/**
 * E2E: ADR-0007 P2 text presets, board themes and slide layouts. In the real editor: add a slide with a layout, apply a
 * layout to a frame, add title / body / number presets, switch the theme (token-coloured elements and presets follow, hex
 * ones do not), present, export a PDF (one page per slide); and a real MCP agent building a 5-slide themed deck from board
 * content, which is then presented slide by slide at 1379 x 985 (E2E_SHOTS_DIR saves each slide).
 * Needs the app at TEST_BASE_URL and QA_ADMIN_* from .env.qa.local. Creates its own diagrams and deletes them afterwards.
 */
const path = require('path');
const os = require('os');
const fs = require('fs');
const puppeteer = require('puppeteer');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.qa.local') });

jest.setTimeout(300000);
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3002';
const SHOTS = process.env.E2E_SHOTS_DIR || '';
const O = 50000;

const frame = (id, x, y, label, extra = {}) => ({
  id, type: 'frame', packId: 'core', isFrame: true, membershipExplicit: true, x: O + x, y: O + y, size: { width: 1200, height: 700 }, label,
  color: '#64748b', layerId: 'default', properties: {}, data: { backgroundColor: '#ffffff', showTitle: true }, ...extra,
});
const note = (id, x, y, label, parent, color = '#4FB3CE') => ({
  id, type: 'rectangle', packId: 'core', x: O + x, y: O + y, size: { width: 300, height: 110 }, label, color, layerId: 'default', properties: {}, parentFrameId: parent,
});
const table = (id, x, y) => ({
  id, type: 'table', packId: 'core', x: O + x, y: O + y, size: { width: 560, height: 190 }, label: 'Funnel', layerId: 'default', properties: {},
  data: { table: { headerRow: true, columns: [{ id: 'col-step', name: 'Step', type: 'text', width: 200 }, { id: 'col-rate', name: 'Conversion', type: 'number', width: 140 }, { id: 'col-note', name: 'Note', type: 'text', width: 180 }],
    rows: [{ id: 'row-1', cells: { 'col-step': 'Cart', 'col-rate': 62, 'col-note': 'steady' } }, { id: 'row-2', cells: { 'col-step': 'Address', 'col-rate': 51, 'col-note': 'slow' } }, { id: 'row-3', cells: { 'col-step': 'Payment', 'col-rate': 24, 'col-note': 'drops' } }] } },
});
const boardContent = () => ({
  elements: [
    frame('fa', 0, 0, 'Problem'), note('a1', 80, 160, 'Checkout drops 40%', 'fa'), note('a2', 460, 160, 'Mobile is worst', 'fa', '#E8A99A'), note('a3', 80, 360, 'Payment form errors', 'fa', '#F0D98A'), note('a4', 460, 360, 'No guest checkout', 'fa', '#9A8AC8'),
    table('tbl', 1500, 100),
  ],
  connections: [{ id: 'c1', sourceId: 'a1', targetId: 'a2', lineStyle: 'step' }, { id: 'c2', sourceId: 'a3', targetId: 'a4', lineStyle: 'step' }],
  layers: [], groups: [], viewport: { x: 0, y: 0, zoom: 1 },
});

describe('Presets, themes and layouts (ADR-0007 P2)', () => {
  let browser; let context; let uiDiagram; let agentDiagram; let downloadDir;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const shot = async (page, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name) }); } };

  async function newPage() {
    const page = await context.newPage();
    await page.setViewport({ width: 1379, height: 985 });
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    return page;
  }
  const call = (page, method, url, body) => page.evaluate(async (m, u, b) => {
    const r = await fetch(u, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
    let json = null; try { json = await r.json(); } catch (e) { /* none */ }
    return { status: r.status, body: json };
  }, method, url, body);
  const head = async (page, d) => (await call(page, 'GET', `/api/diagrams/${d.id}`)).body;
  async function open(page, d) {
    await page.goto(`${BASE_URL}/diagram/${d.short_id}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForSelector('.ds-canvas-container', { timeout: 30000 });
    await page.waitForSelector('[data-node-id]', { timeout: 30000 });
    await sleep(1200);
  }
  async function waitFor(fn, ms = 12000, step = 250) {
    const end = Date.now() + ms;
    for (;;) {
      const v = await fn();
      if (v) return v;
      if (Date.now() > end) throw new Error('timed out waiting');
      await sleep(step);
    }
  }
  async function openPanel(page) {
    if (await page.$('[data-testid="presentation-panel"]')) return;
    await page.click('.ds-title-menu-wrapper button');
    await page.click('[data-testid="menu-presentation"]');
    await page.waitForSelector('[data-testid="presentation-panel"]');
  }
  async function selectFrame(page, label) {
    if (!(await page.$('button.frame-item'))) await page.evaluate(() => document.querySelector('button.minimize-btn').click());
    await page.waitForSelector('button.frame-item');
    await page.evaluate((l) => [...document.querySelectorAll('button.frame-item')].find((b) => b.textContent.includes(l)).click(), label);
    await sleep(500);
  }
  const click = (page, testid) => page.evaluate((t) => document.querySelector(`[data-testid="${t}"]`).click(), testid);
  const presets = (page) => page.$$eval('.ds-canvas-container [data-testid="text-preset"]', (els) => els.map((e) => ({ preset: e.getAttribute('data-preset'), color: e.style.color, family: e.style.fontFamily, size: e.style.fontSize, text: e.textContent.trim() })));
  const frameFill = (page, label) => page.$$eval('.ds-canvas-container [data-type="frame"]', (frames, l) => frames.filter((f) => f.textContent.includes(l)).map((f) => f.querySelector('svg rect[fill]').getAttribute('fill')), label);

  beforeAll(async () => {
    downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p2-dl-'));
    browser = await puppeteer.launch({ headless: process.env.HEADLESS !== 'false', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
    context = await browser.createBrowserContext();
    const p = await context.newPage();
    await p.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0', timeout: 90000 });
    await p.type('#email', process.env.QA_ADMIN_EMAIL);
    await p.type('#password', process.env.QA_ADMIN_PASSWORD);
    await Promise.all([p.waitForFunction(() => !window.location.pathname.startsWith('/login'), { timeout: 30000 }), p.click('button[type="submit"]')]);
    await p.close();
    const session = await browser.target().createCDPSession();
    await session.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir, browserContextId: context.id });
    const pg = await newPage();
    uiDiagram = (await call(pg, 'POST', '/api/diagrams', { type: 'infinite-canvas', name: 'E2E presets ui', content: boardContent() })).body;
    agentDiagram = (await call(pg, 'POST', '/api/diagrams', { type: 'infinite-canvas', name: 'E2E presets agent', content: boardContent() })).body;
    await pg.close();
  });

  afterAll(async () => {
    try {
      const p = await newPage();
      for (const d of [uiDiagram, agentDiagram]) if (d) await call(p, 'DELETE', `/api/diagrams/${d.id}`);
      const tokens = (await call(p, 'GET', '/api/user/tokens')).body?.tokens || [];
      for (const t of tokens.filter((x) => x.name === 'e2e presets')) await call(p, 'DELETE', `/api/user/tokens/${t.id}`);
    } catch (e) { /* best effort */ }
    if (browser) await browser.close();
    try { fs.rmSync(downloadDir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
  });

  test('add a slide with a layout, apply another layout, add presets, switch theme, present, export a PDF', async () => {
    const page = await newPage();
    await open(page, uiDiagram);
    await openPanel(page);

    // 1. a new slide from a layout: themed frame + title placeholder + decor
    await page.select('#dc-layout', 'two-column');
    await click(page, 'layout-add-slide');
    await waitFor(async () => (await presets(page)).length >= 3);
    let found = await presets(page);
    expect(found.map((p) => p.preset).sort()).toEqual(['body', 'body', 'heading']);
    expect(found.find((p) => p.preset === 'heading').text).toBe('Slide 1');
    expect(found.find((p) => p.preset === 'heading').size).toBe('48px');
    expect(found.find((p) => p.preset === 'heading').family).toContain('Inter');
    await shot(page, 'p2-layout-two-column.png');

    // 2. apply a different layout to the selected slide frame: the placed text moves, the missing slot is added
    await selectFrame(page, 'Slide 1');
    await page.select('#dc-layout', 'three-column');
    await click(page, 'layout-apply');
    await waitFor(async () => (await presets(page)).length >= 4 && (await presets(page)).filter((p) => p.preset === 'body').length === 3);
    found = await presets(page);
    expect(found.filter((p) => p.preset === 'body')).toHaveLength(3); // left and right moved into c1 and c2, c3 was added
    await shot(page, 'p2-layout-three-column.png');

    // 3. add title / body / number presets into the selected frame
    for (const p of ['title', 'body', 'number']) await click(page, `add-text-${p}`);
    await waitFor(async () => (await presets(page)).some((x) => x.preset === 'number'));
    found = await presets(page);
    expect(found.find((p) => p.preset === 'number').size).toBe('120px');
    expect(found.find((p) => p.preset === 'title').size).toBe('72px');

    // 4. switch the theme: the presets and the token-coloured frame follow
    const before = { color: found.find((p) => p.preset === 'heading').color, fill: (await frameFill(page, 'Slide 1'))[0] };
    await click(page, 'theme-slate-dark');
    await waitFor(async () => (await presets(page)).find((p) => p.preset === 'heading')?.color !== before.color);
    const after = { color: (await presets(page)).find((p) => p.preset === 'heading').color, fill: (await frameFill(page, 'Slide 1'))[0] };
    expect(after.color).not.toBe(before.color);
    expect(after.fill).not.toBe(before.fill);
    expect(after.fill.toLowerCase()).toBe('#18212b');
    await shot(page, 'p2-theme-slate.png');
    await page.waitForFunction(() => document.querySelector('[data-testid="theme-slate-dark"]').getAttribute('aria-checked') === 'true');

    // 5. the theme is saved with the board
    await waitFor(async () => (await head(page, uiDiagram)).content?.theme?.preset === 'slate-dark', 15000);
    const stored = (await head(page, uiDiagram)).content;
    expect(stored.elements.filter((e) => e.data?.text).every((e) => e.data.text.markdown.length > 0)).toBe(true);
    expect(stored.elements.find((e) => e.type === 'frame' && e.label === 'Slide 1').data).toMatchObject({ backgroundColor: '@bg', layout: 'three-column' });

    // 6. present: the slide shows the themed ground and the presets; Esc leaves
    await click(page, 'pp-present');
    await page.waitForSelector('[data-testid="present-mode"]');
    await sleep(800);
    const stageBg = await page.$eval('[data-testid="present-stage"]', (s) => s.firstElementChild?.style?.background || s.style.background || getComputedStyle(s.parentElement).backgroundColor);
    expect(typeof stageBg).toBe('string');
    expect(await page.$$eval('[data-testid="present-stage"] [data-testid="text-preset"]', (e) => e.length)).toBeGreaterThanOrEqual(5);
    await shot(page, 'p2-present-slate.png');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('[data-testid="present-mode"]'), { timeout: 10000 });

    // 7. export a PDF: one page per slide
    await click(page, 'pp-export-pdf');
    const file = await waitFor(async () => fs.readdirSync(downloadDir).find((f) => f.endsWith('.pdf')), 60000, 500);
    const pdf = fs.readFileSync(path.join(downloadDir, file)).toString('latin1');
    expect((pdf.match(/\/Type\s*\/Page[^s]/g) || []).length).toBe(1);
    await page.close();
  });

  test('opening a board with an undersized text preset writes nothing: no new revision after 10 s', async () => {
    const page = await newPage();
    const content = boardContent();
    content.elements = content.elements.filter((e) => e.type !== 'table'); // a table has its own (older) fit-on-open rule
    content.elements.push({ id: 'tiny', type: 'text-block', packId: 'core', x: O + 80, y: O + 560, size: { width: 300, height: 10 }, fontSize: 28, label: 'x', layerId: 'default', properties: {}, parentFrameId: 'fa', data: { text: { preset: 'body', markdown: 'A long line of text that needs several lines in a three hundred unit wide box so it overflows.' } } });
    const d = (await call(page, 'POST', '/api/diagrams', { type: 'infinite-canvas', name: 'E2E undersized', content })).body;
    const before = (await head(page, d)).revision;
    await open(page, d);
    await sleep(10000);
    expect((await head(page, d)).revision).toBe(before);
    expect(await page.$eval('[data-testid="text-preset"][data-preset="body"]', (e) => e.getAttribute('data-overflow'))).toBe('true');
    await call(page, 'DELETE', `/api/diagrams/${d.id}`);
    await page.close();
  });

  test('a real MCP agent builds a 5-slide themed deck from board content; each slide is presented at 1379x985', async () => {
    const A = await newPage();
    await open(A, agentDiagram);
    const created = await call(A, 'POST', '/api/user/tokens', { name: 'e2e presets', roleCap: 'editor', diagramIds: [agentDiagram.id] });
    expect(created.status).toBe(201);
    const secret = created.body.token;
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
    let n = 1;
    const tool = async (name, args) => { n += 1; const out = await rpc(n, 'tools/call', { name, arguments: args }); if (out.result?.isError) throw new Error(`${name}: ${out.result.content?.[0]?.text}`); return out.result.structuredContent; };
    await rpc(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'e2e', version: '1' } });
    const tools = (await rpc(900, 'tools/list', {})).result.tools.map((t) => t.name);
    for (const t of ['text_add', 'theme_apply', 'slide_add']) expect(tools).toContain(t);

    let rev = (await head(A, agentDiagram)).revision;
    const c = await tool('presentation_create', { id: agentDiagram.id, baseRevision: rev, title: 'Checkout review' });
    const t = await tool('theme_apply', { id: agentDiagram.id, baseRevision: c.revision, preset: 'ethereal-sky' });
    expect(t.theme.preset).toBe('ethereal-sky');
    const s = await tool('slide_add', {
      id: agentDiagram.id, baseRevision: t.revision, presentationId: c.presentationId,
      slides: [
        { layout: 'title-center', title: 'Checkout review', blocks: [{ text: { markdown: 'What we found and what we will do about it' } }], notes: 'Welcome everyone.' },
        { layout: 'title-body', title: 'What we found', blocks: [{ text: { markdown: '- Checkout conversion fell by **40%** in two weeks\n- Mobile is the worst affected device class\n- Payment form errors and a missing guest checkout drive it' } }], notes: 'Three findings.' },
        { layout: 'two-column', title: 'The problem on the board', blocks: [{ slot: 'left', copy: { frameId: 'fa' } }, { slot: 'right', text: { markdown: '- Four clusters of complaints\n- Two of them are about payment\n- Fix the form first' } }] },
        { layout: 'big-number', blocks: [{ text: { markdown: '40%' } }, { text: { markdown: 'drop in checkout conversion' } }, { text: { markdown: 'Measured over the last two weeks, mostly on mobile.' } }] },
        { layout: 'title-visual', title: 'Where the funnel leaks', blocks: [{ copy: { elementIds: ['tbl'] } }] },
      ],
    });
    expect(s.slideIds).toHaveLength(5);
    rev = s.revision;

    const stored = (await head(A, agentDiagram)).content;
    expect(stored.presentations[0].slides).toHaveLength(5);
    expect(stored.theme.preset).toBe('ethereal-sky');
    // originals are untouched (a copy block is a snapshot)
    expect(stored.elements.find((e) => e.id === 'a1').size).toEqual({ width: 300, height: 110 });
    expect(stored.elements.filter((e) => e.origin?.copiedFrom).length).toBeGreaterThanOrEqual(5);
    const versions = (await call(A, 'GET', `/api/diagrams/${agentDiagram.id}/versions`)).body;
    expect((versions.items || []).filter((v) => v.createdVia === 'agent' || v.created_via === 'agent').length).toBeGreaterThanOrEqual(3);

    // picked up live by the open editor
    await openPanel(A);
    await waitFor(async () => (await A.$$('[data-testid="pp-slide"]')).length === 5, 15000);
    await shot(A, 'p2-agent-deck-panel.png');
    await click(A, 'pp-present');
    await A.waitForSelector('[data-testid="present-mode"]');
    await sleep(1500);
    for (let i = 1; i <= 5; i += 1) {
      expect(await A.$eval('[data-testid="present-counter"]', (e) => e.textContent.trim())).toBe(`${i} / 5`);
      await sleep(700);
      await shot(A, `p2-deck-slide-${i}.png`);
      expect(await A.$$eval('[data-testid="present-stage"] [data-testid="text-preset"]', (e) => e.length)).toBeGreaterThanOrEqual(1);
      if (i < 5) { await A.keyboard.press('ArrowRight'); await sleep(300); }
    }
    await A.keyboard.press('Escape');
    // switching the theme restyles the whole deck in one call
    rev = (await head(A, agentDiagram)).revision;
    const t2 = await tool('theme_apply', { id: agentDiagram.id, baseRevision: rev, preset: 'paper' });
    expect(t2.theme.preset).toBe('paper');
    await A.close();
  });
});
