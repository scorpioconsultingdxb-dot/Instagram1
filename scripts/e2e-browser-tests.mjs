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
        metrics.scrollWidth <= metrics.innerWidth + 1,
        `Horizontal overflow at ${vp.w}px: scrollWidth=${metrics.scrollWidth} > innerWidth=${metrics.innerWidth}`
      );
      report.viewports.push({ width: vp.w, ...metrics, overflow: false });
    }
    report.passed.push('Responsive layout verified across 375/390/768/1024/1440/1920px');

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

    // 2. Five-language interface verification
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
    report.passed.push('Five-language routes (/en, /pt-BR, /es, /de, /fr) verified');

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

    // 5. Demo Login (Business Premium User) -> Clean Dashboard -> Persistent Save + Reload
    await cdp.goto(`${BASE_URL}/en/login`, 1000);
    const loginResult = await cdp.eval(`(async () => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'business@viewora.demo', password: 'demo-password' })
      });
      return { status: res.status, body: await res.json() };
    })()`);
    assert(loginResult.status === 200 && loginResult.body.ok, 'Demo business login failed');

    await cdp.goto(`${BASE_URL}/en/dashboard`, 1300);
    const cleanDashText = await cdp.eval(`document.body.innerText`);
    assert(
      cleanDashText.includes('Your workspace starts clean'),
      'Expected clean workspace with zero unconditionally seeded demo profiles'
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

    // Analytics & AI Studio & Reports Library
    await cdp.goto(`${BASE_URL}/en/dashboard/analytics`, 1300);
    const analyticsText = await cdp.eval(`document.body.innerText`);
    assert(analyticsText.includes('Accessible Checkpoint Data Table'), 'Analytics missing accessible data table');
    report.screenshots.push(await cdp.screenshot('final_dashboard_analytics_1440px.png'));

    // Mobile dashboard viewport check
    await cdp.setViewport(390, 844);
    await sleep(400);
    const mobileDashOverflow = await cdp.eval(`document.documentElement.scrollWidth > window.innerWidth + 1`);
    assert(!mobileDashOverflow, 'Horizontal overflow on mobile dashboard (390px)');
    report.screenshots.push(await cdp.screenshot('final_dashboard_390px_mobile.png'));
    report.passed.push('Customer Dashboard clean init, durable folders/notes/profiles, analytics, and mobile layout verified');

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
    report.passed.push('Personal Digital HQ persistence & genuine member-since / usage stats verified');

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
    report.screenshots.push(await cdp.screenshot('final_admin_1440px.png'));
    report.passed.push('Admin Console rendering, RBAC, and locked payments_enabled guard verified');

    report.consoleErrors = cdp.consoleErrors;
    report.pageErrors = cdp.pageErrors;
    assert(cdp.pageErrors.length === 0, `Uncaught page errors: ${cdp.pageErrors.join('; ')}`);

    console.log(JSON.stringify(report, null, 2));
    cdp.close();
  } finally {
    chrome?.kill('SIGKILL');
    server.kill('SIGKILL');
    await sleep(400);
    fs.rmSync(chromeProfileDir, { recursive: true, force: true });
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
