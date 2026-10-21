/**
 * E2E: AI-4 table element.
 *  1. In the editor: place a table with the Table tool, edit cells with the keyboard, paste a spreadsheet range, export
 *     CSV (formula cell neutralized), reload and see it persisted.
 *  2. Claude (MCP over HTTP, an editor token) builds a component table linked to 5 elements of an architecture graph;
 *     the open editor picks it up (AI-2 live pickup); clicking a row's link selects the element; deleting the element
 *     leaves plain text; table_update upsert shows up without a duplicate.
 * Needs the app at TEST_BASE_URL and QA_ADMIN_* from .env.qa.local (platform admin). Creates its own diagrams and
 * deletes them afterwards. E2E_SHOTS_DIR saves screenshots.
 */
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.qa.local') });

jest.setTimeout(180000);
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3002';
const SHOTS = process.env.E2E_SHOTS_DIR || '';

const el = (id, x, y, label) => ({ id, type: 'rectangle', packId: 'core', x: 50000 + x, y: 50000 + y, size: { width: 140, height: 60 }, label, color: '#4FB3CE', layerId: 'default', properties: {} });
const content = (elements, connections = []) => ({ elements, connections, layers: [], groups: [], viewport: { x: 0, y: 0, zoom: 1 } });
const SERVICES = ['Gateway', 'Auth', 'Billing', 'Search', 'Orders'];

describe('Table element (AI-4)', () => {
  let browser; let ctx; const diagrams = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function newPage() {
    const page = await ctx.newPage();
    await page.setViewport({ width: 1379, height: 985 });
    page.setDefaultTimeout(90000); // the dev machine is often heavily loaded
    page.setDefaultNavigationTimeout(120000);
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    return page;
  }
  const call = (page, method, url, body, headers = {}) => page.evaluate(async (m, u, b, h) => {
    const r = await fetch(u, { method: m, headers: { 'Content-Type': 'application/json', ...h }, body: b ? JSON.stringify(b) : undefined });
    let json = null; try { json = await r.json(); } catch (e) { /* none */ }
    return { status: r.status, body: json };
  }, method, url, body, headers);
  const shot = async (page, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name) }); } };
  async function open(page, diagram) {
    await page.goto(`${BASE_URL}/diagram/${diagram.short_id}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('button[title^="Table"]'); // the editor chunk is compiled and mounted
    await sleep(1500);
  }
  async function create(page, name, elements, connections) {
    const d = (await call(page, 'POST', '/api/diagrams', { type: 'infinite-canvas', name, content: content(elements, connections) })).body;
    diagrams.push(d);
    return d;
  }
  const head = async (page, d) => (await call(page, 'GET', `/api/diagrams/${d.id}`)).body;
  const tableData = async (page, d) => {
    const h = await head(page, d);
    const t = h.content.elements.find((e) => e.type === 'table');
    return { revision: h.revision, el: t, table: t && t.data.table };
  };
  const cellText = (page, r, c) => page.$eval(`[data-testid="table-cell-${r}-${c}"]`, (n) => n.textContent);
  async function dblclick(page, sel) {
    const h = await page.$(sel);
    const b = await h.boundingBox();
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2, { clickCount: 2 });
  }
  async function waitSaved(page, d, pred) {
    for (let i = 0; i < 30; i += 1) {
      await sleep(500);
      const r = await tableData(page, d);
      if (r.table && pred(r.table)) return r;
    }
    throw new Error('the change was not saved');
  }

  beforeAll(async () => {
    browser = await puppeteer.launch({ headless: process.env.HEADLESS !== 'false', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
    ctx = await browser.createBrowserContext();
    const p = await ctx.newPage();
    await p.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
    await p.type('#email', process.env.QA_ADMIN_EMAIL);
    await p.type('#password', process.env.QA_ADMIN_PASSWORD);
    await Promise.all([p.waitForFunction(() => !window.location.pathname.startsWith('/login'), { timeout: 30000 }), p.click('button[type="submit"]')]);
    await p.close();
  });
  afterAll(async () => {
    try {
      const p = await newPage();
      for (const d of diagrams) await call(p, 'DELETE', `/api/diagrams/${d.id}`);
    } catch (e) { /* best effort */ }
    if (browser) await browser.close();
  });

  test('editor: Table tool, keyboard cell editing, paste a spreadsheet range, CSV export, persistence', async () => {
    const page = await newPage();
    const d = await create(page, 'E2E table editor', [el('seed', 100, 100, 'Seed note')]);
    await open(page, d);

    // 1. Table tool: click the canvas
    await page.click('button[title^="Table"]');
    const box = await (await page.$('.ds-canvas-container')).boundingBox();
    await page.mouse.click(box.x + 400, box.y + 350);
    await page.waitForSelector('[data-testid="table-node"]');
    expect(await page.$$eval('[data-testid^="table-header-"]', (n) => n.length)).toBe(3);
    expect(await page.$$eval('[data-testid^="table-cell-"]', (n) => n.length)).toBe(9);

    // 2. keyboard editing: header rename, cells with Tab / Enter
    await dblclick(page, '[data-testid="table-header-0"]');
    await page.keyboard.type('Component');
    await page.keyboard.press('Enter');
    await dblclick(page, '[data-testid="table-cell-0-0"]');
    await page.keyboard.type('Gateway');
    await page.keyboard.press('Tab');
    await sleep(200);
    await page.keyboard.press('Enter'); // edit the next cell
    await page.keyboard.type('edge');
    await page.keyboard.press('Enter'); // commit, move down
    await sleep(200);
    await page.keyboard.press('Escape'); // leave the grid
    expect(await cellText(page, 0, 0)).toBe('Gateway');
    expect(await cellText(page, 0, 1)).toBe('edge');
    const saved = await waitSaved(page, d, (t) => t.columns[0].name === 'Component' && t.rows[0].cells[t.columns[0].id] === 'Gateway');
    expect(saved.el.size.height).toBeGreaterThan(100);

    // 3. paste a spreadsheet range onto the canvas (tab separated, a header, a number column and a formula cell)
    await page.mouse.click(box.x + 120, box.y + 700);
    await page.evaluate(() => {
      const dt = new DataTransfer();
      dt.setData('text/plain', 'Service\tCalls\nAuth\t120\nBilling\t45\n=HYPERLINK("http://x","y")\t7\n');
      window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    });
    await sleep(600);
    expect(await page.$$eval('[data-testid="table-node"]', (n) => n.length)).toBe(2);
    await shot(page, 'table-editor.png');
    const pasted = await waitSaved(page, d, () => true);
    const all = (await head(page, d)).content.elements.filter((e) => e.type === 'table');
    expect(all).toHaveLength(2);
    const p = all.find((e) => e.data.table.columns[0].name === 'Service').data.table;
    expect(p.columns.map((c) => [c.name, c.type])).toEqual([['Service', 'text'], ['Calls', 'number']]);
    expect(p.rows).toHaveLength(3);
    expect(pasted.revision).toBeGreaterThan(0);

    // 4. CSV export of the pasted table (the selected one): capture the Blob the download is made from
    await page.evaluate(() => {
      const orig = URL.createObjectURL.bind(URL);
      window.__blobs = [];
      URL.createObjectURL = (b) => { window.__blobs.push(b); return orig(b); };
    });
    await page.click('[data-testid="table-options"]');
    await page.evaluate(() => [...document.querySelectorAll('[data-testid="table-menu"] button')].find((b) => /Export as CSV/.test(b.textContent)).click());
    await sleep(300);
    const csv = await page.evaluate(async () => (window.__blobs.length ? window.__blobs[window.__blobs.length - 1].text() : ''));
    expect(csv).toContain('Service,Calls');
    expect(csv).toContain(`"'=HYPERLINK(""http://x"",""y"")",7`); // formula injection neutralized
    expect(csv).toContain('Auth,120');

    // 5. persistence: reload and the tables are still there
    await open(page, d);
    expect(await page.$$eval('[data-testid="table-node"]', (n) => n.length)).toBe(2);
    await page.close();
  });

  test('Claude builds a component table linked to 5 elements; the open editor picks it up; row links work', async () => {
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');

    const page = await newPage();
    const elements = SERVICES.map((s, i) => el(`n-${s.toLowerCase()}`, i * 220, 100, s));
    const connections = SERVICES.slice(1).map((s, i) => ({ id: `c-${i}`, sourceId: 'n-gateway', targetId: `n-${s.toLowerCase()}`, lineStyle: 'step', autoPorts: true }));
    const d = await create(page, 'E2E table from graph', elements, connections);
    const tok = await call(page, 'POST', '/api/user/tokens', { name: 'e2e table', roleCap: 'editor', diagramIds: [d.id], expiresInDays: 1 });
    expect(tok.status).toBe(201);
    const client = new Client({ name: 'e2e-claude', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL(`${BASE_URL}/api/mcp`), { requestInit: { headers: { Authorization: `Bearer ${tok.body.token}` } } }));
    const tools = (await client.listTools()).tools.map((t) => t.name);
    expect(tools).toEqual(expect.arrayContaining(['table_create', 'table_update', 'table_get']));

    await open(page, d);
    expect(await page.$$eval('[data-node-id]', (n) => n.length)).toBeGreaterThanOrEqual(5);

    // Claude: read the graph, then build the table with one row per element, linked by id
    const read = await client.callTool({ name: 'diagram_get', arguments: { id: d.id } });
    const revision = read.structuredContent.diagram.revision;
    const els = read.structuredContent.content.elements;
    const made = await client.callTool({
      name: 'table_create',
      arguments: {
        id: d.id, baseRevision: revision, title: 'Component inventory',
        columns: ['Component', { name: 'Tier', type: 'select' }, { name: 'Instances', type: 'number' }, { name: 'Critical', type: 'boolean' }],
        rows: els.map((e, i) => ({ cells: [e.label, i === 0 ? 'edge' : 'core', i + 1, i < 2], elementId: e.id })),
        anchor: { near: 'n-orders' },
      },
    });
    expect(made.isError).toBeFalsy();
    expect(made.structuredContent.summary).toMatchObject({ rows: 5, linkedRows: 5 });

    // the open editor shows it within the live pickup window, no conflict dialog
    await page.waitForSelector('[data-testid="table-node"]', { timeout: 8000 });
    expect(await page.evaluate(() => /changed elsewhere/i.test(document.body.textContent))).toBe(false);
    expect(await page.$$eval('[data-testid^="table-cell-"]', (n) => n.length)).toBe(5 * 4);
    expect(await page.$$eval('[data-testid="table-row-link"]', (n) => n.length)).toBe(5);
    expect(await page.$eval('[data-testid="table-title"]', (n) => n.textContent)).toBe('Component inventory');
    await shot(page, 'table-from-graph.png');

    // clicking a row's link selects that element
    const links = await page.$$('[data-testid="table-row-link"]');
    await links[2].click();
    await page.waitForFunction(() => document.querySelector('[data-node-id="n-billing"].selected'), { timeout: 4000 });
    await shot(page, 'table-row-link.png');

    // upsert by key twice: no duplicate rows, and the change appears live
    const rev2 = (await head(page, d)).revision;
    const up = await client.callTool({ name: 'table_update', arguments: { id: d.id, baseRevision: rev2, elementId: made.structuredContent.elementId, key: 'Component', upsertRows: [{ cells: { Component: 'Auth', Instances: 9 } }, { cells: { Component: 'Mail', Tier: 'edge', Instances: 1 } }] } });
    expect(up.isError).toBeFalsy();
    expect(up.structuredContent).toMatchObject({ inserted: 1, updated: 1 });
    const up2 = await client.callTool({ name: 'table_update', arguments: { id: d.id, baseRevision: up.structuredContent.revision, elementId: made.structuredContent.elementId, key: 'Component', upsertRows: [{ cells: { Component: 'Auth', Instances: 9 } }, { cells: { Component: 'Mail', Tier: 'edge', Instances: 1 } }] } });
    expect(up2.structuredContent).toMatchObject({ inserted: 0, updated: 2 });
    await page.waitForFunction(() => document.querySelectorAll('[data-testid^="table-cell-"]').length === 6 * 4, { timeout: 8000 });
    expect((await tableData(page, d)).table.rows).toHaveLength(6);

    // delete a linked element in the editor: the row keeps its text and the link becomes plain text
    await page.click('[data-node-id="n-search"]');
    await page.keyboard.press('Delete');
    await page.waitForSelector('[data-testid="table-row-link-gone"]', { timeout: 5000 });
    expect(await page.$$eval('[data-testid="table-row-link"]', (n) => n.length)).toBe(4);
    const after = await waitSaved(page, d, (t) => t.rows.some((r) => r.elementId === 'n-search'));
    expect(after.table.rows.find((r) => r.elementId === 'n-search')).toBeTruthy(); // dangling link kept, still valid
    await shot(page, 'table-dangling.png');

    // read-back through table_get (paged) and the compact projection
    const got = await client.callTool({ name: 'table_get', arguments: { id: d.id, elementId: made.structuredContent.elementId, limit: 4 } });
    expect(got.structuredContent.rows).toHaveLength(4);
    expect(got.structuredContent.next).toBe(4);
    expect(got.structuredContent.rows.some((r) => r.link && r.link.missing)).toBe(true);
    await client.close();
    await page.close();
  });
});
