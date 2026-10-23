/**
 * E2E: ADR-0008 T3 gallery, one board per pack (every stencil x the ten audit label variants at the stored default size).
 * For every node the lines the editor drew (the DOM, as Chrome flowed them) equal the lines diagram_show draws (renderDiagramSvg,
 * Node) and the lines the shared layout computes; font sizes agree and the text block sits where the layout puts it (within 4 px:
 * a few renderers offset their label by a border width). Geometry assertions, not pixel diffs. Shard with `-t <pack>`.
 * Needs the app at TEST_BASE_URL and QA_ADMIN_* from .env.qa.local. Creates its own boards and deletes them afterwards.
 */
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
const { headlessMode } = require('../helpers/headless');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.qa.local') });
const { PACK_CATALOG } = require('../../components/diagram-studio/packs/catalog');
const { galleryContent, expectedBlock } = require('../helpers/textShowcase');
const { canvasBlocks } = require('../helpers/t3Browser');
const { renderDiagramSvg } = require('../../lib/render/diagramSvg');

jest.setTimeout(600000);
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3002';
const SHOTS = process.env.E2E_SHOTS_DIR || '';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// kinds the canvas names differently from the stencil text slot (UML class, ERD entity: the `name` compartment is the label)
const CANVAS_KINDS = { inside: ['inside', 'name', 'title'], external: ['external'], title: ['title', 'name'] };

describe('Text parity gallery: canvas = diagram_show = shared layout', () => {
  let browser; let context; let page;
  const call = (method, url, body) => page.evaluate(async (m, u, b) => {
    const r = await fetch(u, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
    let json = null; try { json = await r.json(); } catch (e) { /* none */ }
    return { status: r.status, body: json };
  }, method, url, body);
  const created = [];

  beforeAll(async () => {
    browser = await puppeteer.launch({ headless: headlessMode(), args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
    context = await browser.createBrowserContext();
    page = await context.newPage();
    await page.setViewport({ width: 1379, height: 985 });
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0', timeout: 90000 });
    await page.type('#email', process.env.QA_ADMIN_EMAIL);
    await page.type('#password', process.env.QA_ADMIN_PASSWORD);
    await Promise.all([page.waitForFunction(() => !window.location.pathname.startsWith('/login'), { timeout: 30000 }), page.click('button[type="submit"]')]);
  });
  afterAll(async () => {
    try { for (const id of created) await call('DELETE', `/api/diagrams/${id}`); } catch (e) { /* best effort */ }
    if (browser) await browser.close();
  });

  // 11 stencils x 10 variants = 110 nodes per board: under the culling threshold (120), so every node is mounted
  const CHUNK = 11;
  const chunks = PACK_CATALOG.flatMap((p) => Array.from({ length: Math.ceil(p.stencils.length / CHUNK) }, (_, i) => [`${p.id} #${i + 1}`, p.id, i * CHUNK]));
  test.each(chunks)('%s', async (name, packId, from) => {
    const pack = PACK_CATALOG.find((p) => p.id === packId);
    const content = galleryContent(packId, { from, to: from + CHUNK });
    const slug = `${packId}-${from / CHUNK + 1}`;
    const board = (await call('POST', '/api/diagrams', { type: 'infinite-canvas', name: `E2E parity ${slug}`, content })).body;
    created.push(board.id);
    await page.goto(`${BASE_URL}/diagram/${board.short_id}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForSelector('[data-node-id]', { timeout: 90000 });
    await sleep(2500);
    await page.keyboard.press('Escape');
    await page.keyboard.press('0'); // Fit All (for the screenshot)
    await sleep(1500);
    if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, `gallery-${slug}.png`) }); }
    const canvas = await canvasBlocks(page);
    const mountedIds = new Set(canvas.map((b) => b.id));
    const show = renderDiagramSvg(content, { ids: true, pin: false, maxElements: 5000, maxConnections: 1, maxBytes: Infinity });
    const doc = new (require('jsdom').JSDOM)(show.svg, { contentType: 'image/svg+xml' }).window.document;
    const showBlocks = new Map();
    for (const g of doc.querySelectorAll('g[data-id]')) {
      const t = g.querySelector('text[data-text-block]');
      if (t) showBlocks.set(g.getAttribute('data-id'), { kind: t.getAttribute('data-text-block'), lines: [...t.querySelectorAll('tspan')].map((x) => x.textContent.trim()), size: parseFloat(t.getAttribute('font-size')) });
    }
    const problems = [];
    let compared = 0;
    let unmatched = 0;
    for (const el of content.elements) {
      const st = pack.stencils.find((s) => s.id === el.type);
      const want = expectedBlock(el, st);
      if (!want || !want.layout.lines.length) continue;
      const mine = canvas.filter((b) => b.id === el.id && CANVAS_KINDS[want.kind].includes(b.kind));
      const shown = showBlocks.get(el.id);
      if (!mountedIds.has(el.id)) { problems.push({ id: el.id, problem: 'not mounted' }); continue; }
      if (!mine.length) { unmatched += 1; continue; } // the pack draws this label with its own slot structure
      const c = mine[0];
      compared += 1;
      const lines = want.layout.lines.map((l) => l.text.trim());
      const rec = { id: el.id, label: el.label.slice(0, 30) };
      if (JSON.stringify(c.lines) !== JSON.stringify(lines)) problems.push({ ...rec, problem: 'canvas lines', canvas: c.lines, layout: lines });
      if (!shown || JSON.stringify(shown.lines) !== JSON.stringify(c.lines)) problems.push({ ...rec, problem: 'show lines', canvas: c.lines, show: shown && shown.lines });
      if (c.size !== want.layout.fontSize) problems.push({ ...rec, problem: 'font size', canvas: c.size, layout: want.layout.fontSize });
      if (Math.abs(c.left - want.box.x) > 4 || Math.abs(c.top + c.paddingTop - (want.box.y + (want.layout.lines[0].top || 0))) > 4) problems.push({ ...rec, problem: 'box', canvas: [c.left, c.top, c.paddingTop], layout: [want.box.x, want.box.y, want.layout.lines[0].top] });
      if (c.overflow !== !!want.layout.overflow) problems.push({ ...rec, problem: 'overflow flag', canvas: c.overflow, layout: !!want.layout.overflow });
    }
    if (SHOTS) fs.writeFileSync(path.join(SHOTS, `gallery-${slug}.json`), JSON.stringify({ compared, unmatched, problems }, null, 1));
    expect(problems).toEqual([]);
    expect(compared).toBeGreaterThan(Math.min(CHUNK, pack.stencils.length - from) * 6); // most stencils draw their label in the policy slot
  });
});
