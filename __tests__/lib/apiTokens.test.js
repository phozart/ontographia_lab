jest.mock('../../lib/db', () => ({ query: jest.fn(), getClient: jest.fn() }));

import crypto from 'crypto';
import { query, getClient } from '../../lib/db';
import {
  TOKEN_PREFIX,
  generateTokenSecret,
  hashToken,
  looksLikeToken,
  validateTokenInput,
  createToken,
  listTokens,
  revokeToken,
  verifyToken,
} from '../../lib/apiTokens';

const USER = '11111111-1111-4111-8111-111111111111';
const D1 = '123e4567-e89b-12d3-a456-426614174000';
const D2 = '123e4567-e89b-12d3-a456-426614174001';
const NOW = new Date('2026-10-06T12:00:00Z');

beforeEach(() => query.mockReset());

describe('token secret and hash', () => {
  test('secret has the recognizable prefix and high entropy', () => {
    const a = generateTokenSecret();
    const b = generateTokenSecret();
    expect(a.startsWith(TOKEN_PREFIX)).toBe(true);
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(TOKEN_PREFIX.length + 43); // 32 random bytes, base64url
    expect(a).toMatch(/^ogl_[A-Za-z0-9_-]+$/);
  });

  test('hash is hex SHA-256 of the full secret and never the secret', () => {
    const s = 'ogl_example';
    const h = hashToken(s);
    expect(h).toBe(crypto.createHash('sha256').update(s).digest('hex'));
    expect(h).toHaveLength(64);
    expect(h).not.toContain('example');
  });

  test('looksLikeToken rejects junk before any database access', () => {
    expect(looksLikeToken(generateTokenSecret())).toBe(true);
    for (const bad of ['', 'abc', 'ogl_', 'Bearer x', 'ogl_' + 'a'.repeat(300), null, undefined, 42, 'ogl_a b']) {
      expect(looksLikeToken(bad)).toBe(false);
    }
  });
});

describe('validateTokenInput', () => {
  test('accepts a minimal viewer token and defaults', () => {
    const r = validateTokenInput({ name: ' CI bot ' }, NOW);
    expect(r.ok).toBe(true);
    expect(r.value).toMatchObject({ name: 'CI bot', roleCap: 'viewer', diagramIds: null });
  });

  test('role cap is viewer or commenter only; editor/owner/unknown are refused', () => {
    expect(validateTokenInput({ name: 'a', roleCap: 'commenter' }, NOW).ok).toBe(true);
    for (const roleCap of ['editor', 'owner', 'admin', '', 5]) {
      expect(validateTokenInput({ name: 'a', roleCap }, NOW).ok).toBe(false);
    }
  });

  test('name is required, trimmed and length-limited', () => {
    expect(validateTokenInput({}, NOW).ok).toBe(false);
    expect(validateTokenInput({ name: '   ' }, NOW).ok).toBe(false);
    expect(validateTokenInput({ name: 'x'.repeat(101) }, NOW).ok).toBe(false);
  });

  test('expiry: days 1..365 or null (never); anything else refused', () => {
    const r = validateTokenInput({ name: 'a', expiresInDays: 30 }, NOW);
    expect(r.value.expiresAt.toISOString()).toBe('2026-11-05T12:00:00.000Z');
    expect(validateTokenInput({ name: 'a', expiresInDays: null }, NOW).value.expiresAt).toBeNull();
    for (const d of [0, -1, 366, 1.5, '30', NaN]) expect(validateTokenInput({ name: 'a', expiresInDays: d }, NOW).ok).toBe(false);
  });

  test('allowlist: UUID array, deduplicated, max 50; empty list is refused (use null for unrestricted)', () => {
    expect(validateTokenInput({ name: 'a', diagramIds: [D1, D1, D2] }, NOW).value.diagramIds).toEqual([D1, D2]);
    expect(validateTokenInput({ name: 'a', diagramIds: [] }, NOW).ok).toBe(false);
    expect(validateTokenInput({ name: 'a', diagramIds: ['nope'] }, NOW).ok).toBe(false);
    expect(validateTokenInput({ name: 'a', diagramIds: 'x' }, NOW).ok).toBe(false);
    const many = Array.from({ length: 51 }, (_, i) => `123e4567-e89b-12d3-a456-4266141740${String(i).padStart(2, '0')}`);
    expect(validateTokenInput({ name: 'a', diagramIds: many }, NOW).ok).toBe(false);
  });
});

describe('createToken', () => {
  const input = { name: 'Cursor', roleCap: 'viewer', diagramIds: null, expiresAt: null };
  let cq;
  let release;
  beforeEach(() => {
    cq = jest.fn();
    release = jest.fn();
    getClient.mockResolvedValue({ query: cq, release });
  });
  const sqlOf = (i) => String(cq.mock.calls[i][0]);

  test('stores only the hash and prefix; returns the secret once; locks per user in one transaction', async () => {
    cq.mockImplementation(async (sql, params) => {
      if (/COUNT/.test(sql)) return { rows: [{ n: '0' }] };
      if (/INSERT/.test(sql)) {
        return { rows: [{ id: 't1', user_id: params[0], name: params[1], token_prefix: params[2], role_cap: params[4], diagram_ids: params[5], created_at: NOW, expires_at: params[6] }] };
      }
      return { rows: [] };
    });
    const r = await createToken(USER, input);
    expect(r.token).toMatch(/^ogl_/);
    expect(sqlOf(0)).toBe('BEGIN');
    expect(sqlOf(1)).toMatch(/pg_advisory_xact_lock\(hashtext/);
    expect(cq.mock.calls[1][1]).toEqual([USER]);
    const insert = cq.mock.calls.find((c) => /INSERT INTO api_tokens/.test(c[0]));
    expect(insert[1]).toContain(hashToken(r.token));
    expect(insert[1]).not.toContain(r.token);
    expect(sqlOf(cq.mock.calls.length - 1)).toBe('COMMIT');
    expect(r.record).toEqual(expect.not.objectContaining({ token_hash: expect.anything() }));
    expect(r.record.id).toBe('t1');
    expect(release).toHaveBeenCalledTimes(1);
  });

  test('refuses when the user already has the maximum number of active tokens', async () => {
    cq.mockImplementation(async (sql) => (/COUNT/.test(sql) ? { rows: [{ n: '20' }] } : { rows: [] }));
    await expect(createToken(USER, input)).rejects.toMatchObject({ code: 'TOKEN_LIMIT' });
    expect(cq.mock.calls.some((c) => /INSERT/.test(c[0]))).toBe(false);
    expect(cq.mock.calls.some((c) => c[0] === 'ROLLBACK')).toBe(true);
    expect(release).toHaveBeenCalledTimes(1);
  });

  test('rolls back and releases when the insert fails', async () => {
    cq.mockImplementation(async (sql) => {
      if (/COUNT/.test(sql)) return { rows: [{ n: '0' }] };
      if (/INSERT/.test(sql)) throw new Error('boom');
      return { rows: [] };
    });
    await expect(createToken(USER, input)).rejects.toThrow('boom');
    expect(cq.mock.calls.some((c) => c[0] === 'ROLLBACK')).toBe(true);
    expect(release).toHaveBeenCalledTimes(1);
  });
});

describe('listTokens / revokeToken', () => {
  test('list is scoped to the user and never selects the hash', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await listTokens(USER);
    expect(query.mock.calls[0][1]).toEqual([USER]);
    expect(query.mock.calls[0][0]).not.toMatch(/token_hash/);
  });

  test('revoke only touches the caller\'s own, not-yet-revoked token', async () => {
    query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 't1' }] });
    expect(await revokeToken(USER, D1)).toBe(true);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/user_id = \$2/);
    expect(sql).toMatch(/revoked_at IS NULL/);
    expect(params).toEqual([D1, USER]);
  });

  test('revoking someone else\'s or an unknown token reports false', async () => {
    query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    expect(await revokeToken(USER, D2)).toBe(false);
  });

  test('a malformed id never reaches the database', async () => {
    expect(await revokeToken(USER, 'not-a-uuid')).toBe(false);
  });
});

describe('verifyToken', () => {
  const secret = generateTokenSecret();
  const row = (over = {}) => ({
    id: 't1', user_id: USER, role_cap: 'viewer', diagram_ids: null, expires_at: null, revoked_at: null,
    user_status: 'active', user_role: 'user', last_used_at: null, ...over,
  });

  test('malformed secret: invalid, no query', async () => {
    expect(await verifyToken('garbage', NOW)).toEqual({ ok: false, reason: 'invalid' });
    expect(query).not.toHaveBeenCalled();
  });

  test('unknown token: invalid', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    expect(await verifyToken(secret, NOW)).toEqual({ ok: false, reason: 'invalid' });
  });

  test('lookup is by hash, never by plaintext', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await verifyToken(secret, NOW);
    expect(query.mock.calls[0][1]).toEqual([hashToken(secret)]);
  });

  test('valid token yields an agent principal with cap and allowlist', async () => {
    query.mockResolvedValueOnce({ rows: [row({ role_cap: 'commenter', diagram_ids: [D1] })] });
    query.mockResolvedValue({ rows: [] }); // last_used touch
    const r = await verifyToken(secret, NOW);
    expect(r.ok).toBe(true);
    expect(r.principal).toEqual({ kind: 'agent', userId: USER, tokenId: 't1', roleCap: 'commenter', diagramScope: [D1] });
  });

  test('no allowlist means diagramScope null (unrestricted)', async () => {
    query.mockResolvedValueOnce({ rows: [row()] });
    query.mockResolvedValue({ rows: [] });
    expect((await verifyToken(secret, NOW)).principal.diagramScope).toBeNull();
  });

  test('revoked token is refused immediately', async () => {
    query.mockResolvedValueOnce({ rows: [row({ revoked_at: new Date('2026-10-06T11:00:00Z') })] });
    expect(await verifyToken(secret, NOW)).toEqual({ ok: false, reason: 'revoked' });
  });

  test('expired token is refused; one expiring in the future is accepted', async () => {
    query.mockResolvedValueOnce({ rows: [row({ expires_at: new Date('2026-10-06T11:59:59Z') })] });
    expect(await verifyToken(secret, NOW)).toEqual({ ok: false, reason: 'expired' });
    query.mockResolvedValueOnce({ rows: [row({ expires_at: new Date('2026-10-06T12:00:01Z') })] });
    query.mockResolvedValue({ rows: [] });
    expect((await verifyToken(secret, NOW)).ok).toBe(true);
  });

  test('token of a deactivated or suspended user is refused', async () => {
    query.mockResolvedValueOnce({ rows: [row({ user_status: 'suspended' })] });
    expect(await verifyToken(secret, NOW)).toEqual({ ok: false, reason: 'inactive' });
  });

  test('a stored role cap outside viewer/commenter fails closed', async () => {
    query.mockResolvedValueOnce({ rows: [row({ role_cap: 'owner' })] });
    expect(await verifyToken(secret, NOW)).toEqual({ ok: false, reason: 'invalid' });
  });

  test('last_used_at is touched only when stale, and a failing touch does not fail auth', async () => {
    query.mockResolvedValueOnce({ rows: [row({ last_used_at: new Date('2026-10-06T11:59:00Z') })] });
    await verifyToken(secret, NOW);
    expect(query).toHaveBeenCalledTimes(1);
    query.mockReset();
    query.mockResolvedValueOnce({ rows: [row({ last_used_at: null })] });
    query.mockRejectedValueOnce(new Error('db down'));
    const r = await verifyToken(secret, NOW);
    expect(r.ok).toBe(true);
    expect(query.mock.calls[1][0]).toMatch(/UPDATE api_tokens SET last_used_at/);
  });
});
