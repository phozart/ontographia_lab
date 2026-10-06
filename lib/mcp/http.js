// lib/mcp/http.js
// Request pipeline for the stateless Streamable HTTP MCP endpoint (pages/api/mcp.js).
//
// Order: method -> Origin -> bearer token -> per-token rate limit -> size/content-type -> routing headers -> MCP.
// - Bearer tokens only. The next-auth cookie is never read here (no ambient authority, no CSRF surface).
// - 401 carries a WWW-Authenticate Bearer challenge (RFC 6750); a bare challenge when no credentials were sent.
// - Stateless: a new McpServer + transport per request, JSON responses (no SSE stream, no session ids).

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

export const MAX_BODY_BYTES = 256 * 1024;
export const MAX_BATCH = 10;
const REALM = 'ontographia-mcp';
const ALLOWED_METHODS = 'POST';

const REASON_TEXT = {
  invalid: 'The access token is invalid',
  revoked: 'The access token has been revoked',
  expired: 'The access token has expired',
  inactive: 'The access token is no longer valid',
};

function rpcError(res, status, code, message) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ jsonrpc: '2.0', error: { code, message }, id: null }));
}

function challenge(res, reason) {
  const base = `Bearer realm="${REALM}"`;
  res.setHeader(
    'WWW-Authenticate',
    reason ? `${base}, error="invalid_token", error_description="${REASON_TEXT[reason] || REASON_TEXT.invalid}"` : base
  );
}

function parseBearer(header) {
  if (typeof header !== 'string') return null;
  const m = /^Bearer[ \t]+([^\s]+)$/i.exec(header.trim());
  return m ? m[1] : null;
}

/** Origins allowed to call from a browser context: this app's own origin plus MCP_ALLOWED_ORIGINS (comma separated). */
export function defaultAllowedOrigins() {
  const out = [];
  try {
    if (process.env.NEXTAUTH_URL) out.push(new URL(process.env.NEXTAUTH_URL).origin);
  } catch {
    // ignore a malformed NEXTAUTH_URL
  }
  for (const o of String(process.env.MCP_ALLOWED_ORIGINS || '').split(',')) {
    const t = o.trim();
    if (t) out.push(t.replace(/\/$/, ''));
  }
  return out;
}

function routingHeaderError(req, body) {
  const message = Array.isArray(body) ? null : body;
  if (!message || typeof message !== 'object') return null;
  const method = req.headers['mcp-method'];
  if (method !== undefined && method !== message.method) return 'Mcp-Method header does not match the request body';
  const name = req.headers['mcp-name'];
  if (name !== undefined) {
    const bodyName = message.params && (message.params.name ?? message.params.uri);
    if (name !== bodyName) return 'Mcp-Name header does not match the request body';
  }
  return null;
}

/**
 * @param {{
 *   verifyToken: (secret: string) => Promise<{ok: true, principal: object} | {ok: false, reason: string}>,
 *   createServer: (principal: object) => import('@modelcontextprotocol/sdk/server/mcp.js').McpServer,
 *   tokenLimiter: {check: Function},
 *   authFailLimiter: {check: Function},
 *   allowedOrigins?: () => string[],
 * }} deps
 */
export function createMcpHandler(deps) {
  const { verifyToken, createServer, tokenLimiter, authFailLimiter, allowedOrigins = defaultAllowedOrigins } = deps;

  return async function mcpHandler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'POST') {
      res.setHeader('Allow', ALLOWED_METHODS);
      return rpcError(res, 405, -32000, 'Method not allowed. This endpoint is stateless: use POST.');
    }

    // DNS-rebinding / cross-site protection (MCP transport spec): a present Origin must be one of ours.
    const origin = req.headers.origin;
    if (origin !== undefined && !allowedOrigins().includes(origin)) {
      return rpcError(res, 403, -32000, 'Origin not allowed');
    }

    const secret = parseBearer(req.headers.authorization);
    if (!secret) {
      challenge(res, null);
      return rpcError(res, 401, -32001, 'Authentication required: send "Authorization: Bearer <token>"');
    }
    const auth = await verifyToken(secret);
    if (!auth.ok) {
      const limited = await authFailLimiter.check(req, res); // sends 429 itself when exceeded
      if (!limited.success) return undefined;
      challenge(res, auth.reason);
      return rpcError(res, 401, -32001, REASON_TEXT[auth.reason] || REASON_TEXT.invalid);
    }
    const { principal } = auth;

    const rate = await tokenLimiter.check(req, res, `mcp:${principal.tokenId}`);
    if (!rate.success) return undefined;

    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
      return rpcError(res, 413, -32600, `Request body too large (limit ${MAX_BODY_BYTES} bytes)`);
    }
    const contentType = String(req.headers['content-type'] || '');
    if (!/^application\/json\b/i.test(contentType)) {
      return rpcError(res, 415, -32600, 'Content-Type must be application/json');
    }
    const body = req.body;
    if (body === undefined || body === null || typeof body !== 'object') {
      return rpcError(res, 400, -32700, 'Parse error: body must be a JSON-RPC message');
    }
    if (Array.isArray(body) && (body.length === 0 || body.length > MAX_BATCH)) {
      return rpcError(res, 400, -32600, `Batches must contain 1 to ${MAX_BATCH} messages`);
    }
    const headerProblem = routingHeaderError(req, body);
    if (headerProblem) return rpcError(res, 400, -32600, headerProblem);

    const server = createServer(principal);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (err) {
      console.error('MCP request failed', err?.message);
      if (!res.headersSent) rpcError(res, 500, -32603, 'Internal server error');
    }
    return undefined;
  };
}
