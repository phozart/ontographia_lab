// pages/api/user/connected-apps/[id].js
// DELETE: Disconnect. Revokes the whole grant (all access and refresh tokens); takes effect on the app's next request.
import { withUserAuth } from '../../../../lib/authz/next';
import { requireSameOrigin } from '../../../../lib/sameOrigin';
import { revokeGrant } from '../../../../lib/oauth/repository';

async function handler(req, res, { user }) {
  res.setHeader('Cache-Control', 'no-store');
  if (!requireSameOrigin(req, res)) return undefined;
  const id = typeof req.query.id === 'string' ? req.query.id : '';
  const revoked = await revokeGrant(id, 'user', { onlyUserId: user.id });
  // Unknown, malformed, already revoked and other users' connections all answer the same.
  if (!revoked) return res.status(404).json({ error: 'Connection not found' });
  return res.status(200).json({ revoked: true });
}

export default withUserAuth(handler, { methods: ['DELETE'] });
