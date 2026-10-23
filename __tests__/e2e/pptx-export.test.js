/**
 * E2E: ADR-0007 P3 PowerPoint export. In the real editor: open the Presentation panel, click "Export PPTX", read the
 * fidelity limits in the dialog, download the .pptx and open its structure: one slide part per visible slide (hidden and
 * missing slides skipped), native text and a native table, speaker notes, and ONE real 2x PNG for the UML + connector
 * group. Also the five-slide demo deck, the Office-safe fonts option, and a viewer exporting.
 * Needs the app at TEST_BASE_URL and QA_ADMIN_* / QA_USER_* from .env.qa.local. Creates its own boards and deletes them.
 * E2E_SHOTS_DIR saves screenshots and the captured diagram pictures.
 */
const path = require('path');
const os = require('os');
const fs = require('fs');
const puppeteer = require('puppeteer');
const { unzipSync, strFromU8 } = require('fflate');
const { headlessMode } = require('../helpers/headless');
const { demoDeck, mixedDeck } = require('../helpers/pptxFixtures');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.qa.local') });

jest.setTimeout(240000);
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3002';
const SHOTS = process.env.E2E_SHOTS_DIR || '';

describe('PowerPoint export (ADR-0007 P3)', () => {
  let browser; const contexts = {}; let mixed; let demo; let downloadDir;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const shot = async (page, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name) }); } };

  async function login(who, email, password) {
    contexts[who] = await browser.createBrowserContext();
    const p = await contexts[who].newPage();
    await p.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0', timeout: 90000 });
    await p.type('#email', email);
    await p.type('#password', password);
    await Promise.all([
      p.waitForFunction(() => !window.location.pathname.startsWith('/login'), { timeout: 30000 }),
      p.click('button[type="submit"]'),
    ]);
    await p.close();
  }
  async function newPage(who) {
    const page = await contexts[who].newPage();
    await page.setViewport({ width: 1379, height: 985 });
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    return page;
  }
  const call = (page, method, url, body) => page.evaluate(async (m, u, b) => {
    const r = await fetch(u, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
    let json = null; try { json = await r.json(); } catch (e) { /* none */ }
    return { status: r.status, body: json };
  }, method, url, body);
  async function open(page, d) {
    await page.goto(`${BASE_URL}/diagram/${d.short_id}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForSelector('.ds-canvas-container', { timeout: 30000 });
    await page.waitForSelector('[data-node-id]', { timeout: 30000 });
    await sleep(1500);
  }
  async function waitFor(fn, ms = 10000, step = 250) {
    const end = Date.now() + ms;
    for (;;) {
      const v = await fn();
      if (v) return v;
      if (Date.now() > end) throw new Error('timed out waiting');
      await sleep(step);
    }
  }
  async function openPanel(page) {
    if (await page.$('[data-testid="presentation-panel"]')) return;
    await page.click('.ds-title-menu-wrapper button');
    await page.click('[data-testid="menu-presentation"]');
    await page.waitForSelector('[data-testid="presentation-panel"]');
  }
  const pptxFiles = () => fs.readdirSync(downloadDir).filter((f) => f.endsWith('.pptx')).sort();
  async function exportPptx(page, { officeFonts = true } = {}) {
    await openPanel(page);
    await page.waitForSelector('[data-testid="pp-export-pptx"]:not([disabled])', { timeout: 15000 });
    await page.click('[data-testid="pp-export-pptx"]');
    await page.waitForSelector('[data-testid="pptx-dialog"]');
    try { await waitFor(() => page.$eval('[data-testid="pptx-export"]', (b) => !b.disabled), 15000); } catch (e) { await shot(page, 'pptx-stuck.png'); throw new Error(`export button stayed disabled: ${await page.$eval('[data-testid="pptx-dialog"]', (n) => n.textContent.slice(0, 400))}`); }
    if (!officeFonts) await page.click('[data-testid="pptx-office-fonts"]');
    for (const f of fs.readdirSync(downloadDir)) fs.rmSync(path.join(downloadDir, f), { force: true }); // a fresh folder: the same file name is never renamed
    const before = new Set(pptxFiles());
    await page.click('[data-testid="pptx-export"]');
    await page.waitForSelector('[data-testid="pptx-done"]', { timeout: 120000 });
    const name = await waitFor(() => pptxFiles().find((f) => !before.has(f)), 30000, 300);
    // let the download finish writing (Chrome writes a .crdownload first)
    await waitFor(() => !fs.readdirSync(downloadDir).some((f) => f.endsWith('.crdownload')), 30000, 300);
    return path.join(downloadDir, name);
  }
  const unzip = (file) => unzipSync(new Uint8Array(fs.readFileSync(file)));
  const text = (files, name) => strFromU8(files[name]);
  const texts = (xml) => [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]);
  const pngSize = (bytes) => ({ w: (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19], h: (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23] });

  beforeAll(async () => {
    downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p3-dl-'));
    browser = await puppeteer.launch({ headless: headlessMode(), args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
    await login('a', process.env.QA_ADMIN_EMAIL, process.env.QA_ADMIN_PASSWORD);
    await login('b', process.env.QA_USER_EMAIL, process.env.QA_USER_PASSWORD);
    for (const who of ['a', 'b']) {
      const session = await browser.target().createCDPSession();
      await session.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir, browserContextId: contexts[who].id });
    }
    const p = await newPage('a');
    const content = (deck) => ({ ...deck.content, viewport: { x: 0, y: 0, zoom: 1 } });
    mixed = (await call(p, 'POST', '/api/diagrams', { type: 'infinite-canvas', name: 'E2E pptx mixed', content: content(mixedDeck()) })).body;
    demo = (await call(p, 'POST', '/api/diagrams', { type: 'infinite-canvas', name: 'E2E pptx demo', content: content(demoDeck()) })).body;
    expect(mixed && mixed.id).toBeTruthy();
    expect(demo && demo.id).toBeTruthy();
    expect((await call(p, 'POST', `/api/diagrams/${mixed.id}/shares`, { email: process.env.QA_USER_EMAIL, role: 'viewer' })).status).toBeLessThan(300);
    await p.close();
  });

  afterAll(async () => {
    try {
      const p = await newPage('a');
      for (const d of [mixed, demo]) if (d) await call(p, 'DELETE', `/api/diagrams/${d.id}`);
    } catch (e) { /* best effort */ }
    if (browser) await browser.close();
    try { fs.rmSync(downloadDir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
  });

  test('the dialog states the limits; the download is a .pptx with native text, a native table, notes and one real 2x diagram picture', async () => {
    const A = await newPage('a');
    await open(A, mixed);
    await openPanel(A);
    await A.click('[data-testid="pp-export-pptx"]');
    await A.waitForSelector('[data-testid="pptx-dialog"]');
    const limits = await A.$eval('[data-testid="pptx-fidelity"]', (n) => n.textContent);
    expect(limits).toMatch(/line wraps can differ/i);
    expect(limits).toMatch(/no gradients/i);
    expect(limits).toMatch(/fonts are not embedded/i);
    await waitFor(async () => (await A.$eval('[data-testid="pptx-summary"]', (n) => /4 slides/.test(n.textContent))), 15000);
    const summary = await A.$eval('[data-testid="pptx-summary"]', (n) => n.textContent);
    expect(summary).toMatch(/2 skipped \(1 hidden, 1 missing\)/);
    expect(await A.$eval('[data-testid="pptx-office-fonts"]', (n) => n.checked)).toBe(true);
    await shot(A, 'pptx-dialog.png');
    await A.keyboard.press('Escape');
    await waitFor(async () => !(await A.$('[data-testid="pptx-dialog"]')));

    const file = await exportPptx(A);
    expect(path.basename(file)).toBe('Mixed- table, doc, text & UML.pptx'.replace(':', '-'));
    const files = unzip(file);
    const names = Object.keys(files);
    expect(names.filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))).toHaveLength(4);

    // native table, with a header and the literal formula text
    const s1 = text(files, 'ppt/slides/slide1.xml');
    expect(s1).toMatch(/<a:tbl>/);
    expect(texts(s1)).toEqual(expect.arrayContaining(['Step', 'Users', 'Cart', '=1+1']));
    // native text on the text-heavy slide, with every bullet
    const s3 = text(files, 'ppt/slides/slide3.xml');
    expect(texts(s3).join(' ')).toContain('Point 8');
    expect(s3).not.toMatch(/<p:pic>/);
    // the UML group: ONE picture, a real PNG at 2x of the cluster box, heading still text
    const s4 = text(files, 'ppt/slides/slide4.xml');
    expect((s4.match(/<p:pic>/g) || []).length).toBe(1);
    expect(texts(s4)).toContain('Domain model');
    const media = names.filter((n) => /^ppt\/media\/.*\.png$/.test(n));
    expect(media.length).toBe(1);
    const png = files[media[0]];
    expect(Array.from(png.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
    const { w, h } = pngSize(png);
    expect(w).toBeGreaterThan(900); // 2x of a cluster that spans about 1,500 board units across
    expect(w / h).toBeGreaterThan(1.2);
    expect(png.length).toBeGreaterThan(5000); // not blank
    if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); fs.writeFileSync(path.join(SHOTS, 'pptx-picture-uml.png'), png); }
    // speaker notes
    const notes = names.filter((n) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(n)).map((n) => text(files, n)).join('');
    expect(notes).toContain('Walk through the model.');
    expect(notes).not.toContain('hidden copy');
    // Office-safe fonts by default
    expect(s3).toMatch(/typeface="Arial"/);
    expect(s3).not.toMatch(/typeface="Inter"/);
    await A.close();
  });

  test('the five-slide demo deck exports five slides; "Office-safe fonts" off keeps the theme font', async () => {
    const A = await newPage('a');
    await open(A, demo);
    const file = await exportPptx(A, { officeFonts: false });
    const files = unzip(file);
    const names = Object.keys(files);
    expect(names.filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))).toHaveLength(5);
    expect(texts(text(files, 'ppt/slides/slide1.xml'))).toEqual(expect.arrayContaining(['Checkout review', 'What we learned in October']));
    expect(text(files, 'ppt/slides/slide2.xml')).toMatch(/typeface="Inter"/);
    expect(names.some((n) => /^ppt\/media\/[^/]+/.test(n))).toBe(false); // no diagrams in this deck: no pictures
    fs.copyFileSync(file, path.join(downloadDir, 'demo-keep.pptx.bak'));
    if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); fs.copyFileSync(file, path.join(SHOTS, 'e2e-demo-deck.pptx')); }
    await A.close();
  });

  test('a viewer can export too', async () => {
    const B = await newPage('b');
    await open(B, mixed);
    const file = await exportPptx(B);
    expect(Object.keys(unzip(file)).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))).toHaveLength(4);
    await B.close();
  });
});
