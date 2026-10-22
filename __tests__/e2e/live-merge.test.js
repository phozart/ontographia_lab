/**
 * E2E: AI-2 live pickup and merge. Editor A has the diagram open; user B (editor) writes through the API (what an
 * agent's diagram_apply_ops does: a revision bump by another writer). A must pick the change up without the 409
 * dialog and A's next save must succeed with both sides' changes.
 * Needs the app at TEST_BASE_URL and QA_ADMIN_* (owner, editor A) / QA_USER_* (editor B) from .env.qa.local.
 * Creates its own diagram and deletes it afterwards. E2E_SHOTS_DIR saves screenshots.
 */
const path = require('path');
const puppeteer = require('puppeteer');
const { headlessMode } = require('../helpers/headless');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.qa.local') });

jest.setTimeout(150000);
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3002';
const SHOTS = process.env.E2E_SHOTS_DIR || '';

const el = (id, x, y, label) => ({ id, type: 'rectangle', x: 50000 + x, y: 50000 + y, size: { width: 140, height: 60 }, label: label || `Box ${id}`, color: '#4FB3CE' });
const content = (elements) => ({ elements, connections: [], layers: [], groups: [], viewport: { x: 0, y: 0, zoom: 1 } });

describe('Live pickup and merge (AI-2)', () => {
  let browser; const contexts = {}; let diagram;
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
  // what an agent or second editor does: read the head, add/change elements, PUT with If-Match
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
    await sleep(1500); // let the initial fit/settle finish before interacting
  }
  async function drag(page, id, dx, dy) {
    const box = await (await page.$(`[data-node-id="${id}"]`)).boundingBox();
    const x = box.x + box.width / 2; const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 5 });
    await page.mouse.move(x + dx, y + dy, { steps: 5 });
    await page.mouse.up();
    const after = await (await page.$(`[data-node-id="${id}"]`)).boundingBox();
    if (Math.abs(after.x - box.x) < 20 && Math.abs(after.y - box.y) < 20) throw new Error(`drag of ${id} did not move it`);
  }
  // Hold A's autosave PUT for a while so B's write deterministically lands between A's edit and A's save.
  async function delayPuts(page, ms) {
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (req.method() === 'PUT' && /\/api\/diagrams\/[^/]+$/.test(req.url())) setTimeout(() => req.continue().catch(() => {}), ms);
      else req.continue().catch(() => {});
    });
  }
  const nodeIds = (page) => page.$$eval('[data-node-id]', (ns) => [...new Set(ns.map((n) => n.getAttribute('data-node-id')))].sort());
  const dialogShown = (page) => page.evaluate(() => /changed elsewhere/i.test(document.body.textContent));
  const shot = async (page, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name) }); } };

  beforeAll(async () => {
    browser = await puppeteer.launch({ headless: headlessMode(), args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
    await login('a', process.env.QA_ADMIN_EMAIL, process.env.QA_ADMIN_PASSWORD);
    await login('b', process.env.QA_USER_EMAIL, process.env.QA_USER_PASSWORD);
    const p = await newPage('a');
    diagram = (await call(p, 'POST', '/api/diagrams', { type: 'infinite-canvas', name: 'E2E live merge', content: content([el('a', 100, 100), el('b', 400, 100), el('c', 700, 100)]) })).body;
    expect((await call(p, 'POST', `/api/diagrams/${diagram.id}/shares`, { email: process.env.QA_USER_EMAIL, role: 'editor' })).status).toBeLessThan(300);
    await p.close();
  });

  afterAll(async () => {
    try {
      const p = await newPage('a');
      if (diagram) await call(p, 'DELETE', `/api/diagrams/${diagram.id}`);
    } catch (e) { /* best effort */ }
    if (browser) await browser.close();
  });

  test('clean editor: another writer adds an element and A shows it within 5 s, no dialog, nothing written by A', async () => {
    const A = await newPage('a');
    const B = await newPage('b');
    await open(A);
    expect(await nodeIds(A)).toEqual(['a', 'b', 'c']);
    const revBefore = (await head(B)).revision;
    const versionsBefore = (await call(B, 'GET', `/api/diagrams/${diagram.id}/versions`)).body.items.length;

    const revB = await writeAsB(B, (els) => [...els, el('n', 400, 300, 'Added by B')]);
    await A.waitForFunction(() => document.querySelector('[data-node-id="n"]'), { timeout: 5500 });
    expect(await dialogShown(A)).toBe(false);
    await A.waitForSelector('[data-testid="remote-update-notice"]', { timeout: 2000 });
    expect(await A.$eval('[data-testid="remote-update-notice"]', (n) => n.textContent)).toMatch(/Updated by .*1 added/);
    await shot(A, 'clean-pickup.png');

    // A wrote nothing: revision is exactly B's, and no version was created by A
    await sleep(3500);
    const h = await head(B);
    expect(h.revision).toBe(revB);
    expect(revB).toBe(revBefore + 1);
    expect((await call(B, 'GET', `/api/diagrams/${diagram.id}/versions`)).body.items.length).toBeLessThanOrEqual(versionsBefore + 1);
    await A.close(); await B.close();
  });

  test('A moves an element, B adds another: both survive, A saves on the new revision without a dialog', async () => {
    const A = await newPage('a');
    const B = await newPage('b');
    await delayPuts(A, 2500);
    await open(A);
    const nBefore = (await nodeIds(A)).length;
    await drag(A, 'a', 160, 120); // A is now dirty; autosave fires after ~1 s
    await writeAsB(B, (els) => [...els, el(`m${Date.now()}`, 700, 300, 'B second')]);
    await A.waitForFunction((n) => new Set([...document.querySelectorAll('[data-node-id]')].map((x) => x.getAttribute('data-node-id'))).size === n + 1, { timeout: 8000 }, nBefore);
    expect(await dialogShown(A)).toBe(false);
    // wait for A's autosave to land on the server
    let h;
    for (let i = 0; i < 20; i += 1) {
      await sleep(500);
      h = await head(B);
      const a = h.content.elements.find((e) => e.id === 'a');
      if (a && a.x !== 50000 + 100) break;
    }
    const ids = h.content.elements.map((e) => e.id);
    expect(ids).toEqual(expect.arrayContaining(['a', 'b', 'c', 'n']));
    expect(ids.some((i) => /^m\d+$/.test(i))).toBe(true);
    expect(h.content.elements.find((e) => e.id === 'a').x).toBeGreaterThan(50000 + 100 + 100);
    expect(await dialogShown(A)).toBe(false);
    await shot(A, 'dirty-merge.png');
    // and A's view agrees with the server (no lost update either way)
    expect((await nodeIds(A)).length).toBe(ids.length);
    await A.close(); await B.close();
  });

  test('same element, same field on both sides: A\'s value wins and the notice says so', async () => {
    const A = await newPage('a');
    const B = await newPage('b');
    await delayPuts(A, 2500);
    await open(A);
    await drag(A, 'c', 0, 150);
    await writeAsB(B, (els) => els.map((e) => (e.id === 'c' ? { ...e, y: 50000 + 900 } : e)));
    await A.waitForSelector('[data-testid="remote-update-conflicts"]', { timeout: 8000 });
    expect(await A.$eval('[data-testid="remote-update-conflicts"]', (n) => n.textContent)).toMatch(/your edits were kept/i);
    expect(await dialogShown(A)).toBe(false);
    let c;
    for (let i = 0; i < 20; i += 1) {
      await sleep(500);
      c = (await head(B)).content.elements.find((e) => e.id === 'c');
      if (c.y !== 50000 + 900) break;
    }
    expect(c.y).toBeGreaterThan(50000 + 100 + 50); // A's drag result
    expect(c.y).not.toBe(50000 + 900);
    await shot(A, 'conflict-notice.png');
    await A.close(); await B.close();
  });

  test('typing a label while B relabels the same shape: the typed text is not overwritten, local wins on commit', async () => {
    const A = await newPage('a');
    const B = await newPage('b');
    await open(A);
    await A.click('[data-node-id="b"]', { count: 2, delay: 40 });
    await A.waitForSelector('[data-node-id="b"] input', { timeout: 5000 });
    await A.keyboard.type(' typed locally');
    await writeAsB(B, (els) => els.map((e) => (e.id === 'b' ? { ...e, label: 'Relabelled by B' } : e)));
    await sleep(5500); // longer than a poll interval: the pickup must wait for the open editor
    const mid = await A.$eval('[data-node-id="b"] input', (i) => i.value);
    expect(mid).toContain('typed locally');
    expect(mid).not.toContain('Relabelled by B');
    await A.keyboard.press('Enter');
    let b;
    for (let i = 0; i < 24; i += 1) {
      await sleep(500);
      b = (await head(B)).content.elements.find((e) => e.id === 'b');
      if (/typed locally/.test(b.label)) break;
    }
    expect(b.label).toMatch(/typed locally/);
    expect(await dialogShown(A)).toBe(false);
    await shot(A, 'label-typing.png');
    await A.close(); await B.close();
  });

  test('a dirty tab does not revert a rename made by B', async () => {
    const A = await newPage('a');
    const B = await newPage('b');
    await delayPuts(A, 2500);
    await open(A);
    await drag(A, 'a', 80, 60);
    const h = await head(B);
    const put = await call(B, 'PUT', `/api/diagrams/${diagram.id}`, { name: 'Renamed by B', content: { ...h.content, elements: [...h.content.elements, el(`r${Date.now()}`, 700, 400, 'B add')] } }, { 'If-Match': `"${h.revision}"` });
    expect(put.status).toBe(200);
    let saved;
    for (let i = 0; i < 24; i += 1) {
      await sleep(500);
      saved = await head(B);
      if (saved.revision > put.body.revision) break;
    }
    expect(saved.revision).toBeGreaterThan(put.body.revision); // A's autosave landed on top
    expect(saved.name).toBe('Renamed by B');
    expect(await dialogShown(A)).toBe(false);
    await A.close(); await B.close();
  });

  test('a save racing a slow pickup (full GET delayed 3.5 s) ends merged, never in the dialog', async () => {
    const A = await newPage('a');
    const B = await newPage('b');
    await A.setRequestInterception(true);
    A.on('request', (req) => {
      if (req.method() === 'GET' && /\/api\/diagrams\/[^/?]+$/.test(req.url())) setTimeout(() => req.continue().catch(() => {}), 3500);
      else req.continue().catch(() => {});
    });
    await open(A);
    await drag(A, 'c', 0, 120);
    const revB = await writeAsB(B, (els) => [...els, el(`s${Date.now()}`, 100, 500, 'B slow')]);
    let saved;
    for (let i = 0; i < 40; i += 1) {
      await sleep(500);
      saved = await head(B);
      if (saved.revision > revB) break;
    }
    expect(saved.revision).toBeGreaterThan(revB);
    expect(await dialogShown(A)).toBe(false);
    expect(saved.content.elements.some((e) => /^s\d+$/.test(e.id))).toBe(true);
    expect(saved.content.elements.find((e) => e.id === 'c').y).toBeGreaterThan(50000 + 100 + 50);
    await A.close(); await B.close();
  });

  test('a real diagram_apply_ops call (editor token, allowlist) shows up in the open editor: no dialog, "Updated by an agent", Review agent change opens compare', async () => {
    const A = await newPage('a');
    await open(A);
    const created = await call(A, 'POST', '/api/user/tokens', { name: 'e2e live merge', roleCap: 'editor', diagramIds: [diagram.id] });
    expect(created.status).toBe(201);
    const secret = created.body.token;
    try {
      const rpc = async (id, method, params) => {
        const r = await fetch(`${BASE_URL}/api/mcp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: `Bearer ${secret}` },
          body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
        });
        const text = await r.text();
        const data = (r.headers.get('content-type') || '').includes('event-stream')
          ? text.split('\n').filter((l) => l.startsWith('data:')).map((l) => JSON.parse(l.slice(5)))[0]
          : JSON.parse(text);
        return data;
      };
      await rpc(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'e2e', version: '1' } });
      const h = (await call(A, 'GET', `/api/diagrams/${diagram.id}`)).body;
      const nBefore = (await nodeIds(A)).length;
      const out = await rpc(2, 'tools/call', {
        name: 'diagram_apply_ops',
        arguments: { id: diagram.id, baseRevision: h.revision, ops: [{ op: 'add_element', ref: '@x', type: 'process-flow/task', label: 'Agent step' }] },
      });
      expect(out.result?.isError).not.toBe(true);

      await A.waitForFunction((n) => new Set([...document.querySelectorAll('[data-node-id]')].map((x) => x.getAttribute('data-node-id'))).size === n + 1, { timeout: 8000 }, nBefore);
      expect(await dialogShown(A)).toBe(false);
      await A.waitForSelector('[data-testid="remote-update-notice"]', { timeout: 3000 });
      expect(await A.$eval('[data-testid="remote-update-notice"]', (n) => n.textContent)).toMatch(/Updated by an agent/);
      await shot(A, 'agent-pickup.png');

      const [review] = await A.$$('xpath/.//button[contains(., "Review agent change")]');
      expect(review).toBeTruthy();
      await review.click();
      await A.waitForSelector('[data-compare-overlay]', { timeout: 8000 });
      await shot(A, 'agent-review-compare.png');
    } finally {
      const tokens = (await call(A, 'GET', '/api/user/tokens')).body.tokens || [];
      for (const t of tokens.filter((x) => x.name === 'e2e live merge')) await call(A, 'DELETE', `/api/user/tokens/${t.id}`);
      await A.close();
    }
  });
});
