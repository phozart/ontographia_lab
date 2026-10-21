// lib/oauth/tokenEndpoint.js
// Token and revocation endpoint cores (ADR-0005 5.1, 5.4). Framework-free: params in, {status, body} out.
// Public clients only (token_endpoint_auth_method "none"): the client is identified by client_id alone and is
// authenticated by PKCE (code grant) or by possession of the rotating refresh token.

import { getClient } from './clients';
import { exchangeAuthorizationCode, refreshTokens, revokeByToken } from './repository';

const err = (status, error, description) => ({ status, body: { error, error_description: description }, failed: true });
const str = (v) => (typeof v === 'string' && v !== '' ? v : undefined);
const hasDuplicate = (p) => Object.values(p).some((v) => Array.isArray(v));

/** @returns {Promise<{status: number, body: object, grantId?: string}>} */
export async function processTokenRequest(params, deps = {}) {
  const p = params && typeof params === 'object' ? params : {};
  if (hasDuplicate(p)) return err(400, 'invalid_request', 'Parameters must not be repeated');
  const grantType = str(p.grant_type);
  if (!grantType) return err(400, 'invalid_request', 'grant_type is required');
  if (grantType !== 'authorization_code' && grantType !== 'refresh_token') {
    return err(400, 'unsupported_grant_type', 'Only authorization_code and refresh_token are supported');
  }
  const clientId = str(p.client_id);
  if (!clientId) return err(400, 'invalid_request', 'client_id is required');
  const client = await getClient(clientId, deps);
  if (!client.ok) return err(400, 'invalid_client', 'Unknown client');

  let result;
  if (grantType === 'authorization_code') {
    const code = str(p.code);
    const redirectUri = str(p.redirect_uri);
    const verifier = str(p.code_verifier);
    if (!code || !redirectUri || !verifier) return err(400, 'invalid_request', 'code, redirect_uri and code_verifier are required');
    result = await exchangeAuthorizationCode({ code, clientId, redirectUri, codeVerifier: verifier, resource: str(p.resource) }, deps.now);
  } else {
    const refreshToken = str(p.refresh_token);
    if (!refreshToken) return err(400, 'invalid_request', 'refresh_token is required');
    result = await refreshTokens({ refreshToken, clientId, resource: str(p.resource) }, deps.now);
  }
  if (result.ok) return { status: 200, body: result.body, grantId: result.grantId };
  return { status: 400, body: { error: result.error, error_description: result.description }, grantId: result.grantId, failed: true };
}

/** RFC 7009: always 200 for well-formed requests, whether or not the token existed. */
export async function processRevokeRequest(params, deps = {}) {
  const p = params && typeof params === 'object' ? params : {};
  if (hasDuplicate(p)) return err(400, 'invalid_request', 'Parameters must not be repeated');
  const token = str(p.token);
  const clientId = str(p.client_id);
  if (!token || !clientId) return err(400, 'invalid_request', 'token and client_id are required');
  const client = await getClient(clientId, deps);
  if (!client.ok) return err(400, 'invalid_client', 'Unknown client');
  await revokeByToken({ token, clientId });
  return { status: 200, body: {} };
}
