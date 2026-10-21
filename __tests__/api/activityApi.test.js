// GET /api/diagrams/{id}/activity (LA-3): visible to everyone with read access; sharing events only for audit.read.
let mockRole = 'viewer';
jest.mock('../../lib/useAuth', () => ({
  requireActiveUser: jest.fn(async () => ({ id: '11111111-1111-4111-8111-111111111111', email: 'a@b.co', role: 'user', status: 'active' })),
}));
jest.mock('../../lib/db', () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock('../../lib/authz/index', () => {
  const actual = jest.requireActual('../../lib/authz/index');
  const policy = jest.requireActual('../../lib/authz/policy');
  return {
    ...actual,
    authorize: jest.fn(async (principal, ref, action) => {
      if (!policy.can(mockRole, action)) throw new actual.AuthzError(403, 'FORBIDDEN', 'Access denied');
      return { diagram: { id: ref, revision: '9' }, role: mockRole, source: 'member', capabilities: policy.capabilitiesFor(mockRole) };
    }),
  };
});
jest.mock('../../lib/activityRepository', () => ({
  listActivity: jest.fn(async () => ({ items: [{ id: 's:1', kind: 'edit_session' }], nextCursor: 'abc' })),
  pruneEditSessions: jest.fn(async () => 0),
}));

import { listActivity, pruneEditSessions } from '../../lib/activityRepository';
import handler from '../../pages/api/diagrams/[id]/activity';

function mockRes() {
  const res = { headers: {} };
  res.status = jest.fn((c) => { res.statusCode = c; return res; });
  res.json = jest.fn((b) => { res.body = b; return res; });
  res.end = jest.fn(() => res);
  res.setHeader = jest.fn((k, v) => { res.headers[k.toLowerCase()] = v; return res; });
  return res;
}
const call = async (query = {}, method = 'GET') => { const res = mockRes(); await handler({ method, query: { id: 'd1', ...query }, headers: {}, body: {} }, res); return res; };

beforeEach(() => { mockRole = 'viewer'; listActivity.mockClear(); pruneEditSessions.mockClear(); });

test('a viewer gets the feed without sharing events', async () => {
  const res = await call();
  expect(res.statusCode).toBe(200);
  expect(res.body).toEqual({ items: [{ id: 's:1', kind: 'edit_session' }], nextCursor: 'abc' });
  expect(listActivity).toHaveBeenCalledWith('d1', expect.objectContaining({ includeShare: false, headRevision: 9 }));
  expect(res.headers['cache-control']).toBe('no-store');
});

test.each(['commenter', 'editor'])('%s: content activity only (no sharing events)', async (role) => {
  mockRole = role;
  await call();
  expect(listActivity.mock.calls[0][1].includeShare).toBe(false);
});

test('the owner also gets sharing events (audit.read)', async () => {
  mockRole = 'owner';
  await call();
  expect(listActivity.mock.calls[0][1].includeShare).toBe(true);
});

test('limit and cursor are passed through; the repository clamps', async () => {
  await call({ limit: '25', cursor: 'xyz' });
  expect(listActivity).toHaveBeenCalledWith('d1', expect.objectContaining({ limit: '25', cursor: 'xyz' }));
});

test('only GET is allowed', async () => {
  expect((await call({}, 'POST')).statusCode).toBe(405);
});

test('old edit sessions are pruned opportunistically, at most once per interval', async () => {
  jest.isolateModules(() => {});
  await call(); await call(); await call();
  expect(pruneEditSessions.mock.calls.length).toBeLessThanOrEqual(1);
});
