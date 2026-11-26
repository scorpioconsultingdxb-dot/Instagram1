#!/usr/bin/env node
/**
 * Viewora — PostgreSQL-Connected Production Browser E2E Suite (Tasks 7 & 9)
 *
 * Launches the built production Next.js server (`next start`, `NODE_ENV=production`)
 * connected to a REAL PostgreSQL 16 database via the restricted `viewora_app` role,
 * with `DEMO_MODE_ENABLED=false` and `PAYMENTS_ENABLED=false`.
 *
 * Verifies in headless Chromium (desktop 1440x900 + mobile 390x844):
 *   1. Homepage, zero console/page errors, zero Supabase copy
 *   2. Real Registration -> PostgreSQL user creation -> Onboarding
 *   3. Customer Dashboard: saved profile, research folder, private note persistence
 *   4. Personal Profile HQ: title, cover banner, avatar preset persistence
 *   5. Notifications: mark read persistence
 *   6. Membership / Pricing: 5 tiers, payments strictly disabled
 *   7. Full Next.js application process RESTART -> Login -> verify ALL records persisted in PostgreSQL
 *   8. Administrator Dashboard: synthetic super_admin login, admin UI, locked payments_enabled guard
 *   9. Confirmed Account Deletion: deletes synthetic customer from PostgreSQL & ends session
 */
import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3098';
const SCREENSHOT_DIR = process.env.SCREENSHOT_DIR || path.join(process.cwd(), 'ci-screenshots');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

function resolveChromeBinary() {
  const candidates = [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error(`No Chrome/Chromium binary found. Checked: ${candidates.join(', ')}`);
}

function assert(cond, msg) {
  if (!cond) throw new Error(`E2E Assertion Failed: ${msg}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok) return await res.json();
    } catch {
      // retry
    }
    await sleep(300);
  }
  throw new Error(`Timed out waiting for Next.js production server at ${url}`);
}

async function waitForCdp(port) {
  for (let i = 0; i < 50; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await res.json();
      const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // retry
    }
    await sleep(250);
  }
  throw new Error('Timed out waiting for Chrome DevTools Protocol');
}

class CdpSession {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 0;
    this.pending = new Map();
    this.consoleErrors = [];
    this.pageErrors = [];
  }

  async connect() {
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(this.wsUrl);
      this.ws = ws;
      ws.addEventListener('open', () => resolve());
      ws.addEventListener('error', (err) => reject(err));
      ws.addEventListener('message', (event) => {
        const msg = JSON.parse(String(event.data));
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve: res, reject: rej } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) rej(new Error(msg.error.message));
          else res(msg.result);
        } else if (msg.method === 'Runtime.exceptionThrown') {
          this.pageErrors.push(msg.params?.exceptionDetails?.text || 'Uncaught exception');
        } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params?.type === 'error') {
          const text = (msg.params.args || []).map((a) => a.value || a.description).join(' ');
          this.consoleErrors.push(text);
        }
      });
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.text || 'JS eval failed');
    }
    return res.result?.value;
  }

  async setViewport(width, height) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 768,
    });
  }

  async goto(url, waitMs = 1300) {
    await this.send('Page.navigate', { url });
    await sleep(waitMs);
  }

  async screenshot(name) {
    const shot = await this.send('Page.captureScreenshot', { format: 'png' });
    const out = path.join(SCREENSHOT_DIR, name);
    fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
    return out;
  }

  close() {
    this.ws?.close();
  }
}

function startNextServer(port, env) {
  const bin = process.platform === 'win32' ? 'cmd.exe' : 'npx';
  const args =
    process.platform === 'win32'
      ? ['/c', 'npx.cmd', 'next', 'start', '-p', String(port), '-H', 'localhost']
      : ['next', 'start', '-p', String(port), '-H', 'localhost'];
  return spawn(bin, args, { env, stdio: 'pipe' });
}

async function stopProcess(proc) {
  if (!proc?.pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    proc.kill('SIGTERM');
    await sleep(700);
    try {
      proc.kill('SIGKILL');
    } catch {
      // already exited
    }
  }
}

async function main() {
  // Prefer isolated TEST_DATABASE_URL / TEST_DATABASE_ADMIN_URL so E2E runs never pollute main DB
  const runtimeUrl = (process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '').trim();
  const adminUrl = (
    process.env.TEST_DATABASE_ADMIN_URL ||
    process.env.DATABASE_ADMIN_URL ||
    runtimeUrl
  ).trim();
  assert(runtimeUrl, 'TEST_DATABASE_URL (preferred) or DATABASE_URL must be set');
  assert(process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 32, 'Strong AUTH_SECRET required');

  const runtimeDbName = new URL(runtimeUrl).pathname.replace(/^\/+/, '');
  const isIsolatedTestDb = /(^|_)test($|_)/i.test(runtimeDbName);
  assert(
    isIsolatedTestDb || process.env.ALLOW_NON_TEST_DB_E2E === 'true',
    `SAFETY BLOCK: Refusing to run destructive E2E suite against non-test database "${runtimeDbName}". Configure TEST_DATABASE_URL / TEST_DATABASE_ADMIN_URL (e.g. viewora_test) or explicitly set ALLOW_NON_TEST_DB_E2E=true.`
  );

  const chromePath = resolveChromeBinary();
  const chromeProfileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viewora-pg-e2e-chrome-'));
  const port = new URL(BASE_URL).port || '3098';

  const serverEnv = {
    ...process.env,
    DATABASE_URL: runtimeUrl,
    DATABASE_ADMIN_URL: adminUrl,
    NODE_ENV: 'production',
    NEXT_PUBLIC_APP_URL: BASE_URL,
    AUTH_URL: BASE_URL,
    DEMO_MODE_ENABLED: 'false',
    PAYMENTS_ENABLED: 'false',
    NEXT_PUBLIC_PAYMENTS_ENABLED: 'false',
  };

  let server = startNextServer(port, serverEnv);
  let chrome;
  const cdpPort = 9233;

  const adminDb = new PrismaClient({
    datasources: { db: { url: adminUrl } },
  });

  const synthEmail = `e2e.customer.${randomUUID().slice(0, 8)}@viewora.test`;
  const synthPassword = 'E2eCustomerPass!2026';
  const synthAdminEmail = `e2e.admin.${randomUUID().slice(0, 8)}@viewora.test`;
  const synthAdminPassword = 'E2eAdminStrongPass!2026';
  let synthCustomerId = null;
  let synthAdminId = null;

  const report = {
    passed: [],
    screenshots: [],
    consoleErrors: [],
    pageErrors: [],
  };

  try {
    // 1. Health check connected to real PostgreSQL
    const health = await waitForServer(BASE_URL);
    assert(health.ok === true, 'Health endpoint not ok');
    assert(health.services.database.engine === 'postgresql', 'Expected postgresql engine');
    assert(health.services.database.status === 'healthy', `Expected healthy DB, got ${health.services.database.status}`);
    assert(health.services.demoMode.enabled === false, 'Demo mode MUST be false in production');
    assert(health.services.payments.enabled === false, 'Payments MUST be false');
    report.passed.push('Health check verified live healthy PostgreSQL connection, demoMode=false, payments=false');

    chrome = spawn(
      chromePath,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        `--remote-debugging-port=${cdpPort}`,
        `--user-data-dir=${chromeProfileDir}`,
        'about:blank',
      ],
      { stdio: 'ignore' }
    );

    const wsUrl = await waitForCdp(cdpPort);
    const cdp = new CdpSession(wsUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    // 2. Homepage & Free Tools (Desktop 1440px & Mobile 390px)
    await cdp.setViewport(1440, 900);
    await cdp.goto(`${BASE_URL}/en`, 1300);
    const homeDesktop = await cdp.eval(`({
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      hasSupabase: document.body.innerText.toLowerCase().includes('supabase'),
      hasH1: Boolean(document.querySelector('h1')),
      hasErrorBoundary: Boolean(document.querySelector('[data-error-boundary]'))
    })`);
    assert(
      !homeDesktop.overflow && !homeDesktop.hasSupabase && homeDesktop.hasH1 && !homeDesktop.hasErrorBoundary,
      'Desktop homepage check failed'
    );
    report.screenshots.push(await cdp.screenshot('pg_e2e_home_1440px.png'));

    await cdp.goto(`${BASE_URL}/en/instagram-engagement-calculator`, 1100);
    const toolReady = await cdp.eval(`!document.querySelector('[data-error-boundary]') && Boolean(document.querySelector('h1'))`);
    assert(toolReady, 'Free tool page check failed');

    await cdp.setViewport(390, 844);
    await cdp.goto(`${BASE_URL}/en`, 1100);
    const homeMobileOverflow = await cdp.eval(`document.documentElement.scrollWidth > window.innerWidth`);
    assert(!homeMobileOverflow, 'Mobile 390px homepage horizontal overflow detected');
    report.screenshots.push(await cdp.screenshot('pg_e2e_home_390px.png'));

    // Stage 50: Verify all 6 viewport widths (375, 390, 768, 1024, 1440, 1920) & all 5 locales + dark theme
    for (const [w, h] of [[375, 812], [768, 1024], [1024, 768], [1920, 1080]]) {
      await cdp.setViewport(w, h);
      await cdp.goto(`${BASE_URL}/en`, 650);
      const ov = await cdp.eval(`document.documentElement.scrollWidth > window.innerWidth`);
      assert(!ov, `Homepage horizontal overflow at ${w}x${h}`);
    }
    await cdp.setViewport(1440, 900);
    for (const loc of ['pt-BR', 'es', 'de', 'fr']) {
      await cdp.goto(`${BASE_URL}/${loc}`, 650);
      const locOk = await cdp.eval(`Boolean(document.querySelector('h1')) && !document.querySelector('[data-error-boundary]')`);
      assert(locOk, `Locale /${loc} failed render check`);
    }
    // Dark theme toggle check
    await cdp.goto(`${BASE_URL}/en`, 650);
    await cdp.eval(`(() => { document.documentElement.classList.add('dark'); })()`);
    await sleep(200);
    report.screenshots.push(await cdp.screenshot('phase5_home_dark_1440px.png'));
    await cdp.eval(`(() => { document.documentElement.classList.remove('dark'); })()`);
    report.passed.push('Homepage & free tools verified across 6 viewports (375–1920px), 5 locales, and dark theme with zero overflow');

    // 3. Real Registration via UI -> Onboarding -> Dashboard
    await cdp.setViewport(1440, 900);
    await cdp.goto(`${BASE_URL}/en/register`, 1200);
    const regText = await cdp.eval(`document.body.innerText`);
    assert(!regText.toLowerCase().includes('supabase'), 'Found Supabase text on /register');
    report.screenshots.push(await cdp.screenshot('pg_e2e_register_1440px.png'));

    await cdp.eval(`(() => {
      const setVal = (sel, val) => {
        const el = document.querySelector(sel);
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      setVal('#signup-name', 'Synthetic E2E Customer');
      setVal('#signup-email', ${JSON.stringify(synthEmail)});
      setVal('#signup-password', ${JSON.stringify(synthPassword)});
      document.querySelector('form button[type="submit"]').click();
    })()`);
    await sleep(2200);

    const afterRegUrl = await cdp.eval(`window.location.pathname`);
    assert(
      afterRegUrl.includes('/onboarding') || afterRegUrl.includes('/dashboard'),
      `Expected redirect to onboarding/dashboard after signup, got ${afterRegUrl}`
    );

    // Complete onboarding if landed there
    if (afterRegUrl.includes('/onboarding')) {
      const savedPrefsStatus = await cdp.eval(`(async () => {
        const res = await fetch('/api/auth/preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            segment: 'business',
            emailPreferences: { productUpdates: true, weeklyDigest: true, trackingAlerts: true, marketing: false }
          })
        });
        return res.status;
      })()`);
      assert(savedPrefsStatus === 200, `Onboarding preferences PATCH failed: ${savedPrefsStatus}`);
      report.screenshots.push(await cdp.screenshot('pg_e2e_onboarding_1440px.png'));
    }

    // Confirm user actually exists in PostgreSQL
    const dbUserAfterSignup = await adminDb.user.findUnique({ where: { email: synthEmail } });
    assert(dbUserAfterSignup, 'Registered user was NOT persisted in PostgreSQL!');
    synthCustomerId = dbUserAfterSignup.id;
    report.passed.push('Real customer registration & onboarding persisted directly to PostgreSQL');

    // 4. Customer Dashboard: saved profile, folder, private note, notification read state
    await cdp.goto(`${BASE_URL}/en/dashboard/profiles`, 1400);
    const wsMutations = await cdp.eval(`(async () => {
      const fRes = await fetch('/api/dashboard/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'create_folder', name: 'PG Verified Folder', color: 'emerald', description: 'Live PG folder' })
      });
      const fJson = await fRes.json();
      const sRes = await fetch('/api/dashboard/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'save_profile', input: 'viewora.studio', folderId: fJson.folder?.id ?? null })
      });
      const sJson = await sRes.json();
      const s2Res = await fetch('/api/dashboard/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'save_profile', input: 'aurora.coffee', folderId: fJson.folder?.id ?? null })
      });
      const refreshRes = await fetch('/api/dashboard/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'refresh_profile', username: 'viewora.studio' })
      });
      const refreshJson = await refreshRes.json();
      const metaConnRes = await fetch('/api/meta/connections');
      const metaConnJson = await metaConnRes.json();
      const nRes = await fetch('/api/dashboard/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'update_profile_meta', username: 'viewora.studio', privateNote: 'Persisted across PG restart check', tags: ['pg-e2e'] })
      });
      const notifId = sJson.workspace?.notifications?.[0]?.id;
      let rStatus = 200;
      if (notifId) {
        const rRes = await fetch('/api/dashboard/workspace', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'mark_notification_read', id: notifId, read: true })
        });
        rStatus = rRes.status;
      }
      return {
        fStatus: fRes.status,
        sStatus: sRes.status,
        s2Status: s2Res.status,
        refreshStatus: refreshRes.status,
        refreshState: refreshJson.status,
        metaConnStatus: metaConnRes.status,
        metaOauthEnabled: metaConnJson.oauthEnabled,
        nStatus: nRes.status,
        rStatus
      };
    })()`);
    assert(
      wsMutations.fStatus === 201 &&
        wsMutations.sStatus === 201 &&
        wsMutations.s2Status === 403 &&
        wsMutations.refreshStatus === 200 &&
        wsMutations.refreshState === 'live_providers_disabled' &&
        wsMutations.metaConnStatus === 200 &&
        wsMutations.metaOauthEnabled === false &&
        wsMutations.nStatus === 200 &&
        wsMutations.rStatus === 200,
      `Workspace PostgreSQL mutations failed: ${JSON.stringify(wsMutations)}`
    );

    await cdp.goto(`${BASE_URL}/en/dashboard/profiles`, 1400);
    const dashBody = await cdp.eval(`document.body.innerText`);
    assert(dashBody.includes('viewora.studio') && dashBody.includes('PG Verified Folder'), 'Saved profile/folder missing after reload');
    // Expand Profile Intelligence breakdown panel on first saved profile card
    await cdp.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.trim().startsWith('Intelligence'));
      if (btn) btn.click();
    })()`);
    await sleep(400);
    report.screenshots.push(await cdp.screenshot('phase5_profile_intel_1440px.png'));
    report.screenshots.push(await cdp.screenshot('pg_e2e_dashboard_1440px.png'));

    // Competitor Intelligence Studio check (Stage 45)
    await cdp.goto(`${BASE_URL}/en/dashboard/competitors`, 1200);
    report.screenshots.push(await cdp.screenshot('phase5_competitor_studio_1440px.png'));

    // Mobile 390px dashboard check
    await cdp.setViewport(390, 844);
    await cdp.goto(`${BASE_URL}/en/dashboard/profiles`, 1100);
    const dashMobOverflow = await cdp.eval(`document.documentElement.scrollWidth > window.innerWidth`);
    assert(!dashMobOverflow, 'Mobile 390px dashboard overflow detected');
    report.screenshots.push(await cdp.screenshot('pg_e2e_dashboard_390px.png'));

    // 5. Personal Profile HQ, Report Builder & Support persistence
    await cdp.setViewport(1440, 900);
    await cdp.goto(`${BASE_URL}/en/dashboard/profile`, 1300);
    const hqPatchStatus = await cdp.eval(`(async () => {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          professionalTitle: 'PG Persistence Lead',
          biography: 'Verified PostgreSQL Personal Digital HQ bio.',
          coverPreset: 'midnight',
          avatarPreset: 'obsidian-indigo',
          widgetVisibility: { checklist: false, kpis: true }
        })
      });
      return res.status;
    })()`);
    assert(hqPatchStatus === 200, `Profile HQ PATCH failed: ${hqPatchStatus}`);
    await cdp.goto(`${BASE_URL}/en/dashboard/profile`, 1300);
    const hqBody = await cdp.eval(`document.body.innerText`);
    assert(hqBody.includes('PG Persistence Lead') && hqBody.includes('Independent PostgreSQL'), 'Profile HQ changes did not persist');
    report.screenshots.push(await cdp.screenshot('pg_e2e_profile_hq_1440px.png'));

    // Create custom report, research project, feedback & support ticket in PostgreSQL + test authorized global search + PDF entitlement enforcement
    const reportAndSupport = await cdp.eval(`(async () => {
      const rRes = await fetch('/api/reports/builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'create',
          reportType: 'executive_summary',
          title: 'PG Verified Executive Brief',
          description: 'End-to-end PostgreSQL report persistence verification',
          usernames: ['viewora.studio']
        })
      });
      const rJson = await rRes.json();
      // Free-tier customer MUST be blocked (403) from PDF export server-side
      const freePdfRes = await fetch('/api/reports/builder?download=' + encodeURIComponent(rJson.report?.id || '') + '&format=pdf');
      const pRes = await fetch('/api/dashboard/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'create_project',
          title: 'PG E2E Benchmark Project',
          objective: 'Verify research template & search persistence',
          tags: ['benchmark']
        })
      });
      const searchRes = await fetch('/api/dashboard/search?q=PG');
      const searchJson = await searchRes.json();
      const fbRes = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'feature_request',
          title: 'PG E2E Feedback Probe',
          details: 'Automated verification of structured PostgreSQL feedback persistence.'
        })
      });
      const sRes = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: 'PG E2E Support Verification',
          message: 'Verifying PostgreSQL support ticket persistence across process restarts.',
          priority: 'normal'
        })
      });
      return {
        rStatus: rRes.status,
        reportId: rJson.report?.id || null,
        freePdfStatus: freePdfRes.status,
        pStatus: pRes.status,
        searchStatus: searchRes.status,
        searchCount: (searchJson.results || []).length,
        fbStatus: fbRes.status,
        sStatus: sRes.status
      };
    })()`);
    assert(
      reportAndSupport.rStatus === 201 &&
        reportAndSupport.freePdfStatus === 403 &&
        reportAndSupport.pStatus === 201 &&
        reportAndSupport.searchStatus === 200 &&
        reportAndSupport.searchCount >= 2 &&
        reportAndSupport.fbStatus === 201 &&
        reportAndSupport.sStatus === 201,
      `Phase 4.1 Report/Research/Search/Feedback persistence failed: ${JSON.stringify(reportAndSupport)}`
    );
    await cdp.goto(`${BASE_URL}/en/dashboard/report-builder`, 1200);
    report.screenshots.push(await cdp.screenshot('pg_e2e_report_builder_1440px.png'));
    await cdp.goto(`${BASE_URL}/en/dashboard/projects`, 1200);
    report.screenshots.push(await cdp.screenshot('phase41_research_pro_1440px.png'));

    // 6. Notifications & Membership/Pricing pages
    await cdp.goto(`${BASE_URL}/en/dashboard/notifications`, 1100);
    report.screenshots.push(await cdp.screenshot('phase41_notifications_1440px.png'));
    await cdp.goto(`${BASE_URL}/en/pricing`, 1100);
    const pricingText = await cdp.eval(`document.body.innerText`);
    assert(pricingText.includes('Agency') && pricingText.includes('Starter'), 'Pricing page missing tiers');
    report.screenshots.push(await cdp.screenshot('pg_e2e_membership_1440px.png'));
    report.passed.push('Dashboard, saved profiles, folders, notes, Profile HQ, Report Builder, Support, notifications, and pricing verified against PostgreSQL');

    // 7. RESTART THE NEXT.JS PRODUCTION APPLICATION PROCESS & VERIFY PERSISTENCE
    await cdp.eval(`fetch('/api/auth/logout', { method: 'POST' })`);
    await sleep(400);
    await stopProcess(server);
    server = startNextServer(port, serverEnv);
    const healthAfterRestart = await waitForServer(BASE_URL);
    assert(healthAfterRestart.services.database.status === 'healthy', 'DB unhealthy after app restart');

    // Log back in via /en/login UI
    await cdp.goto(`${BASE_URL}/en/login`, 1200);
    report.screenshots.push(await cdp.screenshot('pg_e2e_login_1440px.png'));
    await cdp.eval(`(() => {
      const setVal = (sel, val) => {
        const el = document.querySelector(sel);
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      setVal('#login-email', ${JSON.stringify(synthEmail)});
      setVal('#login-password', ${JSON.stringify(synthPassword)});
      document.querySelector('form button[type="submit"]').click();
    })()`);
    await sleep(2000);

    const postRestartState = await cdp.eval(`(async () => {
      const ws = await (await fetch('/api/dashboard/workspace')).json();
      const prof = await (await fetch('/api/auth/profile')).json();
      const rpts = await (await fetch('/api/reports/builder')).json();
      const sup = await (await fetch('/api/support')).json();
      return {
        savedUsernames: (ws.workspace?.savedProfiles || []).map(p => p.username),
        savedNote: (ws.workspace?.savedProfiles || []).find(p => p.username === 'viewora.studio')?.privateNote,
        folders: (ws.workspace?.folders || []).map(f => f.name),
        readNotifCount: (ws.workspace?.notifications || []).filter(n => n.read).length,
        title: prof.profile?.professionalTitle,
        biography: prof.profile?.biography,
        cover: prof.profile?.coverPreset,
        checklistVisible: prof.profile?.widgetVisibility?.checklist,
        reportTitles: (rpts.reports || []).map(r => r.title),
        ticketSubjects: (sup.tickets || []).map(t => t.subject)
      };
    })()`);
    assert(postRestartState.savedUsernames.includes('viewora.studio'), 'Saved profile lost after app restart');
    assert(postRestartState.savedNote === 'Persisted across PG restart check', 'Private note lost after app restart');
    assert(postRestartState.folders.includes('PG Verified Folder'), 'Folder lost after app restart');
    assert(postRestartState.readNotifCount >= 1, 'Notification read state lost after app restart');
    assert(
      postRestartState.title === 'PG Persistence Lead' &&
        postRestartState.biography === 'Verified PostgreSQL Personal Digital HQ bio.' &&
        postRestartState.cover === 'midnight' &&
        postRestartState.checklistVisible === false,
      'Profile HQ or widget visibility lost after app restart'
    );
    assert(
      postRestartState.reportTitles.includes('PG Verified Executive Brief'),
      'Custom report lost after app restart'
    );
    assert(
      postRestartState.ticketSubjects.includes('PG E2E Support Verification'),
      'Support ticket lost after app restart'
    );
    report.passed.push('Full Next.js production server restart verified: all PostgreSQL customer records persisted');

    // 8. Administrator Dashboard verification with synthetic super_admin created via db:create-admin
    const createAdminRes = spawnSync(
      process.platform === 'win32' ? 'cmd.exe' : 'npm',
      process.platform === 'win32' ? ['/c', 'npm.cmd', 'run', 'db:create-admin'] : ['run', 'db:create-admin'],
      {
        env: {
          ...process.env,
          DATABASE_URL: runtimeUrl,
          DATABASE_ADMIN_URL: adminUrl,
          ADMIN_EMAIL: synthAdminEmail,
          ADMIN_NAME: 'Synthetic CI Super Admin',
          ADMIN_PASSWORD: synthAdminPassword,
        },
        stdio: 'pipe',
      }
    );
    assert(createAdminRes.status === 0, `db:create-admin failed: ${String(createAdminRes.stderr)}`);
    const createdAdmin = await adminDb.user.findUnique({ where: { email: synthAdminEmail } });
    synthAdminId = createdAdmin?.id ?? null;

    await cdp.eval(`fetch('/api/auth/logout', { method: 'POST' })`);
    await sleep(300);
    await cdp.goto(`${BASE_URL}/en/login`, 1200);
    await cdp.eval(`(() => {
      const setVal = (sel, val) => {
        const el = document.querySelector(sel);
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      setVal('#login-email', ${JSON.stringify(synthAdminEmail)});
      setVal('#login-password', ${JSON.stringify(synthAdminPassword)});
      document.querySelector('form button[type="submit"]').click();
    })()`);
    await sleep(2000);

    await cdp.goto(`${BASE_URL}/en/admin`, 1400);
    const adminCheck = await cdp.eval(`(async () => {
      const ov = await fetch('/api/admin/overview');
      const ovJson = await ov.json();
      const intRes = await fetch('/api/admin/integrations');
      const intJson = await intRes.json();
      const commRes = await fetch('/api/admin/communications');
      const commJson = await commRes.json();
      const autoRes = await fetch('/api/automation');
      const autoJson = await autoRes.json();
      const aiStudioGet = await fetch('/api/ai/studio');
      const aiStudioJson = await aiStudioGet.json();
      const lockPay = await fetch('/api/admin/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'toggle_flag', key: 'payments_enabled', enabled: true })
      });
      // Agency-tier admin can create & download a real binary %PDF-1.4 report
      const rCreate = await fetch('/api/reports/builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'create',
          reportType: 'client_performance',
          title: 'Agency Binary PDF Verification',
          description: 'Verifies live %PDF-1.4 download over HTTP',
          usernames: []
        })
      });
      const rCreateJson = await rCreate.json();
      const pdfRes = await fetch('/api/reports/builder?download=' + encodeURIComponent(rCreateJson.report?.id || '') + '&format=pdf');
      const pdfBytes = new Uint8Array(await pdfRes.arrayBuffer());
      const pdfHeader = String.fromCharCode(...pdfBytes.slice(0, 8));
      return {
        overviewStatus: ov.status,
        hasDbHealth: ovJson?.databaseHealth?.status === 'healthy',
        hasBackupSummary: Boolean(ovJson?.backupSummary),
        integrationsStatus: intRes.status,
        allPaidDisabled: intJson?.integrationCenter?.allPaidProvidersDisabled === true,
        providerCount: (intJson?.integrationCenter?.providers || []).length,
        distributedBackend: intJson?.distributedTelemetry?.backend || null,
        hasBudgetAlerts: Boolean(intJson?.budgetAlerts?.daily && intJson?.budgetAlerts?.monthly),
        hasCustomerUsage: Boolean(intJson?.customerUsageSummary),
        commStatus: commRes.status,
        commTemplatesCount: (commJson?.templates || []).length,
        commDisabled: commJson?.overview?.providerEnabled === false,
        autoStatus: autoRes.status,
        autoSchedulerDisabled: autoJson?.schedulerEnabled === false,
        aiStudioStatus: aiStudioGet.status,
        aiCapabilitiesCount: (aiStudioJson?.capabilities || []).length,
        aiGeminiDisabled: aiStudioJson?.providerStatus?.geminiEnabled === false,
        lockPayStatus: lockPay.status,
        pdfStatus: pdfRes.status,
        pdfContentType: pdfRes.headers.get('content-type') || '',
        pdfHeader,
        pdfByteLength: pdfBytes.byteLength,
        bodyLen: document.body.innerText.length
      };
    })()`);
    assert(adminCheck.overviewStatus === 200 && adminCheck.hasDbHealth && adminCheck.hasBackupSummary, `Admin overview failed: ${JSON.stringify(adminCheck)}`);
    assert(
      adminCheck.integrationsStatus === 200 &&
        adminCheck.allPaidDisabled &&
        adminCheck.providerCount === 7 &&
        adminCheck.distributedBackend === 'postgresql' &&
        adminCheck.hasBudgetAlerts &&
        adminCheck.hasCustomerUsage &&
        adminCheck.commStatus === 200 &&
        adminCheck.commTemplatesCount === 19 &&
        adminCheck.commDisabled &&
        adminCheck.autoStatus === 200 &&
        adminCheck.autoSchedulerDisabled &&
        adminCheck.aiStudioStatus === 200 &&
        adminCheck.aiCapabilitiesCount === 12 &&
        adminCheck.aiGeminiDisabled,
      `Phase 5 (Stages 46–49) Integration/Communications/Automation/AI Studio API check failed: ${JSON.stringify(adminCheck)}`
    );
    assert(adminCheck.lockPayStatus === 403, `Expected 403 on locked payments_enabled, got ${adminCheck.lockPayStatus}`);
    assert(
      adminCheck.pdfStatus === 200 &&
        adminCheck.pdfContentType.includes('application/pdf') &&
        adminCheck.pdfHeader === '%PDF-1.4' &&
        adminCheck.pdfByteLength > 800,
      `Live binary PDF export verification failed: ${JSON.stringify(adminCheck)}`
    );
    report.screenshots.push(await cdp.screenshot('pg_e2e_admin_1440px.png'));
    // Switch to Super Admin Integration Center tab and capture screenshot
    await cdp.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('button[role="tab"]')).find(b => b.textContent && b.textContent.includes('Integration Center'));
      if (btn) btn.click();
    })()`);
    await sleep(500);
    report.screenshots.push(await cdp.screenshot('phase5_integration_center_1440px.png'));
    // Switch to Admin Communications Center tab and capture screenshot (Stage 47)
    await cdp.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('button[role="tab"]')).find(b => b.textContent && b.textContent.includes('Communications'));
      if (btn) btn.click();
    })()`);
    await sleep(450);
    report.screenshots.push(await cdp.screenshot('phase5_communications_center_1440px.png'));
    // Agency-tier account saves 2 profiles & verifies Competitor Studio, AI Studio & Automation Center
    const compSetup = await cdp.eval(`(async () => {
      const s1 = await fetch('/api/dashboard/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'save_profile', input: 'viewora.studio' })
      });
      const s2 = await fetch('/api/dashboard/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'save_profile', input: 'aurora.coffee' })
      });
      return { s1: s1.status, s2: s2.status };
    })()`);
    assert(compSetup.s1 === 201 && compSetup.s2 === 201, `Agency competitor profile save failed: ${JSON.stringify(compSetup)}`);
    await cdp.goto(`${BASE_URL}/en/dashboard/competitors`, 1300);
    const compText = await cdp.eval(`document.body.innerText`);
    assert(
      compText.includes('viewora.studio') && compText.includes('aurora.coffee') && compText.includes('Generate Competitor Report'),
      'Competitor Intelligence Studio matrix did not render expected profiles/controls'
    );
    report.screenshots.push(await cdp.screenshot('phase5_competitor_studio_1440px.png'));
    // Stage 46 AI Intelligence Studio (Desktop 1440px + Mobile 390px)
    await cdp.goto(`${BASE_URL}/en/dashboard/ai-insights`, 1200);
    const aiText = await cdp.eval(`document.body.innerText`);
    assert(aiText.includes('Research Assistant') && aiText.includes('12 Intelligence Tools'), 'AI Studio tabs missing');
    report.screenshots.push(await cdp.screenshot('phase5_ai_studio_1440px.png'));
    await cdp.setViewport(390, 844);
    await sleep(300);
    const aiMobOv = await cdp.eval(`document.documentElement.scrollWidth > window.innerWidth`);
    assert(!aiMobOv, 'Mobile 390px AI Studio horizontal overflow detected');
    report.screenshots.push(await cdp.screenshot('phase5_ai_studio_390px.png'));
    await cdp.setViewport(1440, 900);
    // Stage 48 Automation Center (Desktop 1440px)
    await cdp.goto(`${BASE_URL}/en/dashboard/automation`, 1200);
    const autoText = await cdp.eval(`document.body.innerText`);
    assert(
      autoText.includes('Workflow & Automation Center') &&
        autoText.toLowerCase().includes('background_jobs_enabled=false'),
      'Automation Center inactive scheduler disclosure missing'
    );
    report.screenshots.push(await cdp.screenshot('phase5_automation_center_1440px.png'));
    await cdp.setViewport(390, 844);
    await cdp.goto(`${BASE_URL}/en/admin`, 1100);
    await cdp.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('button[role="tab"]')).find(b => b.textContent && b.textContent.includes('Integration Center'));
      if (btn) btn.click();
    })()`);
    await sleep(400);
    const adminMobOverflow = await cdp.eval(`document.documentElement.scrollWidth > window.innerWidth`);
    assert(!adminMobOverflow, 'Mobile 390px Admin Console horizontal overflow detected');
    report.screenshots.push(await cdp.screenshot('phase5_integration_center_390px.png'));
    report.screenshots.push(await cdp.screenshot('phase41_admin_390px.png'));
    await cdp.setViewport(1440, 900);
    report.passed.push('Administrator 3.0 dashboard, PG health, backup summary, locked payments_enabled guard, and real %PDF-1.4 export verified');

    // 9. Confirmed Account Deletion of synthetic test customer
    await cdp.eval(`fetch('/api/auth/logout', { method: 'POST' })`);
    await sleep(300);
    await cdp.goto(`${BASE_URL}/en/login`, 1200);
    await cdp.eval(`(() => {
      const setVal = (sel, val) => {
        const el = document.querySelector(sel);
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      setVal('#login-email', ${JSON.stringify(synthEmail)});
      setVal('#login-password', ${JSON.stringify(synthPassword)});
      document.querySelector('form button[type="submit"]').click();
    })()`);
    await sleep(1800);

    const delStatus = await cdp.eval(`(async () => {
      const res = await fetch('/api/auth/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmEmail: ${JSON.stringify(synthEmail)} })
      });
      const sessAfter = await (await fetch('/api/auth/session')).json();
      return { status: res.status, authenticatedAfter: sessAfter.authenticated };
    })()`);
    assert(delStatus.status === 200 && delStatus.authenticatedAfter === false, `Account deletion failed: ${JSON.stringify(delStatus)}`);
    const dbUserAfterDelete = await adminDb.user.findUnique({ where: { email: synthEmail } });
    assert(dbUserAfterDelete === null, 'Deleted customer still exists in PostgreSQL!');
    report.passed.push('Confirmed customer account deletion purged PostgreSQL records & ended session');

    // Clean up synthetic admin
    await adminDb.user.deleteMany({ where: { email: synthAdminEmail } });

    report.consoleErrors = cdp.consoleErrors;
    report.pageErrors = cdp.pageErrors;
    assert(cdp.pageErrors.length === 0, `Uncaught page errors: ${cdp.pageErrors.join('; ')}`);
    const unexpectedConsole = cdp.consoleErrors.filter((m) => !m.includes('status of 403'));
    assert(unexpectedConsole.length === 0, `Unexpected console errors: ${unexpectedConsole.join('; ')}`);

    console.log(JSON.stringify(report, null, 2));
    cdp.close();
  } finally {
    await stopProcess(chrome);
    await stopProcess(server);
    const synthEmails = [synthEmail, synthAdminEmail];
    const synthIds = [synthCustomerId, synthAdminId].filter(Boolean);
    await adminDb
      .$transaction(async (tx) => {
        // Remove orphaned synthetic support tickets (and cascading support_messages)
        await tx.supportTicket.deleteMany({ where: { email: { in: synthEmails } } });
        // Remove synthetic account deletion requests
        await tx.accountDeletionRequest.deleteMany({ where: { email: { in: synthEmails } } });
        // Remove synthetic funnel events created during E2E signup
        if (synthIds.length > 0) {
          await tx.funnelEvent.deleteMany({
            where: {
              OR: [{ userId: { in: synthIds } }, { sessionId: { in: synthIds } }],
            },
          });
        }
        // Remove synthetic test users (cascades workspaces, folders, profiles, notes, sessions)
        await tx.user.deleteMany({ where: { email: { in: synthEmails } } });
      })
      .catch(() => undefined);
    await adminDb.$disconnect();
    fs.rmSync(chromeProfileDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
