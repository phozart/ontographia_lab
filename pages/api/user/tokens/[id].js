// pages/api/user/tokens/[id].js
// DELETE revokes one of the caller's own API tokens. Takes effect on the next MCP request.

import { withUserAuth } from '../../../../lib/authz/next';
import { revokeToken } from '../../../../lib/apiTokens';

async function handler(req, res, { user }) {
  res.setHeader('Cache-Control', 'no-store');
  const id = typeof req.query.id === 'string' ? req.query.id : '';
  const revoked = await revokeToken(user.id, id);
  // Unknown, malformed, already revoked and other users' tokens all answer the same.
  if (!revoked) return res.status(404).json({ error: 'Token not found' });
  return res.status(200).json({ revoked: true });
}

export default withUserAuth(handler, { methods: ['DELETE'] });
