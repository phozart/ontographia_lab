/**
 * E2E: ADR-0007 P1 slides and presentations. In the real editor: build a deck from frames (panel, frame toolbar),
 * reorder, write notes, present with the keyboard (counter, notes, black, number+Enter, focus trap, Esc, deep link),
 * export a PDF (one page per slide, 16:9) and a slide PNG, present as a viewer (cannot edit), and watch a real MCP
 * agent build a 3-slide deck from existing frames appear through live pickup.
 * Needs the app at TEST_BASE_URL and QA_ADMIN_* (owner) / QA_USER_* (viewer) from .env.qa.local.
 * Creates its own diagrams and deletes them afterwards. E2E_SHOTS_DIR saves screenshots.
 */
const path = require('path');
const os = require('os');
const fs = require('fs');
const puppeteer = require('puppeteer');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.qa.local') });

jest.setTimeout(240000);
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3002';
const SHOTS = process.env.E2E_SHOTS_DIR || '';
const O = 50000;

const frame = (id, x, y, label, extra = {}) => ({
  id, type: 'frame', packId: 'core', isFrame: true, membershipExplicit: true, x: O + x, y: O + y, size: { width: 1920, height: 1080 }, label,
  color: '#64748b', layerId: 'default', properties: {}, data: { backgroundColor: '#ffffff', showTitle: true }, ...extra,
});
const note = (id, x, y, label, parent, color = '#4FB3CE') => ({
  id, type: 'rectangle', packId: 'core', x: O + x, y: O + y, size: { width: 420, height: 160 }, label, color, layerId: 'default', properties: {}, parentFrameId: parent,
});
const boardContent = () => ({
  elements: [
    frame('fa', 0, 0, 'Problem'), note('a1', 120, 300, 'Checkout drops 40%', 'fa'), note('a2', 700, 300, 'Mobile is worst', 'fa', '#E8A99A'),
    frame('fb', 2200, 0, 'Funnel'), note('b1', 2320, 300, 'Cart', 'fb'), note('b2', 2900, 300, 'Payment', 'fb', '#F0D98A'),
    frame('fc', 4400, 0, 'Next steps'), note('c1', 4520, 300, 'Fix the payment form', 'fc'),
  ],
  connections: [], layers: [], groups: [], viewport: { x: 0, y: 0, zoom: 1 },
});

describe('Slides and presentations (ADR-0007 P1)', () => {
  let browser; const contexts = {}; let diagram; let agentDiagram; let downloadDir;
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
  const call = (page, method, url, body) => page.evaluate(async (m, u, b) => {
    const r = await fetch(u, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
    let json = null; try { json = await r.json(); } catch (e) { /* none */ }
    return { status: r.status, body: json };
  }, method, url, body);
  const head = async (page, d = diagram) => (await call(page, 'GET', `/api/diagrams/${d.id}`)).body;
  async function open(page, d = diagram, query = '') {
    await page.goto(`${BASE_URL}/diagram/${d.short_id}${query}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForSelector('.ds-canvas-container', { timeout: 30000 });
    await page.waitForSelector('[data-node-id]', { timeout: 30000 });
    await sleep(1200);
  }
  async function waitFor(fn, ms = 10000, step = 250) {
    const end = Date.now() + ms;
    for (;;) {
      const v = await fn();
      if (v) return v;
      if (Date.now() > end) throw new Error('timed out waiting');
      await sleep(step);
    }
  }
  const deckOnServer = async (page, d = diagram) => ((await head(page, d)).content.presentations || [])[0];
  const slideFrames = async (page, d = diagram) => ((await deckOnServer(page, d)) || { slides: [] }).slides.map((s) => s.frameId);
  async function openPanel(page) {
    if (await page.$('[data-testid="presentation-panel"]')) return;
    await page.click('.ds-title-menu-wrapper button');
    await page.click('[data-testid="menu-presentation"]');
    await page.waitForSelector('[data-testid="presentation-panel"]');
  }
  // select a frame through the Frames overview (Show Frames, then the frame's entry)
  async function selectFrame(page, label) {
    // (evaluate, not click: the Next.js dev indicator can sit on top of this button)
    if (!(await page.$('button.frame-item'))) await page.evaluate(() => document.querySelector('button.minimize-btn').click());
    await page.waitForSelector('button.frame-item');
    await page.evaluate((l) => [...document.querySelectorAll('button.frame-item')].find((b) => b.textContent.includes(l)).click(), label);
    await sleep(400);
  }
  const counter = (page) => page.$eval('[data-testid="present-counter"]', (n) => n.textContent.trim());
  const key = async (page, k) => { await page.keyboard.press(k); await sleep(150); };
  const slideTitles = (page) => page.$$eval('[data-testid="pp-slide"] .pp-link', (els) => els.map((e) => e.textContent.trim()));
  const clickByLabel = (page, label) => page.evaluate((l) => { const b = document.querySelector(`[aria-label="${l}"]`); if (!b) throw new Error(`no button ${l}`); b.click(); }, label);

  beforeAll(async () => {
    downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p1-dl-'));
    browser = await puppeteer.launch({ headless: process.env.HEADLESS !== 'false', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
    await login('a', process.env.QA_ADMIN_EMAIL, process.env.QA_ADMIN_PASSWORD);
    await login('b', process.env.QA_USER_EMAIL, process.env.QA_USER_PASSWORD);
    const session = await browser.target().createCDPSession();
    await session.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir, browserContextId: contexts.a.id });
    const p = await newPage('a');
    diagram = (await call(p, 'POST', '/api/diagrams', { type: 'infinite-canvas', name: 'E2E slides', content: boardContent() })).body;
    agentDiagram = (await call(p, 'POST', '/api/diagrams', { type: 'infinite-canvas', name: 'E2E slides agent', content: boardContent() })).body;
    for (const d of [diagram, agentDiagram]) expect((await call(p, 'POST', `/api/diagrams/${d.id}/shares`, { email: process.env.QA_USER_EMAIL, role: 'viewer' })).status).toBeLessThan(300);
    await p.close();
  });

  afterAll(async () => {
    try {
      const p = await newPage('a');
      for (const d of [diagram, agentDiagram]) if (d) await call(p, 'DELETE', `/api/diagrams/${d.id}`);
      const tokens = (await call(p, 'GET', '/api/user/tokens')).body?.tokens || [];
      for (const t of tokens.filter((x) => x.name === 'e2e slides')) await call(p, 'DELETE', `/api/user/tokens/${t.id}`);
    } catch (e) { /* best effort */ }
    if (browser) await browser.close();
    try { fs.rmSync(downloadDir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
  });

  test('create slides from frames (panel and frame toolbar), reorder, notes, hide, add and remove a slide', async () => {
    const A = await newPage('a');
    await open(A);

    // 1. select a frame, open the panel: "Add selected frame"
    await selectFrame(A, 'Problem');
    await openPanel(A);
    await A.waitForSelector('[data-testid="pp-add-selected"]:not([disabled])', { timeout: 5000 });
    await A.click('[data-testid="pp-add-selected"]');
    await A.waitForSelector('[data-testid="pp-slide"]');

    // 2. frame toolbar: "Add to presentation" for the second frame
    await selectFrame(A, 'Funnel');
    await A.waitForSelector('[data-testid="frame-add-to-presentation"]', { timeout: 5000 });
    await A.evaluate(() => document.querySelector('[data-testid="frame-add-to-presentation"]').click());
    // 3. third frame through the panel again
    await selectFrame(A, 'Next steps');
    await A.waitForSelector('[data-testid="pp-add-selected"]:not([disabled])');
    await A.click('[data-testid="pp-add-selected"]');
    await waitFor(async () => (await slideTitles(A)).length === 3);
    expect(await slideTitles(A)).toEqual(['Problem', 'Funnel', 'Next steps']);
    await shot(A, 'p1-panel-three-slides.png');
    await waitFor(async () => (await slideFrames(A)).length === 3);
    expect(await slideFrames(A)).toEqual(['fa', 'fb', 'fc']);
    expect((await deckOnServer(A)).title).toBe('Presentation 1');

    // 4. reorder with the buttons: move slide 3 up, check the server, move it back
    await clickByLabel(A, 'Move slide 3 up');
    await waitFor(async () => (await slideFrames(A)).join() === 'fa,fc,fb');
    await clickByLabel(A, 'Move slide 3 down'.replace('3 down', '2 down'));
    await waitFor(async () => (await slideFrames(A)).join() === 'fa,fb,fc');
    expect(await slideTitles(A)).toEqual(['Problem', 'Funnel', 'Next steps']);

    // 5. notes on slide 1 (saved on blur), hide / show slide 2
    await clickByLabel(A, 'Notes for slide 1');
    await A.waitForSelector('textarea[aria-label="Speaker notes for slide 1"]');
    await A.type('textarea[aria-label="Speaker notes for slide 1"]', 'Open with the drop-off number.');
    await A.evaluate(() => document.querySelector('textarea[aria-label="Speaker notes for slide 1"]').blur());
    await waitFor(async () => ((await deckOnServer(A)).slides[0].notes || '') === 'Open with the drop-off number.');
    await clickByLabel(A, 'Hide slide 2');
    await waitFor(async () => (await deckOnServer(A)).slides[1].hidden === true);
    await clickByLabel(A, 'Show slide 2');
    await waitFor(async () => !(await deckOnServer(A)).slides[1].hidden);

    // 6. Add slide: a new 16:9 frame right of the deck; removing it with "Delete frame too" deletes the frame
    await A.click('[data-testid="pp-add-slide"]');
    await waitFor(async () => (await slideTitles(A)).length === 4);
    await waitFor(async () => (await slideFrames(A)).length === 4);
    const newFrameId = (await slideFrames(A))[3];
    const made = (await head(A)).content.elements.find((e) => e.id === newFrameId);
    expect(made.size).toEqual({ width: 1920, height: 1080 });
    expect(made.data.aspect).toBe('16:9');
    expect(made.x).toBeGreaterThan(O + 4400 + 1920);
    await clickByLabel(A, 'Remove slide 4');
    await A.waitForSelector('[aria-label="Remove slide"] button.danger');
    await A.evaluate(() => [...document.querySelectorAll('[aria-label="Remove slide"] button')].find((b) => /Delete frame too/.test(b.textContent)).click());
    await waitFor(async () => (await slideFrames(A)).length === 3);
    await waitFor(async () => !(await head(A)).content.elements.some((e) => e.id === newFrameId));
    await A.close();
  });

  test('present with the keyboard: counter, navigation, notes, black screen, number+Enter, focus trap, deep link, Esc', async () => {
    const A = await newPage('a');
    await open(A);
    await openPanel(A);
    await A.click('[data-testid="pp-present"]');
    await A.waitForSelector('[data-testid="present-mode"]', { timeout: 10000 });
    expect(await A.$eval('[data-testid="present-mode"]', (n) => n.getAttribute('role') + '|' + n.getAttribute('aria-modal'))).toBe('dialog|true');
    expect(await counter(A)).toBe('1 / 3');
    // the slide is a read-only render of the frame: it holds the notes inside, and nothing from other slides
    await waitFor(() => A.$('[data-testid="present-stage"] [data-node-id="a1"]'));
    expect(await A.$eval('[data-testid="present-stage"]', (n) => n.textContent)).toContain('Checkout drops 40%');
    // off-slide elements are not in the slide at all (not just clipped)
    expect(await A.$('[data-testid="present-stage"] [data-node-id="c1"]')).toBeNull();
    expect(await A.$('[data-testid="present-stage"] [data-node-id="a2"]')).not.toBeNull();
    expect(await A.$eval('[data-testid="present-announce"]', (n) => n.textContent)).toBe('Slide 1 of 3: Problem');
    expect(await A.evaluate(() => new URLSearchParams(location.search).get('slide'))).toBe('1');
    await shot(A, 'p1-present-slide1.png');

    await key(A, 'ArrowRight'); expect(await counter(A)).toBe('2 / 3');
    expect(await A.$eval('[data-testid="present-stage"]', (n) => n.textContent)).toContain('Payment');
    await key(A, 'Space'); expect(await counter(A)).toBe('3 / 3');
    await key(A, 'ArrowRight'); expect(await counter(A)).toBe('3 / 3'); // clamps at the end
    await key(A, 'PageUp'); expect(await counter(A)).toBe('2 / 3');
    await key(A, 'Home'); expect(await counter(A)).toBe('1 / 3');
    await key(A, 'End'); expect(await counter(A)).toBe('3 / 3');
    await key(A, 'ArrowUp'); expect(await counter(A)).toBe('2 / 3');
    await key(A, 'PageDown'); expect(await counter(A)).toBe('3 / 3');
    await key(A, 'ArrowLeft'); await key(A, 'ArrowLeft'); expect(await counter(A)).toBe('1 / 3');
    await key(A, '3'); await key(A, 'Enter'); expect(await counter(A)).toBe('3 / 3');
    expect(await A.evaluate(() => new URLSearchParams(location.search).get('slide'))).toBe('3');
    expect(await A.$eval('[data-testid="present-announce"]', (n) => n.textContent)).toBe('Slide 3 of 3: Next steps');

    // notes (N) and black (B)
    await key(A, 'Home');
    await key(A, 'n');
    expect(await A.$eval('[data-testid="present-notes"]', (n) => n.textContent)).toContain('Open with the drop-off number.');
    await shot(A, 'p1-present-notes.png');
    await key(A, 'n');
    expect(await A.$('[data-testid="present-notes"]')).toBeNull();
    await key(A, 'b');
    expect(await A.$eval('[data-testid="present-stage"]', (n) => getComputedStyle(n).visibility)).toBe('hidden');
    await key(A, 'b');
    expect(await A.$eval('[data-testid="present-stage"]', (n) => getComputedStyle(n).visibility)).toBe('visible');

    // editor shortcuts are blocked: Delete / Ctrl+A / v change nothing on the board
    const before = await A.evaluate(() => document.querySelectorAll('.ds-canvas-inner [data-node-id]').length);
    await key(A, 'Delete'); await key(A, 'v');
    await A.keyboard.down('Control'); await key(A, 'a'); await A.keyboard.up('Control');
    await key(A, 'Delete');
    expect(await A.evaluate(() => document.querySelectorAll('.ds-canvas-inner [data-node-id]').length)).toBe(before);

    // focus trap: Tab many times, focus never leaves the dialog
    for (let i = 0; i < 9; i += 1) { await key(A, 'Tab'); expect(await A.evaluate(() => !!document.activeElement.closest('[data-testid="present-mode"]'))).toBe(true); }
    await A.keyboard.down('Shift'); await key(A, 'Tab'); await A.keyboard.up('Shift');
    expect(await A.evaluate(() => !!document.activeElement.closest('[data-testid="present-mode"]'))).toBe(true);

    // Esc leaves, removes the deep link, and returns to the slide's frame on the board (selected)
    await key(A, 'Escape');
    await waitFor(async () => !(await A.$('[data-testid="present-mode"]')), 3000);
    expect(await A.evaluate(() => new URL(location.href).searchParams.has('present'))).toBe(false);
    await waitFor(() => A.$eval('[data-node-id="fa"]', (n) => n.classList.contains('selected')).catch(() => false), 4000);

    // the deep link starts the show at slide 2 after a reload
    const deck = await deckOnServer(A);
    await open(A, diagram, `?present=${encodeURIComponent(deck.id)}&slide=2`);
    await A.waitForSelector('[data-testid="present-mode"]', { timeout: 10000 });
    expect(await counter(A)).toBe('2 / 3');
    await key(A, 'Escape');
    await A.close();
  });

  test('hidden and missing slides are skipped when presenting', async () => {
    const A = await newPage('a');
    await open(A);
    await openPanel(A);
    await clickByLabel(A, 'Hide slide 2');
    await waitFor(async () => (await deckOnServer(A)).slides[1].hidden === true);
    await A.click('[data-testid="pp-present"]');
    await A.waitForSelector('[data-testid="present-mode"]');
    expect(await counter(A)).toBe('1 / 2');
    await key(A, 'ArrowRight');
    expect(await A.$eval('[data-testid="present-announce"]', (n) => n.textContent)).toBe('Slide 2 of 2: Next steps');
    await key(A, 'Escape');
    await clickByLabel(A, 'Show slide 2');
    await waitFor(async () => !(await deckOnServer(A)).slides[1].hidden);
    // delete the middle frame on the server (as another editor would): the slide stays as a "missing slide", autosave still works
    const h = await head(A);
    const content = { ...h.content, elements: h.content.elements.filter((e) => e.id !== 'fb' && e.parentFrameId !== 'fb') };
    const put = await A.evaluate(async (id, c, rev) => (await fetch(`/api/diagrams/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'If-Match': `"${rev}"` }, body: JSON.stringify({ content: c }) })).status, diagram.id, content, h.revision);
    expect(put).toBe(200);
    expect((await deckOnServer(A)).slides.map((s) => s.frameId)).toEqual(['fa', 'fb', 'fc']);
    await open(A);
    await openPanel(A);
    await A.waitForSelector('[data-testid="pp-slide"] .pp-badge.bad');
    expect(await A.$eval('[data-testid="pp-slide"] .pp-badge.bad', (n) => n.textContent)).toMatch(/Missing slide/);
    await shot(A, 'p1-panel-missing.png');
    await A.click('[data-testid="pp-present"]');
    await A.waitForSelector('[data-testid="present-mode"]');
    expect(await counter(A)).toBe('1 / 2');
    await key(A, 'Escape');
    // restore the frame for the export test
    const h2 = await head(A);
    await A.evaluate(async (id, c, rev) => { await fetch(`/api/diagrams/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'If-Match': `"${rev}"` }, body: JSON.stringify({ content: c }) }); }, diagram.id, { ...h2.content, elements: boardContent().elements }, h2.revision);
    await A.close();
  });

  test('export: PDF has one 16:9 page per slide, and a slide downloads as PNG', async () => {
    const A = await newPage('a');
    await open(A);
    await openPanel(A);
    await A.click('[data-testid="pp-export-pdf"]');
    const pdfPath = await waitFor(() => fs.readdirSync(downloadDir).map((f) => path.join(downloadDir, f)).find((f) => f.endsWith('.pdf')), 60000, 500);
    await sleep(500);
    const pdf = fs.readFileSync(pdfPath).toString('latin1');
    expect((pdf.match(/\/Type\s*\/Page(?![s\w])/g) || []).length).toBe(3);
    const boxes = [...pdf.matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g)].map((m) => [Number(m[1]), Number(m[2])]);
    expect(boxes.length).toBeGreaterThanOrEqual(3);
    for (const [w, h] of boxes.slice(0, 3)) { expect(Math.round(w)).toBe(960); expect(Math.round(h)).toBe(540); }
    expect(path.basename(pdfPath)).toBe('Presentation 1.pdf');

    await clickByLabel(A, 'Download slide 1 as PNG');
    const pngPath = await waitFor(() => fs.readdirSync(downloadDir).map((f) => path.join(downloadDir, f)).find((f) => f.endsWith('.png')), 60000, 500);
    await sleep(500);
    const png = fs.readFileSync(pngPath);
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    const w = png.readUInt32BE(16); const h = png.readUInt32BE(20);
    expect(w / h).toBeCloseTo(16 / 9, 2);
    expect(w).toBeGreaterThanOrEqual(1920);
    await shot(A, 'p1-after-export.png');
    await A.close();
  });

  test('a viewer can present and export but cannot edit the deck', async () => {
    const B = await newPage('b');
    const deck = await deckOnServer(B);
    await open(B, diagram, `?present=${encodeURIComponent(deck.id)}&slide=2`);
    await B.waitForSelector('[data-testid="present-mode"]', { timeout: 10000 });
    expect(await counter(B)).toBe('2 / 3');
    await key(B, 'ArrowRight'); expect(await counter(B)).toBe('3 / 3');
    await key(B, 'Escape');
    await waitFor(async () => !(await B.$('[data-testid="present-mode"]')), 3000);
    await openPanel(B);
    expect(await B.$('[data-testid="pp-add-slide"]')).toBeNull();
    expect(await B.$('[data-testid="pp-add-selected"]')).toBeNull();
    expect(await B.$('[aria-label="Move slide 2 up"]')).toBeNull();
    expect(await B.$('[aria-label="Remove slide 1"]')).toBeNull();
    expect(await B.$('[data-testid="pp-present"]')).not.toBeNull();
    expect(await B.$('[data-testid="pp-export-pdf"]')).not.toBeNull();
    await shot(B, 'p1-viewer-panel.png');
    // the server refuses a viewer's write
    const h = await head(B);
    const status = await B.evaluate(async (id, rev) => (await fetch(`/api/diagrams/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'If-Match': `"${rev}"` }, body: JSON.stringify({ content: { elements: [] } }) })).status, diagram.id, h.revision);
    expect(status).toBe(403);
    await B.close();
  });

  test('a real MCP agent builds a 3-slide deck from existing frames; the open editor picks it up live', async () => {
    const A = await newPage('a');
    await open(A, agentDiagram);
    await openPanel(A);
    expect(await slideTitles(A)).toEqual([]);
    const created = await call(A, 'POST', '/api/user/tokens', { name: 'e2e slides', roleCap: 'editor', diagramIds: [agentDiagram.id] });
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
    const tool = async (id, name, args) => { const out = await rpc(id, 'tools/call', { name, arguments: args }); expect(out.result?.isError).not.toBe(true); return out.result.structuredContent; };
    await rpc(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'e2e', version: '1' } });
    const rev0 = (await head(A, agentDiagram)).revision;
    const c = await tool(2, 'presentation_create', { id: agentDiagram.id, baseRevision: rev0, title: 'Checkout readout' });
    const a = await tool(3, 'slide_add', { id: agentDiagram.id, baseRevision: c.revision, presentationId: c.presentationId, frameIds: ['fa', 'fb', 'fc'], fitAspect: true, notes: 'Start here' });
    expect(a.slideIds).toHaveLength(3);
    await tool(4, 'slide_update', { id: agentDiagram.id, baseRevision: a.revision, presentationId: c.presentationId, slideId: a.slideIds[1], notes: 'Walk the funnel' });

    // visible in the open editor without a reload
    await waitFor(async () => (await slideTitles(A)).length === 3, 12000);
    expect(await slideTitles(A)).toEqual(['Problem', 'Funnel', 'Next steps']);
    expect(await A.$eval('select[aria-label="Presentation"]', (s) => s.options[s.selectedIndex].textContent)).toBe('Checkout readout');
    await shot(A, 'p1-agent-deck-live.png');
    await A.click('[data-testid="pp-present"]');
    await A.waitForSelector('[data-testid="present-mode"]');
    expect(await counter(A)).toBe('1 / 3');
    await key(A, 'Escape');
    // one version per call, all by the agent, and the deck lives in the stored content
    const stored = await deckOnServerFor(A);
    expect(stored.slides.map((s) => s.frameId)).toEqual(['fa', 'fb', 'fc']);
    expect(stored.slides[1].notes).toBe('Walk the funnel');
    const versions = (await call(A, 'GET', `/api/diagrams/${agentDiagram.id}/versions`)).body;
    expect((versions.items || []).filter((v) => v.createdVia === 'agent' || v.created_via === 'agent').length).toBeGreaterThanOrEqual(3);
    await A.close();

    async function deckOnServerFor(page) { return deckOnServer(page, agentDiagram); }
  });
});
