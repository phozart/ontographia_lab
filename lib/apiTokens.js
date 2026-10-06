// lib/apiTokens.js
// Personal API tokens for non-interactive clients (MCP endpoint). Server-only.
//
// - The secret is `ogl_` + 32 random bytes (base64url). Only its SHA-256 is stored; the plaintext is returned once
//   by createToken() and cannot be recovered. A high-entropy random secret does not need a slow hash.
// - A token maps to an `agent` principal { kind, userId, tokenId, roleCap, diagramScope } for lib/authz.
// - Role cap is viewer or commenter only (editor tokens come with the agent-edit slice and a mandatory allowlist).

import crypto from 'crypto';
import { query } from './db';

export const TOKEN_PREFIX = 'ogl_';
export const TOKEN_ROLE_CAPS = Object.freeze(['viewer', 'commenter']);
export const MAX_ACTIVE_TOKENS_PER_USER = 20;
export const MAX_ALLOWLIST = 50;
export const MAX_NAME_LENGTH = 100;
export const MAX_EXPIRY_DAYS = 365;
const LAST_USED_REFRESH_MS = 5 * 60 * 1000;
const MAX_SECRET_LENGTH = 128;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SECRET_RE = /^ogl_[A-Za-z0-9_-]{20,}$/;

export class TokenError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'TokenError';
    this.code = code;
  }
}

export function generateTokenSecret() {
  return TOKEN_PREFIX + crypto.randomBytes(32).toString('base64url');
}

export function hashToken(secret) {
  return crypto.createHash('sha256').update(String(secret)).digest('hex');
}

/** Cheap shape check so garbage never costs a database query. */
export function looksLikeToken(value) {
  return typeof value === 'string' && value.length <= MAX_SECRET_LENGTH && SECRET_RE.test(value);
}

/** @returns {{ok: true, value: {name, roleCap, diagramIds, expiresAt}} | {ok: false, error: string}} */
export function validateTokenInput(input, now = new Date()) {
  const body = input && typeof input === 'object' ? input : {};
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return { ok: false, error: 'Name is required' };
  if (name.length > MAX_NAME_LENGTH) return { ok: false, error: `Name must be at most ${MAX_NAME_LENGTH} characters` };

  const roleCap = body.roleCap === undefined ? 'viewer' : body.roleCap;
  if (!TOKEN_ROLE_CAPS.includes(roleCap)) return { ok: false, error: 'Role must be viewer or commenter' };

  let expiresAt = null;
  if (body.expiresInDays !== undefined && body.expiresInDays !== null) {
    const d = body.expiresInDays;
    if (!Number.isInteger(d) || d < 1 || d > MAX_EXPIRY_DAYS) {
      return { ok: false, error: `Expiry must be a whole number of days between 1 and ${MAX_EXPIRY_DAYS}` };
    }
    expiresAt = new Date(now.getTime() + d * 24 * 60 * 60 * 1000);
  }

  let diagramIds = null;
  if (body.diagramIds !== undefined && body.diagramIds !== null) {
    if (!Array.isArray(body.diagramIds) || body.diagramIds.length === 0) {
      return { ok: false, error: 'Allowlist must be a non-empty list of diagrams (omit it for no restriction)' };
    }
    if (!body.diagramIds.every((id) => typeof id === 'string' && UUID_RE.test(id))) {
      return { ok: false, error: 'Allowlist entries must be diagram ids' };
    }
    diagramIds = [...new Set(body.diagramIds.map((id) => id.toLowerCase()))];
    if (diagramIds.length > MAX_ALLOWLIST) return { ok: false, error: `Allowlist is limited to ${MAX_ALLOWLIST} diagrams` };
  }

  return { ok: true, value: { name, roleCap, diagramIds, expiresAt } };
}

const PUBLIC_COLUMNS =
  'id, name, token_prefix, role_cap, diagram_ids, created_at, last_used_at, expires_at, revoked_at';

/**
 * Create a token for `userId`. Allowlist ownership/readability must be checked by the caller (via authorize).
 * @returns {Promise<{token: string, record: object}>} `token` is the only time the secret exists in plaintext.
 */
export async function createToken(userId, { name, roleCap, diagramIds, expiresAt }) {
  const active = await query(
    'SELECT COUNT(*) AS n FROM api_tokens WHERE user_id = $1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())',
    [userId]
  );
  if (Number(active.rows[0].n) >= MAX_ACTIVE_TOKENS_PER_USER) {
    throw new TokenError('TOKEN_LIMIT', `You can have at most ${MAX_ACTIVE_TOKENS_PER_USER} active tokens. Revoke one first.`);
  }
  const token = generateTokenSecret();
  const result = await query(
    `INSERT INTO api_tokens (user_id, name, token_prefix, token_hash, role_cap, diagram_ids, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${PUBLIC_COLUMNS}`,
    [userId, name, token.slice(0, TOKEN_PREFIX.length + 4), hashToken(token), roleCap, diagramIds, expiresAt]
  );
  return { token, record: result.rows[0] };
}

export async function listTokens(userId) {
  const result = await query(
    `SELECT ${PUBLIC_COLUMNS} FROM api_tokens WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`,
    [userId]
  );
  return result.rows;
}

/** Revoke one of the user's own tokens. Idempotent: false when it does not exist, is not theirs, or is already revoked. */
export async function revokeToken(userId, tokenId) {
  if (typeof tokenId !== 'string' || !UUID_RE.test(tokenId)) return false;
  const result = await query(
    'UPDATE api_tokens SET revoked_at = NOW() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL RETURNING id',
    [tokenId, userId]
  );
  return result.rowCount > 0;
}

/**
 * Resolve a bearer secret to an agent principal.
 * @returns {Promise<{ok: true, principal: object} | {ok: false, reason: 'invalid'|'revoked'|'expired'|'inactive'}>}
 */
export async function verifyToken(secret, now = new Date()) {
  if (!looksLikeToken(secret)) return { ok: false, reason: 'invalid' };
  const hash = hashToken(secret);
  const result = await query(
    `SELECT t.id, t.user_id, t.role_cap, t.diagram_ids, t.expires_at, t.revoked_at, t.last_used_at,
            u.status AS user_status
       FROM api_tokens t JOIN users u ON u.id = t.user_id
      WHERE t.token_hash = $1`,
    [hash]
  );
  const row = result.rows[0];
  if (!row) return { ok: false, reason: 'invalid' };
  if (!TOKEN_ROLE_CAPS.includes(row.role_cap)) return { ok: false, reason: 'invalid' };
  if (row.revoked_at) return { ok: false, reason: 'revoked' };
  if (row.expires_at && new Date(row.expires_at).getTime() <= now.getTime()) return { ok: false, reason: 'expired' };
  if (row.user_status !== 'active') return { ok: false, reason: 'inactive' };

  const last = row.last_used_at ? new Date(row.last_used_at).getTime() : 0;
  if (now.getTime() - last >= LAST_USED_REFRESH_MS) {
    // Best effort: bookkeeping must never fail or slow an authenticated call.
    Promise.resolve(query('UPDATE api_tokens SET last_used_at = NOW() WHERE id = $1', [row.id])).catch(() => {});
  }

  return {
    ok: true,
    principal: {
      kind: 'agent',
      userId: row.user_id,
      tokenId: row.id,
      roleCap: row.role_cap,
      diagramScope: Array.isArray(row.diagram_ids) ? row.diagram_ids : null,
    },
  };
}
