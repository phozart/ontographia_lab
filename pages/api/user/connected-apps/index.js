// pages/api/user/connected-apps/index.js
// GET: the signed-in user's live OAuth connections ("Connected apps", ADR-0005 5.7). No secrets, no hashes.
import { withUserAuth } from '../../../../lib/authz/next';
import { isOAuthEnabled } from '../../../../lib/oauth/config';
import { listConnectedApps } from '../../../../lib/oauth/connectedApps';

async function handler(req, res, { user }) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ enabled: isOAuthEnabled(), apps: await listConnectedApps(user.id) });
}

export default withUserAuth(handler, { methods: ['GET'] });
