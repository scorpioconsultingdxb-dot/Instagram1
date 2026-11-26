#!/usr/bin/env node
/**
 * Viewora — Task 7: 5-Locale %PDF-1.4 Chromium PDFium Visual Verification
 * & Automated DOM Accessibility Audit across public routes and all 5 locales.
 * Runs exclusively against isolated `viewora_test` (read-only public routes).
 */
import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createHash } from 'crypto';
import { buildReportPdfBuffer } from '../src/lib/reports/pdf';
import { createDefaultSections } from '../src/lib/reports/builder';

const BASE_URL = 'http://localhost:3096';
const PDF_DIR = path.join(process.cwd(), 'executive_visual_evidence', 'pdf_verification');
fs.mkdirSync(PDF_DIR, { recursive: true });

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const LOCALE_SAMPLES = [
  {
    locale: 'en',
    slug: 'en',
    title: 'Executive Social Audit — Q4 Transparency Brief (en)',
    description: 'Verified English export: transparent benchmarks, €99.99 Agency tier & zero scraping.',
    commentary: 'All metrics clearly distinguish observed public fields from Unavailable fields.',
  },
  {
    locale: 'pt-BR',
    slug: 'pt_br',
    title: 'Relatório Executivo — Análise & Estratégia (pt-BR)',
    description: 'Verificação multilíngue: publicação, coração, avaliação e padrão €99.99.',
    commentary: 'Ações recomendadas: otimização de carrosséis, retenção e transparência de dados.',
  },
  {
    locale: 'es',
    slug: 'es',
    title: 'Informe Ejecutivo — Análisis y Campaña (es)',
    description: '¿Cómo optimizar la señal pública, evaluación y crecimiento? ¡Sin scraping!',
    commentary: 'Métricas transparentes en español con acentos completos: á, é, í, ó, ú, ñ, ü.',
  },
  {
    locale: 'de',
    slug: 'de',
    title: 'Öffentliche Profilprüfung & Übersicht (de)',
    description: 'DSGVO-konforme Maßnahme für größere Reichweite & transparente Analyse.',
    commentary: 'Vollständige Umlaute und Sonderzeichen: Ä, Ö, Ü, ä, ö, ü, ß, €.',
  },
  {
    locale: 'fr',
    slug: 'fr',
    title: 'Synthèse Stratégique — Étude Réseau (fr)',
    description: 'Données vérifiées à coût maîtrisé (€19.99) — confidentialité & gouvernance.',
    commentary: 'Caractères accentués français validés: é, è, ê, à, ç, ô, œ, « transparence ».',
  },
];

async function waitForServer(url, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok) return;
    } catch {
      // retry
    }
    await sleep(250);
  }
  throw new Error('Timed out waiting for Next.js server');
}

async function waitForCdp(port) {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // retry
    }
    await sleep(200);
  }
  throw new Error('Timed out waiting for CDP');
}

async function main() {
  // 1. Generate all 5 real %PDF-1.4 samples
  const generatedPdfs = [];
  for (const s of LOCALE_SAMPLES) {
    const doc = {
      id: `exec-pdf-${s.slug}`,
      ownerId: 'executive-preview',
      title: s.title,
      description: s.description,
      reportType: 'client_performance',
      status: 'ready',
      version: 1,
      versionHistory: [],
      generationMode: 'Template-Generated',
      usernames: [],
      branding: { enabled: false, agencyName: '', clientName: '', headerNote: '', accentHex: '#7957FF' },
      sections: createDefaultSections('client_performance').map((sec) =>
        sec.kind === 'custom_text' ? { ...sec, customText: s.commentary } : sec
      ),
      createdAt: '2026-11-26T00:00:00.000Z',
      updatedAt: '2026-11-26T00:00:00.000Z',
    };
    const buf = buildReportPdfBuffer(doc, [], '2026-11-26T00:00:00.000Z');
    const pdfPath = path.join(PDF_DIR, `sample_${s.slug}.pdf`);
    fs.writeFileSync(pdfPath, buf);
    generatedPdfs.push({ ...s, pdfPath, pdfBytes: buf.byteLength });
  }

  const runtimeUrl = (process.env.TEST_DATABASE_URL || '').trim();
  const port = '3096';
  const server = spawn('cmd.exe', ['/c', 'npx.cmd', 'next', 'start', '-p', port, '-H', 'localhost'], {
    env: {
      ...process.env,
      DATABASE_URL: runtimeUrl,
      NODE_ENV: 'production',
      NEXT_PUBLIC_APP_URL: BASE_URL,
      AUTH_URL: BASE_URL,
      DEMO_MODE_ENABLED: 'false',
      PAYMENTS_ENABLED: 'false',
      NEXT_PUBLIC_PAYMENTS_ENABLED: 'false',
    },
    stdio: 'pipe',
  });

  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viewora-a11y-pdf-'));
  const chrome = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--remote-debugging-port=9241',
      `--user-data-dir=${profileDir}`,
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  try {
    await waitForServer(BASE_URL);
    const wsUrl = await waitForCdp(9241);
    const ws = new WebSocket(wsUrl);
    await new Promise((res) => ws.addEventListener('open', res));

    let id = 0;
    const pending = new Map();
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(String(ev.data));
      if (m.id && pending.has(m.id)) {
        pending.get(m.id)(m.result);
        pending.delete(m.id);
      }
    });
    const send = (method, params = {}) =>
      new Promise((res) => {
        const cid = ++id;
        pending.set(cid, res);
        ws.send(JSON.stringify({ id: cid, method, params }));
      });
    const evalJs = async (expression) => {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      return r?.result?.value;
    };

    await send('Page.enable');
    await send('Runtime.enable');

    // 2. Render all 5 locale PDFs inline in Chromium PDFium
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 960, deviceScaleFactor: 1, mobile: false });
    const pdfiumProofs = [];
    for (const p of generatedPdfs) {
      const fileUrl = `file:///${p.pdfPath.replace(/\\/g, '/')}`;
      await send('Page.navigate', { url: fileUrl });
      await sleep(1800);
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      const buf = Buffer.from(shot.data, 'base64');
      const pngName = `pdf_reader_${p.slug}_1440px.png`;
      fs.writeFileSync(path.join(PDF_DIR, pngName), buf);
      pdfiumProofs.push({
        locale: p.locale,
        pdfFile: `pdf_verification/sample_${p.slug}.pdf`,
        pdfBytes: p.pdfBytes,
        readerScreenshot: `pdf_verification/${pngName}`,
        sha256: createHash('sha256').update(buf).digest('hex').slice(0, 16),
      });
    }

    // 3. Automated DOM Accessibility Audit across key routes & all 5 locales
    const routesToAudit = [
      { route: '/en', expectedLang: 'en' },
      { route: '/en/tools', expectedLang: 'en' },
      { route: '/en/pricing', expectedLang: 'en' },
      { route: '/en/launch', expectedLang: 'en' },
      { route: '/en/beta', expectedLang: 'en' },
      { route: '/en/login', expectedLang: 'en' },
      { route: '/en/register', expectedLang: 'en' },
      { route: '/pt-BR', expectedLang: 'pt-BR' },
      { route: '/es', expectedLang: 'es' },
      { route: '/de', expectedLang: 'de' },
      { route: '/fr', expectedLang: 'fr' },
    ];

    const a11yResults = [];
    for (const item of routesToAudit) {
      await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
      await send('Page.navigate', { url: `${BASE_URL}${item.route}` });
      await sleep(900);
      const desktopAudit = await evalJs(`(() => {
        const htmlLang = document.documentElement.getAttribute('lang') || '';
        const title = document.title || '';
        const h1Count = document.querySelectorAll('h1').length;
        const hasHeader = Boolean(document.querySelector('header'));
        const hasNav = Boolean(document.querySelector('nav'));
        const hasMain = Boolean(document.querySelector('main'));
        const hasFooter = Boolean(document.querySelector('footer'));
        const imgsMissingAlt = Array.from(document.querySelectorAll('img')).filter(img => !img.hasAttribute('alt')).length;
        const unlabeledControls = Array.from(document.querySelectorAll('input, select, textarea')).filter(el => {
          if (el.type === 'hidden') return false;
          const id = el.getAttribute('id');
          const hasLabelFor = id ? Boolean(document.querySelector('label[for="' + CSS.escape(id) + '"]')) : false;
          const wrappedByLabel = Boolean(el.closest('label'));
          const hasAria = Boolean(el.getAttribute('aria-label') || el.getAttribute('aria-labelledby'));
          return !hasLabelFor && !wrappedByLabel && !hasAria;
        }).length;
        const namelessButtons = Array.from(document.querySelectorAll('button')).filter(b => {
          const txt = (b.innerText || b.textContent || '').trim();
          const aria = (b.getAttribute('aria-label') || b.getAttribute('title') || '').trim();
          return !txt && !aria;
        }).length;
        const desktopOverflow = document.documentElement.scrollWidth > window.innerWidth + 2;
        return { htmlLang, titleLen: title.length, h1Count, hasHeader, hasNav, hasMain, hasFooter, imgsMissingAlt, unlabeledControls, namelessButtons, desktopOverflow };
      })()`);

      await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
      await sleep(300);
      const mobileOverflow = await evalJs(`document.documentElement.scrollWidth > window.innerWidth + 2`);
      a11yResults.push({ route: item.route, expectedLang: item.expectedLang, ...desktopAudit, mobileOverflow: Boolean(mobileOverflow) });
    }

    ws.close();
    console.log(JSON.stringify({ ok: true, pdfiumProofs, a11yResults }, null, 2));
  } finally {
    spawnSync('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' });
    spawnSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
    await sleep(300);
    try {
      fs.rmSync(profileDir, { recursive: true, force: true });
    } catch {
      // ignore Windows temp lock
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
