// lib/oauth/consent.js
// The consent decision (ADR-0005 5.5, owner decision 2026-10-21 for admins). Every rule that limits what a connection
// may do is enforced HERE and again at runtime by lib/authz (min(live role, cap) inside the allowlist):
//   - the cap cannot exceed the scope the client asked for (ceiling) or, through authz, the user's live role;
//   - an editor connection needs 1..50 diagrams the user can write (same rule as personal editor tokens, Q-MCP2),
//   - OR "all boards I can edit" (all_diagrams), available to platform admins ONLY, re-checked on every request;
//   - viewer and commenter may cover everything the user can read, or a chosen list.

import { authorize, AuthzError } from '../authz';
import { getClient } from './clients';
import { getIssuer } from './config';
import { MAX_ALLOWLIST } from '../apiTokens';
import { parseScope, scopeForCap } from './authorizeRequest';
import { approveAuthorization, denyAuthorization, bindAuthorization, isUuid, OAuthError } from './repository';
import { recordAuditEvent } from '../audit';

export const CAPS = ['viewer', 'commenter', 'editor'];
const RANK = { viewer: 0, commenter: 1, editor: 2 };
export const EXPIRY_DAYS = [7, 30, 90, 365];

/** Messages for the consent page (fixed set: error codes never carry free text into the page). */
export const CONSENT_ERRORS = Object.freeze({
  invalid_form: 'Something was wrong with the form. Please try again.',
  role_above_request: 'That access level is higher than the app asked for.',
  editor_needs_diagrams: 'Editor access needs you to choose the diagrams Claude may change.',
  all_boards_admin_only: 'Editing all boards is only available to administrators.',
  diagrams_required: 'Choose at least one diagram, or allow all of your diagrams.',
  diagram_denied: 'You chose a diagram you cannot edit (or read). Pick from the list shown.',
  too_many_diagrams: `Choose at most ${MAX_ALLOWLIST} diagrams.`,
  grant_limit: 'You have reached the limit of connected apps. Disconnect one in Account, API tokens, then try again.',
  too_many_pending: 'You have too many unfinished sign-in requests. Wait a few minutes and start again from the app.',
  expired: 'This request has expired or was already used. Start again from the app.',
  inactive: 'Your account is not active.',
});

const asArray = (v) => (Array.isArray(v) ? v : v === undefined || v === '' ? [] : [v]);

export function authorizationResponseUrl(redirectUri, params) {
  const u = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
  }
  u.searchParams.set('iss', getIssuer());
  return u.toString();
}

export const errorRedirectUrl = (redirectUri, error, description, state) =>
  authorizationResponseUrl(redirectUri, { error, error_description: description, state });

/**
 * @param {{rid: string, user: {id: string, role: string, status: string, email?: string}, form: object, fetchImpl?: Function}} input
 *   `user` must come from the database for this request (live status and platform role), not from a cached session.
 * @returns {Promise<{ok: true, redirect: string} | {ok: false, error: keyof typeof CONSENT_ERRORS}>}
 */
export async function decideConsent({ rid, user, form, fetchImpl, now = new Date() }) {
  if (!user || user.status !== 'active') return { ok: false, error: 'inactive' };
  if (!isUuid(rid)) return { ok: false, error: 'expired' };
  const bound = await bindAuthorization(rid, user.id, now);
  if (!bound.ok) return { ok: false, error: bound.reason === 'limit' ? 'too_many_pending' : 'expired' };
  const auth = bound.authorization;

  // Re-validate the redirect target against the (cached) client document right before using it.
  const client = await getClient(auth.client_id, { fetchImpl });
  if (!client.ok || !client.client.redirectUris.includes(auth.redirect_uri)) return { ok: false, error: 'expired' };

  const f = form || {};
  if (f.decision === 'deny') {
    await denyAuthorization(rid, user.id);
    await recordAuditEvent({ action: 'oauth.consent.deny', actorType: 'user', actorUserId: user.id, target: { client: client.client.label } });
    return { ok: true, redirect: errorRedirectUrl(auth.redirect_uri, 'access_denied', 'The user denied the request', auth.state) };
  }
  if (f.decision !== 'approve') return { ok: false, error: 'invalid_form' };

  const scope = parseScope(auth.requested_scope);
  if (!scope.ok) return { ok: false, error: 'invalid_form' };
  const roleCap = typeof f.role === 'string' && CAPS.includes(f.role) ? f.role : null;
  if (!roleCap) return { ok: false, error: 'invalid_form' };
  if (RANK[roleCap] > RANK[scope.ceiling]) return { ok: false, error: 'role_above_request' };
  const mode = f.diagramMode === 'all' ? 'all' : f.diagramMode === 'selected' ? 'selected' : null;
  if (!mode) return { ok: false, error: 'invalid_form' };

  const rawIds = asArray(f.diagramIds);
  if (!rawIds.every(isUuid)) return { ok: false, error: 'invalid_form' };
  const ids = [...new Set(rawIds.map((i) => i.toLowerCase()))];
  if (ids.length > MAX_ALLOWLIST) return { ok: false, error: 'too_many_diagrams' };

  let diagramIds = null;
  let allDiagrams = false;
  if (mode === 'selected') {
    if (ids.length === 0) return { ok: false, error: roleCap === 'editor' ? 'editor_needs_diagrams' : 'diagrams_required' };
    const principal = { kind: 'user', userId: user.id, platformRole: user.role || 'user', status: user.status };
    for (const id of ids) {
      try {
        await authorize(principal, id, roleCap === 'editor' ? 'diagram.write' : 'diagram.read');
      } catch (err) {
        if (err instanceof AuthzError) return { ok: false, error: 'diagram_denied' };
        throw err;
      }
    }
    diagramIds = ids;
  } else if (roleCap === 'editor') {
    // "Edit all boards I can edit": platform admins only; the live role is checked again on every MCP request.
    if (user.role !== 'admin') return { ok: false, error: 'all_boards_admin_only' };
    allDiagrams = true;
  }

  let expiresAt = null;
  if (f.expiresInDays !== undefined && f.expiresInDays !== '' && f.expiresInDays !== 'never') {
    const days = Number(f.expiresInDays);
    if (!EXPIRY_DAYS.includes(days)) return { ok: false, error: 'invalid_form' };
    expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  }

  try {
    const { code } = await approveAuthorization(
      {
        rid,
        userId: user.id,
        clientLabel: client.client.label,
        scope: scopeForCap(roleCap, scope.offline),
        roleCap,
        diagramIds,
        allDiagrams,
        expiresAt,
      },
      now
    );
    return { ok: true, redirect: authorizationResponseUrl(auth.redirect_uri, { code, state: auth.state }) };
  } catch (err) {
    if (err instanceof OAuthError) return { ok: false, error: err.code === 'grant_limit' ? 'grant_limit' : 'expired' };
    throw err;
  }
}
