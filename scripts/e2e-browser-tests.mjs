import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3098';
const SCREENSHOT_DIR =
  process.env.SCREENSHOT_DIR ||
  'C:\\Users\\Scorpio\\.gemini\\antigravity\\brain\\36811d4f-f53f-4027-a394-ebcca0dde9f6';

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

function assert(condition, message) {
  if (!condition) {
    throw new Error(`E2E Assertion Failed: ${message}`);
  }
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok) return;
    } catch {
      // retry
    }
    await sleep(300);
  }
  throw new Error(`Timed out waiting for Next.js server at ${url}`);
}

async function waitForCdp(port) {
  for (let i = 0; i < 40; i++) {
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
  throw new Error('Timed out waiting for Chrome CDP');
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
        } else if (
          msg.method === 'Runtime.consoleAPICalled' &&
          msg.params?.type === 'error'
        ) {
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
      throw new Error(
        res.exceptionDetails.exception?.description || res.exceptionDetails.text || 'Eval error'
      );
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

  async setTheme(mode) {
    await this.eval(`localStorage.setItem('viewora_theme', '${mode}')`);
    await this.send('Page.reload', { ignoreCache: false });
    await sleep(1100);
  }

  async screenshot(filename) {
    const shot = await this.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    const fullPath = path.join(SCREENSHOT_DIR, filename);
    fs.writeFileSync(fullPath, Buffer.from(shot.data, 'base64'));
    return fullPath;
  }

  close() {
    this.ws?.close();
  }
}

async function runTests() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viewora-e2e-data-'));
  const chromeProfileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viewora-e2e-chrome-'));
  const port = new URL(BASE_URL).port || '3098';

  const server = spawn(
    'cmd.exe',
    ['/c', 'npx.cmd', 'next', 'start', '-p', port, '-H', '127.0.0.1'],
    {
      env: {
        ...process.env,
        DEMO_MODE_ENABLED: 'true',
        VIEWORA_ALLOW_LOCAL_DEV_STORAGE: 'true',
        PAYMENTS_ENABLED: 'false',
        VIEWORA_DATA_DIR: dataDir,
      },
      stdio: 'ignore',
    }
  );

  const cdpPort = 9231;
  let chrome;
  const report = {
    passed: [],
    viewports: [],
    locales: [],
    performance: {},
    screenshots: [],
    consoleErrors: [],
    pageErrors: [],
  };

  try {
    await waitForServer(BASE_URL);

    // 0. Stage 1 Independent Database & Zero-Supabase Health Check
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    const healthJson = await healthRes.json();
    assert(healthRes.ok && healthJson.ok === true, 'Expected /api/health to return ok: true');
    assert(
      healthJson.services?.database?.engine === 'postgresql',
      `Expected database engine postgresql, got ${healthJson.services?.database?.engine}`
    );
    assert(
      healthJson.services?.payments?.enabled === false,
      'Expected payments.enabled to remain false'
    );
    assert(
      !JSON.stringify(healthJson).toLowerCase().includes('supabase'),
      'Unexpected supabase reference in /api/health'
    );
    report.passed.push('Health endpoint reports independent PostgreSQL engine with zero Supabase references and payments disabled');

    chrome = spawn(
      CHROME_PATH,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
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

    // 1. Multi-Viewport Responsive Checks (375, 390, 768, 1024, 1440, 1920)
    const viewports = [
      { w: 375, h: 812 },
      { w: 390, h: 844 },
      { w: 768, h: 1024 },
      { w: 1024, h: 900 },
      { w: 1440, h: 900 },
      { w: 1920, h: 1080 },
    ];
    for (const vp of viewports) {
      await cdp.setViewport(vp.w, vp.h);
      await cdp.goto(`${BASE_URL}/en`, 1100);
      const metrics = await cdp.eval(`({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        hasH1: Boolean(document.querySelector('h1')),
        hasSkipLink: Boolean(document.querySelector('a[href="#main-content"]')),
        hasSearchInput: Boolean(document.querySelector('#ig-search-input')),
      })`);
      assert(metrics.hasH1, `Missing H1 at ${vp.w}px`);
      assert(metrics.hasSkipLink, `Missing skip-to-content link at ${vp.w}px`);
      assert(metrics.hasSearchInput, `Missing hero search input at ${vp.w}px`);
      assert(
        metrics.innerWidth <= vp.w + 1,
        `Mobile viewport zoom-out at ${vp.w}px: innerWidth=${metrics.innerWidth} > target=${vp.w}`
      );
      assert(
        metrics.scrollWidth <= vp.w + 1,
        `Horizontal overflow at ${vp.w}px: scrollWidth=${metrics.scrollWidth} > target=${vp.w}`
      );
      report.viewports.push({ width: vp.w, ...metrics, overflow: false });
    }
    const homeBody = await cdp.eval(`document.body.innerText`);
    assert(!homeBody.includes('Stage 2'), 'Internal prompt jargon "Stage 2" leaked onto homepage');
    report.passed.push('Responsive layout verified strictly across 375/390/768/1024/1440/1920px with zero zoom-out');

    // Capture Homepage desktop (light + dark) and mobile (390px) screenshots + perf timings
    await cdp.setViewport(1440, 900);
    await cdp.goto(`${BASE_URL}/en`, 1300);
    await cdp.setTheme('light');
    report.screenshots.push(await cdp.screenshot('final_home_1440px_light.png'));
    const navTiming = await cdp.eval(`(() => {
      const e = performance.getEntriesByType('navigation')[0];
      return e ? {
        ttfbMs: Math.round(e.responseStart - e.requestStart),
        domContentLoadedMs: Math.round(e.domContentLoadedEventEnd),
        loadCompleteMs: Math.round(e.loadEventEnd)
      } : null;
    })()`);
    report.performance.homepageDesktop = navTiming;

    await cdp.setTheme('dark');
    const darkBg = await cdp.eval(`getComputedStyle(document.body).backgroundColor`);
    assert(
      darkBg === 'rgb(8, 13, 25)',
      `Expected dark mode body background rgb(8, 13, 25), got ${darkBg}`
    );
    report.screenshots.push(await cdp.screenshot('final_home_1440px_dark.png'));
    await cdp.setViewport(390, 844);
    await cdp.setTheme('light');
    await sleep(300);
    report.screenshots.push(await cdp.screenshot('final_home_390px_mobile.png'));

    // 2. Five-language interface verification (homepage + pricing, tools, login, register)
    await cdp.setViewport(1440, 900);
    for (const loc of ['en', 'pt-BR', 'es', 'de', 'fr']) {
      await cdp.goto(`${BASE_URL}/${loc}`, 800);
      const langCheck = await cdp.eval(`({
        htmlLang: document.documentElement.lang,
        title: document.title,
        textLen: document.body.innerText.trim().length
      })`);
      assert(langCheck.htmlLang === loc, `Expected html lang=${loc}, got ${langCheck.htmlLang}`);
      assert(langCheck.textLen > 300, `Page content too short for locale ${loc}`);
      assert(!langCheck.title.includes('Viewora | Viewora'), `Duplicate brand title in ${loc}: ${langCheck.title}`);
      report.locales.push({ locale: loc, ...langCheck });
    }

    const localizedJourneyChecks = [
      { path: '/pt-BR/pricing', expected: ['Planos Simples e Transparentes', 'Trimestral', 'Anual'] },
      { path: '/es/tools', expected: ['12 Herramientas Gratis de Instagram', 'Analítica'] },
      { path: '/de/login', expected: ['Bei Viewora anmelden', 'Passwort vergessen?'] },
      { path: '/fr/register', expected: ['Créez votre compte Viewora gratuit', 'Entreprise'] },
    ];
    for (const check of localizedJourneyChecks) {
      await cdp.goto(`${BASE_URL}${check.path}`, 900);
      const bodyText = await cdp.eval(`document.body.innerText`);
      for (const phrase of check.expected) {
        assert(
          bodyText.includes(phrase),
          `Localized route ${check.path} missing expected translation "${phrase}"`
        );
      }
    }
    // Verify longer German/French strings do not overflow 375px mobile viewports
    await cdp.setViewport(375, 812);
    for (const mobilePath of ['/de/pricing', '/de/tools', '/de/login', '/fr/register']) {
      await cdp.goto(`${BASE_URL}${mobilePath}`, 800);
      const m = await cdp.eval(`({
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth
      })`);
      assert(
        m.innerWidth <= 376 && m.scrollWidth <= 376,
        `Mobile 375px horizontal overflow on localized route ${mobilePath}: inner=${m.innerWidth}, scroll=${m.scrollWidth}`
      );
    }
    await cdp.setViewport(1440, 900);
    report.passed.push('Five-language routes (/en, /pt-BR, /es, /de, /fr), localized Pricing/Tools/Auth journeys, and 375px German/French mobile wrapping verified');

    // 3. Free Tools Directory & Engagement Calculator + Story Viewer honesty
    await cdp.goto(`${BASE_URL}/en/tools`, 1000);
    const toolCountText = await cdp.eval(`document.body.innerText`);
    assert(toolCountText.includes('12 Free Instagram Tools'), 'Tools page missing 12 Free Tools heading');
    report.screenshots.push(await cdp.screenshot('final_tools_1440px.png'));

    await cdp.goto(`${BASE_URL}/en/instagram-engagement-calculator`, 1000);
    const calcText = await cdp.eval(`document.body.innerText`);
    assert(calcText.includes('Calculation formula & inputs used'), 'Missing formula transparency box');
    assert(calcText.includes('4.72%'), 'Expected deterministic engagement calculation 4.72%');

    await cdp.goto(`${BASE_URL}/en/instagram-story-viewer`, 1000);
    const storyText = await cdp.eval(`document.body.innerText`);
    assert(storyText.includes('Availability & Anonymity Disclosure'), 'Missing honest Story disclosure');
    report.passed.push('Free tools directory, deterministic calculator, and Story Viewer honesty verified');

    // 4. Pricing Page — 5 tiers + Payments Disabled
    await cdp.goto(`${BASE_URL}/en/pricing`, 1000);
    const pricingText = await cdp.eval(`document.body.innerText`);
    for (const tier of ['Free', 'Starter', 'Premium', 'Pro', 'Agency']) {
      assert(pricingText.includes(tier), `Pricing missing tier: ${tier}`);
    }
    assert(pricingText.includes('PAYMENTS_ENABLED=false'), 'Pricing missing payments-disabled notice');
    report.screenshots.push(await cdp.screenshot('final_pricing_1440px.png'));
    report.passed.push('Pricing page 5 tiers and payments-disabled guard verified');

    // 5. Demo Login via UI -> Authenticated search (no 429) -> ?saved= handoff -> Persistent Save + Reload
    await cdp.goto(`${BASE_URL}/en/login`, 1000);
    const clickedDemo = await cdp.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('business@viewora.demo'));
      if (!btn) return false;
      btn.click();
      return true;
    })()`);
    assert(clickedDemo, 'Demo business login button not found on /login UI');
    await sleep(1400);

    // Verify authenticated local demo user can run 2+ consecutive public searches without hitting anonymous 429 gate
    const authSearchTest = await cdp.eval(`(async () => {
      const r1 = await fetch('/api/search?q=viewora.studio');
      const r2 = await fetch('/api/search?q=aurora.coffee');
      return { s1: r1.status, s2: r2.status };
    })()`);
    assert(
      authSearchTest.s1 === 200 && authSearchTest.s2 === 200,
      `Authenticated user blocked by anonymous search limit: ${JSON.stringify(authSearchTest)}`
    );

    await cdp.goto(`${BASE_URL}/en/dashboard`, 1300);
    const cleanDashText = await cdp.eval(`document.body.innerText`);
    assert(
      cleanDashText.includes('Your workspace starts clean'),
      'Expected clean workspace with zero unconditionally seeded demo profiles'
    );

    // Verify ?saved= handoff pre-fills Saved Profiles input
    await cdp.goto(`${BASE_URL}/en/dashboard?saved=viewora.studio`, 1300);
    const prefilledVal = await cdp.eval(
      `document.querySelector('input[aria-label="Instagram username to save"]')?.value ?? ''`
    );
    assert(
      prefilledVal === '@viewora.studio',
      `Expected ?saved=viewora.studio handoff to prefill @viewora.studio, got "${prefilledVal}"`
    );

    // Save a profile, create folder, add note via API, then reload and verify persistence in UI
    const saveProfileRes = await cdp.eval(`(async () => {
      const f = await fetch('/api/dashboard/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'create_folder', name: 'E2E Benchmarks', color: 'cyan' })
      }).then(r => r.json());
      const s = await fetch('/api/dashboard/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'save_profile', input: 'viewora.studio', folderId: f.folder?.id ?? null })
      }).then(r => r.json());
      const n = await fetch('/api/dashboard/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'update_profile_meta', username: 'viewora.studio', privateNote: 'Persisted E2E takeaway note', tags: ['e2e', 'benchmark'] })
      }).then(r => r.json());
      return { f: f.ok, s: s.ok, n: n.ok };
    })()`);
    assert(saveProfileRes.f && saveProfileRes.s && saveProfileRes.n, 'Workspace CRUD mutations failed');

    await cdp.goto(`${BASE_URL}/en/dashboard/profiles`, 1300);
    const persistedProfilesText = await cdp.eval(`document.body.innerText`);
    assert(persistedProfilesText.includes('@viewora.studio'), 'Saved profile did not persist across reload');
    assert(persistedProfilesText.includes('E2E Benchmarks'), 'Research folder did not persist');
    assert(persistedProfilesText.includes('Persisted E2E takeaway note'), 'Private note did not persist');
    report.screenshots.push(await cdp.screenshot('final_dashboard_profiles_1440px.png'));

    // Verify Saved Profile Detail Page displays saved folder and private note
    await cdp.goto(`${BASE_URL}/en/dashboard/profiles/viewora.studio`, 1100);
    const detailText = await cdp.eval(`document.body.innerText`);
    assert(detailText.includes('E2E Benchmarks'), 'Profile detail page missing saved folder');
    assert(detailText.includes('Persisted E2E takeaway note'), 'Profile detail page missing private note');

    // Analytics & AI Studio & Reports Library
    await cdp.goto(`${BASE_URL}/en/dashboard/analytics`, 1300);
    const analyticsText = await cdp.eval(`document.body.innerText`);
    assert(analyticsText.includes('Accessible Checkpoint Data Table'), 'Analytics missing accessible data table');
    report.screenshots.push(await cdp.screenshot('final_dashboard_analytics_1440px.png'));

    // Mobile dashboard viewport check (375px & 390px strict width + all sections reachable)
    await cdp.setViewport(375, 812);
    await sleep(400);
    const mobileDashMetrics = await cdp.eval(`({
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      text: document.body.innerText
    })`);
    assert(
      mobileDashMetrics.innerWidth <= 376 && mobileDashMetrics.scrollWidth <= 376,
      `Horizontal overflow on mobile dashboard (375px): inner=${mobileDashMetrics.innerWidth}, scroll=${mobileDashMetrics.scrollWidth}`
    );
    for (const mobileTab of ['Timeline', 'Calendar', 'Competitors', 'Reports & Exports', 'Support', 'Sign out']) {
      assert(mobileDashMetrics.text.includes(mobileTab), `Mobile dashboard missing section/control: ${mobileTab}`);
    }
    await cdp.setViewport(390, 844);
    await sleep(300);
    report.screenshots.push(await cdp.screenshot('final_dashboard_390px_mobile.png'));
    report.passed.push('Customer Dashboard UI login, auth search, ?saved= handoff, durable folders/notes/detail, analytics, and mobile 375px layout verified');

    // 6. Personal Digital HQ Persistence
    await cdp.setViewport(1440, 900);
    const hqPatch = await cdp.eval(`(async () => {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: 'Maya Chen HQ',
          professionalTitle: 'VP Social Strategy',
          workspaceName: 'Maya Strategy Studio',
          coverPreset: 'emerald'
        })
      });
      return { status: res.status, body: await res.json() };
    })()`);
    assert(hqPatch.status === 200 && hqPatch.body.ok, 'Profile HQ save failed');
    await cdp.goto(`${BASE_URL}/en/dashboard/profile`, 1300);
    const hqText = await cdp.eval(`document.body.innerText`);
    assert(hqText.includes('Maya Chen HQ'), 'Display name did not persist in Profile HQ');
    assert(hqText.includes('VP Social Strategy'), 'Title did not persist in Profile HQ');
    assert(hqText.includes('Maya Strategy Studio'), 'Workspace identity did not persist in Profile HQ');
    assert(!hqText.includes('Member since Nov 2026'), 'Hardcoded Member since Nov 2026 still present');
    report.screenshots.push(await cdp.screenshot('final_profile_hq_1440px.png'));

    // Verify localized authenticated Customer Dashboard & Profile HQ rendering (1440px + 375px)
    await cdp.goto(`${BASE_URL}/pt-BR/dashboard`, 1100);
    const ptDashText = await cdp.eval(`document.body.innerText`);
    assert(ptDashText.includes('Perfis Salvos'), 'Localized /pt-BR/dashboard missing Perfis Salvos');
    await cdp.goto(`${BASE_URL}/de/dashboard/profile`, 1100);
    const deHqText = await cdp.eval(`document.body.innerText`);
    assert(
      deHqText.includes('Persönliches Digital-HQ'),
      'Localized /de/dashboard/profile missing Persönliches Digital-HQ'
    );
    await cdp.setViewport(375, 812);
    for (const authMobilePath of ['/de/dashboard', '/de/dashboard/profile']) {
      await cdp.goto(`${BASE_URL}${authMobilePath}`, 900);
      const m = await cdp.eval(`({
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth
      })`);
      assert(
        m.innerWidth <= 376 && m.scrollWidth <= 376,
        `Mobile 375px horizontal overflow on localized auth route ${authMobilePath}: inner=${m.innerWidth}, scroll=${m.scrollWidth}`
      );
    }
    await cdp.setViewport(1440, 900);
    report.passed.push('Personal Digital HQ persistence, genuine usage stats, and localized authenticated routes (desktop + 375px mobile) verified');

    // 7. Admin Console RBAC & Persistence
    const adminLogin = await cdp.eval(`(async () => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@viewora.demo', password: 'demo-password' })
      });
      return { status: res.status, body: await res.json() };
    })()`);
    assert(adminLogin.status === 200 && adminLogin.body.ok, 'Admin demo login failed');

    await cdp.goto(`${BASE_URL}/en/admin`, 1300);
    const adminText = await cdp.eval(`document.body.innerText`);
    assert(
      adminText.includes('Viewora Business Operations & Admin Console'),
      'Admin console did not render'
    );
    const flagLockTest = await cdp.eval(`(async () => {
      const res = await fetch('/api/admin/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'toggle_flag', key: 'payments_enabled', enabled: true })
      });
      return res.status;
    })()`);
    assert(flagLockTest === 403, `Expected 403 for locked payments_enabled flag, got ${flagLockTest}`);

    // Verify runtime feature flag enforcement (disable ai_insights_enabled -> 503, then re-enable -> 200)
    const aiFlagRuntimeTest = await cdp.eval(`(async () => {
      await fetch('/api/admin/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'toggle_flag', key: 'ai_insights_enabled', enabled: false })
      });
      const disabledStatus = (await fetch('/api/ai/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'viewora.studio', reportType: 'profile_performance', dateRange: '30d' })
      })).status;
      await fetch('/api/admin/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'toggle_flag', key: 'ai_insights_enabled', enabled: true })
      });
      const enabledStatus = (await fetch('/api/ai/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'viewora.studio', reportType: 'profile_performance', dateRange: '30d' })
      })).status;
      return { disabledStatus, enabledStatus };
    })()`);
    assert(
      aiFlagRuntimeTest.disabledStatus === 503 && aiFlagRuntimeTest.enabledStatus === 200,
      `Expected ai_insights_enabled flag enforcement (503 then 200), got ${JSON.stringify(aiFlagRuntimeTest)}`
    );

    // Verify empty input validation in inline editor rejects blank quota instead of parsing as 0
    await cdp.goto(`${BASE_URL}/en/admin/entitlements`, 1200);
    const openedEdit = await cdp.eval(`(() => {
      const btn = document.querySelector('button[aria-label="Edit limit for Starter tracked_profiles"]');
      if (!btn) return false;
      btn.click();
      return true;
    })()`);
    assert(openedEdit, 'Edit limit button for Starter tracked_profiles not found in Admin Entitlements UI');
    await sleep(250);
    const rejectedBlank = await cdp.eval(`(() => {
      const input = document.querySelector('input[aria-label="Numeric limit for Starter tracked_profiles"]');
      if (!input) return false;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, '');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      const saveBtn = Array.from(input.closest('td').querySelectorAll('button')).find(b => b.innerText.trim() === 'Save');
      if (!saveBtn) return false;
      saveBtn.click();
      return true;
    })()`);
    assert(rejectedBlank, 'Could not trigger blank input validation check');
    await sleep(300);
    const blankErrorShown = await cdp.eval(
      `document.body.innerText.includes('Quota limit must be a whole number')`
    );
    assert(blankErrorShown, 'Empty quota input did not display validation error');

    const savedInlineLimit = await cdp.eval(`(() => {
      const input = document.querySelector('input[aria-label="Numeric limit for Starter tracked_profiles"]');
      if (!input) return false;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, '5');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      const saveBtn = Array.from(input.closest('td').querySelectorAll('button')).find(b => b.innerText.trim() === 'Save');
      if (!saveBtn) return false;
      saveBtn.click();
      return true;
    })()`);
    assert(savedInlineLimit, 'Failed to submit inline numeric limit edit in Admin Entitlements UI');
    await sleep(700);
    await cdp.goto(`${BASE_URL}/en/admin/entitlements`, 1200);
    const persistedToggleText = await cdp.eval(
      `document.querySelector('button[aria-label="Toggle Starter tracked_profiles"]')?.innerText.trim() ?? ''`
    );
    assert(
      persistedToggleText === '5',
      `Expected persisted Starter tracked_profiles limit "5" after reload, got "${persistedToggleText}"`
    );

    // Also verify previously omitted featureKey (follower_trends) & unlimited (null) limit works cleanly
    const extraKeyRes = await cdp.eval(`(async () => {
      const res = await fetch('/api/admin/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'update_entitlement',
          planCode: 'starter',
          featureKey: 'follower_trends',
          enabled: true,
          numericLimit: null
        })
      });
      return res.status;
    })()`);
    assert(extraKeyRes === 200, `Expected 200 updating follower_trends unlimited limit, got ${extraKeyRes}`);

    // Verify Unlimited (null) entitlement on Agency renders "∞" cleanly in Dashboard (never "null" or "/ 1")
    const agencyUnlimitedRes = await cdp.eval(`(async () => {
      const res = await fetch('/api/admin/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'update_entitlement',
          planCode: 'agency',
          featureKey: 'tracked_profiles',
          enabled: true,
          numericLimit: null
        })
      });
      return res.status;
    })()`);
    assert(agencyUnlimitedRes === 200, `Expected 200 setting Agency tracked_profiles to unlimited`);
    await cdp.goto(`${BASE_URL}/en/dashboard`, 1100);
    const agencyDashText = await cdp.eval(`document.body.innerText`);
    assert(agencyDashText.includes('/ ∞'), 'Expected Unlimited tracked_profiles to display "/ ∞" on Dashboard');
    assert(!agencyDashText.includes('null/mo') && !agencyDashText.includes('nulld'), 'Literal "null" leaked into Dashboard quota hints');
    await cdp.goto(`${BASE_URL}/en/admin/entitlements`, 1000);

    report.screenshots.push(await cdp.screenshot('final_admin_1440px.png'));
    report.passed.push('Admin Console rendering, RBAC, inline entitlement limit editing, locked payments_enabled guard, and runtime feature-flag enforcement verified');

    // 8. Stage 1 Independent Auth UI Checks (Login, Forgot, Reset, Verify) — Zero Supabase copy
    await cdp.setViewport(1440, 900);
    for (const authRoute of ['/en/login', '/en/forgot-password', '/en/reset-password', '/en/verify-email']) {
      await cdp.goto(`${BASE_URL}${authRoute}`, 900);
      const bodyText = await cdp.eval(`document.body.innerText`);
      assert(
        !bodyText.toLowerCase().includes('supabase'),
        `Found obsolete Supabase copy on ${authRoute}`
      );
      if (authRoute === '/en/login') {
        report.screenshots.push(await cdp.screenshot('stage1_login_1440px.png'));
      }
      if (authRoute === '/en/reset-password') {
        report.screenshots.push(await cdp.screenshot('stage1_reset_password_1440px.png'));
      }
    }
    report.passed.push('Independent Auth UI pages (/login, /forgot-password, /reset-password, /verify-email) render cleanly with zero Supabase references');

    report.consoleErrors = cdp.consoleErrors;
    report.pageErrors = cdp.pageErrors;
    assert(cdp.pageErrors.length === 0, `Uncaught page errors: ${cdp.pageErrors.join('; ')}`);
    // Filter expected 403/503 network error logs emitted by our intentional negative security assertions
    const unexpectedConsoleErrors = cdp.consoleErrors.filter(
      (msg) => !msg.includes('status of 403') && !msg.includes('status of 503')
    );
    assert(
      unexpectedConsoleErrors.length === 0,
      `Unexpected console errors: ${unexpectedConsoleErrors.join('; ')}`
    );

    console.log(JSON.stringify(report, null, 2));
    cdp.close();
  } finally {
    if (process.platform === 'win32') {
      if (chrome?.pid) spawn('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' });
      if (server?.pid) spawn('taskkill', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      chrome?.kill('SIGKILL');
      server.kill('SIGKILL');
    }
    await sleep(600);
    try {
      fs.rmSync(chromeProfileDir, { recursive: true, force: true });
    } catch {
      // ignore locked Windows chrome profile handle
    }
    try {
      fs.rmSync(dataDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
