/**
 * @jest-environment node
 */
// ADR-0005 O1 on the /api/mcp pipeline: Origin normalization + allowlist, OPTIONS, and the 401 challenge carrying
// resource_metadata (only when the handler is given a metadata URL, i.e. the flag is on).
import http from 'http';
import { createMcpHandler } from '../../lib/mcp/http';
import { rateLimit } from '../../lib/rateLimit';

const GOOD = 'ogl_' + 'a'.repeat(43);
const PRM = 'https://lab.example.com/.well-known/oauth-protected-resource/api/mcp';
const INIT = {
  jsonrpc: '2.0', id: 1, method: 'initialize',
  params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 't', version: '1' } },
};

let server; let base; let n = 0;
async function start(over = {}) {
  const handler = createMcpHandler({
    verifyToken: async (s) => (s === GOOD ? { ok: false, reason: 'revoked' } : { ok: false, reason: 'invalid' }),
    createServer: () => { throw new Error('not reached'); },
    tokenLimiter: rateLimit({ limit: 1000, interval: 60000, prefix: `o1-tok-${Math.random()}` }),
    authFailLimiter: rateLimit({ limit: 1000, interval: 60000, prefix: `o1-fail-${++n}-${Math.random()}` }),
    allowedOrigins: () => ['https://lab.example.com', 'https://claude.ai'],
    ...over,
  });
  server = http.createServer((req, res) => {
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (b) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(b)); return res; };
    Promise.resolve(handler(req, res));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}/api/mcp`;
}
afterEach(async () => { if (server) { server.closeAllConnections(); await new Promise((r) => server.close(r)); } server = null; });

const post = (headers = {}) => fetch(base, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers },
  body: JSON.stringify(INIT),
});

describe('401 challenge', () => {
  test('without a metadata URL (flag off) the challenge is unchanged', async () => {
    await start();
    const r = await post();
    expect(r.status).toBe(401);
    expect(r.headers.get('www-authenticate')).toBe('Bearer realm="ontographia-mcp"');
  });

  test('with a metadata URL: bare challenge carries resource_metadata and no scope', async () => {
    await start({ resourceMetadataUrl: () => PRM });
    const r = await post();
    expect(r.status).toBe(401);
    const h = r.headers.get('www-authenticate');
    expect(h).toBe(`Bearer realm="ontographia-mcp", resource_metadata="${PRM}"`);
    expect(h).not.toMatch(/scope=/);
  });

  test('invalid-token challenges carry it too', async () => {
    await start({ resourceMetadataUrl: () => PRM });
    const r = await post({ Authorization: `Bearer ${GOOD}` });
    expect(r.status).toBe(401);
    expect(r.headers.get('www-authenticate')).toMatch(/error="invalid_token".*resource_metadata="https:\/\/lab\.example\.com\//);
  });
});

describe('Origin handling', () => {
  beforeEach(() => start());

  test('https://claude.ai passes the guard (reaches the 401) and gets CORS headers', async () => {
    const r = await post({ Origin: 'https://claude.ai' });
    expect(r.status).toBe(401);
    expect(r.headers.get('access-control-allow-origin')).toBe('https://claude.ai');
    expect(r.headers.get('vary')).toMatch(/Origin/i);
    expect(r.headers.get('access-control-expose-headers')).toMatch(/WWW-Authenticate/i);
  });

  test('trailing slash and case are normalized', async () => {
    for (const o of ['https://claude.ai/', 'HTTPS://Claude.AI']) {
      const r = await post({ Origin: o });
      expect(r.status).toBe(401);
    }
  });

  test('other origins are refused with 403 and get no CORS headers', async () => {
    for (const o of ['https://evil.example', 'https://claude.ai.evil.example', 'http://claude.ai', 'https://claude.ai:8443', 'null', 'https://sub.claude.ai']) {
      const r = await post({ Origin: o });
      expect(r.status).toBe(403);
      expect(r.headers.get('access-control-allow-origin')).toBeNull();
    }
  });

  test('no Origin (CLI clients) is unchanged and sends no CORS headers', async () => {
    const r = await post();
    expect(r.status).toBe(401);
    expect(r.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('OPTIONS', () => {
  beforeEach(() => start());
  const opt = (headers) => fetch(base, { method: 'OPTIONS', headers });

  test('preflight from an allowed origin: 204 with CORS headers, no auth needed', async () => {
    const r = await opt({ Origin: 'https://claude.ai', 'Access-Control-Request-Method': 'POST' });
    expect(r.status).toBe(204);
    expect(r.headers.get('access-control-allow-origin')).toBe('https://claude.ai');
    expect(r.headers.get('access-control-allow-methods')).toMatch(/POST/);
    const allow = r.headers.get('access-control-allow-headers').toLowerCase();
    for (const h of ['authorization', 'content-type', 'mcp-protocol-version', 'mcp-method', 'mcp-name']) expect(allow).toContain(h);
    expect(r.headers.get('vary')).toMatch(/Origin/i);
  });

  test('preflight from another origin: 403', async () => {
    const r = await opt({ Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST' });
    expect(r.status).toBe(403);
    expect(r.headers.get('access-control-allow-origin')).toBeNull();
  });

  test('OPTIONS without an Origin header keeps the old 405', async () => {
    const r = await opt({});
    expect(r.status).toBe(405);
    expect(r.headers.get('allow')).toBe('POST');
  });
});
