// pages/api/mcp.js
// MCP server (stateless Streamable HTTP). Bearer tokens only (personal ogl_; OAuth oga_ when MCP_OAUTH_ENABLED); see lib/mcp/http.js.
// Read tools for every token; the write tool (diagram_apply_ops) needs an editor-capped token with a diagram allowlist.

import { createMcpHandler } from '../../lib/mcp/http';
import { createMcpServer } from '../../lib/mcp/server';
import { verifyBearer } from '../../lib/oauth/verify';
import { isOAuthEnabled, getProtectedResourceMetadataUrl } from '../../lib/oauth/config';
import { rateLimit } from '../../lib/rateLimit';

// Per token: 120 requests per minute, of which at most 30 writes (Q-MCP7). Failed authentications: 30 per minute per client address.
// In-memory like the other limiters: per process; move to shared storage with the multi-instance work.
const tokenLimiter = rateLimit({ interval: 60 * 1000, limit: 120, prefix: 'mcp-token' });
const writeLimiter = rateLimit({ interval: 60 * 1000, limit: 30, prefix: 'mcp-write' });
const authFailLimiter = rateLimit({ interval: 60 * 1000, limit: 30, prefix: 'mcp-authfail' });

export const config = {
  api: {
    bodyParser: false, // lib/mcp/http.js reads the body itself (MAX_BODY_BYTES) so failures are JSON-RPC errors
    externalResolver: true,
  },
};

export default createMcpHandler({
  verifyToken: (secret) => verifyBearer(secret),
  // RFC 9728: with OAuth on, the 401 points clients at the protected resource metadata (ADR-0005).
  resourceMetadataUrl: () => (isOAuthEnabled() ? getProtectedResourceMetadataUrl() : null),
  createServer: (principal) => createMcpServer(principal, { writeLimiter }),
  tokenLimiter,
  authFailLimiter,
});
