/**
 * @jest-environment node
 */
// The /api/mcp request pipeline over real HTTP: auth shapes, Origin, method, size, rate limit, protocol headers,
// and a full SDK client round trip (initialize -> tools/list -> tools/call).

import http from 'http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createMcpHandler } from '../../lib/mcp/http';
import { createMcpServer } from '../../lib/mcp/server';
import { rateLimit } from '../../lib/rateLimit';

const PRINCIPAL = { kind: 'agent', userId: 'u1', tokenId: 'tok-1', roleCap: 'viewer', diagramScope: null };
const GOOD = 'ogl_' + 'a'.repeat(43);
const REVOKED = 'ogl_' + 'b'.repeat(43);
const EXPIRED = 'ogl_' + 'c'.repeat(43);

const repository = {
  listOwned: async () => [],
  searchOwned: async () => [],
  getContent: async () => null,
  getThumbnail: async () => null,
};

function makeHandler(over = {}) {
  let n = 0;
  return createMcpHandler({
    verifyToken: async (secret) => {
      if (secret === GOOD) return { ok: true, principal: PRINCIPAL };
      if (secret === REVOKED) return { ok: false, reason: 'revoked' };
      if (secret === EXPIRED) return { ok: false, reason: 'expired' };
      return { ok: false, reason: 'invalid' };
    },
    createServer: (p) => createMcpServer(p, { repository }),
    tokenLimiter: rateLimit({ limit: 1000, interval: 60000, prefix: `http-tok-${Math.random()}` }),
    authFailLimiter: rateLimit({ limit: 1000, interval: 60000, prefix: `http-fail-${++n}-${Math.random()}` }),
    allowedOrigins: () => ['https://lab.example.com'],
    ...over,
  });
}

let server;
let base;
async function start(handler) {
  server = http.createServer((req, res) => {
    // Emulate the bits of the Next.js API runtime the handler relies on.
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (b) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(b)); return res; };
    // Like the route (bodyParser: false) the handler reads the raw stream itself.
    Promise.resolve(handler(req, res));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}/api/mcp`;
}
afterEach(async () => { if (server) { server.closeAllConnections(); await new Promise((r) => server.close(r)); } server = null; });

const INIT = {
  jsonrpc: '2.0', id: 1, method: 'initialize',
  params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 't', version: '1' } },
};
const post = (body, headers = {}) =>
  fetch(base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
const bearer = (t) => ({ Authorization: `Bearer ${t}` });

describe('authentication shapes', () => {
  beforeEach(() => start(makeHandler()));

  test('no Authorization header: 401 with a bare Bearer challenge', async () => {
    const r = await post(INIT);
    expect(r.status).toBe(401);
    expect(r.headers.get('www-authenticate')).toMatch(/^Bearer realm="[^"]+"$/);
  });

  test('wrong scheme or malformed header: 401 invalid_request-free challenge', async () => {
    for (const h of ['Basic abc', 'Bearer', 'Bearer a b', 'bearer']) {
      const r = await post(INIT, { Authorization: h });
      expect(r.status).toBe(401);
    }
  });

  test('unknown token: 401 invalid_token', async () => {
    const r = await post(INIT, bearer('ogl_' + 'z'.repeat(43)));
    expect(r.status).toBe(401);
    expect(r.headers.get('www-authenticate')).toMatch(/error="invalid_token"/);
  });

  test('revoked and expired tokens: 401 invalid_token naming the reason, never the token', async () => {
    const rev = await post(INIT, bearer(REVOKED));
    expect(rev.status).toBe(401);
    expect(rev.headers.get('www-authenticate')).toMatch(/error="invalid_token".*revoked/);
    const exp = await post(INIT, bearer(EXPIRED));
    expect(exp.headers.get('www-authenticate')).toMatch(/expired/);
    for (const r of [rev, exp]) {
      const body = await r.text();
      expect(body + r.headers.get('www-authenticate')).not.toContain('ogl_');
    }
  });

  test('the session cookie is ignored: a cookie alone is not authentication', async () => {
    const r = await post(INIT, { Cookie: 'next-auth.session-token=anything' });
    expect(r.status).toBe(401);
  });

  test('responses are never cacheable', async () => {
    const r = await post(INIT, bearer(GOOD));
    expect(r.headers.get('cache-control')).toMatch(/no-store/);
  });
});

describe('method, origin and body checks', () => {
  beforeEach(() => start(makeHandler()));

  test('GET and DELETE: 405 with Allow: POST (stateless, no SSE stream, no sessions)', async () => {
    for (const method of ['GET', 'DELETE', 'PUT']) {
      const r = await fetch(base, { method, headers: bearer(GOOD) });
      expect(r.status).toBe(405);
      expect(r.headers.get('allow')).toBe('POST');
    }
  });

  test('foreign Origin: 403 even with a valid token; allowed or absent Origin passes', async () => {
    expect((await post(INIT, { ...bearer(GOOD), Origin: 'https://evil.example' })).status).toBe(403);
    expect((await post(INIT, { ...bearer(GOOD), Origin: 'null' })).status).toBe(403);
    expect((await post(INIT, { ...bearer(GOOD), Origin: 'https://lab.example.com' })).status).toBe(200);
    expect((await post(INIT, bearer(GOOD))).status).toBe(200);
  });

  test('Origin is checked before the token is even looked at', async () => {
    const r = await post(INIT, { Origin: 'https://evil.example' });
    expect(r.status).toBe(403);
  });

  test('oversized bodies: 413 from the declared length', async () => {
    const r = await post(JSON.stringify({ ...INIT, pad: 'x'.repeat(300 * 1024) }), bearer(GOOD));
    expect(r.status).toBe(413);
  });

  test('non-JSON content type: 415; malformed JSON: 400', async () => {
    expect((await post(INIT, { ...bearer(GOOD), 'Content-Type': 'text/plain' })).status).toBe(415);
    expect((await post('{not json', bearer(GOOD))).status).toBe(400);
  });

  test('body failures are JSON-RPC error objects: invalid JSON -32700, oversize -32600 (also when streamed without a length)', async () => {
    const bad = await post('{not json', bearer(GOOD));
    expect(bad.status).toBe(400);
    expect(bad.headers.get('content-type')).toMatch(/application\/json/);
    expect(await bad.json()).toMatchObject({ jsonrpc: '2.0', error: { code: -32700 }, id: null });

    const empty = await post('', bearer(GOOD));
    expect(empty.status).toBe(400);
    expect((await empty.json()).error.code).toBe(-32700);

    const big = await post(JSON.stringify({ ...INIT, pad: 'x'.repeat(300 * 1024) }), bearer(GOOD));
    expect(big.status).toBe(413);
    expect(await big.json()).toMatchObject({ jsonrpc: '2.0', error: { code: -32600 }, id: null });

    // chunked upload: no Content-Length to reject early, the streaming limit applies
    const chunk = Buffer.from('x'.repeat(64 * 1024));
    const body = new ReadableStream({
      start(c) { c.enqueue(Buffer.from('{"a":"')); for (let i = 0; i < 6; i++) c.enqueue(chunk); c.enqueue(Buffer.from('"}')); c.close(); },
    });
    const streamed = await fetch(base, {
      method: 'POST', duplex: 'half', body,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...bearer(GOOD) },
    });
    expect(streamed.status).toBe(413);
    expect((await streamed.json()).error.code).toBe(-32600);
  });

  test('large JSON-RPC batches are refused', async () => {
    const batch = Array.from({ length: 11 }, (_, i) => ({ jsonrpc: '2.0', id: i + 1, method: 'ping' }));
    expect((await post(batch, bearer(GOOD))).status).toBe(400);
  });

  test('unsupported MCP-Protocol-Version: 400', async () => {
    const r = await post({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, { ...bearer(GOOD), 'MCP-Protocol-Version': '1999-01-01' });
    expect(r.status).toBe(400);
  });

  test('Mcp-Method / Mcp-Name headers, when sent, must match the body', async () => {
    const call = { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'stencil_catalog', arguments: {} } };
    const h = { ...bearer(GOOD), 'MCP-Protocol-Version': '2025-11-25' };
    expect((await post(call, { ...h, 'Mcp-Method': 'tools/list' })).status).toBe(400);
    expect((await post(call, { ...h, 'Mcp-Method': 'tools/call', 'Mcp-Name': 'diagram_get' })).status).toBe(400);
    expect((await post(call, { ...h, 'Mcp-Method': 'tools/call', 'Mcp-Name': 'stencil_catalog' })).status).toBe(200);
  });
});

describe('rate limiting', () => {
  test('per token: 429 with Retry-After once the budget is spent; another token is unaffected', async () => {
    const tokenLimiter = rateLimit({ limit: 2, interval: 60000, prefix: 'http-tok-small' });
    const handler = makeHandler({
      tokenLimiter,
      verifyToken: async (s) => ({ ok: true, principal: { ...PRINCIPAL, tokenId: s === GOOD ? 'tok-1' : 'tok-2' } }),
    });
    await start(handler);
    expect((await post(INIT, bearer(GOOD))).status).toBe(200);
    expect((await post(INIT, bearer(GOOD))).status).toBe(200);
    const limited = await post(INIT, bearer(GOOD));
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);
    expect((await post(INIT, bearer('ogl_' + 'd'.repeat(43)))).status).toBe(200);
  });

  test('failed authentications are throttled per client address', async () => {
    await start(makeHandler({ authFailLimiter: rateLimit({ limit: 2, interval: 60000, prefix: 'http-fail-small' }) }));
    expect((await post(INIT, bearer(REVOKED))).status).toBe(401);
    expect((await post(INIT, bearer(REVOKED))).status).toBe(401);
    expect((await post(INIT, bearer(REVOKED))).status).toBe(429);
  });
});

describe('SDK client round trip', () => {
  test('initialize -> tools/list -> tools/call over Streamable HTTP, stateless', async () => {
    await start(makeHandler());
    const client = new Client({ name: 'e2e', version: '1' });
    const transport = new StreamableHTTPClientTransport(new URL(base), { requestInit: { headers: bearer(GOOD) } });
    await client.connect(transport);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain('diagram_get');
    const r = await client.callTool({ name: 'stencil_catalog', arguments: { packId: 'core' } });
    expect(r.structuredContent.pack.id).toBe('core');
    const list = await client.callTool({ name: 'diagram_list', arguments: {} });
    expect(list.structuredContent).toEqual({ items: [] });
    await client.close();
  });

  test('a bad token fails the connection', async () => {
    await start(makeHandler());
    const client = new Client({ name: 'e2e', version: '1' });
    const transport = new StreamableHTTPClientTransport(new URL(base), { requestInit: { headers: bearer(REVOKED) } });
    await expect(client.connect(transport)).rejects.toThrow();
  });
});
