/**
 * E2E: LA-1 change highlight (ADR-0006). Editor A has the board open; user B (editor) or an MCP agent writes.
 * A must ring exactly what changed: cyan for a person, lavender for an agent; reduced motion holds a static ring;
 * an off-screen change shows the edge chip, which pans there.
 * Needs the app at TEST_BASE_URL and QA_ADMIN_* (owner, editor A) / QA_USER_* (editor B) from .env.qa.local.
 * Creates its own diagram and deletes it afterwards. E2E_SHOTS_DIR saves screenshots.
 */
const path = require('path');
const puppeteer = require('puppeteer');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.qa.local') });

jest.setTimeout(150000);
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3002';
const SHOTS = process.env.E2E_SHOTS_DIR || '';

const el = (id, x, y, label) => ({ id, type: 'rectangle', x: 50000 + x, y: 50000 + y, size: { width: 140, height: 60 }, label: label || `Box ${id}`, color: '#4FB3CE' });
const content = (elements) => ({ elements, connections: [], layers: [], groups: [], viewport: { x: 0, y: 0, zoom: 1 } });

describe('Change highlight (LA-1)', () => {
  let browser; const contexts = {}; let diagram; let secret;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function login(who, email, password) {
    contexts[who] = await browser.createBrowserContext();
    const p = await contexts[who].newPage();
    await p.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
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
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    return page;
  }
  const call = (page, method, url, body, headers = {}) => page.evaluate(async (m, u, b, h) => {
    const r = await fetch(u, { method: m, headers: { 'Content-Type': 'application/json', ...h }, body: b ? JSON.stringify(b) : undefined });
    let json = null; try { json = await r.json(); } catch (e) { /* none */ }
    return { status: r.status, body: json };
  }, method, url, body, headers);
  const head = async (page) => (await call(page, 'GET', `/api/diagrams/${diagram.id}`)).body;
  async function writeAsB(pageB, mutate) {
    const h = await head(pageB);
    const next = mutate(h.content.elements);
    const put = await call(pageB, 'PUT', `/api/diagrams/${diagram.id}`, { content: { ...h.content, elements: next } }, { 'If-Match': `"${h.revision}"` });
    expect(put.status).toBe(200);
    return put.body.revision;
  }
  async function open(page) {
    await page.goto(`${BASE_URL}/diagram/${diagram.short_id}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.ds-canvas-container', { timeout: 30000 });
    await page.waitForSelector('[data-node-id]', { timeout: 30000 });
    await sleep(1500);
  }
  const rpc = async (id, method, params) => {
    const r = await fetch(`${BASE_URL}/api/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
    });
    const text = await r.text();
    return (r.headers.get('content-type') || '').includes('event-stream')
      ? text.split('\n').filter((l) => l.startsWith('data:')).map((l) => JSON.parse(l.slice(5)))[0]
      : JSON.parse(text);
  };
  const rings = (page) => page.$$eval('[data-testid="remote-ring"]', (ns) => ns.map((n) => ({ kind: n.getAttribute('data-kind'), agent: n.getAttribute('data-agent'), motion: n.getAttribute('data-motion'), color: n.style.getPropertyValue('--hl-color') })));
  const shot = async (page, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name) }); } };

  beforeAll(async () => {
    browser = await puppeteer.launch({ headless: process.env.HEADLESS !== 'false', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
    await login('a', process.env.QA_ADMIN_EMAIL, process.env.QA_ADMIN_PASSWORD);
    await login('b', process.env.QA_USER_EMAIL, process.env.QA_USER_PASSWORD);
    const p = await newPage('a');
    diagram = (await call(p, 'POST', '/api/diagrams', { type: 'infinite-canvas', name: 'E2E highlight', content: content([el('a', 100, 100), el('b', 400, 100), el('c', 700, 100), el('d', 100, 300)]) })).body;
    expect((await call(p, 'POST', `/api/diagrams/${diagram.id}/shares`, { email: process.env.QA_USER_EMAIL, role: 'editor' })).status).toBeLessThan(300);
    const created = await call(p, 'POST', '/api/user/tokens', { name: 'e2e highlight', roleCap: 'editor', diagramIds: [diagram.id] });
    expect(created.status).toBe(201);
    secret = created.body.token;
    await rpc(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'e2e', version: '1' } });
    await p.close();
  });

  afterAll(async () => {
    try {
      const p = await newPage('a');
      const tokens = (await call(p, 'GET', '/api/user/tokens')).body.tokens || [];
      for (const t of tokens.filter((x) => x.name === 'e2e highlight')) await call(p, 'DELETE', `/api/user/tokens/${t.id}`);
      if (diagram) await call(p, 'DELETE', `/api/diagrams/${diagram.id}`);
    } catch (e) { /* best effort */ }
    if (browser) await browser.close();
  });

  test('a person adds 3 and moves 2: exactly those 5 ring in cyan, then fade away; nothing is written by A', async () => {
    const A = await newPage('a');
    const B = await newPage('b');
    await open(A);
    expect(await rings(A)).toEqual([]);
    const revB = await writeAsB(B, (els) => [
      ...els.map((e) => (e.id === 'a' ? { ...e, x: e.x + 80 } : e.id === 'b' ? { ...e, y: e.y + 90 } : e)),
      el('n1', 100, 500), el('n2', 400, 500), el('n3', 700, 500),
    ]);
    await A.waitForSelector('[data-testid="remote-ring"]', { timeout: 6000 });
    const got = await rings(A);
    expect(got).toHaveLength(5);
    expect(got.every((r) => r.kind === 'element' && r.agent === 'false' && r.color.toLowerCase() === '#4fb3ce')).toBe(true);
    await shot(A, 'la1-person-rings.png');
    await A.waitForFunction(() => !document.querySelector('[data-testid="remote-ring"]'), { timeout: 4000 }); // fades and is removed
    await sleep(3500);
    expect((await head(B)).revision).toBe(revB); // picking it up wrote no revision
    await A.close(); await B.close();
  });

  test('an MCP agent adds 3 and moves 2: those 5 ring in lavender', async () => {
    const A = await newPage('a');
    await open(A);
    const h = await head(A);
    const out = await rpc(2, 'tools/call', {
      name: 'diagram_apply_ops',
      arguments: {
        id: diagram.id,
        baseRevision: h.revision,
        ops: [
          { op: 'add_element', ref: '@x', type: 'process-flow/task', label: 'Agent 1', x: 100, y: 700 },
          { op: 'add_element', ref: '@y', type: 'process-flow/task', label: 'Agent 2', x: 400, y: 700 },
          { op: 'add_element', ref: '@z', type: 'process-flow/task', label: 'Agent 3', x: 700, y: 700 },
          { op: 'update_element', id: 'c', x: 750, y: 150 },
          { op: 'update_element', id: 'd', x: 160, y: 340 },
        ],
      },
    });
    expect(out.result?.isError).not.toBe(true);
    await A.waitForSelector('[data-testid="remote-ring"]', { timeout: 6000 });
    const got = await rings(A);
    expect(got).toHaveLength(5);
    expect(got.every((r) => r.agent === 'true' && r.color.toLowerCase() === '#9a8ac8')).toBe(true);
    await shot(A, 'la1-agent-rings.png');
    await A.close();
  });

  test('reduced motion: a static ring that is still there after the normal fade time', async () => {
    const A = await newPage('a');
    const B = await newPage('b');
    await A.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await open(A);
    await writeAsB(B, (els) => els.map((e) => (e.id === 'a' ? { ...e, x: e.x + 30 } : e)));
    await A.waitForSelector('[data-testid="remote-ring"]', { timeout: 6000 });
    expect((await rings(A))[0].motion).toBe('reduced');
    await sleep(2200);
    expect((await rings(A)).length).toBe(1); // a fading ring would be gone by 1.7 s
    await A.waitForFunction(() => !document.querySelector('[data-testid="remote-ring"]'), { timeout: 3000 });
    await A.close(); await B.close();
  });

  test('an off-screen change shows an edge chip that pans to it', async () => {
    const A = await newPage('a');
    const B = await newPage('b');
    await open(A);
    await writeAsB(B, (els) => [...els, el('far', 4500, 100, 'Far away')]);
    await A.waitForSelector('[data-testid="remote-chip"]', { timeout: 6000 });
    expect(await A.$eval('[data-testid="remote-chip"]', (n) => n.textContent)).toMatch(/1 change/);
    await shot(A, 'la1-edge-chip.png');
    await A.click('[data-testid="remote-chip"]');
    await A.waitForFunction(() => {
      const n = document.querySelector('[data-node-id="far"]');
      if (!n) return false;
      const r = n.getBoundingClientRect();
      return r.left >= 0 && r.right <= window.innerWidth && r.top >= 0 && r.bottom <= window.innerHeight;
    }, { timeout: 4000 });
    await A.waitForSelector('[data-testid="remote-ring"]', { timeout: 2000 }); // ring replays at the new spot
    await A.close(); await B.close();
  });
});
