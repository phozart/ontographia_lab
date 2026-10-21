/**
 * E2E: LA-3 activity panel (ADR-0006 5.3). Owner A, editor B (saves through the API) and an MCP agent acting for A.
 * The Activity tab lists B's session and the agent step, with a working Review link that opens the right diff; the
 * owner also sees the sharing event; B, demoted to viewer, still reads content activity but gets no sharing events.
 * Needs the app at TEST_BASE_URL and QA_ADMIN_* (owner A) / QA_USER_* (B) from .env.qa.local.
 * Creates its own diagram and deletes it afterwards. E2E_SHOTS_DIR saves screenshots.
 */
const path = require('path');
const puppeteer = require('puppeteer');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.qa.local') });

jest.setTimeout(180000);
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3002';
const SHOTS = process.env.E2E_SHOTS_DIR || '';

const el = (id, x, y, label) => ({ id, type: 'rectangle', x: 50000 + x, y: 50000 + y, size: { width: 140, height: 60 }, label: label || `Box ${id}`, color: '#4FB3CE' });
const content = (elements) => ({ elements, connections: [], layers: [], groups: [], viewport: { x: 0, y: 0, zoom: 1 } });

describe('Activity panel (LA-3)', () => {
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
  async function saveAsB(pageB, label) {
    const h = await head(pageB);
    const put = await call(pageB, 'PUT', `/api/diagrams/${diagram.id}`, { content: { ...h.content, elements: [...h.content.elements, el(`b${Date.now()}${Math.floor(Math.random() * 1000)}`, 100 + Math.floor(Math.random() * 400), 500, label)] } }, { 'If-Match': `"${h.revision}"` });
    expect(put.status).toBe(200);
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
  const shot = async (page, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name) }); } };
  const text = (page, sel) => page.$eval(sel, (n) => n.textContent);

  beforeAll(async () => {
    browser = await puppeteer.launch({ headless: process.env.HEADLESS !== 'false', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
    await login('a', process.env.QA_ADMIN_EMAIL, process.env.QA_ADMIN_PASSWORD);
    await login('b', process.env.QA_USER_EMAIL, process.env.QA_USER_PASSWORD);
    const p = await newPage('a');
    diagram = (await call(p, 'POST', '/api/diagrams', { type: 'infinite-canvas', name: 'E2E activity', content: content([el('a', 100, 100), el('b', 400, 100)]) })).body;
    expect((await call(p, 'POST', `/api/diagrams/${diagram.id}/shares`, { email: process.env.QA_USER_EMAIL, role: 'editor' })).status).toBeLessThan(300);
    const created = await call(p, 'POST', '/api/user/tokens', { name: 'e2e activity', roleCap: 'editor', diagramIds: [diagram.id] });
    expect(created.status).toBe(201);
    secret = created.body.token;
    await rpc(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'e2e', version: '1' } });
    await p.close();
  });

  afterAll(async () => {
    try {
      const p = await newPage('a');
      const tokens = (await call(p, 'GET', '/api/user/tokens')).body.tokens || [];
      for (const t of tokens.filter((x) => x.name === 'e2e activity')) await call(p, 'DELETE', `/api/user/tokens/${t.id}`);
      if (diagram) await call(p, 'DELETE', `/api/diagrams/${diagram.id}`);
    } catch (e) { /* best effort */ }
    if (browser) await browser.close();
  });

  test('the panel lists B\'s session and the agent step; Review opens the right diff; the owner also sees sharing; a viewer does not', async () => {
    const A = await newPage('a');
    const B = await newPage('b');
    // B saves three times (one session), then the agent adds a step (an audit row with the tool name)
    await saveAsB(B, 'B one'); await saveAsB(B, 'B two'); await saveAsB(B, 'B three');
    const h = await head(A);
    const out = await rpc(2, 'tools/call', {
      name: 'diagram_apply_ops',
      arguments: { id: diagram.id, baseRevision: h.revision, ops: [{ op: 'add_element', ref: '@x', type: 'process-flow/task', label: 'Agent step' }] },
    });
    expect(out.result?.isError).not.toBe(true);

    await open(A);
    // the pill's popover offers "Open activity"
    await A.waitForSelector('[data-testid="agent-pill"]', { timeout: 6000 });
    await A.click('[data-testid="agent-pill"]');
    await A.waitForSelector('[data-testid="agent-popover"]', { timeout: 2000 });
    const [openActivity] = await A.$$('xpath/.//button[contains(., "Open activity")]');
    expect(openActivity).toBeTruthy();
    await openActivity.click();
    await A.waitForSelector('[role="tab"][aria-selected="true"]', { timeout: 5000 });
    expect(await A.$eval('[role="tab"][aria-selected="true"]', (n) => n.textContent)).toBe('Activity');

    // B's session and the agent step
    await A.waitForFunction(() => /3 saves/.test(document.body.textContent) && /map_structure|diagram_apply_ops/.test(document.body.textContent), { timeout: 8000 });
    const panelText = await A.$eval('aside[role="complementary"]', (n) => n.textContent);
    expect(panelText).toMatch(/qa-user/);
    expect(panelText).toMatch(/diagram_apply_ops/);
    expect(panelText).toMatch(/\+1/);
    expect(panelText).toMatch(/shared with qa-user as editor/); // the owner sees sharing events
    expect(panelText).not.toMatch(/@/); // display names only, never e-mail addresses
    await shot(A, 'la3-activity-owner.png');

    // Review opens the diff of exactly that agent edit
    const [review] = await A.$$('xpath/.//aside//button[contains(., "Review")]');
    expect(review).toBeTruthy();
    await review.click();
    await A.waitForSelector('section[aria-label="Changes"]', { timeout: 8000 });
    const changes = await A.$eval('section[aria-label="Changes"]', (n) => n.textContent);
    expect(changes).toMatch(/Agent step/);
    expect(changes).toMatch(/1 added/);
    await shot(A, 'la3-review.png');

    // the saves-session has a Compare link that also works
    const [compare] = await A.$$('xpath/.//aside//button[starts-with(normalize-space(.), "Compare")]');
    if (compare) {
      await compare.click();
      await A.waitForFunction(() => document.querySelectorAll('section[aria-label="Changes"]').length >= 1, { timeout: 8000 });
    }

    // demote B to a viewer: content activity yes, sharing events no
    const access = (await call(A, 'GET', `/api/diagrams/${diagram.id}/access`)).body;
    const bMember = (access.members || []).find((m) => (m.user?.name || '').includes('qa-user') || m.role === 'editor');
    expect(bMember).toBeTruthy();
    const demote = await call(A, 'PUT', `/api/diagrams/${diagram.id}/members/${bMember.user.id}`, { role: 'viewer' });
    expect(demote.status).toBeLessThan(300);
    const asViewer = (await call(B, 'GET', `/api/diagrams/${diagram.id}/activity?limit=50`)).body;
    const kinds = asViewer.items.map((i) => i.kind);
    expect(kinds).toContain('agent_edit');
    expect(kinds).toContain('edit_session');
    expect(kinds).not.toContain('share');
    expect(JSON.stringify(asViewer)).not.toMatch(/@/);
    const asOwner = (await call(A, 'GET', `/api/diagrams/${diagram.id}/activity?limit=50`)).body;
    expect(asOwner.items.map((i) => i.kind)).toContain('share');
    const agentItem = asOwner.items.find((i) => i.kind === 'agent_edit');
    expect(agentItem.agent.tool).toBe('diagram_apply_ops');

    // the viewer opens the panel and sees the same content activity (no sharing line)
    await open(B);
    await B.waitForSelector('[title="Menu"]', { timeout: 5000 });
    await B.click('[title="Menu"]');
    const [item] = await B.$$('xpath/.//button[contains(., "Activity...")]');
    expect(item).toBeTruthy();
    await item.click();
    await B.waitForFunction(() => /diagram_apply_ops/.test(document.querySelector('aside[role="complementary"]')?.textContent || ''), { timeout: 8000 });
    const viewerText = await B.$eval('aside[role="complementary"]', (n) => n.textContent);
    expect(viewerText).not.toMatch(/shared with/);
    await shot(B, 'la3-activity-viewer.png');
    await A.close(); await B.close();
  });
});
