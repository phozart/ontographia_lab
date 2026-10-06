jest.mock('../../lib/useAuth', () => ({ requireActiveUser: jest.fn() }));
jest.mock('../../lib/db', () => ({ query: jest.fn() }));
jest.mock('../../lib/apiTokens', () => {
  const actual = jest.requireActual('../../lib/apiTokens');
  return { ...actual, createToken: jest.fn(), listTokens: jest.fn(), revokeToken: jest.fn() };
});

import { requireActiveUser } from '../../lib/useAuth';
import { query } from '../../lib/db';
import { createToken, listTokens, revokeToken } from '../../lib/apiTokens';
import tokensRoute from '../../pages/api/user/tokens/index';
import tokenRoute from '../../pages/api/user/tokens/[id]';

const ME = '11111111-1111-4111-8111-111111111111';
const D1 = '123e4567-e89b-12d3-a456-426614174000';
const T1 = '123e4567-e89b-12d3-a456-4266141740aa';

function mockRes() {
  const res = { headers: {} };
  res.status = jest.fn((c) => { res.statusCode = c; return res; });
  res.json = jest.fn((b) => { res.body = b; return res; });
  res.setHeader = jest.fn((k, v) => { res.headers[k] = v; });
  return res;
}
const req = (method, body, extra = {}) => ({ method, body, headers: { 'content-type': 'application/json' }, query: {}, ...extra });

beforeEach(() => {
  jest.resetAllMocks();
  requireActiveUser.mockResolvedValue({ id: ME, role: 'user', status: 'active' });
});

describe('GET /api/user/tokens', () => {
  test('401 without a session (requireActiveUser answers)', async () => {
    requireActiveUser.mockImplementation(async (rq, res) => { res.status(401).json({ error: 'Unauthorized' }); return null; });
    const res = mockRes();
    await tokensRoute(req('GET'), res);
    expect(res.statusCode).toBe(401);
    expect(listTokens).not.toHaveBeenCalled();
  });

  test('lists only the caller\'s tokens, no secrets or hashes', async () => {
    listTokens.mockResolvedValue([{ id: T1, name: 'n', token_prefix: 'ogl_abcd', role_cap: 'viewer' }]);
    const res = mockRes();
    await tokensRoute(req('GET'), res);
    expect(listTokens).toHaveBeenCalledWith(ME);
    expect(res.statusCode).toBe(200);
    expect(JSON.stringify(res.body)).not.toMatch(/token_hash|ogl_[A-Za-z0-9_-]{20,}/);
    expect(res.headers['Cache-Control']).toMatch(/no-store/);
  });
});

describe('POST /api/user/tokens', () => {
  test('creates and returns the secret exactly once, 201', async () => {
    createToken.mockResolvedValue({ token: 'ogl_SECRET', record: { id: T1, name: 'n' } });
    const res = mockRes();
    await tokensRoute(req('POST', { name: 'n', roleCap: 'commenter', expiresInDays: 30 }), res);
    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({ token: 'ogl_SECRET', record: { id: T1, name: 'n' } });
    expect(createToken).toHaveBeenCalledWith(ME, expect.objectContaining({ name: 'n', roleCap: 'commenter' }));
    expect(res.headers['Cache-Control']).toMatch(/no-store/);
  });

  test('editor cap and invalid input: 400, nothing created', async () => {
    for (const body of [{ name: 'n', roleCap: 'editor' }, {}, { name: 'n', diagramIds: [] }]) {
      const res = mockRes();
      await tokensRoute(req('POST', body), res);
      expect(res.statusCode).toBe(400);
    }
    expect(createToken).not.toHaveBeenCalled();
  });

  test('requires a JSON content type (cross-site form posts are refused)', async () => {
    const res = mockRes();
    await tokensRoute(req('POST', { name: 'n' }, { headers: { 'content-type': 'application/x-www-form-urlencoded' } }), res);
    expect(res.statusCode).toBe(415);
    expect(createToken).not.toHaveBeenCalled();
  });

  test('allowlist entries must be diagrams the user can read (checked with authorize)', async () => {
    query.mockResolvedValue({ rows: [] }); // diagram not found
    const res = mockRes();
    await tokensRoute(req('POST', { name: 'n', diagramIds: [D1] }), res);
    expect(res.statusCode).toBe(400);
    expect(createToken).not.toHaveBeenCalled();

    query.mockResolvedValue({ rows: [{ id: D1, owner_id: ME, short_id: 'LAB-1', name: 'x', type: 't', revision: 1 }] });
    createToken.mockResolvedValue({ token: 'ogl_S', record: { id: T1 } });
    const ok = mockRes();
    await tokensRoute(req('POST', { name: 'n', diagramIds: [D1] }), ok);
    expect(ok.statusCode).toBe(201);
    expect(createToken).toHaveBeenCalledWith(ME, expect.objectContaining({ diagramIds: [D1] }));
  });

  test('token limit surfaces as 409', async () => {
    const { TokenError } = jest.requireActual('../../lib/apiTokens');
    createToken.mockRejectedValue(new TokenError('TOKEN_LIMIT', 'too many'));
    const res = mockRes();
    await tokensRoute(req('POST', { name: 'n' }), res);
    expect(res.statusCode).toBe(409);
  });

  test('other methods: 405', async () => {
    const res = mockRes();
    await tokensRoute(req('PUT', {}), res);
    expect(res.statusCode).toBe(405);
  });
});

describe('DELETE /api/user/tokens/[id]', () => {
  test('revokes the caller\'s own token', async () => {
    revokeToken.mockResolvedValue(true);
    const res = mockRes();
    await tokenRoute(req('DELETE', undefined, { query: { id: T1 } }), res);
    expect(revokeToken).toHaveBeenCalledWith(ME, T1);
    expect(res.statusCode).toBe(200);
  });

  test('someone else\'s or unknown token: 404 (same answer)', async () => {
    revokeToken.mockResolvedValue(false);
    const res = mockRes();
    await tokenRoute(req('DELETE', undefined, { query: { id: T1 } }), res);
    expect(res.statusCode).toBe(404);
  });

  test('only DELETE is allowed', async () => {
    const res = mockRes();
    await tokenRoute(req('GET', undefined, { query: { id: T1 } }), res);
    expect(res.statusCode).toBe(405);
  });
});
