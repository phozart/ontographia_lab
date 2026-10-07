/**
 * E2E: slice 4 - server comments.
 * Needs the app running at TEST_BASE_URL and QA_ADMIN_* / QA_USER_* (.env.qa.local). Two browser contexts act as
 * two sessions. Creates its own diagram and deletes it afterwards.
 */
const path = require('path');
const puppeteer = require('puppeteer');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.qa.local') });

jest.setTimeout(180000);
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3002';
const SHOTS = process.env.E2E_SHOTS_DIR || '';

// the canvas origin sits at (50000, 50000) in element coordinates
const el = (id, x, y = 50100) => ({ id, type: 'rectangle', x: 50000 + x, y, size: { width: 140, height: 60 }, label: `Box ${id}`, color: '#4FB3CE' });
const content = (...els) => ({ elements: els, connections: [], layers: [], groups: [], viewport: { x: 0, y: 0, zoom: 1 } });
const XSS = '<img src=x onerror="window.__xss=1"> <b>bold</b>';

describe('Server comments (slice 4)', () => {
  let browser; let ctxA; let ctxB; let diagram; let page; let pageB;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const shot = async (p, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, `${name}.png`) }); } };

  async function login(context, email, password) {
    const p = await context.newPage();
    await p.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
    await p.type('#email', email);
    await p.type('#password', password);
    await Promise.all([
      p.waitForFunction(() => !window.location.pathname.startsWith('/login'), { timeout: 30000 }),
      p.click('button[type="submit"]'),
    ]);
    return p;
  }
  const api = (p, fn, ...args) => p.evaluate(fn, ...args);
  const http = (p, method, url, body) => p.evaluate(async (m, u, b) => {
    const r = await fetch(u, { method: m, headers: { 'Content-Type': 'application/json' }, body: b === undefined ? undefined : JSON.stringify(b) });
    let data = null; try { data = await r.json(); } catch (e) { /* 204 */ }
    return { status: r.status, data };
  }, method, url, body);

  async function openEditor(p, preload) {
    if (preload) await p.evaluateOnNewDocument(preload.fn, ...preload.args);
    await p.goto(`${BASE_URL}/diagram/${diagram.short_id}`, { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('.ds-canvas-container', { timeout: 30000 });
    await p.waitForSelector('[data-node-id]', { timeout: 30000 });
  }
  // a click before hydration finishes is ignored: retry until the popup is up
  const openThread = async (p) => {
    for (let i = 0; i < 6; i += 1) {
      await p.waitForSelector('.ds-comment-marker[data-thread-id]', { timeout: 15000 });
      await p.click('.ds-comment-marker[data-thread-id]');
      try { await p.waitForSelector('.ds-comment-thread', { timeout: 2000 }); return; } catch (e) { /* retry */ }
    }
    throw new Error('comment popup did not open');
  };
  const markers = (p) => p.$$eval('.ds-comment-marker[data-thread-id]', (ns) => ns.map((n) => ({ id: n.dataset.threadId, state: n.dataset.anchorState, left: parseFloat(n.style.left), top: parseFloat(n.style.top) })));

  beforeAll(async () => {
    const { QA_ADMIN_EMAIL: e, QA_ADMIN_PASSWORD: pw } = process.env;
    if (!e || !pw) throw new Error('QA_ADMIN_EMAIL and QA_ADMIN_PASSWORD must be set (.env.qa.local)');
    browser = await puppeteer.launch({ headless: process.env.HEADLESS !== 'false', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
    ctxA = await browser.createBrowserContext();
    ctxB = await browser.createBrowserContext();
    page = await login(ctxA, e, pw);
    pageB = await login(ctxB, e, pw);
    await page.setViewport({ width: 1600, height: 900 });
    await pageB.setViewport({ width: 1600, height: 900 });
    const created = await http(page, 'POST', '/api/diagrams', { type: 'infinite-canvas', name: 'E2E Comments', content: content(el('a', 100), el('b', 400)) });
    diagram = created.data;
  });

  afterAll(async () => {
    try { await http(page, 'DELETE', `/api/diagrams/${diagram.id}`); } catch (e) { /* best effort */ }
    if (browser) await browser.close();
  });

  test('a non-owner gets 404 on every comment endpoint (no membership yet)', async () => {
    const { QA_USER_EMAIL: e, QA_USER_PASSWORD: pw } = process.env;
    const ctx = await browser.createBrowserContext();
    const other = await login(ctx, e, pw);
    const t = '00000000-0000-4000-8000-000000000001';
    const base = `/api/diagrams/${diagram.id}`;
    const results = [
      await http(other, 'GET', `${base}/threads`),
      await http(other, 'POST', `${base}/threads`, { anchor: { type: 'canvas', x: 1, y: 1 }, body: 'x' }),
      await http(other, 'GET', `${base}/threads/${t}`),
      await http(other, 'PATCH', `${base}/threads/${t}`, { status: 'resolved' }),
      await http(other, 'POST', `${base}/threads/${t}/comments`, { body: 'x' }),
      await http(other, 'PATCH', `${base}/comments/${t}`, { body: 'x' }),
      await http(other, 'DELETE', `${base}/comments/${t}`),
    ];
    expect(results.map((r) => r.status)).toEqual([404, 404, 404, 404, 404, 404, 404]);
    await ctx.close();
  });

  test('create an element-anchored comment in the UI; it persists and shows in a second session with author identity; body is text', async () => {
    await openEditor(page);
    await openEditor(pageB);
    expect(await markers(pageB)).toHaveLength(0);

    await page.keyboard.press('k'); // comment tool
    await page.waitForSelector('.comment-mode', { timeout: 5000 });
    const box = await (await page.$('[data-node-id="a"]')).boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForSelector('.ds-new-comment-input textarea', { timeout: 5000 });
    await page.type('.ds-new-comment-input textarea', XSS);
    await shot(page, '1-new-comment');
    await page.click('.ds-new-comment-input button[type="submit"]');
    await page.waitForSelector('.ds-comment-marker[data-anchor-state="attached"]', { timeout: 10000 });
    await sleep(500);

    const listed = await http(page, 'GET', `/api/diagrams/${diagram.id}/threads?status=all`);
    expect(listed.status).toBe(200);
    expect(listed.data.items).toHaveLength(1);
    const th = listed.data.items[0];
    expect(th.anchor).toMatchObject({ type: 'element', targetId: 'a' });
    expect(th.comments[0]).toMatchObject({ body: XSS, createdVia: 'web' });
    expect(th.comments[0].author.name).toBeTruthy();

    // second session: reload to fetch from the server
    await openEditor(pageB);
    await openThread(pageB);
    const text = await pageB.$eval('.ds-comment-thread-messages', (n) => n.textContent);
    expect(text).toContain(XSS);
    expect(text).toContain(th.comments[0].author.name);
    expect(await pageB.evaluate(() => window.__xss)).toBeUndefined();
    expect(await pageB.$('.ds-comment-message-body img')).toBeNull();
    await shot(pageB, '2-second-session');

    // reply from session B (reopens nothing, plain reply), visible to A after refresh
    await pageB.type('.ds-comment-reply-form input', 'reply from B');
    await pageB.click('.ds-comment-reply-form button[type="submit"]');
    await pageB.waitForFunction(() => /reply from B/.test(document.querySelector('.ds-comment-thread-messages').textContent), { timeout: 10000 });
    let after;
    for (let i = 0; i < 20; i += 1) { // the reply is shown optimistically; wait for the server to have it
      after = await http(page, 'GET', `/api/diagrams/${diagram.id}/threads/${th.id}`);
      if (after.data.comments.length === 2) break;
      await sleep(250);
    }
    expect(after.data.comments.map((c) => c.body)).toEqual([XSS, 'reply from B']);
  });

  test('marker follows its element when it moves; delete element -> detached; restore a version -> re-attached', async () => {
    const [th] = (await http(page, 'GET', `/api/diagrams/${diagram.id}/threads?status=all`)).data.items;
    const head = async () => (await http(page, 'GET', `/api/diagrams/${diagram.id}`)).data;
    const put = async (c) => (await http(page, 'PUT', `/api/diagrams/${diagram.id}`, { content: c })).status;
    const original = content(el('a', 100), el('b', 400));

    await openEditor(page);
    await page.waitForSelector('.ds-comment-marker[data-thread-id]');
    const m0 = (await markers(page))[0];
    expect(m0.state).toBe('attached');

    // name a version of the current state (contains element a)
    const named = await http(page, 'POST', `/api/diagrams/${diagram.id}/versions`, { kind: 'named', label: 'With A' });
    expect([200, 201]).toContain(named.status);

    // move element a by +200 x
    expect(await put(content(el('a', 300), el('b', 400)))).toBe(200);
    await openEditor(page);
    await page.waitForSelector('.ds-comment-marker[data-thread-id]');
    const m1 = (await markers(page))[0];
    expect(m1.state).toBe('attached');
    expect(Math.round(m1.left - m0.left)).toBe(200); // viewport scale 1: marker moved with the element

    // delete element a -> detached, listed in the Detached group, drawn at its creation position
    expect(await put(content(el('b', 400)))).toBe(200);
    await openEditor(page);
    await page.waitForSelector('.ds-comment-marker[data-thread-id]');
    const m2 = (await markers(page))[0];
    expect(m2.state).toBe('detached');
    expect(Math.round(m2.left)).toBe(Math.round(m0.left)); // fallback = position at creation
    const server = (await http(page, 'GET', `/api/diagrams/${diagram.id}/threads?status=all`)).data.items[0];
    expect(server.anchorState).toBe('detached');
    expect(server.status).toBe('open');
    await page.waitForSelector('[data-testid="detached-comments"]');
    expect(await page.$eval('[data-testid="detached-comments"]', (n) => n.textContent)).toMatch(/Detached comments \(1\)/);
    await page.click('[data-testid="detached-comments"] button');
    await shot(page, '3-detached');

    // restore the named version -> the element is back -> re-attached (no write to comments)
    const restored = await http(page, 'POST', `/api/diagrams/${diagram.id}/versions/${named.data.version ? named.data.version.number : named.data.number}/restore`);
    expect(restored.status).toBe(200);
    await openEditor(page);
    await page.waitForSelector('.ds-comment-marker[data-thread-id]');
    expect((await markers(page))[0].state).toBe('attached');
    expect((await http(page, 'GET', `/api/diagrams/${diagram.id}/threads/${th.id}`)).data.anchorState).toBe('attached');
    expect((await head()).content.elements.map((e) => e.id).sort()).toEqual(original.elements.map((e) => e.id).sort());
    await shot(page, '4-reattached');
  });

  test('resolve / reopen via the popup; a reply reopens', async () => {
    await openEditor(page);
    await openThread(page);
    await page.waitForSelector('.ds-comment-resolve-btn', { timeout: 5000 });
    await page.click('.ds-comment-resolve-btn');
    await page.waitForSelector('.ds-comment-marker.resolved', { timeout: 5000 });
    let t1;
    for (let i = 0; i < 20 && !t1; i += 1) { // optimistic UI first; the server write lands a moment later
      [t1] = (await http(page, 'GET', `/api/diagrams/${diagram.id}/threads?status=resolved`)).data.items;
      if (!t1) await sleep(250);
    }
    expect(t1.status).toBe('resolved');
    await page.type('.ds-comment-reply-form input', 'reopening');
    await page.click('.ds-comment-reply-form button[type="submit"]');
    await page.waitForFunction(() => !document.querySelector('.ds-comment-marker.resolved'), { timeout: 5000 });
    let status;
    for (let i = 0; i < 20 && status !== 'open'; i += 1) {
      status = (await http(page, 'GET', `/api/diagrams/${diagram.id}/threads/${t1.id}`)).data.status;
      if (status !== 'open') await sleep(250);
    }
    expect(status).toBe('open');
  });

  test('one-time import of browser-only comments (Q-C1): prompt, import as current user, key cleared', async () => {
    const legacy = [{ id: 'comment_1', text: 'imported <i>note</i>', x: 50300, y: 50300, elementId: null, user: { id: 'x', name: 'Old' }, resolved: false, createdAt: '2020-01-01T00:00:00Z', replies: [{ id: 'r', text: 'old reply', user: { name: 'Old' } }] }];
    const p2 = await ctxB.newPage();
    await p2.setViewport({ width: 1600, height: 900 });
    await openEditor(p2, { fn: (key, val) => { if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, val); }, args: [`comments-${diagram.short_id}`, JSON.stringify(legacy)] });
    // the hook is keyed by the id the page uses (short id in the URL)
    await p2.waitForSelector('.ds-comment-import', { timeout: 10000 });
    await shot(p2, '5-import-prompt');
    const before = (await http(p2, 'GET', `/api/diagrams/${diagram.id}/threads?status=all`)).data.items.length;
    await p2.evaluate(() => [...document.querySelectorAll('.ds-comment-import button')].find((b) => /^Import$/.test(b.textContent)).click());
    await p2.waitForFunction(() => !document.querySelector('.ds-comment-import'), { timeout: 15000 });
    const items = (await http(p2, 'GET', `/api/diagrams/${diagram.id}/threads?status=all`)).data.items;
    expect(items.length).toBe(before + 1);
    const imported = items.find((t) => t.comments[0].body === 'imported <i>note</i>');
    expect(imported.comments.map((c) => c.body)).toEqual(['imported <i>note</i>', 'old reply']);
    expect(imported.comments[0].author.name).toBeTruthy();
    expect(await p2.evaluate((k) => window.localStorage.getItem(k), `comments-${diagram.short_id}`)).toBeNull();
    await p2.close();
  });

  test('delete a comment: author deletes own; thread with all comments deleted disappears', async () => {
    const items = (await http(page, 'GET', `/api/diagrams/${diagram.id}/threads?status=all`)).data.items;
    const imported = items.find((t) => t.comments[0].body.startsWith('imported'));
    for (const c of imported.comments) expect((await http(page, 'DELETE', `/api/diagrams/${diagram.id}/comments/${c.id}`)).status).toBe(204);
    const left = (await http(page, 'GET', `/api/diagrams/${diagram.id}/threads?status=all`)).data.items;
    expect(left.find((t) => t.id === imported.id)).toBeUndefined();
  });
});
