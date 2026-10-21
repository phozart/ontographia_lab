/**
 * @jest-environment node
 */
// ADR-0005 O2: the authorization server end to end over real HTTP against a throwaway database, driven by the MCP SDK's
// own client `auth()` (discovery -> CIMD client id -> PKCE -> token -> refresh) with a stubbed CIMD document fetch,
// plus the negative paths of every endpoint (authorize, consent, token, revoke).
const http = require('http');
const crypto = require('crypto');
const querystring = require('querystring');
const { setupOauthDb, BASE_URL } = require('../helpers/oauthDb');

const dbDescribe = BASE_URL ? describe : describe.skip;
const CLAUDE = 'https://claude.ai/oauth/mcp-oauth-client-metadata';
const CB = 'https://claude.ai/api/mcp/auth_callback';
const realFetch = global.fetch;
const CIMD = { client_id: CLAUDE, client_name: 'Claude', redirect_uris: [CB], token_endpoint_auth_method: 'none' };

dbDescribe('OAuth endpoints over HTTP (throwaway database)', () => {
  let db; let server; let base; let MCP;
  let flow; let consentMod; let repo; let clientsMod; let cryptoMod;
  let alice; let bob; let suspended; let aliceDiagram;
  let userSeq = 0;
  let signedIn = null; // the "browser session" the consent endpoint sees

  const shim = (handler) => (req, res) => {
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (b) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(b)); return res; };
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', async () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      const type = String(req.headers['content-type'] || '');
      // The MCP route disables Next's body parser; the others get Next's parsed body.
      if (!req.url.startsWith('/api/mcp')) {
        req.body = /urlencoded/.test(type) ? querystring.parse(raw) : raw ? { raw } : {};
      } else {
        req.push = undefined;
      }
      try { await handler(req, res, raw); } catch (e) { res.statusCode = 500; res.end(String(e && e.stack)); }
    });
  };

  beforeAll(async () => {
    db = await setupOauthDb('oauthhttp');
    // The MCP route reads the raw stream itself, so it must be served before our shim consumes the body.
    server = http.createServer();
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${server.address().port}`;
    MCP = `${base}/api/mcp`;
    process.env.NEXTAUTH_URL = base;
    process.env.NEXTAUTH_SECRET = 'test-secret-oauth-http';
    process.env.MCP_OAUTH_ENABLED = 'true';
    process.env.MCP_ALLOWED_ORIGINS = 'https://claude.ai';
    delete process.env.MCP_PUBLIC_URL; delete process.env.OAUTH_ISSUER; delete process.env.OAUTH_TRUSTED_CLIENT_IDS;
    process.env.TRUST_PROXY_HOPS = '0';

    flow = require('../../lib/oauth/authorizeFlow');
    consentMod = require('../../lib/oauth/consentEndpoint');
    repo = require('../../lib/oauth/repository');
    clientsMod = require('../../lib/oauth/clients');
    cryptoMod = require('../../lib/oauth/crypto');
    const prm = require('../../pages/api/oauth/protected-resource').default;
    const asMeta = require('../../pages/api/oauth/authorization-server').default;
    const token = require('../../pages/api/oauth/token').default;
    const revoke = require('../../pages/api/oauth/revoke').default;
    const mcp = require('../../pages/api/mcp').default;
    const consent = consentMod.createConsentHandler({ getUser: async () => signedIn });

    server.on('request', (req, res) => {
      const p = req.url.split('?')[0];
      if (p === '/api/mcp') {
        res.status = (c) => { res.statusCode = c; return res; };
        res.json = (b) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(b)); return res; };
        return Promise.resolve(mcp(req, res));
      }
      const routes = {
        '/.well-known/oauth-protected-resource': prm,
        '/.well-known/oauth-protected-resource/api/mcp': prm,
        '/.well-known/oauth-authorization-server': asMeta,
        '/api/oauth/token': token,
        '/api/oauth/revoke': revoke,
        '/api/oauth/consent': consent,
      };
      const h = routes[p];
      if (!h) { res.statusCode = 404; return res.end('nf'); }
      return shim(h)(req, res);
    });

    alice = await db.user('alice@x.co');
    bob = await db.user('bob@x.co');
    suspended = await db.user('susp@x.co', { status: 'suspended' });
    aliceDiagram = await db.diagram(alice);
  });
  afterAll(async () => {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
    await db.teardown();
  });
  beforeEach(async () => {
    // each test starts clean: the per-user caps (10 connections, 20 pending requests) must not leak between tests
    await db.pg.query("update oauth_grants set revoked_at = now(), revoked_reason = 'test' where revoked_at is null");
    await db.pg.query('update oauth_authorizations set consumed_at = now() where consumed_at is null');
    // a fresh user per test keeps the per-user consent rate limit (10 a minute) out of the way
    userSeq += 1;
    alice = await db.user(`alice${userSeq}@x.co`);
    aliceDiagram = await db.diagram(alice);
    clientsMod.resetClientCache();
    signedIn = null;
    jest.spyOn(global, 'fetch').mockImplementation((url, init) => {
      if (String(url) === CLAUDE) {
        return Promise.resolve(new Response(JSON.stringify(CIMD), { status: 200, headers: { 'content-type': 'application/json' } }));
      }
      return realFetch(url, init);
    });
  });
  afterEach(() => jest.restoreAllMocks());

  // ---- helpers: act like the browser and like Claude's backend ----
  const pkce = () => {
    const verifier = crypto.randomBytes(32).toString('base64url');
    return { verifier, challenge: crypto.createHash('sha256').update(verifier).digest('base64url') };
  };
  const authorizeParams = (over = {}) => {
    const { challenge } = over.pkce || pkce();
    const p = { client_id: CLAUDE, redirect_uri: CB, response_type: 'code', state: 'state-1', code_challenge: challenge, code_challenge_method: 'S256', resource: MCP, scope: 'diagrams:read diagrams:comment diagrams:write offline_access', ...over.q };
    for (const k of Object.keys(p)) if (p[k] === undefined) delete p[k];
    return p;
  };
  /** GET /oauth/authorize (no session) then again with the rid and the user's session. */
  async function openConsent(params, user) {
    const first = await flow.runAuthorizeFlow({ query: params, user: null });
    if (first.type !== 'redirect') return { first };
    const rid = new URL(first.destination, base).searchParams.get('rid');
    const loggedOut = await flow.runAuthorizeFlow({ query: { rid }, user: null });
    const second = await flow.runAuthorizeFlow({ query: { rid }, user });
    return { first, rid, loggedOut, second };
  }
  const postConsent = (form, { origin = base, user = signedIn, headers = {} } = {}) => {
    signedIn = user;
    return realFetch(`${base}/api/oauth/consent`, {
      method: 'POST', redirect: 'manual',
      headers: { 'content-type': 'application/x-www-form-urlencoded', ...(origin ? { origin } : {}), ...headers },
      body: new URLSearchParams(form).toString(),
    });
  };
  async function approve(params, user, formOver = {}) {
    const { rid, second } = await openConsent(params, user);
    expect(second.type).toBe('consent');
    const res = await postConsent({ rid, csrf: second.props.csrf, decision: 'approve', role: 'viewer', diagramMode: 'all', ...formOver }, { user });
    expect(res.status).toBe(303);
    return new URL(res.headers.get('location'));
  }
  const tokenPost = (body, headers = {}) => realFetch(`${base}/api/oauth/token`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers }, body: new URLSearchParams(body).toString(),
  });
  const tokenBody = (over) => over; // readability

  // ================================================================================================================
  describe('SDK client auth() conformance driver (discovery -> CIMD -> PKCE -> token -> refresh -> MCP)', () => {
    test('a full connection from claude.ai as Viewer, with refresh rotation, and MCP calls on the oga_ token', async () => {
      const { auth } = require('@modelcontextprotocol/sdk/client/auth.js');
      const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
      const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');

      // 1. unauthenticated call from the claude.ai origin gets the challenge
      const challenge401 = await realFetch(MCP, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', origin: 'https://claude.ai' }, body: '{}' });
      expect(challenge401.status).toBe(401);
      const rm = /resource_metadata="([^"]+)"/.exec(challenge401.headers.get('www-authenticate'))[1];
      expect(rm).toBe(`${base}/.well-known/oauth-protected-resource/api/mcp`);

      const saved = {};
      const provider = {
        get redirectUrl() { return CB; },
        get clientMetadata() { return { client_name: 'Claude', redirect_uris: [CB], token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'] }; },
        clientMetadataUrl: CLAUDE,
        state: () => 'sdk-state',
        clientInformation: () => saved.info,
        saveClientInformation: (i) => { saved.info = i; },
        tokens: () => saved.tokens,
        saveTokens: (t) => { saved.tokens = t; },
        redirectToAuthorization: (url) => { saved.authUrl = url; },
        saveCodeVerifier: (v) => { saved.verifier = v; },
        codeVerifier: () => saved.verifier,
      };
      const opts = { serverUrl: MCP, resourceMetadataUrl: new URL(rm), fetchFn: realFetch };

      const scope = 'diagrams:read diagrams:comment diagrams:write offline_access'; // Claude appends offline_access itself
      expect(await auth(provider, { ...opts, scope })).toBe('REDIRECT');
      const authUrl = new URL(saved.authUrl);
      expect(`${authUrl.origin}${authUrl.pathname}`).toBe(`${base}/oauth/authorize`);
      expect(authUrl.searchParams.get('client_id')).toBe(CLAUDE);
      expect(authUrl.searchParams.get('code_challenge_method')).toBe('S256');
      expect(authUrl.searchParams.get('resource')).toBe(MCP);
      expect(authUrl.searchParams.get('redirect_uri')).toBe(CB);

      // 2. the user signs in and approves Viewer in the browser
      const query = Object.fromEntries(authUrl.searchParams.entries());
      const back = await approve(query, alice, { role: 'viewer', diagramMode: 'all' });
      expect(`${back.origin}${back.pathname}`).toBe(CB);
      expect(back.searchParams.get('state')).toBe('sdk-state');
      expect(back.searchParams.get('iss')).toBe(base);

      // 3. Claude exchanges the code
      expect(await auth(provider, { ...opts, scope, authorizationCode: back.searchParams.get('code') })).toBe('AUTHORIZED');
      expect(saved.tokens.token_type.toLowerCase()).toBe('bearer');
      expect(saved.tokens.access_token).toMatch(/^oga_/);
      expect(saved.tokens.refresh_token).toMatch(/^ogr_/);

      // 4. MCP over the oga_ token, using the SDK transport with the provider (it refreshes by itself on 401)
      const connect = async () => {
        const client = new Client({ name: 'claude-ai-test', version: '1' });
        await client.connect(new StreamableHTTPClientTransport(new URL(MCP), { authProvider: provider, fetch: realFetch }));
        return client;
      };
      let client = await connect();
      const tools = (await client.listTools()).tools.map((t) => t.name);
      expect(tools).toEqual(expect.arrayContaining(['diagram_list', 'board_read_region', 'diagram_apply_ops']));
      const list = await client.callTool({ name: 'diagram_list', arguments: {} });
      expect(JSON.parse(list.content[0].text).items.map((i) => i.id)).toContain(aliceDiagram.id);
      const region = await client.callTool({ name: 'board_read_region', arguments: { id: aliceDiagram.id, focus: { bbox: { x: 0, y: 0, width: 100, height: 100 } } } });
      expect(region.isError).toBeFalsy();
      // a Viewer grant cannot edit
      const denied = await client.callTool({ name: 'diagram_apply_ops', arguments: { id: aliceDiagram.id, baseRevision: 0, ops: [{ op: 'add_element', type: 'process-flow/task', label: 'x' }] } });
      expect(denied.isError).toBe(true);
      await client.close();

      // 5. the access token expires; the SDK refreshes with the rotating refresh token and keeps working
      const oldRefresh = saved.tokens.refresh_token;
      const oldAccess = saved.tokens.access_token;
      await db.pg.query("update oauth_tokens set expires_at = now() - interval '1 minute' where kind='access'");
      client = await connect();
      expect((await client.listTools()).tools.length).toBeGreaterThan(0);
      expect(saved.tokens.access_token).not.toBe(oldAccess);
      expect(saved.tokens.refresh_token).not.toBe(oldRefresh);
      await client.close();
      // once the successor has been used, replaying the spent refresh token is theft: the grant is revoked
      const used = await tokenPost({ grant_type: 'refresh_token', client_id: CLAUDE, refresh_token: saved.tokens.refresh_token });
      expect(used.status).toBe(200);
      const replay = await tokenPost({ grant_type: 'refresh_token', client_id: CLAUDE, refresh_token: oldRefresh });
      expect(replay.status).toBe(400);
      expect((await replay.json()).error).toBe('invalid_grant');
    });
  });

  // ================================================================================================================
  describe('GET /oauth/authorize', () => {
    test('good request: stored, then (signed out) the login detour carries only the rid; signed in: consent', async () => {
      const { first, rid, loggedOut, second } = await openConsent(authorizeParams(), alice);
      expect(first).toEqual({ type: 'redirect', destination: `/oauth/authorize?rid=${rid}` });
      expect(loggedOut).toEqual({ type: 'login', callbackUrl: `/oauth/authorize?rid=${rid}` });
      expect(second.type).toBe('consent');
      expect(second.props).toMatchObject({ clientLabel: 'claude.ai', redirectHost: 'claude.ai', ceiling: 'editor', isAdmin: false, account: { email: alice.email } });
      expect(second.props.diagrams.map((d) => d.id)).toContain(aliceDiagram.id);
    });
    test('unknown client, redirect mismatch: shown on our page, never redirected', async () => {
      const bads = [
        { client_id: 'https://evil.example/m' }, { client_id: undefined },
        { redirect_uri: 'https://evil.example/cb' }, { redirect_uri: CB + '/' }, { redirect_uri: undefined },
        { redirect_uri: `${CB}?next=https://evil.example` },
      ];
      for (const q of bads) {
        const out = await flow.runAuthorizeFlow({ query: authorizeParams({ q }), user: null });
        expect(out.type).toBe('error');
        expect(JSON.stringify(out)).not.toMatch(/evil/);
      }
    });
    test('later errors redirect to the registered redirect_uri with error, state and iss', async () => {
      const cases = [
        [{ code_challenge_method: 'plain' }, 'invalid_request'], [{ code_challenge_method: undefined }, 'invalid_request'],
        [{ code_challenge: undefined }, 'invalid_request'], [{ response_type: 'token' }, 'unsupported_response_type'],
        [{ resource: 'https://other.example/api/mcp' }, 'invalid_target'], [{ scope: 'nonsense' }, 'invalid_scope'],
      ];
      for (const [q, error] of cases) {
        const out = await flow.runAuthorizeFlow({ query: authorizeParams({ q }), user: null });
        expect(out.type).toBe('redirect');
        const u = new URL(out.destination);
        expect(`${u.origin}${u.pathname}`).toBe(CB);
        expect(u.searchParams.get('error')).toBe(error);
        expect(u.searchParams.get('iss')).toBe(base);
        if (q.state !== undefined || error !== 'invalid_request') expect(u.searchParams.get('state')).toBe('state-1');
      }
    });
    test('open redirect attempts through every parameter never leave the app or the registered redirect', async () => {
      const evil = 'https://evil.example/steal';
      const attempts = [
        { client_id: evil }, { redirect_uri: evil }, { state: evil }, { resource: evil }, { scope: evil }, { code_challenge: evil },
        { response_type: evil }, { code_challenge_method: evil }, { rid: evil }, { rid: `//evil.example` },
        { state: '\r\nLocation: https://evil.example' }, { redirect_uri: [CB, evil] }, { client_id: [CLAUDE, evil] },
      ];
      for (const q of attempts) {
        const params = q.rid !== undefined ? { rid: q.rid } : authorizeParams({ q });
        const out = await flow.runAuthorizeFlow({ query: params, user: alice });
        const dest = out.destination ? new URL(out.destination, base) : null;
        if (dest) expect([new URL(base).host, 'claude.ai']).toContain(dest.host);
        expect(JSON.stringify(out)).not.toMatch(/evil\.example/);
      }
    });
    test('a request id is bound to the first user; another account is refused; "switch account" releases it', async () => {
      const { rid, second } = await openConsent(authorizeParams(), alice);
      expect(second.type).toBe('consent');
      expect(await flow.runAuthorizeFlow({ query: { rid }, user: bob })).toEqual({ type: 'error', code: 'other_user' });
      const sw = await postConsent({ rid, csrf: second.props.csrf, decision: 'switch' }, { user: alice });
      expect(sw.status).toBe(204);
      expect((await flow.runAuthorizeFlow({ query: { rid }, user: bob })).type).toBe('consent');
    });
    test('suspended and unknown request ids', async () => {
      const { rid } = await openConsent(authorizeParams(), alice);
      expect(await flow.runAuthorizeFlow({ query: { rid }, user: suspended })).toEqual({ type: 'error', code: 'inactive' });
      expect(await flow.runAuthorizeFlow({ query: { rid: crypto.randomUUID() }, user: alice })).toEqual({ type: 'error', code: 'expired' });
      expect(await flow.runAuthorizeFlow({ query: { rid: 'x' }, user: alice })).toEqual({ type: 'error', code: 'expired' });
    });
  });

  // ================================================================================================================
  describe('POST /api/oauth/consent', () => {
    let rid; let csrf;
    beforeEach(async () => {
      const o = await openConsent(authorizeParams(), alice);
      ({ rid } = o); csrf = o.second.props.csrf;
    });
    const form = (over = {}) => ({ rid, csrf, decision: 'approve', role: 'viewer', diagramMode: 'all', ...over });

    test('cross-origin POST is refused (403) and creates nothing', async () => {
      for (const origin of ['https://evil.example', 'null', 'http://127.0.0.1:1']) {
        expect((await postConsent(form(), { origin, user: alice })).status).toBe(403);
      }
      expect((await db.pg.query('select count(*)::int n from oauth_grants where user_id=$1 and revoked_at is null', [alice.id])).rows[0].n).toBe(0);
    });
    test('missing, empty, wrong and other-user CSRF tokens are refused', async () => {
      const bobsToken = cryptoMod.consentCsrfToken(rid, bob.id);
      for (const c of [undefined, '', 'x', csrf + 'x', bobsToken, cryptoMod.consentCsrfToken(crypto.randomUUID(), alice.id)]) {
        const body = form(); if (c === undefined) delete body.csrf; else body.csrf = c;
        expect((await postConsent(body, { user: alice })).status).toBe(403);
      }
    });
    test('another user cannot decide your request even with a token they minted for themselves', async () => {
      const res = await postConsent(form({ csrf: cryptoMod.consentCsrfToken(rid, bob.id) }), { user: bob });
      expect(res.status).toBe(303);
      expect(res.headers.get('location')).toBe('/oauth/authorize?rid=' + rid); // refused as expired; no redirect to the client
      expect((await db.pg.query('select count(*)::int n from oauth_grants where user_id=$1', [bob.id])).rows[0].n).toBe(0);
    });
    test('signed out, suspended, wrong method and wrong content type', async () => {
      expect((await postConsent(form(), { user: null })).status).toBe(401);
      expect((await postConsent(form(), { user: suspended })).status).toBe(403);
      expect((await realFetch(`${base}/api/oauth/consent`, { method: 'GET' })).status).toBe(405);
      signedIn = alice;
      expect((await realFetch(`${base}/api/oauth/consent`, { method: 'POST', headers: { 'content-type': 'application/json', origin: base }, body: '{}' })).status).toBe(415);
    });
    test('refused rules redirect back to the consent page with a fixed error code, not to the client', async () => {
      const res = await postConsent(form({ role: 'editor', diagramMode: 'all' }), { user: alice });
      expect(res.status).toBe(303);
      expect(res.headers.get('location')).toBe(`/oauth/authorize?rid=${rid}&e=all_boards_admin_only`);
      const page = await flow.runAuthorizeFlow({ query: { rid, e: 'all_boards_admin_only' }, user: alice });
      expect(page.props.formError).toMatch(/administrators/);
      const reflected = await flow.runAuthorizeFlow({ query: { rid, e: '<script>alert(1)</script>' }, user: alice });
      expect(reflected.props.formError).toBeNull();
    });
    test('approve redirects to the client with code, the exact state and iss; deny with access_denied', async () => {
      const res = await postConsent(form(), { user: alice });
      const u = new URL(res.headers.get('location'));
      expect(`${u.origin}${u.pathname}`).toBe(CB);
      expect(u.searchParams.get('state')).toBe('state-1');
      expect(u.searchParams.get('iss')).toBe(base);
      expect(u.searchParams.get('code')).toBeTruthy();
      const o = await openConsent(authorizeParams(), alice);
      const d = await postConsent({ rid: o.rid, csrf: o.second.props.csrf, decision: 'deny' }, { user: alice });
      expect(new URL(d.headers.get('location')).searchParams.get('error')).toBe('access_denied');
    });
    test('a replay of the same approval is refused', async () => {
      expect((await postConsent(form(), { user: alice })).headers.get('location')).toContain('code=');
      expect((await postConsent(form(), { user: alice })).headers.get('location')).toBe(`/oauth/authorize?rid=${rid}`);
    });
  });

  // ================================================================================================================
  describe('POST /api/oauth/token and /api/oauth/revoke', () => {
    async function codeFor(user, over = {}) {
      const k = pkce();
      const u = await approve(authorizeParams({ pkce: k, ...over }), user, { role: 'viewer', diagramMode: 'all' });
      return { code: u.searchParams.get('code'), verifier: k.verifier };
    }
    const exchangeBody = (c, over = {}) => ({ grant_type: 'authorization_code', client_id: CLAUDE, code: c.code, code_verifier: c.verifier, redirect_uri: CB, resource: MCP, ...over });

    test('happy path response shape and headers', async () => {
      const c = await codeFor(alice);
      const res = await tokenPost(exchangeBody(c));
      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(res.headers.get('pragma')).toBe('no-cache');
      expect(res.headers.get('access-control-allow-origin')).toBeNull();
      expect(await res.json()).toMatchObject({ token_type: 'Bearer', expires_in: 3600, scope: 'diagrams:read offline_access' });
    });
    test('form-urlencoded only; JSON and other methods are refused', async () => {
      expect((await realFetch(`${base}/api/oauth/token`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status).toBe(400);
      const get = await realFetch(`${base}/api/oauth/token`);
      expect(get.status).toBe(405);
      expect(get.headers.get('allow')).toBe('POST');
      const opt = await realFetch(`${base}/api/oauth/token`, { method: 'OPTIONS', headers: { origin: 'https://claude.ai' } });
      expect(opt.headers.get('access-control-allow-origin')).toBeNull();
    });
    test('error responses: unknown client, unsupported grant, missing params, repeated params', async () => {
      const c = await codeFor(alice);
      const err = async (b) => { const r = await tokenPost(b); return { status: r.status, body: await r.json() }; };
      expect(await err(exchangeBody(c, { client_id: 'https://evil.example/m' }))).toMatchObject({ status: 400, body: { error: 'invalid_client' } });
      expect(await err(exchangeBody(c, { grant_type: 'password' }))).toMatchObject({ body: { error: 'unsupported_grant_type' } });
      expect(await err(exchangeBody(c, { grant_type: 'client_credentials' }))).toMatchObject({ body: { error: 'unsupported_grant_type' } });
      expect(await err({ client_id: CLAUDE })).toMatchObject({ body: { error: 'invalid_request' } });
      expect(await err({ grant_type: 'authorization_code', client_id: CLAUDE })).toMatchObject({ body: { error: 'invalid_request' } });
      const dup = await realFetch(`${base}/api/oauth/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `grant_type=refresh_token&grant_type=authorization_code&client_id=${encodeURIComponent(CLAUDE)}` });
      expect((await dup.json()).error).toBe('invalid_request');
    });
    test('PKCE: wrong verifier fails, and the code is then burned', async () => {
      const c = await codeFor(alice);
      const bad = await tokenPost(exchangeBody(c, { code_verifier: crypto.randomBytes(32).toString('base64url') }));
      expect((await bad.json()).error).toBe('invalid_grant');
      expect((await (await tokenPost(exchangeBody(c))).json()).error).toBe('invalid_grant');
    });
    test('redirect_uri must match exactly, resource must match: invalid_grant / invalid_target', async () => {
      for (const redirect_uri of [CB + '/', CB + '?a=1', 'https://claude.ai/api/mcp/auth_callbac']) {
        const c = await codeFor(alice);
        expect((await (await tokenPost(exchangeBody(c, { redirect_uri }))).json()).error).toBe('invalid_grant');
      }
      const c = await codeFor(alice);
      expect((await (await tokenPost(exchangeBody(c, { resource: 'https://other.example/api/mcp' }))).json()).error).toBe('invalid_target');
    });
    test('code reuse: the second redemption fails and the first connection is revoked', async () => {
      const c = await codeFor(alice);
      const first = await (await tokenPost(exchangeBody(c))).json();
      expect(first.access_token).toMatch(/^oga_/);
      expect((await (await tokenPost(exchangeBody(c))).json()).error).toBe('invalid_grant');
      const r = await realFetch(MCP, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: `Bearer ${first.access_token}` }, body: '{}' });
      expect(r.status).toBe(401);
    });
    test('state echo survives odd characters through the whole round trip', async () => {
      const state = 'a b+c&d=e%20/?#é';
      const u = await approve(authorizeParams({ q: { state } }), alice);
      expect(u.searchParams.get('state')).toBe(state);
    });
    test('refresh over HTTP: rotation, reuse revokes the connection, wrong client refused', async () => {
      const c = await codeFor(alice);
      const t1 = await (await tokenPost(exchangeBody(c))).json();
      const refresh = (rt, over = {}) => tokenPost({ grant_type: 'refresh_token', client_id: CLAUDE, refresh_token: rt, resource: MCP, ...over });
      expect((await (await refresh(t1.refresh_token, { client_id: 'https://claude.ai/oauth/other' })).json()).error).toBe('invalid_client');
      const t2 = await (await refresh(t1.refresh_token)).json();
      expect(t2.refresh_token).toBeTruthy();
      const t3 = await (await refresh(t2.refresh_token)).json();
      expect(t3.refresh_token).toBeTruthy();
      expect((await (await refresh(t1.refresh_token)).json()).error).toBe('invalid_grant'); // theft: t2 was already used
      expect((await (await refresh(t3.refresh_token)).json()).error).toBe('invalid_grant'); // the whole connection is gone
    });
    test('revocation endpoint disconnects the app; unknown tokens still answer 200', async () => {
      const c = await codeFor(alice);
      const t = await (await tokenPost(exchangeBody(c))).json();
      const rev = (token, client_id = CLAUDE) => realFetch(`${base}/api/oauth/revoke`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token, client_id }).toString() });
      expect((await rev('oga_' + 'q'.repeat(43))).status).toBe(200);
      expect((await rev(t.access_token, 'https://evil.example/m')).status).toBe(400);
      expect((await repo.verifyAccessToken(t.access_token)).ok).toBe(true);
      expect((await rev(t.refresh_token)).status).toBe(200);
      expect(await repo.verifyAccessToken(t.access_token)).toEqual({ ok: false, reason: 'revoked' });
    });
  });

  // ================================================================================================================
  describe('/api/mcp with OAuth tokens', () => {
    const mcpCall = (token, headers = {}) => realFetch(MCP, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) });
    async function connectedToken(user, formOver) {
      const k = pkce();
      const u = await approve(authorizeParams({ pkce: k }), user, formOver);
      const t = await (await tokenPost({ grant_type: 'authorization_code', client_id: CLAUDE, code: u.searchParams.get('code'), code_verifier: k.verifier, redirect_uri: CB, resource: MCP })).json();
      return t;
    }
    test('401 challenge points at the metadata; claude.ai origin allowed, others refused', async () => {
      const r = await mcpCall(null, { origin: 'https://claude.ai' });
      expect(r.status).toBe(401);
      expect(r.headers.get('www-authenticate')).toMatch(/resource_metadata="[^"]*\/\.well-known\/oauth-protected-resource\/api\/mcp"/);
      expect((await mcpCall(null, { origin: 'https://evil.example' })).status).toBe(403);
    });
    test('valid token works; after Disconnect the very next request fails; suspended users fail', async () => {
      const t = await connectedToken(alice);
      expect((await mcpCall(t.access_token)).status).toBe(200);
      const [g] = await repo.listGrants(alice.id);
      await repo.revokeGrant(g.id, 'user', { onlyUserId: alice.id });
      const after = await mcpCall(t.access_token);
      expect(after.status).toBe(401);
      expect(after.headers.get('www-authenticate')).toMatch(/invalid_token/);
      const s = await db.user('later-susp@x.co');
      const t2 = await connectedToken(s);
      expect((await mcpCall(t2.access_token)).status).toBe(200);
      await db.pg.query("update users set status='suspended' where id=$1", [s.id]);
      expect((await mcpCall(t2.access_token)).status).toBe(401);
    });
    test('a token minted for another resource is refused at /api/mcp', async () => {
      const t = await connectedToken(alice);
      await db.pg.query("update oauth_grants set resource='https://other.example/api/mcp' where revoked_at is null and user_id=$1", [alice.id]);
      expect((await mcpCall(t.access_token)).status).toBe(401);
    });
    test('an oga_ token is refused when the flag is off, and personal ogl_ tokens are unaffected by it', async () => {
      const t = await connectedToken(alice);
      const apiTokens = require('../../lib/apiTokens');
      const personal = (await apiTokens.createToken(alice.id, { name: 'p', roleCap: 'viewer', diagramIds: null, expiresAt: null })).token;
      process.env.MCP_OAUTH_ENABLED = 'false';
      try {
        expect((await mcpCall(t.access_token)).status).toBe(401);
        expect((await mcpCall(personal)).status).toBe(200);
        const challenge = await mcpCall(null);
        expect(challenge.headers.get('www-authenticate')).toBe('Bearer realm="ontographia-mcp"');
      } finally { process.env.MCP_OAUTH_ENABLED = 'true'; }
      expect((await mcpCall(personal)).status).toBe(200);
    });
  });

  // last: it exhausts the per-address token limits for the rest of the minute
  describe('abuse limits', () => {
    test('failed attempts are rate limited (429) and the response carries no tokens', async () => {
      let last;
      for (let i = 0; i < 40; i += 1) last = await tokenPost({ grant_type: 'authorization_code', client_id: CLAUDE, code: crypto.randomBytes(32).toString('base64url'), code_verifier: 'v'.repeat(50), redirect_uri: CB });
      expect([400, 429]).toContain(last.status);
      expect(last.status).toBe(429);
    });
  });
});
