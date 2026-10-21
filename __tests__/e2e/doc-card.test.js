/**
 * E2E: AI-5 doc card. In the real editor: create a doc from the toolbar, write in the side panel, link to an element,
 * click the link (selects the element), see the card update, export the .md, drop a .md file, and see a doc written by
 * "an agent" (a second writer) appear through live pickup. Also: hostile markdown stored through the API is inert in
 * the editor (no script, no image, no handler runs), and the server neutralizes it (warning).
 * Needs the app at TEST_BASE_URL and QA_ADMIN_* (owner) / QA_USER_* (second writer) from .env.qa.local.
 * Creates its own diagram and deletes it afterwards. E2E_SHOTS_DIR saves screenshots.
 */
const path = require('path');
const os = require('os');
const puppeteer = require('puppeteer');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.qa.local') });

jest.setTimeout(180000);
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3002';
const SHOTS = process.env.E2E_SHOTS_DIR || '';

const el = (id, x, y, label) => ({ id, type: 'rectangle', packId: 'core', x: 50000 + x, y: 50000 + y, size: { width: 160, height: 70 }, label, color: '#4FB3CE', layerId: 'default', properties: {} });
const content = (elements) => ({ elements, connections: [], layers: [], groups: [], viewport: { x: 0, y: 0, zoom: 1 } });

describe('Doc card (AI-5)', () => {
  let browser; const contexts = {}; let diagram; let downloadDir;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const shot = async (page, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name) }); } };

  async function login(who, email, password) {
    contexts[who] = await browser.createBrowserContext();
    const p = await contexts[who].newPage();
    await p.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0', timeout: 90000 });
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
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    return page;
  }
  const call = (page, method, url, body, headers = {}) => page.evaluate(async (m, u, b, h) => {
    const r = await fetch(u, { method: m, headers: { 'Content-Type': 'application/json', ...h }, body: b ? JSON.stringify(b) : undefined });
    let json = null; try { json = await r.json(); } catch (e) { /* none */ }
    return { status: r.status, body: json };
  }, method, url, body, headers);
  const head = async (page) => (await call(page, 'GET', `/api/diagrams/${diagram.id}`)).body;
  async function allowDownloads(who, dir) {
    const session = await browser.target().createCDPSession();
    await session.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dir, browserContextId: contexts[who].id });
  }
  async function open(page) {
    await page.goto(`${BASE_URL}/diagram/${diagram.short_id}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForSelector('.ds-canvas-container', { timeout: 30000 });
    await page.waitForSelector('[data-node-id]', { timeout: 30000 });
    await sleep(1500);
  }
  const isSelected = (page, id) => page.$eval(`[data-node-id="${id}"]`, (n) => n.classList.contains('selected')).catch(() => false);
  async function waitFor(fn, ms = 8000, step = 250) {
    const end = Date.now() + ms;
    for (;;) {
      const v = await fn();
      if (v) return v;
      if (Date.now() > end) throw new Error('timed out waiting');
      await sleep(step);
    }
  }
  async function docOnServer(page, id) {
    const h = await head(page);
    return { rev: h.revision, el: h.content.elements.find((e) => e.id === id), content: h.content };
  }

  beforeAll(async () => {
    downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai5-dl-'));
    browser = await puppeteer.launch({ headless: process.env.HEADLESS !== 'false', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
    await login('a', process.env.QA_ADMIN_EMAIL, process.env.QA_ADMIN_PASSWORD);
    await login('b', process.env.QA_USER_EMAIL, process.env.QA_USER_PASSWORD);
    const p = await newPage('a');
    diagram = (await call(p, 'POST', '/api/diagrams', { type: 'infinite-canvas', name: 'E2E doc card', content: content([el('auth', 100, 100, 'Auth service'), el('db', 400, 100, 'Orders DB'), el('queue', 700, 100, 'Event queue')]) })).body;
    expect((await call(p, 'POST', `/api/diagrams/${diagram.id}/shares`, { email: process.env.QA_USER_EMAIL, role: 'editor' })).status).toBeLessThan(300);
    await p.close();
  });

  afterAll(async () => {
    try {
      const p = await newPage('a');
      if (diagram) await call(p, 'DELETE', `/api/diagrams/${diagram.id}`);
    } catch (e) { /* best effort */ }
    if (browser) await browser.close();
    try { fs.rmSync(downloadDir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
  });

  test('create a doc from the toolbar, write, link an element, click the link, export .md', async () => {
    const A = await newPage('a');
    await open(A);
    // arm the Doc tool and click an empty spot
    await A.click('button.ds-sidebar-btn[title="Doc"]');
    const canvas = await A.$('.ds-canvas-container');
    const box = await canvas.boundingBox();
    await A.mouse.click(box.x + 500, box.y + 520);
    await A.waitForSelector('[data-testid="doc-panel"]', { timeout: 10000 });
    await A.waitForSelector('[data-testid="doc-card"]', { timeout: 5000 });

    // title and text
    await A.click('[data-testid="doc-title"]', { clickCount: 3 });
    await A.type('[data-testid="doc-title"]', 'Architecture summary');
    await A.click('[data-testid="doc-textarea"]');
    await A.type('[data-testid="doc-textarea"]', '## Findings\n\nThe main hub is ');
    // link to an element through the picker
    await A.click('[data-testid="doc-link-element"]');
    await A.waitForSelector('[data-testid="doc-element-picker"]');
    await A.type('[data-testid="doc-element-picker"] input', 'Auth');
    await A.click('[data-testid="doc-element-picker"] [role="option"]');
    await A.type('[data-testid="doc-textarea"]', ', which reads the ');
    await A.click('[data-testid="doc-link-element"]');
    await A.type('[data-testid="doc-element-picker"] input', 'Orders');
    await A.click('[data-testid="doc-element-picker"] [role="option"]');
    await A.type('[data-testid="doc-textarea"]', ' and a <script>window.__pwned=1</script> [bad](javascript:window.__pwned=1).');
    const value = await A.$eval('[data-testid="doc-textarea"]', (t) => t.value);
    expect(value).toContain('[Auth service](#el=auth)');
    expect(value).toContain('[Orders DB](#el=db)');
    await sleep(900); // flush into the element
    await shot(A, 'doc-editing.png');

    // the card shows the rendered text; the hostile bits are inert text
    const card = await A.$eval('[data-testid="doc-card"]', (c) => ({ text: c.textContent, links: [...c.querySelectorAll('a')].map((a) => a.getAttribute('href')), scripts: c.querySelectorAll('script, img, iframe').length }));
    expect(card.text).toContain('Architecture summary');
    expect(card.text).toContain('Findings');
    expect(card.links).toEqual(['#el=auth', '#el=db']);
    expect(card.scripts).toBe(0);
    expect(await A.evaluate(() => window.__pwned)).toBeUndefined();

    // clicking a link in the card selects the element
    expect(await isSelected(A, 'auth')).toBe(false);
    await A.click('[data-testid="doc-card"] a[data-element-id="auth"]');
    await waitFor(() => isSelected(A, 'auth'), 4000);
    // and in the panel preview
    await A.click('[data-testid="doc-tab-preview"]');
    await A.click('[data-testid="doc-preview"] a[data-element-id="db"]');
    await waitFor(() => isSelected(A, 'db'), 4000);
    await shot(A, 'doc-link-clicked.png');

    // export .md
    await allowDownloads('a', downloadDir);
    await A.click('[data-testid="doc-export-md"]');
    const file = await waitFor(() => fs.readdirSync(downloadDir).find((f) => f.endsWith('.md')), 8000);
    expect(file).toBe('Architecture-summary.md');
    const md = fs.readFileSync(path.join(downloadDir, file), 'utf8');
    expect(md.startsWith('# Architecture summary\n\n## Findings')).toBe(true);
    expect(md).toContain('[Auth service](#el=auth)');

    // saved to the server: stored text is clean (the server rewrote the hostile parts), one doc element
    const doc = await waitFor(async () => {
      const h = await head(A);
      const d = h.content.elements.find((e) => e.type === 'doc');
      return d && /Auth service/.test(d.data?.doc?.markdown || '') ? d : null;
    }, 12000);
    expect(doc.data.doc.title).toBe('Architecture summary');
    expect(doc.data.doc.markdown).not.toMatch(/(^|[^\\])<script/);
    expect(doc.data.doc.markdown).not.toMatch(/\]\(javascript:/);
    await A.close();
  });

  test('a doc written by another writer (what an agent does) appears by live pickup; its links work; dangling links are plain text', async () => {
    const A = await newPage('a');
    const B = await newPage('b');
    await open(A);
    const h = await head(B);
    const summary = '## Summary\n\nThree parts: [auth](#el=auth), [db](#el=db), [queue](#el=queue). Gone: [old](#el=does-not-exist).\n\n- [ ] follow up\n';
    const agentDoc = { id: 'agent-doc', type: 'doc', packId: 'core', name: 'Doc', label: 'Agent summary', layerId: 'default', x: 50000 + 100, y: 50000 + 400, size: { width: 400, height: 260 }, properties: {}, data: { doc: { title: 'Agent summary', markdown: summary } } };
    const put = await call(B, 'PUT', `/api/diagrams/${diagram.id}`, { content: { ...h.content, elements: [...h.content.elements, agentDoc] } }, { 'If-Match': `"${h.revision}"` });
    expect(put.status).toBe(200);
    await A.waitForFunction(() => document.querySelector('[data-node-id="agent-doc"]'), { timeout: 8000 });
    const links = await A.$$eval('[data-node-id="agent-doc"] a', (as) => as.map((a) => a.getAttribute('href')));
    expect(links).toEqual(['#el=auth', '#el=db', '#el=queue']);
    expect(await A.$eval('[data-node-id="agent-doc"] [data-doc-link="dangling"]', (n) => n.textContent)).toBe('old');
    await A.click('[data-node-id="agent-doc"] a[data-element-id="queue"]');
    await waitFor(() => isSelected(A, 'queue'), 4000);
    await shot(A, 'doc-agent-pickup.png');
    await A.close(); await B.close();
  });

  test('hostile markdown stored via the API is neutralized by the server and inert in the editor', async () => {
    const B = await newPage('b');
    const h = await head(B);
    const evil = '<script>window.__pwned=1</script>\n\n<img src=x onerror="window.__pwned=1">\n\n[a](javascript:window.__pwned=1) [b](data:text/html,<script>window.__pwned=1</script>) ![i](https://tracker.example.com/p.png)';
    const evilEl = { id: 'evil-doc', type: 'doc', packId: 'core', name: 'Doc', label: 'Evil', layerId: 'default', x: 50000 + 700, y: 50000 + 400, size: { width: 320, height: 220 }, properties: {}, data: { doc: { title: 'Evil <img src=x onerror=1>', markdown: evil } } };
    const put = await call(B, 'PUT', `/api/diagrams/${diagram.id}`, { content: { ...h.content, elements: [...h.content.elements, evilEl] } }, { 'If-Match': `"${h.revision}"` });
    expect(put.status).toBe(200);
    const stored = (await head(B)).content.elements.find((e) => e.id === 'evil-doc').data.doc.markdown;
    expect(stored).not.toMatch(/(^|[^\\])<(script|img)/);
    expect(stored).not.toMatch(/\]\((javascript|data):/);
    const A = await newPage('a');
    await open(A);
    await A.waitForSelector('[data-node-id="evil-doc"]');
    await A.click('[data-node-id="evil-doc"] [data-testid="doc-card"]', { count: 2 });
    await A.waitForSelector('[data-testid="doc-panel"]');
    await A.click('[data-testid="doc-tab-preview"]');
    await sleep(500);
    const dom = await A.evaluate(() => ({
      pwned: window.__pwned,
      imgs: document.querySelectorAll('[data-testid="doc-card"] img, [data-testid="doc-panel"] img').length,
      scripts: document.querySelectorAll('[data-testid="doc-card"] script, [data-testid="doc-panel"] script').length,
      handlers: [...document.querySelectorAll('[data-testid="doc-card"] *, [data-testid="doc-panel"] *')].filter((n) => n.getAttributeNames().some((a) => a.startsWith('on'))).length,
      hrefs: [...document.querySelectorAll('[data-testid="doc-card"] a, [data-testid="doc-panel"] a')].map((a) => a.getAttribute('href')),
    }));
    expect(dom.pwned).toBeUndefined();
    expect(dom.imgs).toBe(0);
    expect(dom.scripts).toBe(0);
    expect(dom.handlers).toBe(0);
    for (const href of dom.hrefs) expect(href).toMatch(/^(https?:\/\/|mailto:|#el=|\/diagram\/)/);
    await shot(A, 'doc-hostile-inert.png');
    await A.close(); await B.close();
  });

  test('dropping a .md file on the canvas creates a doc card with the file title; an oversized file is refused with a message', async () => {
    const A = await newPage('a');
    await open(A);
    const drop = (name, text, x, y) => A.evaluate((n, t, px, py) => {
      const dt = new DataTransfer();
      dt.items.add(new File([t], n, { type: 'text/markdown' }));
      const target = document.querySelector('.ds-canvas-area');
      const rect = target.getBoundingClientRect();
      target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: rect.left + px, clientY: rect.top + py }));
    }, name, text, x, y);
    const before = await A.$$eval('[data-testid="doc-card"]', (c) => c.length);
    await drop('plan.md', '# Rollout plan\n\n- step one\n- step two [x](javascript:alert(1))\n', 900, 560);
    await A.waitForFunction((n) => document.querySelectorAll('[data-testid="doc-card"]').length === n + 1, { timeout: 8000 }, before);
    await A.waitForSelector('[data-testid="doc-panel"]');
    expect(await A.$eval('[data-testid="doc-title"]', (i) => i.value)).toBe('Rollout plan');
    await waitFor(async () => (await head(A)).content.elements.some((e) => e.type === 'doc' && e.data?.doc?.title === 'Rollout plan'), 12000);
    const imported = (await head(A)).content.elements.find((e) => e.data?.doc?.title === 'Rollout plan');
    expect(imported.data.doc.markdown).toContain('step one');
    expect(imported.data.doc.markdown).not.toMatch(/\]\(javascript:/);
    // oversized
    await drop('big.md', 'a'.repeat(101 * 1024), 200, 700);
    await A.waitForSelector('[data-testid="doc-import-notice"]', { timeout: 6000 });
    expect(await A.$eval('[data-testid="doc-import-notice"]', (n) => n.textContent)).toMatch(/100 KB/);
    await shot(A, 'doc-md-drop.png');
    await A.close();
  });

  test('exports show the card: the PNG preview renders and the SVG file contains the doc title and text; no script or handler in the SVG', async () => {
    const A = await newPage('a');
    await open(A);
    const dl = fs.mkdtempSync(path.join(os.tmpdir(), 'ai5-svg-'));
    await allowDownloads('a', dl);
    await A.evaluate(() => window.dispatchEvent(new Event('ds:open-export-dialog')));
    await A.waitForSelector('.export-preview-img', { timeout: 20000 });
    await sleep(1500);
    await shot(A, 'doc-export-dialog.png');
    const png = await A.$eval('.export-preview-img', (i) => i.getAttribute('src'));
    expect(png).toMatch(/^data:image\/png;base64,/);
    if (SHOTS) fs.writeFileSync(path.join(SHOTS, 'doc-export-preview.png'), Buffer.from(png.split(',')[1], 'base64'));
    const svgBtn = await A.evaluateHandle(() => [...document.querySelectorAll('.export-format-btn')].find((b) => /svg/i.test(b.textContent)));
    await svgBtn.asElement().click();
    await sleep(800);
    await A.click('.export-btn-primary');
    const file = await waitFor(() => fs.readdirSync(dl).find((f) => f.endsWith('.svg')), 20000);
    const svg = fs.readFileSync(path.join(dl, file), 'utf8');
    expect(svg).toContain('Architecture summary');
    expect(svg).toContain('Findings');
    const markup = svg.replace(/url\(data:[^)]*\)/g, 'url()'); // embedded fonts are base64, not markup
    expect(markup).not.toMatch(/<script/i);
    expect(markup).not.toMatch(/<[a-z][^<>]*\son[a-z]+\s*=/i);
    expect(markup).not.toMatch(/javascript:/i);
    fs.rmSync(dl, { recursive: true, force: true });
    await A.close();
  });
});
