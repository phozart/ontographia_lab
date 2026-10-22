/**
 * E2E: copy (rich) + .docx / .pdf export for doc cards, rich copy for tables, and the doc scroll fixes (side panel and
 * card body). Real editor, real clipboard (permissions granted), real downloads into a scratch dir.
 * Needs the app at TEST_BASE_URL and QA_ADMIN_* from .env.qa.local. Creates its own diagram and deletes it afterwards.
 * E2E_SHOTS_DIR saves screenshots and the sample .docx / .pdf.
 */
const path = require('path');
const os = require('os');
const puppeteer = require('puppeteer');
const { headlessMode } = require('../helpers/headless');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.qa.local') });

jest.setTimeout(240000);
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3002';
const SHOTS = process.env.E2E_SHOTS_DIR || '';

const el = (id, x, y, label) => ({ id, type: 'rectangle', packId: 'core', x: 50000 + x, y: 50000 + y, size: { width: 160, height: 70 }, label, color: '#4FB3CE', layerId: 'default', properties: {} });
const para = (i) => `Paragraph ${i}: the quick brown fox jumps over the lazy dog, then reads the [Auth service](#el=auth) notes.`;
const MD = [
  '## Findings', '',
  'The main hub is [Auth service](#el=auth); see also [the docs](https://example.com/docs).', '',
  '- first point', '  - nested point', '- second point', '',
  '1. step one', '2. step two', '',
  '> A quoted remark', '',
  '| Name | Value |', '|---|---|', '| alpha | 1 |', '| beta | 2 |', '',
  '```', 'const x = 1 < 2;', '```', '',
  ...Array.from({ length: 40 }, (_, i) => `${para(i)}\n`),
  '## The end', '', 'Last line.',
].join('\n');
const docEl = { id: 'doc1', type: 'doc', packId: 'core', x: 50000 + 300, y: 50000 + 250, size: { width: 360, height: 220 }, label: 'Architecture summary', color: '#4FB3CE', layerId: 'default', properties: {}, data: { doc: { title: 'Architecture summary', markdown: MD } } };
const tableEl = {
  id: 'tbl1', type: 'table', packId: 'core', x: 50000 + 800, y: 50000 + 250, size: { width: 420, height: 160 }, label: 'Risks', color: '#4FB3CE', layerId: 'default', properties: {},
  data: { table: { headerRow: true, headerColumn: false, columns: [{ id: 'col-1', name: 'Risk', type: 'text' }, { id: 'col-2', name: 'Score', type: 'number' }], rows: [{ id: 'row-1', cells: { 'col-1': 'Login', 'col-2': 3 }, elementId: 'auth' }, { id: 'row-2', cells: { 'col-1': '=HYPERLINK("x")', 'col-2': 5 } }] } },
};
const content = (elements) => ({ elements, connections: [], layers: [], groups: [], viewport: { x: 0, y: 0, zoom: 1 } });

describe('Doc copy and export', () => {
  let browser; let ctx; let diagram; let downloadDir;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const shot = async (page, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name) }); } };
  async function waitFor(fn, ms = 15000, step = 250) {
    const end = Date.now() + ms;
    for (;;) { const v = await fn(); if (v) return v; if (Date.now() > end) throw new Error('timed out waiting'); await sleep(step); }
  }
  const call = (page, method, url, body) => page.evaluate(async (m, u, b) => {
    const r = await fetch(u, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
    let json = null; try { json = await r.json(); } catch (e) { /* none */ }
    return { status: r.status, body: json };
  }, method, url, body);
  const readClipboard = async (page) => {
    for (let i = 0; ; i++) {
      try {
        return await page.evaluate(async () => {
          const out = {};
          for (const item of await navigator.clipboard.read()) for (const type of item.types) out[type] = await (await item.getType(type)).text();
          return out;
        });
      } catch (e) { if (i >= 5) throw e; await sleep(300); } // 'Clipboard data has changed' while a write settles
    }
  };

  beforeAll(async () => {
    downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docexport-dl-'));
    browser = await puppeteer.launch({ headless: headlessMode(), args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
    ctx = await browser.createBrowserContext();
    await ctx.overridePermissions(BASE_URL, ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']);
    const p = await ctx.newPage();
    await p.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0', timeout: 90000 });
    await p.type('#email', process.env.QA_ADMIN_EMAIL);
    await p.type('#password', process.env.QA_ADMIN_PASSWORD);
    await Promise.all([p.waitForFunction(() => !window.location.pathname.startsWith('/login'), { timeout: 30000 }), p.click('button[type="submit"]')]);
    const created = (await call(p, 'POST', '/api/diagrams', { type: 'infinite-canvas', name: 'E2E doc export', content: content([el('auth', 100, 100, 'Auth service'), docEl, tableEl]) }));
    diagram = created.body;
    if (!(diagram && diagram.id)) throw new Error('create failed: ' + created.status + ' ' + JSON.stringify(created.body).slice(0, 300));
    await p.close();
    const session = await browser.target().createCDPSession();
    await session.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir, browserContextId: ctx.id });
  });

  afterAll(async () => {
    try { const p = await ctx.newPage(); await p.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' }); if (diagram) await call(p, 'DELETE', `/api/diagrams/${diagram.id}`); } catch (e) { /* best effort */ }
    if (browser) await browser.close();
    try { fs.rmSync(downloadDir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
  });

  async function open() {
    const page = await ctx.newPage();
    await page.setViewport({ width: 1379, height: 985 });
    await page.goto(`${BASE_URL}/diagram/${diagram.short_id}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForSelector('[data-testid="doc-card"]', { timeout: 40000 });
    await sleep(1500);
    return page;
  }
  const cardRect = (page) => page.$eval('[data-testid="doc-card"]', (n) => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });

  test('card body scrolls on wheel without panning/zooming the canvas; Ctrl+wheel still zooms', async () => {
    const page = await open();
    // select the card by clicking its title bar
    const r0 = await cardRect(page);
    await page.mouse.click(r0.x + 60, r0.y + 20);
    await sleep(800);
    expect(await page.$eval('[data-testid="doc-card-scroll"]', (n) => n.scrollHeight > n.clientHeight)).toBe(true);
    expect(await page.$eval('[data-testid="doc-card-scroll"]', (n) => n.dataset.more)).toBe('true');
    const rs = await cardRect(page);
    await page.mouse.move(rs.x + rs.w / 2, rs.y + 120);
    await page.mouse.wheel({ deltaY: 120 });
    await sleep(300);
    const top = await page.$eval('[data-testid="doc-card-scroll"]', (n) => n.scrollTop);
    expect(top).toBeGreaterThan(50);
    const r1 = await cardRect(page);
    expect(Math.abs(r1.x - rs.x)).toBeLessThan(1);
    expect(Math.abs(r1.y - rs.y)).toBeLessThan(1);
    expect(Math.abs(r1.w - rs.w)).toBeLessThan(1);
    await shot(page, 'card-scrolled.png');
    // wheel over empty canvas still pans
    await page.mouse.move(r0.x + r0.w / 2, r0.y + r0.h + 150);
    await page.mouse.wheel({ deltaY: 100 });
    await sleep(300);
    const r2 = await cardRect(page);
    expect(Math.abs(r2.y - r1.y)).toBeGreaterThan(20);
    // Ctrl+wheel over the card zooms the canvas (card changes size), and does not scroll the card
    const before = await page.$eval('[data-testid="doc-card-scroll"]', (n) => n.scrollTop);
    await page.mouse.move(r2.x + r2.w / 2, r2.y + 120);
    await page.keyboard.down('Control');
    await page.mouse.wheel({ deltaY: -200 });
    await page.keyboard.up('Control');
    await sleep(400);
    const r3 = await cardRect(page);
    expect(r3.w).toBeGreaterThan(r2.w + 2);
    expect(await page.$eval('[data-testid="doc-card-scroll"]', (n) => n.scrollTop)).toBe(before);
    await page.close();
  });

  test('side panel: Write and Preview both scroll; header stays; copy puts formatted HTML on the clipboard', async () => {
    const page = await open();
    const r0 = await cardRect(page);
    await page.mouse.click(r0.x + 60, r0.y + 20);
    await page.keyboard.press('Enter');
    await page.waitForSelector('[data-testid="doc-panel"]', { timeout: 10000 });
    const panel = await page.$eval('[data-testid="doc-panel"]', (n) => { const r = n.getBoundingClientRect(); return { h: r.height, bottom: r.bottom, vh: window.innerHeight }; });
    expect(panel.bottom).toBeLessThanOrEqual(panel.vh + 1); // the panel is bounded by the viewport
    const ta = await page.$('[data-testid="doc-textarea"]');
    const box = await ta.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel({ deltaY: 400 });
    await sleep(300);
    expect(await page.$eval('[data-testid="doc-textarea"]', (n) => n.scrollTop)).toBeGreaterThan(100);
    expect(await page.$eval('[data-testid="doc-title"]', (n) => n.getBoundingClientRect().top)).toBeGreaterThanOrEqual(0);
    await page.click('[data-testid="doc-tab-preview"]');
    await page.waitForSelector('[data-testid="doc-preview"]');
    const pb = await (await page.$('[data-testid="doc-preview"]')).boundingBox();
    await page.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2);
    await page.mouse.wheel({ deltaY: 500 });
    await sleep(300);
    expect(await page.$eval('[data-testid="doc-preview"]', (n) => n.scrollTop)).toBeGreaterThan(100);
    await shot(page, 'panel-preview-scrolled.png');

    // copy with formatting
    await page.click('[data-testid="doc-copy-rich"]');
    await page.waitForSelector('[data-testid="doc-toast"]');
    expect(await page.$eval('[data-testid="doc-toast"]', (n) => n.textContent)).toMatch(/Copied with formatting/);
    const clip = await readClipboard(page);
    expect(clip['text/html']).toMatch(/<h1[^>]*>Architecture summary<\/h1>/);
    expect(clip['text/html']).toMatch(/<h2[^>]*>Findings<\/h2>/);
    expect(clip['text/html']).toContain(`href="${BASE_URL}/diagram/${diagram.short_id}?focus=auth"`);
    expect(clip['text/html']).toContain('href="https://example.com/docs"');
    expect(clip['text/html']).toMatch(/<table[^>]*>/);
    expect(clip['text/html']).not.toMatch(/<script|javascript:|#el=/);
    expect(clip['text/plain']).toContain('Architecture summary');
    expect(clip['text/plain']).not.toContain('##');
    // keyboard: Ctrl+Shift+C in the preview
    await page.evaluate(() => navigator.clipboard.writeText('x'));
    await page.focus('[data-testid="doc-copy-rich"]');
    await page.keyboard.down('Control'); await page.keyboard.down('Shift'); await page.keyboard.press('KeyC'); await page.keyboard.up('Shift'); await page.keyboard.up('Control');
    await waitFor(async () => (await readClipboard(page))['text/html']);
    await page.close();
  });

  test('downloads a non-empty .docx and .pdf named after the doc title', async () => {
    const page = await open();
    const r0 = await cardRect(page);
    await page.mouse.click(r0.x + 60, r0.y + 20);
    await page.keyboard.press('Enter');
    await page.waitForSelector('[data-testid="doc-export-docx"]');
    await page.click('[data-testid="doc-export-docx"]');
    await page.click('[data-testid="doc-export-pdf"]');
    const docx = path.join(downloadDir, 'Architecture-summary.docx');
    const pdf = path.join(downloadDir, 'Architecture-summary.pdf');
    await waitFor(() => fs.existsSync(docx) && fs.existsSync(pdf) && fs.statSync(docx).size > 0 && fs.statSync(pdf).size > 0 && !fs.readdirSync(downloadDir).some((f) => f.endsWith('.crdownload')), 30000);
    expect(fs.readFileSync(docx).subarray(0, 2).toString()).toBe('PK');
    expect(fs.readFileSync(pdf).subarray(0, 5).toString()).toBe('%PDF-');
    expect(fs.statSync(docx).size).toBeGreaterThan(2000);
    expect(fs.statSync(pdf).size).toBeGreaterThan(2000);
    if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); fs.copyFileSync(docx, path.join(SHOTS, 'sample.docx')); fs.copyFileSync(pdf, path.join(SHOTS, 'sample.pdf')); }
    await page.close();
  });

  test('context menus: doc card export/copy items and table Copy table (HTML table + TSV with formula guard)', async () => {
    const page = await open();
    const r0 = await cardRect(page);
    await page.mouse.click(r0.x + 60, r0.y + 20, { button: 'right' });
    await page.waitForSelector('[data-testid="ctx-doc-copy"]');
    await page.waitForSelector('[data-testid="ctx-doc-docx"]');
    await page.waitForSelector('[data-testid="ctx-doc-pdf"]');
    await page.click('[data-testid="ctx-doc-copy"]');
    expect((await readClipboard(page))['text/html']).toMatch(/<h1/);
    await page.keyboard.press('Escape');
    // table
    const t = await page.$('[data-node-id="tbl1"]');
    const tb = await t.boundingBox();
    await page.mouse.click(tb.x + 10, tb.y + 8, { button: 'right' });
    await page.waitForSelector('[data-testid="ctx-table-copy"]');
    await page.click('[data-testid="ctx-table-copy"]');
    const clip = await waitFor(async () => { const c = await readClipboard(page); return /<table/.test(c['text/html'] || '') ? c : null; });
    expect(clip['text/html']).toMatch(/<th[^>]*>Risk<\/th>/);
    expect(clip['text/html']).toContain(`${BASE_URL}/diagram/${diagram.short_id}?focus=auth`);
    expect(clip['text/plain'].split('\n')).toEqual(['Risk\tScore', 'Login\t3', "'=HYPERLINK(\"x\")\t5"]);
    await shot(page, 'table-copied.png');
    await page.close();
  });

  const readImage = async (page) => {
    for (let n = 0; ; n++) {
      try {
        return await page.evaluate(async () => {
          for (const item of await navigator.clipboard.read()) if (item.types.includes('image/png')) {
            const b = await item.getType('image/png');
            const head = new Uint8Array(await b.slice(0, 8).arrayBuffer());
            const bmp = await createImageBitmap(b);
            return { size: b.size, sig: Array.from(head), w: bmp.width, h: bmp.height };
          }
          return null;
        });
      } catch (e) { if (n >= 5) throw e; await sleep(300); }
    }
  };

  test('copy as image: selection, board and table go to the clipboard as a PNG (2x); the shortcut does the same', async () => {
    const page = await open();
    // board (nothing selected): right-click empty canvas
    await page.mouse.click(1100, 700, { button: 'right' });
    await page.waitForSelector('[data-testid="ctx-copy-image"]');
    await page.click('[data-testid="ctx-copy-image"]');
    let img = await waitFor(() => readImage(page), 30000);
    expect(img.sig).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(img.size).toBeGreaterThan(1000);
    const boardW = img.w;
    await page.keyboard.press('Escape');
    // the table, individually
    await page.evaluate(() => navigator.clipboard.writeText('x'));
    const tb = await (await page.$('[data-node-id="tbl1"]')).boundingBox();
    await page.mouse.click(tb.x + 10, tb.y + 8, { button: 'right' });
    await page.waitForSelector('[data-testid="ctx-copy-image"]');
    await page.click('[data-testid="ctx-copy-image"]');
    img = await waitFor(() => readImage(page), 30000);
    expect(img.sig.slice(0, 4)).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(img.w).toBeGreaterThanOrEqual(2 * 420); // 2x of the table width
    expect(img.w).toBeLessThan(boardW);
    await shot(page, 'copied-table-image.png');
    // shortcut with a doc card selected on the canvas -> image of the card (not the doc HTML)
    await page.evaluate(() => navigator.clipboard.writeText('y'));
    const r0 = await cardRect(page);
    await page.mouse.click(r0.x + 60, r0.y + 20);
    await sleep(300);
    await page.keyboard.down('Control'); await page.keyboard.down('Shift'); await page.keyboard.press('KeyC'); await page.keyboard.up('Shift'); await page.keyboard.up('Control');
    img = await waitFor(() => readImage(page), 30000);
    expect(img.w).toBeGreaterThanOrEqual(2 * 360);
    await page.close();
  });

  test('table menu: Export as Excel downloads a valid .xlsx with typed cells and no formulas', async () => {
    const page = await open();
    const tb = await (await page.$('[data-node-id="tbl1"]')).boundingBox();
    await page.mouse.click(tb.x + 10, tb.y + 8);
    await sleep(300);
    await page.waitForSelector('[data-testid="table-options"]');
    await page.click('[data-testid="table-options"]');
    await page.waitForSelector('[data-testid="table-menu"]');
    const items = await page.$$('[data-testid="table-menu"] button');
    for (const b of items) { if (/Excel/.test(await b.evaluate((n) => n.textContent))) { await b.click(); break; } }
    const file = path.join(downloadDir, 'Risks.xlsx');
    await waitFor(() => fs.existsSync(file) && fs.statSync(file).size > 0 && !fs.readdirSync(downloadDir).some((f) => f.endsWith('.crdownload')), 30000);
    const buf = fs.readFileSync(file);
    expect(buf.subarray(0, 2).toString()).toBe('PK');
    const JSZip = require('jszip');
    const zip = await JSZip.loadAsync(buf);
    const sheet = await zip.file('xl/worksheets/sheet1.xml').async('string');
    expect(sheet).toContain('<c r="B2"><v>3</v></c>');
    expect(sheet).toContain('>=HYPERLINK(&quot;x&quot;)</t>');
    expect(sheet).not.toMatch(/<f[ >/]/);
    expect(await zip.file('xl/worksheets/_rels/sheet1.xml.rels').async('string')).toContain(`${BASE_URL}/diagram/${diagram.short_id}?focus=auth`);
    expect(await zip.file('xl/workbook.xml').async('string')).toContain('name="Risks"');
    if (SHOTS) fs.copyFileSync(file, path.join(SHOTS, 'sample-table.xlsx'));
    await page.close();
  });
});
