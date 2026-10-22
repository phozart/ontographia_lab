/**
 * E2E: board load performance (viewport culling + thumbnails off the critical path).
 *  - 2,000-element board: nodes exist within a generous time budget (best of 2), only a band around the viewport is
 *    mounted, panning far mounts the far nodes, select-all + Delete + undo works with most nodes unmounted, and no
 *    thumbnail PUT is fired by merely opening the board;
 *  - 400-element board: Export PNG includes the OFF-SCREEN content (the image has the whole board's aspect ratio) and
 *    "Copy frame as image" of a frame that is half off-screen is complete (all four children are drawn);
 *  - 160-element board with a 3-slide deck whose frames are far apart: present mode shows every slide completely.
 * Needs the app at TEST_BASE_URL and QA_ADMIN_* from .env.qa.local. Creates its own diagrams and deletes them afterwards.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const puppeteer = require('puppeteer');
const { headlessMode } = require('../helpers/headless');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.qa.local') });
const { seedContent } = require('../../scripts/perf/seedBoard');

jest.setTimeout(420000);
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3002';
const O = 50000;
const BUDGET_MS = 5000; // generous: a loaded CI-like machine; the unculled editor needed 15-30 s for this board

const shape = (id, x, y, extra = {}) => ({ id, type: 'rectangle', packId: 'core', x: O + x, y: O + y, size: { width: 140, height: 80 }, label: id, color: '#4FB3CE', layerId: 'default', properties: {}, ...extra });
const frame = (id, x, y, w, h, label) => ({ id, type: 'frame', packId: 'core', isFrame: true, membershipExplicit: true, x: O + x, y: O + y, size: { width: w, height: h }, label, color: '#64748b', layerId: 'default', properties: {}, data: { backgroundColor: '#ffffff', showTitle: true } });
const note = (id, x, y, label, parent, color) => shape(id, x, y, { size: { width: 300, height: 120 }, label, color, parentFrameId: parent });
const content = (elements, extra = {}) => ({ elements, connections: [], layers: [], groups: [], viewport: { x: 0, y: 0, zoom: 1 }, ...extra });

// 40 x 10 grid, 300 apart: 11,900 x 2,900 world units; the viewport band can never cover it
const wideGrid = () => Array.from({ length: 400 }, (_, i) => shape(`g${i}`, (i % 40) * 300, Math.floor(i / 40) * 300));
const FRAME_X = 3000; const FRAME_Y = 3200; const FRAME_W = 1200; const FRAME_H = 700;
const CHILD_COLORS = ['#E8A99A', '#F0D98A', '#9A8AC8', '#6A9FC9'];
const CHILDREN = [[100, 100], [700, 100], [100, 450], [700, 450]]; // 300 x 120 each, frame-relative
const exportBoard = () => content([
  ...wideGrid(),
  frame('big', FRAME_X, FRAME_Y, FRAME_W, FRAME_H, 'Big frame'),
  ...CHILDREN.map(([x, y], i) => note(`kid${i}`, FRAME_X + x, FRAME_Y + y, `Kid ${i}`, 'big', CHILD_COLORS[i])),
]);

const SLIDE_W = 1920; const SLIDE_H = 1080;
const deckBoard = () => content([
  ...Array.from({ length: 160 }, (_, i) => shape(`f${i}`, (i % 40) * 300, 2000 + Math.floor(i / 40) * 300)),
  frame('fa', 0, 0, SLIDE_W, SLIDE_H, 'Problem'), note('a1', 120, 300, 'Checkout drops 40 percent', 'fa', '#4FB3CE'),
  frame('fb', 6000, 0, SLIDE_W, SLIDE_H, 'Funnel'), note('b1', 6120, 300, 'Cart abandonment', 'fb', '#E8A99A'), note('b2', 6700, 300, 'Payment errors', 'fb', '#F0D98A'),
  frame('fc', 12000, 0, SLIDE_W, SLIDE_H, 'Next steps'), note('c1', 12120, 300, 'Fix the payment form', 'fc', '#4FB3CE'),
], { presentations: [{ id: 'deck1', title: 'Deck', aspect: '16:9', slides: [{ id: 's1', frameId: 'fa' }, { id: 's2', frameId: 'fb' }, { id: 's3', frameId: 'fc' }] }] });

describe('Board load performance: viewport culling', () => {
  let browser; let context; let big; let wide; let deck; let downloadDir;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const call = (page, method, url, body) => page.evaluate(async (m, u, b) => {
    const r = await fetch(u, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
    let json = null; try { json = await r.json(); } catch (e) { /* none */ }
    return { status: r.status, body: json };
  }, method, url, body);
  async function waitFor(fn, ms = 20000, step = 250) {
    const end = Date.now() + ms;
    for (;;) {
      const v = await fn();
      if (v) return v;
      if (Date.now() > end) throw new Error('timed out waiting');
      await sleep(step);
    }
  }
  async function newPage() {
    const page = await context.newPage();
    await page.setViewport({ width: 1379, height: 985 });
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    return page;
  }
  async function open(page, d) {
    const t0 = Date.now();
    await page.goto(`${BASE_URL}/diagram/${d.short_id}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForSelector('[data-node-id]', { timeout: 90000 });
    return Date.now() - t0;
  }
  const mountedIds = (page) => page.$$eval('.ds-canvas-inner > [data-node-id]', (els) => els.map((e) => e.getAttribute('data-node-id')));
  const nodeCount = (page) => page.$$eval('[data-node-id]', (els) => els.length);
  /** The viewport as the canvas has it: world -> screen is (world + t) * scale. */
  const view = (page) => page.evaluate(() => {
    const inner = document.querySelector('.ds-canvas-inner');
    const area = document.querySelector('.ds-canvas-area').getBoundingClientRect();
    const m = /scale\(([-\d.]+)\)\s*translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(inner.style.transform);
    return { scale: parseFloat(m[1]), tx: parseFloat(m[2]), ty: parseFloat(m[3]), left: area.left, top: area.top, width: area.width, height: area.height };
  });
  /** Wheel-pan until the world point (wx, wy) is at screen point (sx, sy) of the canvas area. */
  async function panTo(page, wx, wy, sx, sy) {
    const v0 = await view(page);
    await page.mouse.move(v0.left + v0.width / 2, v0.top + v0.height / 2);
    for (let i = 0; i < 40; i += 1) {
      const v = await view(page);
      const dx = (wx + v.tx) * v.scale - sx;
      const dy = (wy + v.ty) * v.scale - sy;
      if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
      await page.mouse.wheel({ deltaX: Math.max(-1500, Math.min(1500, dx)), deltaY: Math.max(-1500, Math.min(1500, dy)) });
      await sleep(120);
    }
  }
  const pngSize = (buf) => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });

  beforeAll(async () => {
    downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'perf-dl-'));
    browser = await puppeteer.launch({ headless: headlessMode(), args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
    context = await browser.createBrowserContext();
    const p = await context.newPage();
    await p.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0', timeout: 90000 });
    await p.type('#email', process.env.QA_ADMIN_EMAIL);
    await p.type('#password', process.env.QA_ADMIN_PASSWORD);
    await Promise.all([p.waitForFunction(() => !window.location.pathname.startsWith('/login'), { timeout: 30000 }), p.click('button[type="submit"]')]);
    await p.close();
    const session = await browser.target().createCDPSession();
    await session.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir, browserContextId: context.id });
    await context.overridePermissions(BASE_URL, ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']);
    const page = await newPage();
    const mk = async (name, c) => { const r = await call(page, 'POST', '/api/diagrams', { type: 'infinite-canvas', name, content: c }); expect(r.status).toBe(201); return r.body; };
    big = await mk('E2E perf 2000', seedContent(2000));
    wide = await mk('E2E perf export', exportBoard());
    deck = await mk('E2E perf deck', deckBoard());
    await page.close();
  });

  afterAll(async () => {
    try {
      const page = await newPage();
      for (const d of [big, wide, deck]) if (d) await call(page, 'DELETE', `/api/diagrams/${d.id}`);
    } catch (e) { /* best effort */ }
    await browser.close();
  });

  test('2,000 elements: nodes within the time budget, only a band is mounted, no thumbnail write on open', async () => {
    const times = [];
    let last;
    for (let i = 0; i < 2; i += 1) {
      const page = await newPage();
      const puts = [];
      page.on('request', (r) => { if (r.method() === 'PUT' && /\/api\/diagrams\//.test(r.url())) puts.push(r.url()); });
      times.push(await open(page, big));
      await sleep(i === 1 ? 12000 : 500); // the second run waits past the thumbnail debounce (8 s) + idle
      last = { page, puts };
      if (i === 0) await page.close();
    }
    expect(Math.min(...times)).toBeLessThan(BUDGET_MS);
    const n = await nodeCount(last.page);
    expect(n).toBeGreaterThan(10);
    expect(n).toBeLessThan(600); // not all 2,000
    expect(last.puts).toEqual([]); // opening writes nothing: no thumbnail, no autosave
    await last.page.close();
  });

  test('panning far away mounts the far nodes (and unmounts the ones left behind)', async () => {
    const page = await newPage();
    await open(page, big);
    await sleep(800);
    expect(await mountedIds(page)).not.toContain('e1999');
    const cols = Math.ceil(Math.sqrt(2000 / 1.4));
    const wx = O + (1999 % cols) * 260 + 70; const wy = O + Math.floor(1999 / cols) * 190 + 40;
    const v = await view(page);
    await panTo(page, wx, wy, v.width / 2, v.height / 2);
    await waitFor(async () => (await mountedIds(page)).includes('e1999'), 15000);
    const ids = await mountedIds(page);
    expect(ids).toContain('e1999');
    expect(ids).not.toContain('e0');
    await page.close();
  });

  test('select all + Delete + undo works with most of the board unmounted', async () => {
    const page = await newPage();
    await open(page, big);
    await sleep(800);
    await page.mouse.click(700, 700); // focus the canvas on empty space
    const before = await nodeCount(page);
    await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control');
    await sleep(500);
    await page.keyboard.press('Delete');
    await waitFor(async () => (await nodeCount(page)) === 0, 20000);
    // the whole board was deleted, not just what was mounted: autosave stores zero elements
    await waitFor(async () => ((await call(page, 'GET', `/api/diagrams/${big.id}`)).body.content.elements || []).length === 0, 30000, 1000);
    await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control');
    await waitFor(async () => (await nodeCount(page)) > 0, 20000);
    expect(await nodeCount(page)).toBe(before);
    await waitFor(async () => ((await call(page, 'GET', `/api/diagrams/${big.id}`)).body.content.elements || []).length === 2000, 40000, 1000);
    await page.close();
  });

  test('Export PNG includes the off-screen content: the image has the whole board aspect ratio', async () => {
    const page = await newPage();
    await open(page, wide);
    await sleep(1000);
    expect(await nodeCount(page)).toBeLessThan(405); // (culled: the grid is 11,900 wide)
    expect((await mountedIds(page)).includes('g39')).toBe(false);
    await page.click('.ds-title-menu-wrapper button');
    await page.evaluate(() => [...document.querySelectorAll('.ds-dropdown-item')].find((b) => b.textContent.includes('Export...')).click());
    await page.waitForSelector('.export-dialog');
    await waitFor(async () => (await page.$('.export-preview-container img')) !== null, 120000, 500);
    await page.click('.export-btn-primary');
    const png = await waitFor(() => fs.readdirSync(downloadDir).map((f) => path.join(downloadDir, f)).find((f) => f.endsWith('.png') && fs.statSync(f).size > 1000), 240000, 1000);
    await sleep(500);
    const { w, h } = pngSize(fs.readFileSync(png));
    // board: 39 * 300 + 140 wide, 9 * 300 + 80 plus the frame (to y 3,900) tall, plus padding: about 3.0
    expect(w / h).toBeGreaterThan(2.5);
    expect(w / h).toBeLessThan(3.6);
    fs.unlinkSync(png);
    await waitFor(async () => (await nodeCount(page)) < 405, 15000); // culling is back after the export
    await page.close();
  });

  test('Copy frame as image of a frame that is half off-screen is complete', async () => {
    const page = await newPage();
    await open(page, wide);
    await sleep(1000);
    // pan so the frame's centre sits on the right edge of the screen: the right half is off-screen
    const v = await view(page);
    await panTo(page, O + FRAME_X + FRAME_W / 2, O + FRAME_Y + FRAME_H / 2, v.width - 4, v.height / 2);
    await waitFor(async () => (await mountedIds(page)).includes('big'), 15000);
    await waitFor(async () => (await mountedIds(page)).includes('kid0'), 15000);
    const box = await (await page.$('[data-node-id="big"]')).boundingBox();
    expect(box.x + box.width).toBeGreaterThan(v.left + v.width); // the frame really extends past the screen edge
    await page.mouse.click(box.x + 50, box.y + box.height - 40, { button: 'right' });
    await page.evaluate(() => [...document.querySelectorAll('.ds-context-menu-item')].find((b) => b.textContent.includes('Copy frame as image')).click());
    const img = await waitFor(async () => page.evaluate(async () => {
      try {
        for (const item of await navigator.clipboard.read()) {
          if (!item.types.includes('image/png')) continue;
          const bmp = await createImageBitmap(await item.getType('image/png'));
          return { w: bmp.width, h: bmp.height };
        }
      } catch (e) { /* not yet */ }
      return null;
    }), 180000, 1000);
    expect(img.w / img.h).toBeCloseTo(FRAME_W / FRAME_H, 1);
    // every child is drawn: sample the centre of each against the white frame background
    const px = await page.evaluate(async (centers) => {
      for (const item of await navigator.clipboard.read()) {
        if (!item.types.includes('image/png')) continue;
        const bmp = await createImageBitmap(await item.getType('image/png'));
        const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
        const ctx = c.getContext('2d'); ctx.drawImage(bmp, 0, 0);
        const k = bmp.width / 1200;
        return centers.map(([x, y]) => Array.from(ctx.getImageData(Math.round((x + 10) * k), Math.round((y + 10) * k), 1, 1).data));
      }
      return null;
    }, CHILDREN.map(([x, y]) => [x, y]));
    expect(px).toHaveLength(4);
    for (const [r, g, b] of px) expect(r + g + b).toBeLessThan(740); // not plain white: the child is there
    await page.close();
  });

  test('present mode shows every slide completely although the frames are far apart', async () => {
    const page = await newPage();
    await open(page, deck);
    await sleep(1000);
    expect((await mountedIds(page)).includes('c1')).toBe(false); // slide 3 is far away: not mounted on the board
    await page.click('.ds-title-menu-wrapper button');
    await page.click('[data-testid="menu-presentation"]');
    await page.waitForSelector('[data-testid="presentation-panel"]');
    await page.click('[data-testid="pp-present"]');
    await page.waitForSelector('[data-testid="present-stage"]');
    const stageText = () => page.$eval('[data-testid="present-stage"]', (s) => s.textContent);
    const expected = [['Checkout drops 40 percent'], ['Cart abandonment', 'Payment errors'], ['Fix the payment form']];
    for (let i = 0; i < 3; i += 1) {
      await waitFor(async () => { const t = await stageText(); return expected[i].every((x) => t.includes(x)); }, 30000, 300).catch(() => { throw new Error(`slide ${i + 1} is incomplete`); });
      expect(await page.$eval('[data-testid="present-counter"]', (n) => n.textContent.trim())).toBe(`${i + 1} / 3`);
      if (i < 2) await page.keyboard.press('ArrowRight');
      await sleep(400);
    }
    await page.keyboard.press('Escape');
    await waitFor(async () => (await page.$('[data-testid="present-mode"]')) === null, 10000);
    await waitFor(async () => (await nodeCount(page)) < 167, 15000); // culling is back after presenting (the board may have followed to the last slide)
    await page.close();
  });
});
