/**
 * E2E: ADR-0008 T1 text layout in the real editor.
 *  - editor: type a long label -> the box auto-sizes (and a newline needs Shift+Enter), the label is drawn by the shared
 *    layout, and the DOM lines equal what lib/text computes in Node (the parity test);
 *  - agent: map_structure with the audit's 10 label variants and NO sizes -> every label is inside its box or externally
 *    bounded, never clipped without a badge, never below 11 px;
 *  - "Fit to text" resizes selected boxes in one undo step; opening a legacy board writes nothing (no autosave).
 * Needs the app at TEST_BASE_URL and QA_ADMIN_* from .env.qa.local. Creates its own diagrams and deletes them afterwards.
 * E2E_SHOTS_DIR saves screenshots.
 */
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
const { headlessMode } = require('../helpers/headless');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.qa.local') });
const { layoutForElement } = require('../../lib/text/fit');
const { policyFor } = require('../../lib/text/policy');

jest.setTimeout(300000);
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3002';
const SHOTS = process.env.E2E_SHOTS_DIR || '';
const O = 50000;
const C140 = 'Aggregate all inbound partner shipment notifications, reconcile them against open purchase orders and flag any discrepancies for review';
const VARIANTS = [
  ['w1', 'Billing'], ['w3', 'Customer Order Service'], ['c60', 'Validate payment details before confirming the customer order'], ['c140', C140],
  ['ml', 'Order intake\nValidation\nFulfilment'], ['num', 'p95 latency 250 ms / 1.2k req/s'], ['de', 'Kundenzufriedenheitsanalyse'],
  ['ja', '顧客満足度分析サービス'], ['ar', 'تحليل رضا العملاء'], ['emoji', '🚀 Launch readiness ✅'],
];

const rect = (id, x, y, label, extra = {}) => ({ id, type: 'rectangle', packId: 'core', x: O + x, y: O + y, size: { width: 120, height: 80 }, label, color: '#4FB3CE', layerId: 'default', properties: {}, ...extra });
const content = (elements) => ({ elements, connections: [], layers: [], groups: [], viewport: { x: 0, y: 0, zoom: 1 } });

describe('Text layout and autosizing (ADR-0008 T1)', () => {
  let browser; let context; let board; let agentBoard; let legacyBoard;
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
  async function open(page, d) {
    await page.goto(`${BASE_URL}/diagram/${d.short_id}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForSelector('[data-node-id]', { timeout: 60000 });
    await sleep(1500);
  }
  /** One record per node: its box, every text line's rect, font sizes and whether a badge accompanies a clamp. */
  const geometry = (page) => page.evaluate(() => [...document.querySelectorAll('[data-node-id]')].map((n) => {
    const nr = n.getBoundingClientRect();
    // each text block is one text node of newline-joined lines (or line spans for RTL): measure every line box with a Range
    const lines = [];
    for (const block of n.querySelectorAll('[data-text-block]')) {
      const font = parseFloat(getComputedStyle(block).fontSize);
      const spans = [...block.querySelectorAll(':scope > .ds-text-line')];
      const texts = spans.length ? spans.map((x) => x.textContent.replace(/\n$/, '')) : [...block.childNodes].filter((c) => c.nodeType === 3).map((c) => c.nodeValue).join('').split('\n');
      const rects = [];
      if (spans.length) spans.forEach((x) => { const r = document.createRange(); r.selectNodeContents(x); const b2 = r.getBoundingClientRect(); rects.push(b2); });
      else {
        const tn = [...block.childNodes].find((c) => c.nodeType === 3);
        if (tn) { const r = document.createRange(); r.selectNodeContents(tn); for (const b2 of r.getClientRects()) if (b2.width > 0) rects.push(b2); }
      }
      texts.forEach((t, i) => { const t2 = rects[i] || rects[rects.length - 1] || nr; lines.push({ text: t.trim(), left: t2.left - nr.left, right: nr.right - t2.right, top: t2.top - nr.top, bottom: nr.bottom - t2.bottom, w: t2.width, font }); });
    }
    return { id: n.getAttribute('data-node-id'), type: n.getAttribute('data-type'), label: (lines[0] || {}).text, w: nr.width, h: nr.height, lines, overflow: !!n.querySelector('[data-overflow="true"]'), badge: !!n.querySelector('.ds-text-badge'), below: !!n.querySelector('.ds-node-label-below') };
  }));

  beforeAll(async () => {
    browser = await puppeteer.launch({ headless: headlessMode(), args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
    context = await browser.createBrowserContext();
    const p = await context.newPage();
    await p.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0', timeout: 90000 });
    await p.type('#email', process.env.QA_ADMIN_EMAIL);
    await p.type('#password', process.env.QA_ADMIN_PASSWORD);
    await Promise.all([p.waitForFunction(() => !window.location.pathname.startsWith('/login'), { timeout: 30000 }), p.click('button[type="submit"]')]);
    await p.close();
    const page = await newPage();
    board = (await call(page, 'POST', '/api/diagrams', { type: 'infinite-canvas', name: 'E2E text editor', content: content([rect('r1', 0, 0, 'Billing'), rect('r2', 400, 0, C140), rect('r3', 800, 0, 'Fit me'), rect('r4', 1200, 0, 'Accent', { showLabel: false })]) })).body;
    agentBoard = (await call(page, 'POST', '/api/diagrams', { type: 'infinite-canvas', name: 'E2E text agent', content: content([]) })).body;
    legacyBoard = (await call(page, 'POST', '/api/diagrams', { type: 'infinite-canvas', name: 'E2E text legacy', content: content([rect('l1', 0, 0, C140), rect('l2', 400, 0, 'Kundenzufriedenheitsanalyse', { size: { width: 100, height: 40 } })]) })).body;
    await page.close();
  });

  afterAll(async () => {
    try {
      const p = await newPage();
      for (const d of [board, agentBoard, legacyBoard]) if (d) await call(p, 'DELETE', `/api/diagrams/${d.id}`);
      const tokens = (await call(p, 'GET', '/api/user/tokens')).body?.tokens || [];
      for (const t of tokens.filter((x) => x.name === 'e2e text')) await call(p, 'DELETE', `/api/user/tokens/${t.id}`);
    } catch (e) { /* best effort */ }
    if (browser) await browser.close();
  });

  test('legacy boards: opening one draws wrapped, shrunk or badged labels inside the stored boxes and writes nothing', async () => {
    const page = await newPage();
    const before = (await call(page, 'GET', `/api/diagrams/${legacyBoard.id}`)).body;
    await open(page, legacyBoard);
    await sleep(6000); // longer than an autosave debounce
    const g = await geometry(page);
    const l1 = g.find((n) => n.id === 'l1');
    expect(l1.w).toBe(120);
    for (const line of l1.lines) {
      expect(line.left).toBeGreaterThanOrEqual(-1);
      expect(line.right).toBeGreaterThanOrEqual(-1);
      expect(line.top).toBeGreaterThanOrEqual(-1);
      expect(line.bottom).toBeGreaterThanOrEqual(-1);
      expect(line.font).toBeGreaterThanOrEqual(11);
    }
    expect(l1.badge).toBe(true); // 140 characters cannot fit 120x80: clamped, with the indicator
    const l2 = g.find((n) => n.id === 'l2');
    expect(l2.lines.every((l) => l.font >= 11)).toBe(true);
    await shot(page, 'text-legacy-board.png');
    const after = (await call(page, 'GET', `/api/diagrams/${legacyBoard.id}`)).body;
    expect(after.revision).toBe(before.revision); // rendering never writes
    expect(JSON.stringify(after.content)).toBe(JSON.stringify(before.content));
    await page.close();
  });

  test('editor: a long label auto-sizes the box, Shift+Enter is a newline, Enter commits, and the DOM lines equal the shared layout', async () => {
    const page = await newPage();
    await open(page, board);
    const sel = '[data-node-id="r1"]';
    // a decorative shape with showLabel: false (the slide accent bar) draws no label at all
    expect((await geometry(page)).find((n) => n.id === 'r4').lines).toHaveLength(0);
    const box0 = await page.$eval(sel, (n) => ({ w: n.offsetWidth, h: n.offsetHeight }));
    expect(box0).toEqual({ w: 120, h: 80 });
    await page.click(sel, { clickCount: 2 });
    await page.waitForSelector(`${sel} textarea`);
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.keyboard.type('Line one', { delay: 5 });
    await page.keyboard.down('Shift');
    await page.keyboard.press('Enter');
    await page.keyboard.up('Shift');
    expect(await page.$eval(`${sel} textarea`, (t) => t.value)).toBe('Line one\n'); // still editing: a newline, not a commit
    await page.keyboard.type(C140, { delay: 1 });
    await page.keyboard.press('Enter');
    await page.waitForFunction((s) => !document.querySelector(`${s} textarea`), {}, sel);
    await sleep(800);
    const g = (await geometry(page)).find((n) => n.id === 'r1');
    expect(g.w).toBeGreaterThan(120);
    expect(g.w).toBeLessThanOrEqual(240);
    expect(g.h).toBeGreaterThan(80);
    expect(g.badge).toBe(false); // the box grew instead of clipping
    for (const line of g.lines) {
      expect(line.left).toBeGreaterThanOrEqual(-1);
      expect(line.right).toBeGreaterThanOrEqual(-1);
      expect(line.top).toBeGreaterThanOrEqual(-1);
      expect(line.bottom).toBeGreaterThanOrEqual(-1);
      expect(line.font).toBe(14);
    }
    // parity: the lines the browser drew are the lines lib/text computes in Node for the same element
    let stored;
    for (let i = 0; i < 40; i++) { // wait for the autosave
      stored = (await call(page, 'GET', `/api/diagrams/${board.id}`)).body.content.elements.find((e) => e.id === 'r1');
      if (stored.label !== 'Billing') break;
      await sleep(500);
    }
    expect(stored.label).toBe(`Line one\n${C140}`);
    const policy = policyFor('core', { id: 'rectangle', shape: 'rect', defaultSize: { width: 120, height: 80 } });
    const expected = layoutForElement({ ...stored }, policy).layout.lines.map((l) => l.text);
    expect(g.lines.map((l) => l.text)).toEqual(expected);
    await shot(page, 'text-editor-autosize.png');
    await page.close();
  });

  test('"Fit to text" resizes the selection in one undo step', async () => {
    const page = await newPage();
    await open(page, board);
    const r2 = '[data-node-id="r2"]';
    const before = await page.$eval(r2, (n) => ({ w: n.offsetWidth, h: n.offsetHeight }));
    expect(before).toEqual({ w: 120, h: 80 }); // a stored legacy size: rendering did not resize it
    await page.click(r2);
    await page.waitForSelector('[data-testid="fit-to-text"]', { timeout: 10000 });
    await page.click('[data-testid="fit-to-text"]');
    await page.waitForFunction((sel) => document.querySelector(sel).offsetWidth > 120, { timeout: 10000 }, r2).catch(() => {});
    await sleep(300);
    const after = await page.$eval(r2, (n) => ({ w: n.offsetWidth, h: n.offsetHeight }));
    expect(after.w).toBeGreaterThan(120);
    expect(after.h).toBeGreaterThan(80);
    const g = (await geometry(page)).find((n) => n.id === 'r2');
    expect(g.badge).toBe(false);
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyZ');
    await page.keyboard.up('Control');
    await sleep(500);
    expect(await page.$eval(r2, (n) => ({ w: n.offsetWidth, h: n.offsetHeight }))).toEqual(before);
    await page.close();
  });

  test('an agent: map_structure with long labels and no sizes gives boxes that fit (no clipping without an indicator)', async () => {
    const page = await newPage();
    const created = await call(page, 'POST', '/api/user/tokens', { name: 'e2e text', roleCap: 'editor', diagramIds: [agentBoard.id] });
    expect(created.status).toBe(201);
    const secret = created.body.token;
    const rpc = async (id, method, params) => {
      const r = await fetch(`${BASE_URL}/api/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: `Bearer ${secret}` }, body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) });
      const text = await r.text();
      return (r.headers.get('content-type') || '').includes('event-stream') ? text.split('\n').filter((l) => l.startsWith('data:')).map((l) => JSON.parse(l.slice(5)))[0] : JSON.parse(text);
    };
    await rpc(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'e2e', version: '1' } });
    let rev = 0;
    for (const [i, stencil] of ['core/rectangle', 'process-flow/task', 'sticky-notes/sticky-medium', 'process-flow/start-event'].entries()) {
      const out = await rpc(2 + i, 'tools/call', { name: 'map_structure', arguments: { id: agentBoard.id, baseRevision: rev, layout: 'grid', structure: { nodes: VARIANTS.map(([k, label]) => ({ key: `${stencil.replace('/', '_')}_${k}`, label, stencil })) } } });
      expect(out.result?.isError).not.toBe(true);
      rev = out.result.structuredContent.revision;
    }
    await open(page, agentBoard);
    const g = await geometry(page);
    expect(g).toHaveLength(40);
    for (const n of g) {
      for (const line of n.lines) expect([n.type, n.label, line.font >= 11]).toEqual([n.type, n.label, true]);
      if (n.overflow) expect([n.type, n.label, n.badge]).toEqual([n.type, n.label, true]); // never silent
      if (!n.below) {
        for (const line of n.lines) {
          expect([n.type, n.label, line.left >= -1.5 && line.right >= -1.5 && line.top >= -1.5 && line.bottom >= -1.5]).toEqual([n.type, n.label, true]);
        }
      } else {
        for (const line of n.lines) expect(line.w).toBeLessThanOrEqual(242); // an external label wraps at max(2w, 120) and widens to 240 for one long word
        expect(n.lines.length).toBeLessThanOrEqual(3);
      }
    }
    // the long labels that fit were given room by the server instead of being clipped
    const rectC140 = g.find((n) => n.type === 'rectangle' && n.label && n.label.startsWith('Aggregate'));
    expect(rectC140.w).toBeGreaterThan(120);
    expect(rectC140.badge).toBe(false);
    await shot(page, 'text-agent-map-structure.png');
    await page.close();
  });
});
