import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT_DIR =
  process.env.SCREENSHOT_DIR ||
  'C:\\Users\\Scorpio\\.gemini\\antigravity\\brain\\36811d4f-f53f-4027-a394-ebcca0dde9f6';
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3099';
const PREFIX = process.env.SCREENSHOT_PREFIX || 'baseline';

fs.mkdirSync(OUT_DIR, { recursive: true });

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function waitForCdp(port) {
  for (let i = 0; i < 40; i++) {
    try {
      const targets = await fetchJson(`http://127.0.0.1:${port}/json/list`);
      const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // retry
    }
    await sleep(250);
  }
  throw new Error('Timed out waiting for Chrome DevTools Protocol');
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 0;
    this.pending = new Map();
    this.events = [];
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
        } else if (msg.method) {
          this.events.push(msg);
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

  close() {
    this.ws?.close();
  }
}

async function capturePage(cdp, name, url, width, height, darkMode = false) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 768,
  });
  await cdp.send('Page.navigate', { url });
  await sleep(1600);

  if (darkMode) {
    await cdp.eval(`
      localStorage.setItem('viewora_theme', 'dark');
      document.documentElement.classList.add('dark');
    `);
    await sleep(300);
  } else {
    await cdp.eval(`
      localStorage.setItem('viewora_theme', 'light');
      document.documentElement.classList.remove('dark');
    `);
    await sleep(300);
  }

  const metrics = await cdp.eval(`({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    overflow: document.documentElement.scrollWidth > window.innerWidth,
    title: document.title,
  })`);

  const shot = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  const filePath = path.join(OUT_DIR, `${PREFIX}_${name}_${width}px${darkMode ? '_dark' : ''}.png`);
  fs.writeFileSync(filePath, Buffer.from(shot.data, 'base64'));
  return { filePath, metrics };
}

async function main() {
  const cdpPort = 9229;
  const userDataDir = path.join(process.cwd(), '.tmp-chrome-profile');
  fs.rmSync(userDataDir, { recursive: true, force: true });

  const chrome = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${userDataDir}`,
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  try {
    const wsUrl = await waitForCdp(cdpPort);
    const cdp = new CdpClient(wsUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    const targets = [
      { name: 'home', path: '/en', width: 1440, height: 900, dark: false },
      { name: 'home', path: '/en', width: 390, height: 844, dark: false },
      { name: 'tools', path: '/en/tools', width: 1440, height: 900, dark: false },
      { name: 'pricing', path: '/en/pricing', width: 1440, height: 900, dark: false },
      { name: 'login', path: '/en/login', width: 1440, height: 900, dark: false },
    ];

    const results = [];
    for (const t of targets) {
      const res = await capturePage(cdp, t.name, `${BASE_URL}${t.path}`, t.width, t.height, t.dark);
      results.push({ target: `${t.name}@${t.width}`, ...res });
    }

    console.log(JSON.stringify(results, null, 2));
    cdp.close();
  } finally {
    chrome.kill('SIGKILL');
    await sleep(300);
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
