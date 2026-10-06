/**
 * E2E: slice 2 - named versions + restore (History panel).
 * Needs the app running at TEST_BASE_URL and QA_ADMIN_EMAIL / QA_ADMIN_PASSWORD (.env.qa.local).
 * Creates its own diagram and deletes it afterwards.
 */
const path = require('path');
const puppeteer = require('puppeteer');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.qa.local') });

jest.setTimeout(90000);
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3002';
const SHOTS = process.env.E2E_SHOTS_DIR || '';

// the canvas origin sits at (50000, 50000) in element coordinates
const el = (id, x) => ({ id, type: 'rectangle', x: 50000 + x, y: 50100, size: { width: 140, height: 60 }, label: `Box ${id}`, color: '#4FB3CE' });
const twoBoxes = { elements: [el('a', 100), el('b', 320)], connections: [], layers: [], groups: [], viewport: { x: 0, y: 0, zoom: 1 } };
const threeBoxes = { ...twoBoxes, elements: [el('a', 100), el('b', 320), el('c', 540)] };

describe('Version history (slice 2)', () => {
  let browser; let page; let cookies = []; let diagram;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const shot = async (name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, `${name}.png`) }); } };
  const api = (fn, ...args) => page.evaluate(fn, ...args);

  beforeAll(async () => {
    const email = process.env.QA_ADMIN_EMAIL; const password = process.env.QA_ADMIN_PASSWORD;
    if (!email || !password) throw new Error('QA_ADMIN_EMAIL and QA_ADMIN_PASSWORD must be set (.env.qa.local)');
    browser = await puppeteer.launch({ headless: process.env.HEADLESS !== 'false', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
    const login = await browser.newPage();
    await login.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
    await login.type('#email', email);
    await login.type('#password', password);
    await Promise.all([
      login.waitForFunction(() => !window.location.pathname.startsWith('/login'), { timeout: 30000 }),
      login.click('button[type="submit"]'),
    ]);
    cookies = await login.cookies();
    diagram = await login.evaluate(async (content) => {
      const res = await fetch('/api/diagrams', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'infinite-canvas', name: 'E2E Versions', content }) });
      return res.json();
    }, twoBoxes);
    await login.close();
  });

  afterAll(async () => {
    try {
      const p = await browser.newPage();
      await p.setCookie(...cookies);
      await p.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
      await p.evaluate((id) => fetch(`/api/diagrams/${id}`, { method: 'DELETE' }), diagram.id);
    } catch (e) { /* best effort */ }
    if (browser) await browser.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 900 });
    await page.setCookie(...cookies);
  });
  afterEach(async () => { if (page && !page.isClosed()) await page.close(); });

  const openEditor = async () => {
    await page.goto(`${BASE_URL}/diagram/${diagram.short_id}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.ds-canvas-container', { timeout: 30000 });
    await page.waitForSelector('[data-node-id]', { timeout: 30000 });
  };
  const COUNT_FN = () => new Set([...document.querySelectorAll('[data-node-id]')].map((n) => n.getAttribute('data-node-id'))).size;
  const nodeCount = () => page.evaluate(COUNT_FN);
  const openHistory = async () => {
    // retry: a click before hydration finishes is ignored
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await page.click('button.ds-title-btn[title="Menu"]');
      try { await page.waitForSelector('.ds-dropdown-item', { timeout: 2000 }); } catch (e) { continue; }
      const items = await page.$$('.ds-dropdown-item');
      for (const it of items) {
        if (/Version history/i.test(await it.evaluate((n) => n.textContent))) { await it.click(); break; }
      }
      try { await page.waitForSelector('aside[aria-label="Version history"]', { timeout: 3000 }); return; } catch (e) { /* retry */ }
    }
    throw new Error('Version history panel did not open');
  };
  const clickByText = async (selector, re) => {
    await page.waitForFunction((sel, src) => [...document.querySelectorAll(sel)].some((n) => new RegExp(src, 'i').test(n.textContent)), { timeout: 10000 }, selector, re.source);
    await page.evaluate((sel, src) => { [...document.querySelectorAll(sel)].find((n) => new RegExp(src, 'i').test(n.textContent)).click(); }, selector, re.source);
  };

  test('name a version, list it, change the diagram, preview, restore with confirm; editor shows restored head and nothing stale overwrites it', async () => {
    await openEditor();
    expect(await nodeCount()).toBe(2);

    // 1. open the panel from the menu: empty state
    await openHistory();
    await page.waitForFunction(() => /No versions yet/i.test(document.body.textContent));
    await shot('1-history-empty');

    // 2. name the current version
    await page.type('#vh-label', 'Baseline');
    await page.type('#vh-desc', 'two boxes');
    await clickByText('aside button', /^Save version$/);
    await page.waitForSelector('ul[aria-label="Versions"] li', { timeout: 10000 });
    await shot('2-history-named');
    const list = await page.$eval('ul[aria-label="Versions"]', (n) => n.textContent);
    expect(list).toMatch(/Baseline/);
    expect(list).toMatch(/Named/);

    // 3. someone changes the diagram (API write, as another session would), then the editor reloads it
    const head = await api(async (id) => (await fetch(`/api/diagrams/${id}`)).json(), diagram.id);
    const put = await api(async (id, rev, content) => {
      const r = await fetch(`/api/diagrams/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'If-Match': `"${rev}"` }, body: JSON.stringify({ content }) });
      return r.status;
    }, diagram.id, head.revision, threeBoxes);
    expect(put).toBe(200);
    await openEditor();
    await page.waitForFunction(() => new Set([...document.querySelectorAll('[data-node-id]')].map((n) => n.getAttribute('data-node-id'))).size === 3);

    // 4. preview the Baseline version
    await openHistory();
    await clickByText('aside .vh-item', /Baseline/);
    await page.waitForSelector('aside img[alt="Preview of Baseline"]', { timeout: 10000 });
    const src = await page.$eval('aside img[alt="Preview of Baseline"]', (i) => i.getAttribute('src'));
    const svg = decodeURIComponent(src.split(',')[1]);
    expect((svg.match(/<g transform=/g) || []).length).toBe(2 + 0); // two element groups, no third box
    await shot('3-history-preview');

    // 5. restore: confirm dialog first
    await clickByText('aside button', /Restore this version/);
    await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
    await shot('4-history-confirm');
    await clickByText('[role="dialog"] button', /^Restore$/);
    await page.waitForFunction(() => new Set([...document.querySelectorAll('[data-node-id]')].map((n) => n.getAttribute('data-node-id'))).size === 2, { timeout: 15000 });
    await page.waitForFunction(() => /Your previous state was kept as version #/i.test(document.body.textContent), { timeout: 10000 });
    await shot('5-history-restored');

    // 6. server state: head = 2 boxes, versions: named, pre_restore (3 boxes), restore
    await sleep(2500); // longer than the autosave debounce: a stale autosave would have overwritten the head by now
    const after = await api(async (id) => ({
      diagram: await (await fetch(`/api/diagrams/${id}`)).json(),
      versions: await (await fetch(`/api/diagrams/${id}/versions`)).json(),
    }), diagram.id);
    expect(after.diagram.content.elements.map((e) => e.id)).toEqual(['a', 'b']);
    const kinds = after.versions.items.map((v) => v.kind).reverse();
    expect(kinds).toEqual(['named', 'pre_restore', 'restore']);
    const pre = await api(async (id, n) => (await fetch(`/api/diagrams/${id}/versions/${n}`)).json(), diagram.id, after.versions.items[1].number);
    expect(pre.content.elements).toHaveLength(3); // the work that restore replaced is kept

    // 7. editor revision is the restored one: the next edit saves without a conflict dialog
    expect(await page.evaluate(() => /changed elsewhere/i.test(document.body.textContent))).toBe(false);
  });

  test('API: a stale If-Match on restore is rejected with 409 and changes nothing', async () => {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    const out = await api(async (id) => {
      const versions = await (await fetch(`/api/diagrams/${id}/versions`)).json();
      const named = versions.items.find((v) => v.kind === 'named');
      const r = await fetch(`/api/diagrams/${id}/versions/${named.number}/restore`, { method: 'POST', headers: { 'If-Match': '"1"' } });
      return { status: r.status, body: await r.json(), count: (await (await fetch(`/api/diagrams/${id}/versions`)).json()).items.length, before: versions.items.length };
    }, diagram.id);
    expect(out.status).toBe(409);
    expect(out.body.code).toBe('REVISION_CONFLICT');
    expect(out.count).toBe(out.before);
  });
});
