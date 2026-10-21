/**
 * E2E: slice 8 - compare versions (summary list + read-only canvas overlay).
 * Needs the app running at TEST_BASE_URL, QA_ADMIN_EMAIL / QA_ADMIN_PASSWORD and QA_USER_EMAIL / QA_USER_PASSWORD
 * (.env.qa.local). Creates its own diagrams and deletes them afterwards. E2E_SHOTS_DIR saves screenshots.
 */
const path = require('path');
const puppeteer = require('puppeteer');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.qa.local') });

jest.setTimeout(120000);
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3002';
const SHOTS = process.env.E2E_SHOTS_DIR || '';

const el = (id, x, y, label) => ({ id, type: 'rectangle', x: 50000 + x, y: 50000 + y, size: { width: 140, height: 60 }, label: label || `Box ${id}`, color: '#4FB3CE' });
const conn = (id, s, t) => ({ id, sourceId: s, targetId: t, type: 'straight', sourcePort: 'e', targetPort: 'w' });
const baseline = {
  elements: [el('a', 100, 100), el('b', 400, 100), el('c', 700, 100)],
  connections: [conn('ab', 'a', 'b')],
  layers: [], groups: [], viewport: { x: 0, y: 0, zoom: 1 },
};
const edited = {
  // a moved, b deleted (and its connection), c renamed, d added
  elements: [el('a', 100, 300), el('c', 700, 100, 'Renamed C'), el('d', 400, 300)],
  connections: [conn('ad', 'a', 'd')],
  layers: [], groups: [], viewport: { x: 0, y: 0, zoom: 1 },
};

describe('Compare versions (slice 8)', () => {
  let browser; const cookies = {}; const contexts = {}; let diagram; let other;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function login(who, email, password) {
    // one isolated browser context per user: cookies must not leak between owner and viewer
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
    return true;
  }
  async function newPage(who) {
    const page = await contexts[who].newPage();
    await page.setViewport({ width: 1379, height: 985 });
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' }); // same-origin context for fetch
    return page;
  }
  const call = (page, method, url, body, headers = {}) => page.evaluate(async (m, u, b, h) => {
    const r = await fetch(u, { method: m, headers: { 'Content-Type': 'application/json', ...h }, body: b ? JSON.stringify(b) : undefined });
    let json = null; try { json = await r.json(); } catch (e) { /* none */ }
    return { status: r.status, body: json };
  }, method, url, body, headers);

  beforeAll(async () => {
    browser = await puppeteer.launch({ headless: process.env.HEADLESS !== 'false', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
    cookies.owner = await login('owner', process.env.QA_ADMIN_EMAIL, process.env.QA_ADMIN_PASSWORD);
    cookies.viewer = await login('viewer', process.env.QA_USER_EMAIL, process.env.QA_USER_PASSWORD);
    const p = await newPage('owner');
    diagram = (await call(p, 'POST', '/api/diagrams', { type: 'infinite-canvas', name: 'E2E compare', content: baseline })).body;
    other = (await call(p, 'POST', '/api/diagrams', { type: 'infinite-canvas', name: 'E2E compare other', content: baseline })).body;
    await call(p, 'POST', `/api/diagrams/${diagram.id}/versions`, { kind: 'named', label: 'Baseline' });
    await call(p, 'POST', `/api/diagrams/${other.id}/versions`, { kind: 'named', label: 'Other v1' });
    await call(p, 'POST', `/api/diagrams/${diagram.id}/shares`, { email: process.env.QA_USER_EMAIL, role: 'viewer' });
    const head = (await call(p, 'GET', `/api/diagrams/${diagram.id}`)).body;
    const put = await call(p, 'PUT', `/api/diagrams/${diagram.id}`, { content: edited }, { 'If-Match': `"${head.revision}"` });
    expect(put.status).toBe(200);
    await p.close();
  });

  afterAll(async () => {
    try {
      const p = await newPage('owner');
      for (const d of [diagram, other]) if (d) await call(p, 'DELETE', `/api/diagrams/${d.id}`);
    } catch (e) { /* best effort */ }
    if (browser) await browser.close();
  });

  async function openCompare(page, who) {
    await page.goto(`${BASE_URL}/diagram/${diagram.short_id}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.ds-canvas-container', { timeout: 30000 });
    await page.waitForSelector('[data-node-id]', { timeout: 30000 });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await page.click('button.ds-title-btn[title="Menu"]');
      try { await page.waitForSelector('.ds-dropdown-item', { timeout: 2000 }); } catch (e) { continue; }
      for (const it of await page.$$('.ds-dropdown-item')) {
        if (/Version history/i.test(await it.evaluate((n) => n.textContent))) { await it.click(); break; }
      }
      try { await page.waitForSelector('aside[aria-label="Version history"]', { timeout: 3000 }); break; } catch (e) { /* retry */ }
    }
    await page.waitForFunction(() => document.querySelector('aside .vh-item'), { timeout: 10000 });
    await page.evaluate(() => [...document.querySelectorAll('aside .vh-item')].find((n) => /Baseline/.test(n.textContent)).click());
    await page.waitForFunction(() => [...document.querySelectorAll('aside button')].some((n) => /Compare with current/.test(n.textContent)));
    await page.evaluate(() => [...document.querySelectorAll('aside button')].find((n) => /Compare with current/.test(n.textContent)).click());
    await page.waitForSelector('aside section[aria-label="Changes"]', { timeout: 15000 });
    await page.waitForSelector('[data-compare-overlay]', { timeout: 5000 });
    await sleep(300);
    if (SHOTS && who) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, `${who}-compare.png`) }); }
  }

  test('owner: summary counts, overlay colors, reveal on click, dismiss; nothing is written', async () => {
    const page = await newPage('owner');
    const before = await call(page, 'GET', `/api/diagrams/${diagram.id}/versions`);
    const headBefore = (await call(page, 'GET', `/api/diagrams/${diagram.id}`)).body;
    await openCompare(page, 'owner');

    const text = await page.$eval('aside section[aria-label="Changes"]', (n) => n.textContent);
    expect(text).toMatch(/2 added/);
    expect(text).toMatch(/2 changed/);
    expect(text).toMatch(/2 removed/); // element b + connection ab
    expect(text).toMatch(/Renamed C/);
    const colors = await page.$$eval('[data-compare-overlay] [data-compare-change]', (ns) => ns.map((n) => `${n.getAttribute('data-compare-id')}:${n.getAttribute('data-compare-change')}`).sort());
    expect(colors).toEqual(expect.arrayContaining(['a:changed', 'c:changed', 'd:added', 'b:removed']));

    // reveal: clicking "Renamed C" selects it and keeps it inside the canvas
    await page.evaluate(() => [...document.querySelectorAll('aside .vh-change')].find((n) => /Renamed C/.test(n.textContent)).click());
    await sleep(500);
    const inView = await page.$eval('[data-compare-overlay] [data-compare-id="c"]', (n) => {
      const r = n.getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth && r.top >= 0 && r.bottom <= window.innerHeight;
    });
    expect(inView).toBe(true);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'owner-compare-revealed.png') });

    // dismiss from the legend
    await page.evaluate(() => [...document.querySelectorAll('[data-compare-legend] button')].find((n) => /Dismiss/.test(n.textContent)).click());
    await page.waitForFunction(() => !document.querySelector('[data-compare-overlay]'));

    // read-only: no new versions, head untouched
    await sleep(2500);
    const after = await call(page, 'GET', `/api/diagrams/${diagram.id}/versions`);
    expect(after.body.items.length).toBe(before.body.items.length);
    const headAfter = (await call(page, 'GET', `/api/diagrams/${diagram.id}`)).body;
    expect(headAfter.revision).toBe(headBefore.revision);
    await page.close();
  });

  test('viewer (read-only role) can compare and sees the same summary', async () => {
    const page = await newPage('viewer');
    await openCompare(page, 'viewer');
    const text = await page.$eval('aside section[aria-label="Changes"]', (n) => n.textContent);
    expect(text).toMatch(/2 added/);
    expect(await page.$$eval('[data-compare-overlay] [data-compare-change]', (ns) => ns.length)).toBeGreaterThanOrEqual(4);
    await page.close();
  });

  test('API: structural diff, two-version compare, and IDOR (another diagram\'s version is 404)', async () => {
    const page = await newPage('owner');
    const d = await call(page, 'GET', `/api/diagrams/${diagram.id}/versions/1/diff?against=head`);
    expect(d.status).toBe(200);
    expect(d.body.summary).toEqual({ added: 2, removed: 2, changed: 2 });
    // diagram 'other' also has a version 1; asking for a version number that only exists elsewhere is a 404
    const idor = await call(page, 'GET', `/api/diagrams/${diagram.id}/versions/1/diff?against=7`);
    expect(idor.status).toBe(404);
    const v = await newPage('viewer');
    // the viewer has no access at all to the other diagram
    expect((await call(v, 'GET', `/api/diagrams/${other.id}/versions/1/diff?against=head`)).status).toBe(404);
    expect((await call(v, 'GET', `/api/diagrams/${diagram.id}/versions/1/diff?against=head`)).status).toBe(200);
    await v.close();
    await page.close();
  });
});
