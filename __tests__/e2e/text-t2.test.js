/**
 * E2E: ADR-0008 T2, the remaining packs, connection labels and table cells in the real editor.
 *  - one board per pack (TOGAF, ITIL, CapabilityMap, ProductDesign, ERD, UML, CLD) created through MCP map_structure with
 *    long labels and NO sizes: no glyph outside its node (declared title and external label slots are bounded instead),
 *    nothing under 11 px, a clamp always carries the overflow badge (never silent);
 *  - a legacy board (every T2 stencil at its stored default size, long labels): opening it draws inside the boxes and
 *    writes nothing (no new revision, identical content);
 *  - connection labels: wrapped, measured background, kept clear of nodes;
 *  - table cells: pinned lines inside their cell, a clamped cell is flagged and carries its full text.
 * Needs the app at TEST_BASE_URL and QA_ADMIN_* from .env.qa.local. Creates its own diagrams and deletes them afterwards.
 * E2E_SHOTS_DIR saves screenshots.
 */
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
const { headlessMode } = require('../helpers/headless');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.qa.local') });
const { PACK_CATALOG } = require('../../components/diagram-studio/packs/catalog');
const { tableElementSize, cellLayout } = require('../../lib/table/tableModel');

jest.setTimeout(600000);
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3002';
const SHOTS = process.env.E2E_SHOTS_DIR || '';
const O = 50000;
const C140 = 'Aggregate all inbound partner shipment notifications, reconcile them against open purchase orders and flag any discrepancies for review';
const VARIANTS = [
  ['w3', 'Customer Order Service'], ['c140', C140], ['ml', 'Order intake\nValidation\nFulfilment'], ['de', 'Kundenzufriedenheitsanalyse'], ['ja', '顧客満足度分析サービス'],
];
const T2 = ['togaf', 'itil', 'capability-map', 'product-design', 'erd', 'uml-class', 'cld'];
const SLOT_KINDS = new Set(['title', 'external']); // declared slots that may lie outside the node box
const content = (elements, connections = []) => ({ elements, connections, layers: [], groups: [], viewport: { x: 0, y: 0, zoom: 1 } });

describe('Text layout T2: the remaining packs, connection labels and tables', () => {
  let browser; let context; let cleanup = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const shot = async (page, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name) }); } };
  const call = (page, method, url, body) => page.evaluate(async (m, u, b) => {
    const r = await fetch(u, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
    let json = null; try { json = await r.json(); } catch (e) { /* none */ }
    return { status: r.status, body: json };
  }, method, url, body);
  async function newPage() {
    const page = await context.newPage();
    await page.setViewport({ width: 1379, height: 985 });
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    return page;
  }
  async function open(page, d, selector = '[data-node-id]') {
    await page.goto(`${BASE_URL}/diagram/${d.short_id}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForSelector(selector, { timeout: 90000 });
    await sleep(2500);
  }
  /**
   * Viewport culling mounts only the nodes near the view, so a board bigger than the screen is measured in tiles: pan across
   * `w` x `h` world units from the opening view (the board's top-left) in steps of about one viewport and union the
   * records by node id (no bypass flag is shipped for tests).
   */
  async function geometryAll(page, w, h) {
    const all = new Map();
    const area = await page.$eval('.ds-canvas-area', (a) => { const r = a.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; });
    await page.mouse.move(area.l + area.w / 2, area.t + area.h / 2);
    const stepX = Math.floor(area.w * 0.8); const stepY = Math.floor(area.h * 0.8);
    const cols = Math.ceil(w / stepX) + 1; const rows = Math.ceil(h / stepY) + 1;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        await sleep(250);
        for (const rec of await geometry(page)) all.set(rec.id, rec);
        if (c < cols - 1) await page.mouse.wheel({ deltaX: (r % 2 ? -1 : 1) * stepX, deltaY: 0 });
      }
      await page.mouse.wheel({ deltaX: 0, deltaY: stepY });
    }
    return [...all.values()];
  }
  /** One record per node: its box, every text line's rect, font sizes, the block kind, and whether a clamp has its badge. */
  const geometry = (page) => page.evaluate(() => [...document.querySelectorAll('[data-node-id]')].map((n) => {
    const nr = n.getBoundingClientRect();
    const lines = [];
    for (const block of n.querySelectorAll('[data-text-block]')) {
      const font = parseFloat(getComputedStyle(block).fontSize);
      const kind = block.getAttribute('data-text-block');
      const spans = [...block.querySelectorAll(':scope > .ds-text-line')];
      const texts = spans.length ? spans.map((x) => x.textContent.replace(/\n$/, '')) : [...block.childNodes].filter((c) => c.nodeType === 3).map((c) => c.nodeValue).join('').split('\n');
      const rects = [];
      if (spans.length) spans.forEach((x) => { const r = document.createRange(); r.selectNodeContents(x); rects.push(r.getBoundingClientRect()); });
      else {
        const tn = [...block.childNodes].find((c) => c.nodeType === 3);
        if (tn) { const r = document.createRange(); r.selectNodeContents(tn); for (const b2 of r.getClientRects()) if (b2.width > 0) rects.push(b2); }
      }
      texts.forEach((t, i) => { const t2 = rects[i] || rects[rects.length - 1] || nr; lines.push({ text: t.trim(), kind, left: t2.left - nr.left, right: nr.right - t2.right, top: t2.top - nr.top, bottom: nr.bottom - t2.bottom, w: t2.width, font, blockOverflow: block.getAttribute('data-overflow') === 'true', hasBadge: !!block.querySelector('.ds-text-badge') }); });
    }
    return { id: n.getAttribute('data-node-id'), type: n.getAttribute('data-type'), w: nr.width, h: nr.height, lines };
  }));

  /** The assertions every drawn label must satisfy, per pack board. */
  function checkNodes(g, tag) {
    for (const n of g) {
      for (const line of n.lines) {
        const id = `${tag} ${n.type} "${(line.text || '').slice(0, 24)}"`;
        expect([id, line.font >= 11]).toEqual([id, true]);
        if (line.blockOverflow) expect([id, line.hasBadge]).toEqual([id, true]); // a clamp is never silent
        if (SLOT_KINDS.has(line.kind)) {
          if (line.kind === 'external') expect([id, line.w <= 242]).toEqual([id, true]);
        } else {
          const inside = line.left >= -1.5 && line.right >= -1.5 && line.top >= -1.5 && line.bottom >= -1.5;
          expect([id, inside]).toEqual([id, true]);
        }
      }
    }
  }

  beforeAll(async () => {
    browser = await puppeteer.launch({ headless: headlessMode(), args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
    context = await browser.createBrowserContext();
    const p = await context.newPage();
    await p.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0', timeout: 90000 });
    await p.type('#email', process.env.QA_ADMIN_EMAIL);
    await p.type('#password', process.env.QA_ADMIN_PASSWORD);
    await Promise.all([p.waitForFunction(() => !window.location.pathname.startsWith('/login'), { timeout: 30000 }), p.click('button[type="submit"]')]);
    await p.close();
  });

  afterAll(async () => {
    try {
      const p = await newPage();
      for (const d of cleanup) await call(p, 'DELETE', `/api/diagrams/${d.id}`);
      const tokens = (await call(p, 'GET', '/api/user/tokens')).body?.tokens || [];
      for (const t of tokens.filter((x) => x.name === 'e2e text t2')) await call(p, 'DELETE', `/api/user/tokens/${t.id}`);
    } catch (e) { /* best effort */ }
    if (browser) await browser.close();
  });

  describe('one board per pack, created by an agent with long labels and no sizes', () => {
    let token; let boards = {};
    beforeAll(async () => {
      const page = await newPage();
      for (const id of T2) boards[id] = (await call(page, 'POST', '/api/diagrams', { type: 'infinite-canvas', name: `E2E text T2 ${id}`, content: content([]) })).body;
      cleanup.push(...Object.values(boards));
      const created = await call(page, 'POST', '/api/user/tokens', { name: 'e2e text t2', roleCap: 'editor', diagramIds: Object.values(boards).map((b) => b.id) });
      expect(created.status).toBe(201);
      token = created.body.token;
      await page.close();
    });
    const rpc = async (id, method, params) => {
      const r = await fetch(`${BASE_URL}/api/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: `Bearer ${token}` }, body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) });
      const text = await r.text();
      return (r.headers.get('content-type') || '').includes('event-stream') ? text.split('\n').filter((l) => l.startsWith('data:')).map((l) => JSON.parse(l.slice(5)))[0] : JSON.parse(text);
    };

    test.each(T2)('%s: every label is inside its box (or in its declared slot), at least 11 px, and a clamp has its badge', async (packId) => {
      const pack = PACK_CATALOG.find((p) => p.id === packId);
      await rpc(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'e2e', version: '1' } });
      const nodes = [];
      for (const s of pack.stencils) for (const [k, label] of VARIANTS) nodes.push({ key: `${s.id}_${k}`, label, stencil: `${packId}/${s.id}` });
      let rev = 0;
      for (let i = 0; i < nodes.length; i += 150) {
        const out = await rpc(2 + i, 'tools/call', { name: 'map_structure', arguments: { id: boards[packId].id, baseRevision: rev, layout: 'grid', structure: { nodes: nodes.slice(i, i + 150) } } });
        expect(out.result?.isError).not.toBe(true);
        rev = out.result.structuredContent.revision;
      }
      const page = await newPage();
      await open(page, boards[packId]);
      const g = await geometry(page);
      expect(g.length).toBe(nodes.length);
      checkNodes(g, packId);
      await shot(page, `t2-agent-${packId}.png`);
      await page.close();
    });
  });

  test('legacy board: every T2 stencil at its stored default size with long labels draws inside the boxes and writes nothing', async () => {
    const page = await newPage();
    const els = [];
    let i = 0;
    for (const p of PACK_CATALOG.filter((x) => T2.includes(x.id))) {
      for (const s of p.stencils) {
        const sz = s.defaultSize || { width: 120, height: 60 };
        els.push({ id: `l${i}`, type: s.id, packId: p.id, x: O + (i % 12) * 420, y: O + Math.floor(i / 12) * 360, size: { width: sz.width, height: sz.height }, label: C140, layerId: 'default', properties: {}, ...(s.defaultData ? { data: JSON.parse(JSON.stringify(s.defaultData)) } : {}) });
        i += 1;
      }
    }
    const legacy = (await call(page, 'POST', '/api/diagrams', { type: 'infinite-canvas', name: 'E2E text T2 legacy', content: content(els) })).body;
    cleanup.push(legacy);
    const before = (await call(page, 'GET', `/api/diagrams/${legacy.id}`)).body;
    await open(page, legacy);
    await sleep(6000); // longer than an autosave debounce
    const g = await geometryAll(page, 5100, 4400);
    expect(g.length).toBe(els.length);
    checkNodes(g, 'legacy');
    for (const n of g) { const el = els.find((e) => e.id === n.id); expect([n.id, n.w]).toEqual([n.id, el.size.width]); } // rendering did not resize
    await shot(page, 't2-legacy-board.png');
    const after = (await call(page, 'GET', `/api/diagrams/${legacy.id}`)).body;
    expect(after.revision).toBe(before.revision);
    expect(JSON.stringify(after.content)).toBe(JSON.stringify(before.content));
    await page.close();
  });

  test('connection labels: wrapped, a measured background, tspans inside it, and clear of every node', async () => {
    const page = await newPage();
    const node = (id, x, y, w, h, label) => ({ id, type: 'rectangle', packId: 'core', x: O + x, y: O + y, size: { width: w, height: h }, label, color: '#4FB3CE', layerId: 'default', properties: {} });
    const els = [node('a', 0, 100, 120, 80, 'A'), node('b', 700, 100, 120, 80, 'B'), node('c', 330, 60, 160, 160, 'In the way'), node('d', 0, 400, 120, 80, 'D'), node('e', 500, 400, 120, 80, 'E')];
    const conns = [
      { id: 'k1', sourceId: 'a', targetId: 'b', sourcePort: 'right', targetPort: 'left', type: 'sequence-flow', lineStyle: 'straight', label: 'Validate payment details before confirming the customer order' },
      { id: 'k2', sourceId: 'd', targetId: 'e', sourcePort: 'right', targetPort: 'left', type: 'sequence-flow', lineStyle: 'straight', label: C140 },
    ];
    const d = (await call(page, 'POST', '/api/diagrams', { type: 'infinite-canvas', name: 'E2E text T2 connection labels', content: content(els, conns) })).body;
    cleanup.push(d);
    await open(page, d, '.connection-label');
    const labels = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('[data-node-id]')].map((n) => { const r = n.getBoundingClientRect(); return { id: n.getAttribute('data-node-id'), l: r.left, t: r.top, r: r.right, b: r.bottom }; });
      return [...document.querySelectorAll('.connection-label')].map((g) => {
        const rect = g.querySelector('rect').getBoundingClientRect();
        const text = g.querySelector('text');
        const tr = [...g.querySelectorAll('tspan')].map((t) => { const b = t.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, s: t.textContent }; });
        const hit = nodes.filter((n) => rect.left < n.r && rect.right > n.l && rect.top < n.b && rect.bottom > n.t).map((n) => n.id);
        return { w: rect.width, h: rect.height, rect: { l: rect.left, r: rect.right, t: rect.top, b: rect.bottom }, tspans: tr, overflow: text.getAttribute('data-overflow') === 'true', title: text.querySelector('title') ? text.querySelector('title').textContent : null, font: parseFloat(text.getAttribute('data-font-size')), hit };
      });
    });
    expect(labels).toHaveLength(2);
    for (const l of labels) {
      expect(l.w).toBeLessThanOrEqual(201);
      expect(l.font).toBeGreaterThanOrEqual(11);
      expect(l.hit).toEqual([]); // no collision with any node
      for (const t of l.tspans) {
        expect(t.l).toBeGreaterThanOrEqual(l.rect.l - 1);
        expect(t.r).toBeLessThanOrEqual(l.rect.r + 1);
        expect(t.t).toBeGreaterThanOrEqual(l.rect.t - 1);
        expect(t.b).toBeLessThanOrEqual(l.rect.b + 1);
      }
    }
    expect(labels[0].tspans.length).toBeGreaterThan(1); // wrapped, not one long line
    expect(labels[1].overflow).toBe(true); // 140 characters: clamped to 3 lines with the tooltip
    expect(labels[1].title).toBe(C140);
    await shot(page, 't2-connection-labels.png');
    await page.close();
  });

  test('table cells: pinned lines inside their cell; a clamped cell is flagged with its full text and the row height is exact', async () => {
    const page = await newPage();
    const table = {
      headerRow: true, headerColumn: false,
      columns: [{ id: 'col-c1', name: 'Component', type: 'text', width: 160 }, { id: 'col-c2', name: 'Notes', type: 'text', width: 200 }],
      rows: [{ id: 'row-r1', cells: { 'col-c1': 'Gateway', 'col-c2': C140 } }, { id: 'row-r2', cells: { 'col-c1': 'Customer Order Service', 'col-c2': C140.repeat(3) } }],
    };
    const size = tableElementSize(table);
    const els = [{ id: 't1', type: 'table', packId: 'core', x: O, y: O, size, label: 'Inventory', layerId: 'default', properties: {}, data: { table } }];
    const d = (await call(page, 'POST', '/api/diagrams', { type: 'infinite-canvas', name: 'E2E text T2 table', content: content(els) })).body;
    cleanup.push(d);
    await open(page, d, '.ds-tbl-text');
    const res = await page.evaluate(() => [...document.querySelectorAll('[role="gridcell"][data-row-id][data-col-id]')].map((c) => {
      const cr = c.getBoundingClientRect();
      const t = c.querySelector('.ds-tbl-text');
      const tn = t && [...t.childNodes].find((n) => n.nodeType === 3);
      const rects = [];
      if (tn) { const r = document.createRange(); r.selectNodeContents(tn); for (const b of r.getClientRects()) if (b.width > 0) rects.push({ l: b.left - cr.left, r: cr.right - b.right, t: b.top - cr.top, b: cr.bottom - b.bottom }); }
      return { row: c.getAttribute('data-row-id'), col: c.getAttribute('data-col-id'), h: cr.height, w: cr.width, lines: t ? t.textContent.split('\n') : [], flagged: t ? t.getAttribute('data-text-overflow') === 'true' : false, title: t ? t.getAttribute('title') : null, rects };
    }));
    for (const c of res) for (const r of c.rects) { expect(r.l).toBeGreaterThanOrEqual(-1); expect(r.r).toBeGreaterThanOrEqual(-1); expect(r.t).toBeGreaterThanOrEqual(-1); expect(r.b).toBeGreaterThanOrEqual(-1); }
    const notes2 = res.find((c) => c.row === 'row-r2' && c.col === 'col-c2');
    expect(notes2.flagged).toBe(true);
    expect(notes2.title).toBe(C140.repeat(3));
    expect(notes2.lines).toHaveLength(5);
    expect(notes2.lines[4].endsWith('…')).toBe(true);
    const notes1 = res.find((c) => c.row === 'row-r1' && c.col === 'col-c2');
    expect(notes1.flagged).toBe(false);
    expect(notes1.lines.join(' ')).toBe(cellLayout(C140, 200).lines.map((l) => l.text).join(' '));
    // the row height is the shared layout's: lines x 17 + 14
    expect(Math.abs(Math.round(notes2.h) - (5 * 17 + 14))).toBeLessThanOrEqual(1); // minus the 1 px row border
    await shot(page, 't2-table.png');
    await page.close();
  });
});
