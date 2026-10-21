// pages/api/oauth/revoke.js
// POST /api/oauth/revoke (RFC 7009) for clients that disconnect. Revokes the whole grant. No CORS.
import { oauthPostEndpoint } from '../../../lib/oauth/serverEndpoint';
import { processRevokeRequest } from '../../../lib/oauth/tokenEndpoint';

export default oauthPostEndpoint(processRevokeRequest);
