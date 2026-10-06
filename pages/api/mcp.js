// pages/api/mcp.js
// Read-only MCP server (stateless Streamable HTTP). Bearer API tokens only; see lib/mcp/http.js.

import { createMcpHandler } from '../../lib/mcp/http';
import { createMcpServer } from '../../lib/mcp/server';
import { verifyToken } from '../../lib/apiTokens';
import { rateLimit } from '../../lib/rateLimit';

// Per token: 120 requests per minute. Failed authentications: 30 per minute per client address.
// In-memory like the other limiters: per process; move to shared storage with the multi-instance work.
const tokenLimiter = rateLimit({ interval: 60 * 1000, limit: 120, prefix: 'mcp-token' });
const authFailLimiter = rateLimit({ interval: 60 * 1000, limit: 30, prefix: 'mcp-authfail' });

export const config = {
  api: {
    bodyParser: false, // lib/mcp/http.js reads the body itself (MAX_BODY_BYTES) so failures are JSON-RPC errors
    externalResolver: true,
  },
};

export default createMcpHandler({
  verifyToken: (secret) => verifyToken(secret),
  createServer: (principal) => createMcpServer(principal),
  tokenLimiter,
  authFailLimiter,
});
