// lib/oauth/repository.js
// Persistence and token lifecycle for the OAuth authorization server (ADR-0005 5.6, 5.8). Server-only.
// Authorization decisions (who may grant what) live in lib/oauth/consent.js; this file enforces the invariants that
// protect the data (single-use codes, rotation, reuse detection, caps) and resolves tokens to the agent principal.

import { query, getClient } from '../db';
import { recordAuditEvent } from '../audit';
import { OFFLINE_ACCESS } from './config';
import { randomSecret, sha256Hex, safeEqual, looksLikeAccessToken, looksLikeRefreshToken, looksLikeCode, verifyPkce, ACCESS_PREFIX, REFRESH_PREFIX } from './crypto';
import { resourceMatches } from './authorizeRequest';

export const REQUEST_TTL_MS = 10 * 60 * 1000;
export const CODE_TTL_MS = 60 * 1000;
export const ACCESS_TTL_MS = 60 * 60 * 1000;
export const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const RETRY_GRACE_MS = 60 * 1000;
export const MAX_ACTIVE_GRANTS = 10;
export const MAX_PENDING_AUTHORIZATIONS = 20;
const LAST_USED_REFRESH_MS = 5 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);

export class OAuthError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'OAuthError';
    this.code = code;
  }
}

async function inTransaction(fn) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Pending authorization requests

/** Store a validated authorization request; returns its id (the `rid` the login detour and consent page carry). */
export async function createAuthorization({ clientId, redirectUri, state, codeChallenge, resource, requestedScope }, now = new Date()) {
  const result = await query(
    `INSERT INTO oauth_authorizations (client_id, redirect_uri, state, code_challenge, resource, requested_scope, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [clientId, redirectUri, state, codeChallenge, resource, requestedScope, new Date(now.getTime() + REQUEST_TTL_MS)]
  );
  return result.rows[0].id;
}

/** An undecided, unexpired request, bound to `userId` if it has been viewed; null otherwise. */
export async function getOpenAuthorization(rid, now = new Date()) {
  if (!isUuid(rid)) return null;
  const result = await query(
    `SELECT id, client_id, redirect_uri, state, code_challenge, resource, requested_scope, user_id, expires_at
       FROM oauth_authorizations WHERE id = $1 AND consumed_at IS NULL AND expires_at > $2`,
    [rid, now]
  );
  return result.rows[0] || null;
}

/**
 * Bind the request to the first signed-in user who views it. Another user gets null. Refuses (reason 'limit') when the
 * user already has too many pending requests.
 * @returns {Promise<{ok: true, authorization: object} | {ok: false, reason: 'not_found'|'other_user'|'limit'}>}
 */
export async function bindAuthorization(rid, userId, now = new Date()) {
  const open = await getOpenAuthorization(rid, now);
  if (!open) return { ok: false, reason: 'not_found' };
  if (open.user_id) return open.user_id === userId ? { ok: true, authorization: open } : { ok: false, reason: 'other_user' };
  const pending = await query(
    'SELECT COUNT(*) AS n FROM oauth_authorizations WHERE user_id = $1 AND consumed_at IS NULL AND expires_at > $2',
    [userId, now]
  );
  if (Number(pending.rows[0].n) >= MAX_PENDING_AUTHORIZATIONS) return { ok: false, reason: 'limit' };
  const bound = await query(
    `UPDATE oauth_authorizations SET user_id = $2 WHERE id = $1 AND user_id IS NULL AND consumed_at IS NULL RETURNING id`,
    [rid, userId]
  );
  if (bound.rowCount === 0) {
    const again = await getOpenAuthorization(rid, now);
    if (again && again.user_id === userId) return { ok: true, authorization: again };
    return { ok: false, reason: 'other_user' };
  }
  return { ok: true, authorization: { ...open, user_id: userId } };
}

/** "Not you? Switch account": release the request from the signed-in user so the account that started it can take it. */
export async function unbindAuthorization(rid, userId) {
  const result = await query(
    'UPDATE oauth_authorizations SET user_id = NULL WHERE id = $1 AND user_id = $2 AND consumed_at IS NULL RETURNING id',
    [rid, userId]
  );
  return result.rowCount > 0;
}

/** Mark a request as decided without a grant (Cancel). Single use. */
export async function denyAuthorization(rid, userId) {
  const result = await query(
    'UPDATE oauth_authorizations SET consumed_at = NOW() WHERE id = $1 AND user_id = $2 AND consumed_at IS NULL RETURNING id',
    [rid, userId]
  );
  return result.rowCount > 0;
}

/**
 * Approve: create the grant and the one-time code in one transaction and consume the request.
 * The caller has already applied the consent rules (cap <= ceiling and <= live role, diagram checks, admin-only all_diagrams).
 * @returns {Promise<{code: string, grant: object}>}
 * @throws {OAuthError} 'not_found' | 'grant_limit'
 */
export async function approveAuthorization({ rid, userId, clientLabel, scope, roleCap, diagramIds = null, allDiagrams = false, expiresAt = null }, now = new Date()) {
  const code = randomSecret();
  const out = await inTransaction(async (c) => {
    await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`oauth-grants:${userId}`]);
    const auth = (
      await c.query(
        `SELECT * FROM oauth_authorizations WHERE id = $1 AND user_id = $2 AND consumed_at IS NULL AND expires_at > $3 FOR UPDATE`,
        [rid, userId, now]
      )
    ).rows[0];
    if (!auth) throw new OAuthError('not_found');
    const active = await c.query(
      `SELECT COUNT(*) AS n FROM oauth_grants WHERE user_id = $1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > $2)`,
      [userId, now]
    );
    if (Number(active.rows[0].n) >= MAX_ACTIVE_GRANTS) throw new OAuthError('grant_limit');
    const grant = (
      await c.query(
        `INSERT INTO oauth_grants (user_id, client_id, client_label, redirect_uri, resource, scope, role_cap, diagram_ids, all_diagrams, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, user_id, client_id, client_label, role_cap, diagram_ids, all_diagrams, scope, created_at, expires_at`,
        [userId, auth.client_id, clientLabel, auth.redirect_uri, auth.resource, scope, roleCap, diagramIds, allDiagrams, expiresAt]
      )
    ).rows[0];
    await c.query(
      `UPDATE oauth_authorizations SET consumed_at = $2, grant_id = $3, code_hash = $4, code_expires_at = $5 WHERE id = $1`,
      [rid, now, grant.id, sha256Hex(code), new Date(now.getTime() + CODE_TTL_MS)]
    );
    return { grant, state: auth.state, redirectUri: auth.redirect_uri };
  });
  await recordAuditEvent({
    action: 'oauth.grant.create',
    actorType: 'user',
    actorUserId: userId,
    target: { grantId: out.grant.id, client: out.grant.client_label, roleCap: roleCap, diagramCount: diagramIds ? diagramIds.length : null, allDiagrams: !!allDiagrams },
  });
  cleanupExpired().catch(() => {});
  return { code, ...out };
}

// ---------------------------------------------------------------------------------------------------------------
// Grants

async function revokeGrantTx(c, grantId, reason, onlyUserId) {
  const params = [grantId, reason];
  let where = 'id = $1 AND revoked_at IS NULL';
  if (onlyUserId) {
    params.push(onlyUserId);
    where += ' AND user_id = $3';
  }
  const res = await c.query(`UPDATE oauth_grants SET revoked_at = NOW(), revoked_reason = $2 WHERE ${where} RETURNING id, user_id`, params);
  if (res.rowCount > 0) await c.query('UPDATE oauth_tokens SET revoked_at = NOW() WHERE grant_id = $1 AND revoked_at IS NULL', [grantId]);
  return res.rows[0] || null;
}

/** Revoke a grant (idempotent). `onlyUserId` restricts it to the owner's grants. Returns the grant row or null. */
export async function revokeGrant(grantId, reason, { onlyUserId = null, actorType = 'user', actorUserId = null } = {}) {
  if (!isUuid(grantId)) return null;
  const row = await inTransaction((c) => revokeGrantTx(c, grantId, reason, onlyUserId));
  if (row) {
    const action = reason === 'reuse' ? 'oauth.grant.revoke_reuse' : reason === 'code_reuse' ? 'oauth.grant.revoke_code_reuse' : 'oauth.grant.revoke';
    await recordAuditEvent({ action, actorType, actorUserId: actorUserId || (actorType === 'system' ? null : row.user_id), onBehalfOf: actorType === 'admin' ? row.user_id : null, target: { grantId, reason } });
  }
  return row;
}

/** Revoke all of a user's grants (password reset, Q-OA5). Returns the number revoked. */
export async function revokeAllGrantsForUser(userId, reason = 'password_reset') {
  const res = await query(
    `UPDATE oauth_grants SET revoked_at = NOW(), revoked_reason = $2 WHERE user_id = $1 AND revoked_at IS NULL RETURNING id`,
    [userId, reason]
  );
  if (res.rowCount > 0) {
    await query('UPDATE oauth_tokens SET revoked_at = NOW() WHERE grant_id = ANY($1::uuid[]) AND revoked_at IS NULL', [res.rows.map((r) => r.id)]);
    await recordAuditEvent({ action: 'oauth.grants.revoke_all', actorType: 'system', onBehalfOf: userId, target: { reason, count: res.rowCount } });
  }
  return res.rowCount;
}

/** The user's live (not revoked, not expired) grants, newest first. */
export async function listGrants(userId, now = new Date()) {
  const res = await query(
    `SELECT id, client_id, client_label, scope, role_cap, diagram_ids, all_diagrams, created_at, last_used_at, expires_at
       FROM oauth_grants WHERE user_id = $1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > $2)
      ORDER BY created_at DESC LIMIT 50`,
    [userId, now]
  );
  return res.rows;
}

// ---------------------------------------------------------------------------------------------------------------
// Token issuance

async function issuePair(c, grant, parentId, now) {
  const access = randomSecret(ACCESS_PREFIX);
  const accessRow = await c.query(
    `INSERT INTO oauth_tokens (grant_id, kind, token_hash, parent_id, expires_at) VALUES ($1, 'access', $2, $3, $4) RETURNING id`,
    [grant.id, sha256Hex(access), parentId, new Date(now.getTime() + ACCESS_TTL_MS)]
  );
  const body = { access_token: access, token_type: 'Bearer', expires_in: ACCESS_TTL_MS / 1000, scope: grant.scope };
  if (String(grant.scope).split(' ').includes(OFFLINE_ACCESS)) {
    const refresh = randomSecret(REFRESH_PREFIX);
    await c.query(
      `INSERT INTO oauth_tokens (grant_id, kind, token_hash, parent_id, expires_at) VALUES ($1, 'refresh', $2, $3, $4)`,
      [grant.id, sha256Hex(refresh), parentId, new Date(now.getTime() + REFRESH_TTL_MS)]
    );
    body.refresh_token = refresh;
  }
  return { body, accessTokenId: accessRow.rows[0].id };
}

const invalidGrant = (description, extra = {}) => ({ ok: false, error: 'invalid_grant', description, ...extra });

/**
 * Redeem an authorization code (single use). Binds to client_id, redirect_uri and resource and verifies PKCE.
 * A second redemption revokes the grant (OAuth 2.1 section 4.1.3). A failed binding or PKCE check burns the code and
 * revokes the (token-less) grant, so a stolen code cannot be retried.
 * @returns {Promise<{ok: true, body: object, grantId: string} | {ok: false, error: string, description: string, grantId?: string}>}
 */
export async function exchangeAuthorizationCode({ code, clientId, redirectUri, codeVerifier, resource }, now = new Date()) {
  if (!looksLikeCode(code)) return invalidGrant('Invalid authorization code');
  let revokeAfter = null; // grant to revoke once the transaction is committed
  const result = await inTransaction(async (c) => {
    const row = (
      await c.query(
        `SELECT a.id AS auth_id, a.code_used_at, a.code_expires_at, a.code_challenge, a.client_id AS a_client, a.redirect_uri AS a_redirect, a.resource AS a_resource,
                g.id, g.user_id, g.scope, g.resource, g.revoked_at, g.expires_at, g.client_id, g.redirect_uri, u.status AS user_status
           FROM oauth_authorizations a JOIN oauth_grants g ON g.id = a.grant_id JOIN users u ON u.id = g.user_id
          WHERE a.code_hash = $1 FOR UPDATE OF a`,
        [sha256Hex(code)]
      )
    ).rows[0];
    if (!row) return invalidGrant('Invalid authorization code');
    if (row.code_used_at) {
      revokeAfter = { id: row.id, reason: 'code_reuse' };
      return invalidGrant('Authorization code already used', { grantId: row.id });
    }
    // Burn the code regardless of what follows.
    await c.query('UPDATE oauth_authorizations SET code_used_at = $2 WHERE id = $1', [row.auth_id, now]);
    const fail = (description) => {
      revokeAfter = { id: row.id, reason: 'exchange_failed' };
      return invalidGrant(description, { grantId: row.id });
    };
    if (new Date(row.code_expires_at).getTime() <= now.getTime()) return fail('Authorization code expired');
    if (row.revoked_at) return invalidGrant('Grant revoked', { grantId: row.id });
    if (row.user_status !== 'active') return fail('Account is not active');
    if (typeof clientId !== 'string' || !safeEqual(clientId, row.client_id)) return fail('client_id does not match the authorization');
    if (typeof redirectUri !== 'string' || !safeEqual(redirectUri, row.redirect_uri)) return fail('redirect_uri does not match the authorization');
    if (resource !== undefined && !resourceMatches(resource)) {
      revokeAfter = { id: row.id, reason: 'exchange_failed' };
      return { ok: false, error: 'invalid_target', description: 'resource must be this MCP server', grantId: row.id };
    }
    if (!verifyPkce(codeVerifier, String(row.code_challenge).trim())) return fail('PKCE verification failed');
    const issued = await issuePair(c, row, null, now);
    return { ok: true, body: issued.body, grantId: row.id };
  });
  if (revokeAfter) await revokeGrant(revokeAfter.id, revokeAfter.reason, { actorType: 'system' });
  return result;
}

/**
 * Refresh-token grant with rotation, reuse detection and retry tolerance (Q-OA4).
 * - Unused token: marked used, a new access + refresh pair is issued (refresh lifetime renews: 30 days idle).
 * - Used token: if its successor was NEVER used and the replay is within 60 s, the unused successor is revoked and a fresh
 *   pair issued (the client's first response was probably lost). Otherwise the whole grant is revoked.
 * @returns {Promise<{ok: true, body: object, grantId: string} | {ok: false, error: string, description: string, grantId?: string}>}
 */
export async function refreshTokens({ refreshToken, clientId, resource }, now = new Date()) {
  if (!looksLikeRefreshToken(refreshToken)) return invalidGrant('Invalid refresh token');
  let revokeReuse = null;
  const result = await inTransaction(async (c) => {
    const row = (
      await c.query(
        `SELECT t.id AS token_id, t.used_at, t.revoked_at AS token_revoked_at, t.expires_at AS token_expires_at,
                g.id, g.user_id, g.scope, g.client_id, g.resource, g.revoked_at, g.expires_at, u.status AS user_status
           FROM oauth_tokens t JOIN oauth_grants g ON g.id = t.grant_id JOIN users u ON u.id = g.user_id
          WHERE t.token_hash = $1 AND t.kind = 'refresh' FOR UPDATE OF t`,
        [sha256Hex(refreshToken)]
      )
    ).rows[0];
    if (!row) return invalidGrant('Invalid refresh token');
    if (typeof clientId !== 'string' || !safeEqual(clientId, row.client_id)) return invalidGrant('client_id does not match the grant');
    if (row.revoked_at || row.token_revoked_at) return invalidGrant('Grant revoked');
    if (row.expires_at && new Date(row.expires_at).getTime() <= now.getTime()) return invalidGrant('Grant expired');
    if (new Date(row.token_expires_at).getTime() <= now.getTime()) return invalidGrant('Refresh token expired');
    if (row.user_status !== 'active') return invalidGrant('Account is not active');
    if (resource !== undefined && !resourceMatches(resource)) return { ok: false, error: 'invalid_target', description: 'resource must be this MCP server', grantId: row.id };

    if (!row.used_at) {
      await c.query('UPDATE oauth_tokens SET used_at = $2 WHERE id = $1', [row.token_id, now]);
      const issued = await issuePair(c, row, row.token_id, now);
      return { ok: true, body: issued.body, grantId: row.id };
    }

    const successor = (
      await c.query(
        `SELECT id, used_at, revoked_at FROM oauth_tokens WHERE parent_id = $1 AND kind = 'refresh' ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
        [row.token_id]
      )
    ).rows[0];
    const withinGrace = now.getTime() - new Date(row.used_at).getTime() <= RETRY_GRACE_MS;
    if (successor && !successor.used_at && !successor.revoked_at && withinGrace) {
      await c.query(`UPDATE oauth_tokens SET revoked_at = $2 WHERE parent_id = $1 AND used_at IS NULL AND revoked_at IS NULL`, [row.token_id, now]);
      const issued = await issuePair(c, row, row.token_id, now);
      return { ok: true, body: issued.body, grantId: row.id };
    }
    revokeReuse = row.id;
    return invalidGrant('Refresh token already used', { grantId: row.id });
  });
  if (revokeReuse) await revokeGrant(revokeReuse, 'reuse', { actorType: 'system' });
  return result;
}

/**
 * RFC 7009 revocation by a client that disconnects: the presented token (access or refresh) identifies the grant,
 * which is revoked as a whole. Always silent about unknown tokens. Requires the client_id to match.
 */
export async function revokeByToken({ token, clientId }) {
  const kindOk = looksLikeAccessToken(token) || looksLikeRefreshToken(token);
  if (!kindOk) return false;
  const row = (
    await query(
      `SELECT g.id, g.client_id FROM oauth_tokens t JOIN oauth_grants g ON g.id = t.grant_id WHERE t.token_hash = $1`,
      [sha256Hex(token)]
    )
  ).rows[0];
  if (!row || typeof clientId !== 'string' || !safeEqual(clientId, row.client_id)) return false;
  await revokeGrant(row.id, 'user', { actorType: 'user' });
  return true;
}

// ---------------------------------------------------------------------------------------------------------------
// Verification (resource server side)

/**
 * Resolve an `oga_` access token to the agent principal used by lib/authz (same shape as personal tokens).
 * Joins the grant and the user on every request, so revocation, suspension and role changes apply immediately.
 * @returns {Promise<{ok: true, principal: object} | {ok: false, reason: 'invalid'|'revoked'|'expired'|'inactive'}>}
 */
export async function verifyAccessToken(secret, now = new Date()) {
  if (!looksLikeAccessToken(secret)) return { ok: false, reason: 'invalid' };
  const result = await query(
    `SELECT t.expires_at AS token_expires_at, t.revoked_at AS token_revoked_at,
            g.id AS grant_id, g.user_id, g.client_id, g.resource, g.role_cap, g.diagram_ids, g.all_diagrams,
            g.expires_at, g.revoked_at, g.last_used_at, u.status AS user_status, u.role AS user_role
       FROM oauth_tokens t JOIN oauth_grants g ON g.id = t.grant_id JOIN users u ON u.id = g.user_id
      WHERE t.token_hash = $1 AND t.kind = 'access'`,
    [sha256Hex(secret)]
  );
  const row = result.rows[0];
  if (!row) return { ok: false, reason: 'invalid' };
  if (!['viewer', 'commenter', 'editor'].includes(row.role_cap)) return { ok: false, reason: 'invalid' };
  // Audience: a token minted for any other resource is never honored here (RFC 8707, no passthrough).
  if (!resourceMatches(row.resource)) return { ok: false, reason: 'invalid' };
  if (row.revoked_at || row.token_revoked_at) return { ok: false, reason: 'revoked' };
  if (new Date(row.token_expires_at).getTime() <= now.getTime()) return { ok: false, reason: 'expired' };
  if (row.expires_at && new Date(row.expires_at).getTime() <= now.getTime()) return { ok: false, reason: 'expired' };
  if (row.user_status !== 'active') return { ok: false, reason: 'inactive' };

  let roleCap = row.role_cap;
  let allDiagrams = false;
  const allowlist = Array.isArray(row.diagram_ids) && row.diagram_ids.length > 0 ? row.diagram_ids : null;
  if (roleCap === 'editor') {
    if (row.all_diagrams) {
      // Admin-only all-boards editing (owner decision 2026-10-21): re-checked on every request. A user who is no longer
      // an admin keeps a connection that can read and comment but not write.
      if (row.user_role === 'admin') allDiagrams = true;
      else roleCap = 'commenter';
    } else if (!allowlist) {
      return { ok: false, reason: 'invalid' }; // defense in depth behind the CHECK constraint
    }
  }

  const last = row.last_used_at ? new Date(row.last_used_at).getTime() : 0;
  if (now.getTime() - last >= LAST_USED_REFRESH_MS) {
    Promise.resolve(query('UPDATE oauth_grants SET last_used_at = NOW() WHERE id = $1', [row.grant_id])).catch(() => {});
  }

  return {
    ok: true,
    principal: {
      kind: 'agent',
      userId: row.user_id,
      tokenId: row.grant_id,
      roleCap,
      diagramScope: allDiagrams ? null : allowlist,
      allDiagrams,
      credential: 'oauth',
      clientId: row.client_id,
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------

/** Opportunistic cleanup (ADR 5.8): old authorizations, long-expired tokens, long-revoked grants. */
export async function cleanupExpired(now = new Date()) {
  const day = 24 * 60 * 60 * 1000;
  await query('DELETE FROM oauth_authorizations WHERE created_at < $1', [new Date(now.getTime() - day)]);
  await query('DELETE FROM oauth_tokens WHERE expires_at < $1', [new Date(now.getTime() - 30 * day)]);
  await query('DELETE FROM oauth_grants WHERE revoked_at IS NOT NULL AND revoked_at < $1', [new Date(now.getTime() - 90 * day)]);
}
