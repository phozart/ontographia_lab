// pages/api/mcp.js
// Read-only MCP server (stateless Streamable HTTP). Bearer API tokens only; see lib/mcp/http.js.

import { createMcpHandler, MAX_BODY_BYTES } from '../../lib/mcp/http';
import { createMcpServer } from '../../lib/mcp/server';
import { verifyToken } from '../../lib/apiTokens';
import { rateLimit } from '../../lib/rateLimit';

// Per token: 120 requests per minute. Failed authentications: 30 per minute per client address.
// In-memory like the other limiters: per process; move to shared storage with the multi-instance work.
const tokenLimiter = rateLimit({ interval: 60 * 1000, limit: 120, prefix: 'mcp-token' });
const authFailLimiter = rateLimit({ interval: 60 * 1000, limit: 30, prefix: 'mcp-authfail' });

export const config = {
  api: {
    bodyParser: { sizeLimit: MAX_BODY_BYTES },
    externalResolver: true,
  },
};

export default createMcpHandler({
  verifyToken: (secret) => verifyToken(secret),
  createServer: (principal) => createMcpServer(principal),
  tokenLimiter,
  authFailLimiter,
});
