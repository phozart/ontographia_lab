let mockUser = { id: 'u1', email: 'a@b.co', role: 'user', status: 'active' };
jest.mock('../../lib/useAuth', () => ({
  requireActiveUser: jest.fn(async (req, res) => {
    if (!mockUser) { res.status(401).json({ error: 'Unauthorized' }); return null; }
    return mockUser;
  }),
}));
jest.mock('../../lib/db', () => ({ query: jest.fn() }));
jest.mock('../../lib/authz/index', () => {
  const actual = jest.requireActual('../../lib/authz/index');
  return { ...actual, authorize: jest.fn() };
});

import { authorize, AuthzError } from '../../lib/authz/index';
import { withDiagramAuth, withUserAuth, AUTHZ_WRAPPED, principalFromUser } from '../../lib/authz/next';

function mockRes() {
  const res = { headers: {} };
  res.status = jest.fn((c) => { res.statusCode = c; return res; });
  res.json = jest.fn((b) => { res.body = b; return res; });
  res.setHeader = jest.fn((k, v) => { res.headers[k] = v; });
  return res;
}
const actions = { GET: 'diagram.read', PUT: 'diagram.write' };

beforeEach(() => { authorize.mockReset(); mockUser = { id: 'u1', email: 'a@b.co', role: 'user', status: 'active' }; jest.spyOn(console, 'error').mockImplementation(() => {}); });

describe('withDiagramAuth', () => {
  test('marks the handler as wrapped', () => {
    expect(withDiagramAuth(actions, async () => {})[AUTHZ_WRAPPED]).toBe(true);
    expect(withUserAuth(async () => {})[AUTHZ_WRAPPED]).toBe(true);
  });

  test('passes principal, diagram, role to the handler and authorizes the mapped action', async () => {
    authorize.mockResolvedValue({ diagram: { id: 'd' }, role: 'editor', source: 'member', capabilities: [] });
    const handler = jest.fn(async (req, res) => res.status(200).json({}));
    const res = mockRes();
    await withDiagramAuth(actions, handler)({ method: 'PUT', query: { id: 'abc' } }, res);
    expect(authorize).toHaveBeenCalledWith({ kind: 'user', userId: 'u1', platformRole: 'user', status: 'active' }, 'abc', 'diagram.write');
    expect(handler.mock.calls[0][2]).toMatchObject({ role: 'editor', diagram: { id: 'd' }, principal: { kind: 'user' } });
  });

  test('method not in the map -> 405 with Allow, no auth call', async () => {
    const res = mockRes();
    await withDiagramAuth(actions, jest.fn())({ method: 'DELETE', query: { id: 'abc' } }, res);
    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe('GET, PUT');
    expect(authorize).not.toHaveBeenCalled();
  });

  test('prototype-chain method names are not treated as mapped', async () => {
    const res = mockRes();
    await withDiagramAuth(actions, jest.fn())({ method: 'constructor', query: { id: 'abc' } }, res);
    expect(res.statusCode).toBe(405);
  });

  test('insufficient role (viewer saving) -> 403 FORBIDDEN, handler not run', async () => {
    authorize.mockRejectedValue(new AuthzError(403, 'FORBIDDEN', 'Access denied'));
    const handler = jest.fn();
    const res = mockRes();
    await withDiagramAuth(actions, handler)({ method: 'PUT', query: { id: 'abc' } }, res);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'Access denied', code: 'FORBIDDEN' });
    expect(handler).not.toHaveBeenCalled();
  });

  test('no role -> 404 NOT_FOUND', async () => {
    authorize.mockRejectedValue(new AuthzError(404, 'NOT_FOUND', 'Diagram not found'));
    const res = mockRes();
    await withDiagramAuth(actions, jest.fn())({ method: 'GET', query: { id: 'abc' } }, res);
    expect(res.statusCode).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  test('unauthenticated -> 401 and authorize never reached', async () => {
    mockUser = null;
    const res = mockRes();
    await withDiagramAuth(actions, jest.fn())({ method: 'GET', query: { id: 'abc' } }, res);
    expect(res.statusCode).toBe(401);
    expect(authorize).not.toHaveBeenCalled();
  });

  test('array / missing id is passed as an empty reference (-> 404 in authorize)', async () => {
    authorize.mockRejectedValue(new AuthzError(404, 'NOT_FOUND'));
    const res = mockRes();
    await withDiagramAuth(actions, jest.fn())({ method: 'GET', query: { id: ['a', 'b'] } }, res);
    expect(authorize.mock.calls[0][1]).toBe('');
  });

  test('unexpected handler error -> generic 500', async () => {
    authorize.mockResolvedValue({ diagram: {}, role: 'owner', source: 'owner', capabilities: [] });
    const res = mockRes();
    await withDiagramAuth(actions, async () => { throw new Error('secret detail'); })({ method: 'GET', query: { id: 'abc' } }, res);
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/secret/);
  });
});

describe('withUserAuth / principalFromUser', () => {
  test('principal derived from session user', () => {
    expect(principalFromUser({ id: 'x', role: 'admin', status: 'active' })).toEqual({ kind: 'user', userId: 'x', platformRole: 'admin', status: 'active' });
  });
  test('methods allow-list -> 405', async () => {
    const res = mockRes();
    await withUserAuth(jest.fn(), { methods: ['GET'] })({ method: 'PUT' }, res);
    expect(res.statusCode).toBe(405);
  });
});
