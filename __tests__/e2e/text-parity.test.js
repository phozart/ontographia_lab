/**
 * E2E: ADR-0008 T3, the same text on the canvas, in the exports and in diagram_show.
 *  - a mixed showcase board (every pack, labelled connections, frames, table, doc, text presets, long / CJK / Arabic / emoji
 *    labels) is opened in the editor; the export dialog downloads PNG, SVG and PDF; renderDiagramSvg (diagram_show and the
 *    thumbnail) draws the same content in Node.
 *  - geometry assertions, not pixel diffs: for every node the lines the canvas drew equal the lines of the exported SVG and,
 *    for the label slot, the lines of diagram_show; font sizes and block boxes agree within a pixel.
 *  - E2E_SHOTS_DIR gets the screenshots (canvas, export PNG, export SVG rendered, PDF page, diagram_show, thumbnail) and
 *    parity-report.json.
 * Needs the app at TEST_BASE_URL and QA_ADMIN_* from .env.qa.local. Creates its own board and deletes it afterwards.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const puppeteer = require('puppeteer');
const { headlessMode } = require('../helpers/headless');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.qa.local') });
const { showcaseContent } = require('../helpers/textShowcase');
const { canvasBlocks, blocksOfSvgText, flowedLines } = require('../helpers/t3Browser');
const { renderDiagramSvg } = require('../../lib/render/diagramSvg');

jest.setTimeout(600000);
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3002';
const SHOTS = process.env.E2E_SHOTS_DIR || '';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

describe('Text parity: canvas, export and diagram_show (ADR-0008 T3)', () => {
  let browser; let context; let board; let downloadDir; let boardContent;
  const shot = async (page, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name) }); } };
  const keep = (name, data) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); fs.writeFileSync(path.join(SHOTS, name), data); } };
  const call = (page, method, url, body) => page.evaluate(async (m, u, b) => {
    const r = await fetch(u, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
    let json = null; try { json = await r.json(); } catch (e) { /* none */ }
    return { status: r.status, body: json };
  }, method, url, body);
  async function waitFor(fn, ms = 30000, step = 200) {
    const end = Date.now() + ms;
    for (;;) { const v = await fn(); if (v) return v; if (Date.now() > end) throw new Error('timed out waiting'); await sleep(step); }
  }
  async function newPage() {
    const page = await context.newPage();
    await page.setViewport({ width: 1379, height: 985 });
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    return page;
  }
  async function open(page, d) {
    await page.goto(`${BASE_URL}/diagram/${d.short_id}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForSelector('[data-node-id]', { timeout: 60000 });
    await sleep(2500);
    await page.keyboard.press('Escape');
    await page.keyboard.press('0'); // Fit All
    await sleep(1500);
  }
  /** Download one export through the real dialog; returns the file path. */
  async function exportVia(page, formatLabel) {
    for (const f of fs.readdirSync(downloadDir)) fs.unlinkSync(path.join(downloadDir, f));
    await page.evaluate(() => window.dispatchEvent(new Event('ds:open-export-dialog')));
    await page.waitForSelector('.export-dialog', { timeout: 20000 });
    await page.evaluate((label) => { [...document.querySelectorAll('.export-format-btn')].find((b) => b.textContent.trim().toLowerCase() === label).click(); }, formatLabel);
    await sleep(600);
    await waitFor(async () => (await page.$('.export-preview-img.loading')) === null && (await page.$('.export-preview-img')) !== null, 60000, 300);
    await page.click('.export-btn-primary');
    const ext = formatLabel === 'jpeg' ? 'jpg' : formatLabel;
    const file = await waitFor(() => fs.readdirSync(downloadDir).map((f) => path.join(downloadDir, f)).find((f) => f.endsWith(`.${ext}`) && !f.endsWith('.crdownload') && fs.statSync(f).size > 200), 120000, 250);
    await sleep(300);
    const data = fs.readFileSync(file);
    const kept = path.join(os.tmpdir(), `parity-${Date.now()}.${ext}`);
    fs.writeFileSync(kept, data);
    return kept;
  }

  beforeAll(async () => {
    downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parity-dl-'));
    browser = await puppeteer.launch({ headless: headlessMode(), args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
    context = await browser.createBrowserContext();
    const p = await context.newPage();
    await p.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0', timeout: 90000 });
    await p.type('#email', process.env.QA_ADMIN_EMAIL);
    await p.type('#password', process.env.QA_ADMIN_PASSWORD);
    await Promise.all([p.waitForFunction(() => !window.location.pathname.startsWith('/login'), { timeout: 30000 }), p.click('button[type="submit"]')]);
    boardContent = showcaseContent();
    board = (await call(p, 'POST', '/api/diagrams', { type: 'infinite-canvas', name: 'E2E text parity', content: boardContent })).body;
    if (!(board && board.id)) throw new Error('create failed');
    await p.close();
    const session = await browser.target().createCDPSession();
    await session.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir, browserContextId: context.id });
  });

  afterAll(async () => {
    try { const p = await newPage(); if (board) await call(p, 'DELETE', `/api/diagrams/${board.id}`); } catch (e) { /* best effort */ }
    if (browser) await browser.close();
    try { fs.rmSync(downloadDir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
  });

  test('showcase board: canvas lines = exported SVG lines = diagram_show lines; screenshots of every renderer', async () => {
    const page = await newPage();
    await open(page, board);
    await shot(page, '1-canvas.png');
    const canvas = await canvasBlocks(page);
    expect(canvas.length).toBeGreaterThan(20);

    // ---- exports through the real dialog
    const pngFile = await exportVia(page, 'png');
    const svgFile = await exportVia(page, 'svg');
    const pdfFile = await exportVia(page, 'pdf');
    if (SHOTS) {
      fs.mkdirSync(SHOTS, { recursive: true });
      fs.copyFileSync(pngFile, path.join(SHOTS, '2-export.png'));
      fs.copyFileSync(svgFile, path.join(SHOTS, 'export.svg'));
      fs.copyFileSync(pdfFile, path.join(SHOTS, 'export.pdf'));
      try { execFileSync('sips', ['-s', 'format', 'png', pdfFile, '--out', path.join(SHOTS, '4-export-pdf.png')], { stdio: 'ignore' }); } catch (e) { /* no sips */ }
    }
    const svgText = fs.readFileSync(svgFile, 'utf8');
    const exported = await blocksOfSvgText(page, svgText);

    // ---- the exported SVG, rendered, and diagram_show, rendered
    const view = await context.newPage();
    await view.setViewport({ width: 1379, height: 985 });
    await view.goto(`file://${svgFile}`, { waitUntil: 'load' });
    await sleep(800);
    await shot(view, '3-export-svg.png');
    await view.close();
    const view2 = await context.newPage();
    await view2.setViewport({ width: 1379, height: 985 });
    const show = renderDiagramSvg(boardContent, { maxElements: 5000, maxConnections: 10000, maxBytes: Infinity, ids: true });
    keep('diagram_show.svg', show.svg);
    await view2.setContent(`<html><body style="margin:0;background:#fff"><img id="i" style="width:1379px" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(show.svg)}"></body></html>`);
    await sleep(500);
    await shot(view2, '5-diagram_show.png');
    const thumb = renderDiagramSvg(boardContent, { maxElements: 5000, maxConnections: 10000, maxBytes: Infinity });
    await view2.setContent(`<html><body style="margin:0;background:#fff"><img id="i" style="width:320px;image-rendering:auto" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(thumb.svg)}"></body></html>`);
    await sleep(300);
    await view2.setViewport({ width: 340, height: 260 });
    await shot(view2, '6-thumbnail.png');
    await view2.close();

    // ---- geometry comparison
    const key = (r) => `${r.id}|${r.kind}`;
    const exportedBy = new Map(exported.map((r) => [key(r), r]));
    const report = { canvasBlocks: canvas.length, exportedBlocks: exported.length, canvasVsExport: [], canvasVsShow: [], unmatchedShow: [] };
    for (const c of canvas) {
      const e = exportedBy.get(key(c));
      if (!e) { report.canvasVsExport.push({ id: c.id, kind: c.kind, problem: 'missing in export' }); continue; }
      const same = JSON.stringify(c.lines) === JSON.stringify(e.lines) && c.size === e.size && Math.abs(c.left - e.left) <= 1 && Math.abs(c.top - e.top) <= 1 && Math.abs(c.width - e.width) <= 1 && c.badge === e.badge;
      if (!same) report.canvasVsExport.push({ id: c.id, kind: c.kind, canvas: c.lines, exported: e.lines, sizes: [c.size, e.size] });
    }
    const showDoc = new (require('jsdom').JSDOM)(show.svg, { contentType: 'image/svg+xml' }).window.document;
    for (const g of showDoc.querySelectorAll('g[data-id]')) {
      const id = g.getAttribute('data-id');
      for (const t of g.querySelectorAll('text[data-text-block]')) {
        const kind = t.getAttribute('data-text-block');
        const lines = [...t.querySelectorAll('tspan')].map((x) => x.textContent.trim());
        // UML classes and ERD entities draw the name in their own `name` slot: diagram_show draws it as the label
        const c = canvas.find((b) => b.id === id && b.kind === kind) || (kind === 'inside' ? canvas.find((b) => b.id === id && b.kind === 'name') : null);
        if (!c) { report.unmatchedShow.push({ id, kind, show: lines, canvasKinds: canvas.filter((b) => b.id === id).map((b) => b.kind) }); continue; }
        if (JSON.stringify(c.lines) !== JSON.stringify(lines)) report.canvasVsShow.push({ id, kind, canvas: c.lines, show: lines });
      }
    }
    // rich text the browser flows itself (text presets, the doc card): compare its lines with the shared layout's lines
    const showLines = (id, kind) => [...showDoc.querySelectorAll(`g[data-id="${id}"] text[data-text-block="${kind}"]`)].map((t) => [...t.querySelectorAll('tspan')].map((x) => x.textContent.trim()).join(' '));
    report.presets = [];
    for (const id of ['p1', 'p2', 'p3']) {
      const dom = await flowedLines(page, `[data-node-id="${id}"] [data-testid="text-preset"]`);
      const mine = showLines(id, 'preset');
      if (JSON.stringify(dom) !== JSON.stringify(mine)) report.presets.push({ id, dom, show: mine });
    }
    const domDoc = await flowedLines(page, '[data-node-id="doc1"] [data-testid="doc-card-scroll"]');
    report.doc = { dom: domDoc, show: showLines('doc1', 'doc-line') };
    keep('parity-report.json', JSON.stringify(report, null, 2));
    await page.close();
    expect(report.canvasVsExport).toEqual([]);
    expect(report.canvasVsShow).toEqual([]);
    expect(report.presets).toEqual([]);
  });
});
