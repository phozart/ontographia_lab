/**
 * E2E: ADR-0005 O2 - connect a "Claude" client through the full OAuth flow, like claude.ai does.
 * Node plays Claude's backend (CIMD document, PKCE, code and refresh exchange, MCP calls); a headless browser plays the
 * user (login + consent). The dev server must run with:
 *   MCP_OAUTH_ENABLED=true NEXTAUTH_URL=$TEST_BASE_URL MCP_ALLOWED_ORIGINS=https://claude.ai
 *   OAUTH_TRUSTED_CLIENT_IDS=http://127.0.0.1:3268/client.json   (loopback http client ids are accepted outside production only)
 * and a THROWAWAY DATABASE (DATABASE_URL), with the QA accounts of .env.qa.local (QA_ADMIN_* is a platform admin).
 * E2E_SHOTS_DIR saves screenshots.
 */
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const puppeteer = require('puppeteer');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.qa.local') });

jest.setTimeout(180000);
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3267';
const MCP = `${BASE_URL}/api/mcp`;
const CLIENT_PORT = 3268;
const CLIENT_ID = `http://127.0.0.1:${CLIENT_PORT}/client.json`;
const CALLBACK = `http://127.0.0.1:${CLIENT_PORT}/callback`;
const SHOTS = process.env.E2E_SHOTS_DIR || '';
const RUN = Date.now().toString(36); // unique diagram names: leftovers of an aborted run must not be picked by name

const el = (id, x, y, label) => ({ id, type: 'rectangle', x: 50000 + x, y: 50000 + y, size: { width: 140, height: 60 }, label, color: '#4FB3CE' });
const content = (elements) => ({ elements, connections: [], layers: [], groups: [], viewport: { x: 0, y: 0, zoom: 1 } });

describe('Connect Claude through OAuth (O2)', () => {
  let browser; let clientServer; let callbacks = [];
  const created = []; // [{ctx, id}] diagrams to delete

  // ---- the fake claude.ai: serves the client metadata document and receives the redirect ----
  beforeAll(async () => {
    clientServer = http.createServer((req, res) => {
      if (req.url === '/client.json') {
        res.setHeader('content-type', 'application/json');
        return res.end(JSON.stringify({ client_id: CLIENT_ID, client_name: 'Claude (e2e)', redirect_uris: [CALLBACK], token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'] }));
      }
      if (req.url.startsWith('/callback')) {
        callbacks.push(new URL(req.url, `http://127.0.0.1:${CLIENT_PORT}`));
        res.setHeader('content-type', 'text/html');
        return res.end('<html><body>Claude callback</body></html>');
      }
      res.statusCode = 404;
      return res.end();
    });
    await new Promise((r) => clientServer.listen(CLIENT_PORT, '127.0.0.1', r));
    browser = await puppeteer.launch({ headless: process.env.HEADLESS !== 'false', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
  });
  afterAll(async () => {
    for (const { page, id } of created) { try { await call(page, 'DELETE', `/api/diagrams/${id}`); } catch (e) { /* best effort */ } }
    if (browser) await browser.close();
    if (clientServer) await new Promise((r) => clientServer.close(r));
  });

  // ---- helpers ----
  const call = (page, method, url, body) => page.evaluate(async (m, u, b) => {
    const r = await fetch(u, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
    let json = null; try { json = await r.json(); } catch (e) { /* none */ }
    return { status: r.status, body: json };
  }, method, url, body);
  const shot = async (page, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name) }); } };
  async function newSession() {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 1100, height: 1000 });
    return { ctx, page };
  }
  // One login per account for the whole file (the login endpoint allows 5 attempts a minute per address).
  const sessions = {};
  async function session(who) {
    if (!sessions[who]) {
      const s = await newSession();
      await login(s.page, ...(who === 'admin' ? [process.env.QA_ADMIN_EMAIL, process.env.QA_ADMIN_PASSWORD] : [process.env.QA_USER_EMAIL, process.env.QA_USER_PASSWORD]));
      sessions[who] = s;
    }
    const page = await sessions[who].ctx.newPage();
    await page.setViewport({ width: 1100, height: 1000 });
    await page.goto(`${BASE_URL}/api/health`); // same-origin document so relative fetches work
    return { page, ctx: sessions[who].ctx };
  }
  async function login(page, email, password) {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
    await page.type('#email', email);
    await page.type('#password', password);
    await Promise.all([page.waitForFunction(() => !window.location.pathname.startsWith('/login'), { timeout: 30000 }), page.click('button[type="submit"]')]);
  }
  const pkce = () => { const verifier = crypto.randomBytes(32).toString('base64url'); return { verifier, challenge: crypto.createHash('sha256').update(verifier).digest('base64url') }; };
  const authorizeUrl = (k, over = {}) => {
    const u = new URL(`${BASE_URL}/oauth/authorize`);
    Object.entries({ client_id: CLIENT_ID, redirect_uri: CALLBACK, response_type: 'code', state: `st-${crypto.randomBytes(6).toString('hex')}`, code_challenge: k.challenge, code_challenge_method: 'S256', resource: MCP, scope: 'diagrams:read diagrams:comment diagrams:write offline_access', ...over }).forEach(([a, b]) => { if (b !== undefined) u.searchParams.set(a, b); });
    return u.toString();
  };
  async function tokenRequest(body) {
    const r = await fetch(`${BASE_URL}/api/oauth/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body).toString() });
    return { status: r.status, body: await r.json() };
  }
  async function mcpClient(token) {
    const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
    const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
    const client = new Client({ name: 'claude-e2e', version: '1' });
    await client.connect(new StreamableHTTPClientTransport(new URL(MCP), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
    return client;
  }
  /** Browser steps: open the authorize URL (login if needed), run `decide(page)` on the consent screen, return the callback URL. */
  async function connect(page, url, { email, password, decide }) {
    callbacks = [];
    const responses = [];
    page.on('response', (r) => { if (r.url().includes('/oauth/authorize')) responses.push(r); });
    await page.goto(url, { waitUntil: 'networkidle0' });
    if (new URL(page.url()).pathname === '/login') {
      expect(new URL(page.url()).searchParams.get('callbackUrl')).toMatch(/^\/oauth\/authorize\?rid=[0-9a-f-]{36}$/); // only the opaque rid detours through login
      await page.type('#email', email);
      await page.type('#password', password);
      await Promise.all([page.waitForFunction(() => window.location.pathname === '/oauth/authorize', { timeout: 30000 }), page.click('button[type="submit"]')]);
      await page.waitForNetworkIdle({ idleTime: 500 });
    }
    await page.waitForSelector('form[action="/api/oauth/consent"]');
    await page.waitForNetworkIdle({ idleTime: 500 }); // hydration
    const headers = responses.length ? responses[responses.length - 1].headers() : {};
    await decide(page, headers);
    await page.waitForFunction(() => window.location.host.startsWith('127.0.0.1:3268'), { timeout: 30000 });
    expect(callbacks.length).toBeGreaterThan(0);
    return callbacks[callbacks.length - 1];
  }
  async function exchange(cb, k) {
    const r = await tokenRequest({ grant_type: 'authorization_code', client_id: CLIENT_ID, code: cb.searchParams.get('code'), code_verifier: k.verifier, redirect_uri: CALLBACK, resource: MCP });
    expect(r.status).toBe(200);
    return r.body;
  }
  const text = (r) => r.content.find((c) => c.type === 'text').text;

  // ---- tests ----
  test('Viewer: login detour, consent screen contents and headers, code + PKCE exchange, read tools work, editing is refused', async () => {
    const { page: owner } = await session('user');
    const d = (await call(owner, 'POST', '/api/diagrams', { type: 'infinite-canvas', name: `E2E OAuth viewer ${RUN}`, content: content([el('a', 100, 100, 'Alpha'), el('b', 400, 100, 'Beta')]) })).body;
    created.push({ page: owner, id: d.id });

    const { page } = await newSession();
    const k = pkce();
    const url = authorizeUrl(k, { state: 'e2e state &=?' });
    const cb = await connect(page, url, {
      email: process.env.QA_USER_EMAIL, password: process.env.QA_USER_PASSWORD,
      decide: async (p, headers) => {
        const body = await p.evaluate(() => document.body.innerText);
        expect(body).toContain(`127.0.0.1:${CLIENT_PORT} wants to use Ontographia Lab as ${process.env.QA_USER_EMAIL}`);
        expect(body).toMatch(/Only continue if you started connecting Claude yourself/);
        expect(body).toContain('sent back to 127.0.0.1:3268');
        expect(await p.$eval('input[name="role"][value="viewer"]', (i) => i.checked)).toBe(true);
        expect(headers['content-security-policy']).toMatch(/frame-ancestors 'none'/);
        expect(headers['referrer-policy']).toBe('same-origin');
        expect(headers['cache-control']).toMatch(/no-store|no-cache/); // dev serves gSSP pages as no-cache; production adds no-store
        await shot(p, 'oauth-consent-viewer.png');
        await p.click('button[value="approve"]');
      },
    });
    expect(cb.searchParams.get('state')).toBe('e2e state &=?');
    expect(cb.searchParams.get('iss')).toBe(BASE_URL);
    const tokens = await exchange(cb, k);
    expect(tokens.access_token).toMatch(/^oga_/);
    expect(tokens.scope).toBe('diagrams:read offline_access');

    const client = await mcpClient(tokens.access_token);
    const names = (await client.listTools()).tools.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(['diagram_list', 'diagram_get', 'board_read_region', 'diagram_apply_ops']));
    const list = JSON.parse(text(await client.callTool({ name: 'diagram_list', arguments: {} })));
    expect(list.items.map((i) => i.id)).toContain(d.id);
    const region = await client.callTool({ name: 'board_read_region', arguments: { id: d.id, focus: { bbox: { x: 49000, y: 49000, width: 2000, height: 2000 } } } });
    expect(region.isError).toBeFalsy();
    expect(text(region)).toMatch(/Alpha/);
    const denied = await client.callTool({ name: 'diagram_apply_ops', arguments: { id: d.id, baseRevision: 0, ops: [{ op: 'add_element', type: 'process-flow/task', label: 'nope' }] } });
    expect(denied.isError).toBe(true);
    await client.close();

    // refresh rotation over the wire
    const r1 = await tokenRequest({ grant_type: 'refresh_token', client_id: CLIENT_ID, refresh_token: tokens.refresh_token, resource: MCP });
    expect(r1.status).toBe(200);
    expect(r1.body.refresh_token).not.toBe(tokens.refresh_token);
    expect((await tokenRequest({ grant_type: 'refresh_token', client_id: CLIENT_ID, refresh_token: r1.body.refresh_token, resource: MCP })).status).toBe(200);
    // a stolen (spent) token replayed after its successor was used revokes the connection: the access token dies at once
    expect((await tokenRequest({ grant_type: 'refresh_token', client_id: CLIENT_ID, refresh_token: tokens.refresh_token })).status).toBe(400);
    const dead = await mcpClient(tokens.access_token).catch((e) => e);
    expect(String(dead && dead.message)).toMatch(/401|Unauthorized|invalid|revoked/i);
  });

  test('Editor (non-admin): must choose diagrams, applies ops with diagram_apply_ops; "all boards" is not offered', async () => {
    const { page: owner } = await session('user');
    const d = (await call(owner, 'POST', '/api/diagrams', { type: 'infinite-canvas', name: `E2E OAuth editor ${RUN}`, content: content([el('a', 100, 100, 'Start')]) })).body;
    created.push({ page: owner, id: d.id });

    const { page } = await session('user');
    const k = pkce();
    const cb = await connect(page, authorizeUrl(k), {
      email: process.env.QA_USER_EMAIL, password: process.env.QA_USER_PASSWORD,
      decide: async (p) => {
        await p.click('input[name="role"][value="editor"]');
        expect(await p.evaluate(() => document.body.innerText)).not.toContain('All boards I can edit');
        expect(await p.$eval('button[value="approve"]', (b) => b.disabled)).toBe(true);
        await p.evaluate((name) => { [...document.querySelectorAll('label')].find((l) => l.textContent.includes(name)).querySelector('input').click(); }, `E2E OAuth editor ${RUN}`);
        await shot(p, 'oauth-consent-editor.png');
        expect(await p.$eval('button[value="approve"]', (b) => b.disabled)).toBe(false);
        await p.click('button[value="approve"]');
      },
    });
    const tokens = await exchange(cb, k);
    expect(tokens.scope).toBe('diagrams:read diagrams:comment diagrams:write offline_access');
    const client = await mcpClient(tokens.access_token);
    const head = (await call(owner, 'GET', `/api/diagrams/${d.id}`)).body;
    const applied = await client.callTool({ name: 'diagram_apply_ops', arguments: { id: d.id, baseRevision: head.revision, ops: [{ op: 'add_element', ref: '@n', type: 'process-flow/task', label: 'Added through OAuth' }] } });
    expect(applied.isError).toBeFalsy();
    const after = (await call(owner, 'GET', `/api/diagrams/${d.id}`)).body;
    expect(after.revision).toBe(head.revision + 1);
    expect(JSON.stringify(after.content)).toMatch(/Added through OAuth/);
    await client.close();
  });

  test('Admin: "All boards I can edit" shows the warning and writes any board they can edit, never someone else\'s', async () => {
    const { page: other } = await session('user');
    const priv = (await call(other, 'POST', '/api/diagrams', { type: 'infinite-canvas', name: `E2E private of user ${RUN}`, content: content([el('p', 100, 100, 'Private')]) })).body;
    created.push({ page: other, id: priv.id });

    const { page: admin } = await session('admin');
    const mine = (await call(admin, 'POST', '/api/diagrams', { type: 'infinite-canvas', name: `E2E admin board ${RUN}`, content: content([el('m', 100, 100, 'Mine')]) })).body;
    created.push({ page: admin, id: mine.id });

    const { page } = await session('admin');
    const k = pkce();
    const cb = await connect(page, authorizeUrl(k), {
      email: process.env.QA_ADMIN_EMAIL, password: process.env.QA_ADMIN_PASSWORD,
      decide: async (p) => {
        await p.click('input[name="role"][value="editor"]');
        const body = await p.evaluate(() => document.body.innerText);
        expect(body).toContain('All boards I can edit');
        expect(body).toContain('Claude can change any board you can edit; every change is saved as a version you can restore');
        await shot(p, 'oauth-consent-admin-all.png');
        await p.click('button[value="approve"]');
      },
    });
    const tokens = await exchange(cb, k);
    const client = await mcpClient(tokens.access_token);
    const head = (await call(admin, 'GET', `/api/diagrams/${mine.id}`)).body;
    const ok = await client.callTool({ name: 'diagram_apply_ops', arguments: { id: mine.id, baseRevision: head.revision, ops: [{ op: 'add_element', ref: '@n', type: 'process-flow/task', label: 'All boards edit' }] } });
    expect(ok.isError).toBeFalsy();
    const nope = await client.callTool({ name: 'diagram_apply_ops', arguments: { id: priv.id, baseRevision: 0, ops: [{ op: 'add_element', type: 'process-flow/task', label: 'x' }] } });
    expect(nope.isError).toBe(true);
    expect(text(nope)).toMatch(/not found/i);
    await client.close();
  });

  test('Consent POST protections in a real browser: no CSRF token, and Cancel redirects with access_denied', async () => {
    const { page } = await session('user');
    const k = pkce();
    const cb = await connect(page, authorizeUrl(k, { state: 'deny-me' }), {
      email: process.env.QA_USER_EMAIL, password: process.env.QA_USER_PASSWORD,
      decide: async (p) => {
        const noCsrf = await p.evaluate(async () => {
          const rid = document.querySelector('input[name="rid"]').value;
          const r = await fetch('/api/oauth/consent', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ rid, decision: 'approve', role: 'viewer', diagramMode: 'all' }).toString() });
          return r.status;
        });
        expect(noCsrf).toBe(403);
        await p.click('button[value="deny"]');
      },
    });
    expect(cb.searchParams.get('error')).toBe('access_denied');
    expect(cb.searchParams.get('state')).toBe('deny-me');
    expect(cb.searchParams.get('iss')).toBe(BASE_URL);
    expect(cb.searchParams.get('code')).toBeNull();
  });

  test('Unknown client and a wrong redirect_uri are shown on the page and never redirected', async () => {
    const { page } = await session('user');
    const k = pkce();
    for (const over of [{ client_id: 'https://evil.example/client.json' }, { redirect_uri: 'https://evil.example/cb' }, { redirect_uri: `${CALLBACK}/` }]) {
      callbacks = [];
      await page.goto(authorizeUrl(k, over), { waitUntil: 'networkidle0' });
      expect(new URL(page.url()).host).toBe(new URL(BASE_URL).host);
      expect(await page.evaluate(() => document.body.innerText)).toMatch(/Unknown app|Invalid request/);
      expect(callbacks).toHaveLength(0);
    }
  });
});
