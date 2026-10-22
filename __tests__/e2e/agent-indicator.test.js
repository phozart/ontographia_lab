/**
 * E2E: LA-2 agent indicator (ADR-0006 5.1). An MCP agent acts for user A (token owner). A sees "reading" and the dashed
 * read-focus box within one poll; a second user B with read access (viewer) sees nothing for that read, but sees
 * "editing" when the agent writes; after 20 s the pill turns muted ("recent").
 * Needs the app at TEST_BASE_URL and QA_ADMIN_* (owner A) / QA_USER_* (viewer B) from .env.qa.local.
 * Creates its own diagram and deletes it afterwards. E2E_SHOTS_DIR saves screenshots.
 */
const path = require('path');
const puppeteer = require('puppeteer');
const { headlessMode } = require('../helpers/headless');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.qa.local') });

jest.setTimeout(180000);
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3002';
const SHOTS = process.env.E2E_SHOTS_DIR || '';

const el = (id, x, y, label) => ({ id, type: 'rectangle', x: 50000 + x, y: 50000 + y, size: { width: 140, height: 60 }, label: label || `Box ${id}`, color: '#4FB3CE' });
const content = (elements) => ({ elements, connections: [], layers: [], groups: [], viewport: { x: 0, y: 0, zoom: 1 } });

describe('Agent indicator (LA-2)', () => {
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
  const pill = (page) => page.$eval('[data-testid="agent-pill"]', (n) => ({ text: n.textContent, state: n.getAttribute('data-state') })).catch(() => null);
  const shot = async (page, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name) }); } };

  beforeAll(async () => {
    browser = await puppeteer.launch({ headless: headlessMode(), args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
    await login('a', process.env.QA_ADMIN_EMAIL, process.env.QA_ADMIN_PASSWORD);
    await login('b', process.env.QA_USER_EMAIL, process.env.QA_USER_PASSWORD);
    const p = await newPage('a');
    diagram = (await call(p, 'POST', '/api/diagrams', { type: 'infinite-canvas', name: 'E2E agent indicator', content: content([el('a', 100, 100), el('b', 400, 100), el('c', 700, 100)]) })).body;
    expect((await call(p, 'POST', `/api/diagrams/${diagram.id}/shares`, { email: process.env.QA_USER_EMAIL, role: 'viewer' })).status).toBeLessThan(300);
    const created = await call(p, 'POST', '/api/user/tokens', { name: 'e2e agent indicator', roleCap: 'editor', diagramIds: [diagram.id] });
    expect(created.status).toBe(201);
    secret = created.body.token;
    await rpc(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'e2e', version: '1' } });
    await p.close();
  });

  afterAll(async () => {
    try {
      const p = await newPage('a');
      const tokens = (await call(p, 'GET', '/api/user/tokens')).body.tokens || [];
      for (const t of tokens.filter((x) => x.name === 'e2e agent indicator')) await call(p, 'DELETE', `/api/user/tokens/${t.id}`);
      if (diagram) await call(p, 'DELETE', `/api/diagrams/${diagram.id}`);
    } catch (e) { /* best effort */ }
    if (browser) await browser.close();
  });

  test('a read is visible to the user the agent acts for (with the focus box) and to nobody else; a write is visible to both', async () => {
    const A = await newPage('a');
    const B = await newPage('b');
    await open(A);
    await open(B);
    expect(await pill(A)).toBeNull();

    // the agent reads a region (board_read_region) on behalf of A
    const read = await rpc(2, 'tools/call', { name: 'board_read_region', arguments: { id: diagram.id, focus: { elementIds: ['a', 'b'] } } });
    expect(read.result?.isError).not.toBe(true);
    await A.waitForSelector('[data-testid="agent-pill"]', { timeout: 6000 });
    const reading = await pill(A);
    expect(reading.state).toBe('reading');
    expect(reading.text).toMatch(/reading/);
    await A.waitForSelector('[data-testid="agent-focus-box"]', { timeout: 2000 });
    await shot(A, 'la2-reading.png');

    // B (viewer) must see nothing for that read, and the probe must not carry it either
    await sleep(4500);
    expect(await pill(B)).toBeNull();
    const probeB = await call(B, 'GET', `/api/diagrams/${diagram.id}/revision?since=0`);
    expect(probeB.body.agents).toEqual([]);
    await shot(B, 'la2-viewer-sees-nothing.png');

    // now the agent writes: both A and B see "editing"
    const h = (await call(A, 'GET', `/api/diagrams/${diagram.id}`)).body;
    const write = await rpc(3, 'tools/call', {
      name: 'diagram_apply_ops',
      arguments: { id: diagram.id, baseRevision: h.revision, ops: [{ op: 'add_element', ref: '@x', type: 'process-flow/task', label: 'Agent step' }] },
    });
    expect(write.result?.isError).not.toBe(true);
    await A.waitForFunction(() => document.querySelector('[data-testid="agent-pill"]')?.getAttribute('data-state') === 'editing', { timeout: 6000 });
    await B.waitForFunction(() => document.querySelector('[data-testid="agent-pill"]')?.getAttribute('data-state') === 'editing', { timeout: 6000 });
    const seenByB = await pill(B);
    expect(seenByB.text).toMatch(/Agent for/); // not the client label: someone else's agent
    await shot(A, 'la2-editing-owner.png');
    await shot(B, 'la2-editing-viewer.png');

    // the popover names the last tool
    await A.click('[data-testid="agent-pill"]');
    await A.waitForSelector('[data-testid="agent-popover"]', { timeout: 2000 });
    expect(await A.$eval('[data-testid="agent-popover"]', (n) => n.textContent)).toMatch(/edited shapes/);
    await shot(A, 'la2-popover.png');
    await A.keyboard.press('Escape');

    // after 20 s of no calls the pill fades to "recent" (muted)
    await A.waitForFunction(() => document.querySelector('[data-testid="agent-pill"]')?.getAttribute('data-state') === 'recent', { timeout: 40000, polling: 1000 });
    expect((await pill(A)).text).toMatch(/\d+ s ago|just now/);
    await shot(A, 'la2-recent.png');
    await A.close(); await B.close();
  });
});
