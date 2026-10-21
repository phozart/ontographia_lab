// lib/oauth/authorizeRequest.js
// Validation of an authorization request (ADR-0005 5.2, 5.4). Order matters:
//   1. client_id (closed allowlist, CIMD) and redirect_uri (exact match) FIRST. Failures here are `fatal`: shown on our
//      page and NEVER redirected (no open redirect, no oracle for attacker-chosen URLs).
//   2. everything else fails with a redirect to the (now trusted) redirect_uri carrying error, state and iss.

import { getClient } from './clients';
import { getResourceUrl, OAUTH_SCOPES, OFFLINE_ACCESS } from './config';
import { isValidCodeChallenge } from './crypto';

export const MAX_STATE_LENGTH = 1024;
const CAP_BY_SCOPE = { 'diagrams:read': 'viewer', 'diagrams:comment': 'commenter', 'diagrams:write': 'editor' };
const CAP_RANK = { viewer: 0, commenter: 1, editor: 2 };

/** Scope string granted for a role cap (a cap implies the scopes below it). */
export function scopeForCap(cap, offline = false) {
  const n = CAP_RANK[cap] + 1;
  return [...OAUTH_SCOPES.slice(0, n), ...(offline ? [OFFLINE_ACCESS] : [])].join(' ');
}

/**
 * @returns {{ok: true, ceiling: 'viewer'|'commenter'|'editor', offline: boolean} | {ok: false}}
 * No scope requested means all three (the 401 challenge carries no scope, so a client may send none).
 * Unknown scope tokens are ignored; a request with scope tokens of which none is known is invalid_scope.
 */
export function parseScope(requested) {
  if (requested === undefined || requested === null || String(requested).trim() === '') {
    return { ok: true, ceiling: 'editor', offline: false };
  }
  const tokens = String(requested).split(/\s+/).filter(Boolean);
  let ceiling = null;
  let offline = false;
  for (const t of tokens) {
    if (t === OFFLINE_ACCESS) offline = true;
    else if (CAP_BY_SCOPE[t]) {
      if (ceiling === null || CAP_RANK[CAP_BY_SCOPE[t]] > CAP_RANK[ceiling]) ceiling = CAP_BY_SCOPE[t];
    }
  }
  if (ceiling === null) {
    // offline_access alone requests no access level: treat as the full ceiling (the user still picks the cap).
    return offline ? { ok: true, ceiling: 'editor', offline } : { ok: false };
  }
  return { ok: true, ceiling, offline };
}

/** RFC 8707 resource comparison against the canonical R: case-insensitive scheme and host, no trailing slash. */
export function resourceMatches(value) {
  if (typeof value !== 'string') return false;
  let u;
  let r;
  try {
    u = new URL(value);
    r = new URL(getResourceUrl());
  } catch {
    return false;
  }
  if (u.search || u.hash || u.username || u.password) return false;
  const path = (p) => p.replace(/\/+$/, '');
  return u.protocol === r.protocol && u.host === r.host && path(u.pathname) === path(r.pathname);
}

const single = (v) => (typeof v === 'string' ? v : undefined);

/**
 * @param {Record<string, string|string[]|undefined>} q query parameters
 * @param {{fetchImpl?: Function, now?: () => number}} [deps]
 * @returns {Promise<
 *   {ok: true, request: object, client: object} |
 *   {ok: false, fatal: true, code: 'unknown_client'|'client_unavailable'|'invalid_redirect_uri'} |
 *   {ok: false, fatal: false, redirectUri: string, error: string, description: string, state?: string}>}
 */
export async function validateAuthorizeRequest(q, deps = {}) {
  const query = q || {};
  const clientId = single(query.client_id);
  const found = await getClient(clientId, deps);
  if (!found.ok) return { ok: false, fatal: true, code: found.error };
  const client = found.client;

  const redirectUri = single(query.redirect_uri);
  if (!redirectUri || !client.redirectUris.includes(redirectUri)) {
    return { ok: false, fatal: true, code: 'invalid_redirect_uri' };
  }

  const fail = (error, description, state) => ({ ok: false, fatal: false, redirectUri, error, description, ...(state !== undefined ? { state } : {}) });

  let state;
  if (query.state !== undefined) {
    state = single(query.state);
    if (state === undefined || state.length > MAX_STATE_LENGTH) return fail('invalid_request', 'Invalid state');
  }
  if (single(query.response_type) !== 'code') return fail('unsupported_response_type', 'Only response_type=code is supported', state);
  if (single(query.code_challenge_method) !== 'S256') return fail('invalid_request', 'code_challenge_method must be S256', state);
  const codeChallenge = single(query.code_challenge);
  if (!isValidCodeChallenge(codeChallenge)) return fail('invalid_request', 'code_challenge is missing or malformed', state);

  if (query.resource !== undefined) {
    if (!resourceMatches(single(query.resource))) return fail('invalid_target', 'resource must be this MCP server', state);
  }
  // Absent resource: the grant is bound to R anyway (single resource server).

  if (query.scope !== undefined && typeof query.scope !== 'string') return fail('invalid_scope', 'Invalid scope', state);
  if (!parseScope(query.scope).ok) return fail('invalid_scope', 'No supported scope was requested', state);

  return {
    ok: true,
    client,
    request: {
      clientId,
      redirectUri,
      state: state === undefined ? null : state,
      codeChallenge,
      resource: getResourceUrl(),
      requestedScope: single(query.scope) || null,
    },
  };
}
