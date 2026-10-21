// lib/oauth/verify.js
// Bearer dispatch for /api/mcp (ADR-0005 5.6): `ogl_` -> personal API token (unchanged), `oga_` -> OAuth access token.
// Both resolve to the same `agent` principal shape that lib/authz understands.

import { verifyToken as verifyPersonalToken } from '../apiTokens';
import { isOAuthEnabled } from './config';

export const ACCESS_TOKEN_PREFIX = 'oga_';

// O1 scaffold: the authorization server (and with it any OAuth access token) does not exist yet, so nothing is valid.
// Replaced in O2 by the oauth_tokens lookup.
async function verifyAccessToken() {
  return { ok: false, reason: 'invalid' };
}

export async function verifyBearer(secret, deps = {}) {
  const personal = deps.verifyPersonal || verifyPersonalToken;
  const access = deps.verifyAccess || verifyAccessToken;
  const enabled = deps.enabled || isOAuthEnabled;
  if (typeof secret === 'string' && secret.startsWith(ACCESS_TOKEN_PREFIX)) {
    // With the flag off an oga_ token is never honored, whatever is in the database.
    return enabled() ? access(secret) : { ok: false, reason: 'invalid' };
  }
  return personal(secret);
}
