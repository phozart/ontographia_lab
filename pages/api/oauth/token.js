// pages/api/oauth/token.js
// POST /api/oauth/token: authorization_code and refresh_token grants (form-urlencoded, no CORS). ADR-0005 5.1.
import { oauthPostEndpoint } from '../../../lib/oauth/serverEndpoint';
import { processTokenRequest } from '../../../lib/oauth/tokenEndpoint';

export default oauthPostEndpoint(processTokenRequest);
