// Slice 5: behavior of access / shares / members / audit endpoints. The real policy table and the real
// withDiagramAuth wrapper run; role resolution, the session, repositories, audit and the limiter are mocked.
// (The full endpoint x role matrix lives in __tests__/authz/endpointMatrix.test.js.)
let mockUser = null;
let mockRole = 'owner';
let mockOwnerId = '99999999-9999-4999-8999-999999999999';
jest.mock('../../lib/useAuth', () => ({
  requireActiveUser: jest.fn(async (req, res) => {
    if (!mockUser) { res.status(401).json({ error: 'Unauthorized' }); return null; }
    return mockUser;
  }),
}));
jest.mock('../../lib/db', () => ({ query: jest.fn(), getClient: jest.fn() }));
const OWNER_ID = '99999999-9999-4999-8999-999999999999';
jest.mock('../../lib/authz/index', () => {
  const actual = jest.requireActual('../../lib/authz/index');
  const policy = jest.requireActual('../../lib/authz/policy');
  return {
    ...actual,
    authorize: jest.fn(async (principal, ref, action) => {
      if (!mockRole) throw new actual.AuthzError(404, 'NOT_FOUND', 'Diagram not found');
      if (!policy.can(mockRole, action)) throw new actual.AuthzError(403, 'FORBIDDEN', 'Access denied');
      return { diagram: { id: ref, short_id: 'LAB-1', owner_id: mockOwnerId }, role: mockRole, source: 'member', capabilities: policy.capabilitiesFor(mockRole) };
    }),
  };
});
jest.mock('../../lib/memberRepository', () => ({
  memberRepository: {
    findActiveUserByEmail: jest.fn(), getMember: jest.fn(), listAccess: jest.fn(),
    addMember: jest.fn(), setRole: jest.fn(), removeMember: jest.fn(), listSharedWith: jest.fn(),
  },
}));
jest.mock('../../lib/diagramRepository', () => ({
  diagramRepository: { findById: jest.fn(), duplicateDiagram: jest.fn(), updateDiagram: jest.fn() },
}));
jest.mock('../../lib/audit', () => ({ recordAuditEvent: jest.fn(async () => {}), listAuditEvents: jest.fn() }));
let mockLimited = false;
jest.mock('../../lib/rateLimit', () => ({
  rateLimit: jest.fn(() => ({
    check: jest.fn(async (req, res) => {
      if (mockLimited) { res.status(429).json({ error: 'Too many requests' }); return { success: false }; }
      return { success: true };
    }),
  })),
}));

import { memberRepository as repo } from '../../lib/memberRepository';
import { recordAuditEvent, listAuditEvents } from '../../lib/audit';
import { diagramRepository as diagrams } from '../../lib/diagramRepository';
import diagramHandler from '../../pages/api/diagrams/[id]';
import duplicateHandler from '../../pages/api/diagrams/[id]/duplicate';
import accessHandler from '../../pages/api/diagrams/[id]/access';
import sharesHandler from '../../pages/api/diagrams/[id]/shares';
import memberHandler from '../../pages/api/diagrams/[id]/members/[userId]';
import auditHandler from '../../pages/api/diagrams/[id]/audit';

const ID = '123e4567-e89b-12d3-a456-426614174000';
const ME = { id: '11111111-1111-4111-8111-111111111111', email: 'me@x.co', role: 'user', status: 'active' };
const TARGET = '22222222-2222-4222-8222-222222222222';
const ref = (id, email) => ({ id, name: null, email, image: null });

function mockRes() {
  const res = { headers: {} };
  res.status = jest.fn((c) => { res.statusCode = c; return res; });
  res.json = jest.fn((b) => { res.body = b; return res; });
  res.end = jest.fn(() => res);
  res.setHeader = jest.fn((k, v) => { res.headers[k.toLowerCase()] = v; return res; });
  return res;
}
const call = (handler, req) => { const res = mockRes(); return handler({ query: { id: ID }, body: {}, headers: {}, ...req }, res).then(() => res); };

beforeEach(() => {
  Object.values(repo).forEach((f) => f.mockReset());
  recordAuditEvent.mockClear();
  listAuditEvents.mockReset();
  mockUser = ME; mockRole = 'owner'; mockLimited = false; mockOwnerId = OWNER_ID;
  diagrams.findById.mockReset(); diagrams.duplicateDiagram.mockReset();
});

describe('GET /access', () => {
  const access = { owner: ref(OWNER_ID, 'o@x.co'), members: [{ user: ref(TARGET, 't@x.co'), role: 'viewer', grantedBy: null, createdAt: 'x' }] };

  test.each(['owner', 'editor'])('%s sees the owner, members and (empty until slices 6/7) invitations/links', async (role) => {
    mockRole = role;
    repo.listAccess.mockResolvedValue(access);
    const res = await call(accessHandler, { method: 'GET' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ owner: access.owner, members: access.members, invitations: [], links: [] });
    expect(res.body.you).toEqual({ userId: ME.id, role });
  });

  test.each(['commenter', 'viewer'])('%s -> 403', async (role) => {
    mockRole = role;
    expect((await call(accessHandler, { method: 'GET' })).statusCode).toBe(403);
    expect(repo.listAccess).not.toHaveBeenCalled();
  });

  test('no role -> 404, unauthenticated -> 401, other methods -> 405', async () => {
    mockRole = null;
    expect((await call(accessHandler, { method: 'GET' })).statusCode).toBe(404);
    mockRole = 'owner'; mockUser = null;
    expect((await call(accessHandler, { method: 'GET' })).statusCode).toBe(401);
    mockUser = ME;
    expect((await call(accessHandler, { method: 'POST' })).statusCode).toBe(405);
  });
});

describe('POST /shares', () => {
  const body = (over = {}) => ({ email: 'T@x.co', role: 'viewer', ...over });
  beforeEach(() => {
    repo.findActiveUserByEmail.mockResolvedValue(ref(TARGET, 't@x.co'));
    repo.addMember.mockResolvedValue({ diagramId: ID, userId: TARGET, role: 'viewer', grantedBy: ME.id, createdAt: 'c', updatedAt: 'u' });
  });

  test('owner grants an existing active user: 201 granted, audited, grantor recorded', async () => {
    const res = await call(sharesHandler, { method: 'POST', body: body({ role: 'editor' }) });
    expect(res.statusCode).toBe(201);
    expect(res.body).toMatchObject({ result: 'granted', member: { user: { id: TARGET, email: 't@x.co' }, role: 'viewer' } });
    expect(repo.addMember).toHaveBeenCalledWith(ID, TARGET, 'editor', ME.id);
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'share.grant', actorUserId: ME.id, diagramId: ID, target: { userId: TARGET, role: 'editor' },
    }));
    expect(JSON.stringify(recordAuditEvent.mock.calls)).not.toContain('t@x.co'); // ids only, no e-mail addresses
  });

  test.each(['viewer', 'commenter'])('editor may share as %s (Q-S3)', async (role) => {
    mockRole = 'editor';
    expect((await call(sharesHandler, { method: 'POST', body: body({ role }) })).statusCode).toBe(201);
  });

  test('editor may NOT grant editor (403), nothing written, no lookup of the account', async () => {
    mockRole = 'editor';
    const res = await call(sharesHandler, { method: 'POST', body: body({ role: 'editor' }) });
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('ROLE_NOT_GRANTABLE');
    expect(repo.addMember).not.toHaveBeenCalled();
    expect(repo.findActiveUserByEmail).not.toHaveBeenCalled();
  });

  test.each(['commenter', 'viewer'])('%s cannot share at all (403)', async (role) => {
    mockRole = role;
    expect((await call(sharesHandler, { method: 'POST', body: body() })).statusCode).toBe(403);
    expect(repo.findActiveUserByEmail).not.toHaveBeenCalled();
  });

  test.each([
    [{ email: undefined }], [{ email: '' }], [{ email: 'no-at-sign' }], [{ email: 42 }], [{ email: 'a@b.co ' + 'x'.repeat(300) }],
    [{ role: 'owner' }], [{ role: 'admin' }], [{ role: undefined }], [{ role: ['viewer'] }],
    [{ message: 'x'.repeat(501) }], [{ message: 5 }],
  ])('invalid body %j -> 400 VALIDATION_FAILED', async (over) => {
    const res = await call(sharesHandler, { method: 'POST', body: body(over) });
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(repo.addMember).not.toHaveBeenCalled();
  });

  test('role "owner" is rejected even for the owner (no ownership via share)', async () => {
    expect((await call(sharesHandler, { method: 'POST', body: body({ role: 'owner' }) })).statusCode).toBe(400);
  });

  test('unknown or non-active account -> 404 USER_NOT_FOUND with a clear message (Q-S8), nothing written', async () => {
    repo.findActiveUserByEmail.mockResolvedValue(null);
    const res = await call(sharesHandler, { method: 'POST', body: body() });
    expect(res.statusCode).toBe(404);
    expect(res.body.code).toBe('USER_NOT_FOUND');
    expect(res.body.error).toMatch(/no active account/i);
    expect(repo.addMember).not.toHaveBeenCalled();
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  test('sharing with the owner -> 409 ALREADY_OWNER; with an existing member -> 409 ALREADY_MEMBER', async () => {
    repo.findActiveUserByEmail.mockResolvedValue(ref(OWNER_ID, 'o@x.co'));
    const r1 = await call(sharesHandler, { method: 'POST', body: body() });
    expect([r1.statusCode, r1.body.code]).toEqual([409, 'ALREADY_OWNER']);
    repo.findActiveUserByEmail.mockResolvedValue(ref(TARGET, 't@x.co'));
    repo.addMember.mockResolvedValue(null);
    const r2 = await call(sharesHandler, { method: 'POST', body: body() });
    expect([r2.statusCode, r2.body.code]).toEqual([409, 'ALREADY_MEMBER']);
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  test('sharing with yourself -> 409 (you already have access)', async () => {
    mockRole = 'editor';
    repo.findActiveUserByEmail.mockResolvedValue(ref(ME.id, 'me@x.co'));
    const res = await call(sharesHandler, { method: 'POST', body: body({ role: 'viewer' }) });
    expect(res.statusCode).toBe(409);
    expect(repo.addMember).not.toHaveBeenCalled();
  });

  test('rate limited -> 429 before any lookup (Q-S8: 20/hour/user)', async () => {
    mockLimited = true;
    const res = await call(sharesHandler, { method: 'POST', body: body() });
    expect(res.statusCode).toBe(429);
    expect(repo.findActiveUserByEmail).not.toHaveBeenCalled();
  });
});

describe('PUT /members/{userId}', () => {
  const put = (role, userId = TARGET) => call(memberHandler, { method: 'PUT', query: { id: ID, userId }, body: { role } });
  const member = (role) => ({ diagramId: ID, userId: TARGET, role, grantedBy: null, createdAt: 'c', updatedAt: 'u' });
  beforeEach(() => {
    repo.getMember.mockResolvedValue(member('viewer'));
    repo.setRole.mockImplementation(async (d, u, from, to) => member(to));
  });

  test('owner changes viewer -> editor; audited with from/to; compare-and-set on the authorized role', async () => {
    const res = await put('editor');
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ userId: TARGET, role: 'editor' });
    expect(repo.setRole).toHaveBeenCalledWith(ID, TARGET, 'viewer', 'editor');
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'share.change', actorUserId: ME.id, diagramId: ID, target: { userId: TARGET, from: 'viewer', to: 'editor' },
    }));
  });

  test('same role is a no-op 200 without an audit event', async () => {
    const res = await put('viewer');
    expect(res.statusCode).toBe(200);
    expect(repo.setRole).not.toHaveBeenCalled();
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  test('editor may move viewer <-> commenter, but not promote to editor nor touch editors', async () => {
    mockRole = 'editor';
    expect((await put('commenter')).statusCode).toBe(200);
    expect((await put('editor')).statusCode).toBe(403);
    repo.getMember.mockResolvedValue(member('editor'));
    expect((await put('viewer')).statusCode).toBe(403);
    expect(repo.setRole).toHaveBeenCalledTimes(1);
  });

  test.each(['commenter', 'viewer'])('%s -> 403', async (role) => {
    mockRole = role;
    expect((await put('viewer')).statusCode).toBe(403);
    expect(repo.setRole).not.toHaveBeenCalled();
  });

  test('the owner cannot be demoted or changed: 409 OWNER_IMMUTABLE', async () => {
    const res = await put('viewer', OWNER_ID);
    expect([res.statusCode, res.body.code]).toEqual([409, 'OWNER_IMMUTABLE']);
    expect(repo.setRole).not.toHaveBeenCalled();
  });

  test('not a member -> 404 MEMBER_NOT_FOUND; bad userId -> 404; bad role -> 400', async () => {
    repo.getMember.mockResolvedValue(null);
    const r1 = await put('viewer');
    expect([r1.statusCode, r1.body.code]).toEqual([404, 'MEMBER_NOT_FOUND']);
    expect((await put('viewer', 'not-a-uuid')).statusCode).toBe(404);
    repo.getMember.mockResolvedValue(member('viewer'));
    expect((await put('owner')).statusCode).toBe(400);
    expect((await put(undefined)).statusCode).toBe(400);
  });

  test('a concurrent change (compare-and-set miss) -> 409 CONFLICT, no audit event', async () => {
    repo.setRole.mockResolvedValue(null);
    const res = await put('editor');
    expect([res.statusCode, res.body.code]).toEqual([409, 'CONFLICT']);
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });
});

describe('DELETE /members/{userId}', () => {
  const del = (userId = TARGET, user) => { if (user) mockUser = user; return call(memberHandler, { method: 'DELETE', query: { id: ID, userId } }); };
  const member = (role) => ({ diagramId: ID, userId: TARGET, role });
  beforeEach(() => {
    repo.getMember.mockResolvedValue(member('viewer'));
    repo.removeMember.mockResolvedValue(true);
  });

  test('owner revokes: 204, audited with the removed role', async () => {
    const res = await del();
    expect(res.statusCode).toBe(204);
    expect(repo.removeMember).toHaveBeenCalledWith(ID, TARGET, 'viewer');
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'share.revoke', actorUserId: ME.id, diagramId: ID, target: { userId: TARGET, role: 'viewer' },
    }));
  });

  test('editor may revoke viewer/commenter but not an editor', async () => {
    mockRole = 'editor';
    expect((await del()).statusCode).toBe(204);
    repo.getMember.mockResolvedValue(member('editor'));
    expect((await del()).statusCode).toBe(403);
    expect(repo.removeMember).toHaveBeenCalledTimes(1);
  });

  test.each(['commenter', 'viewer'])('%s cannot revoke someone else (403)', async (role) => {
    mockRole = role;
    expect((await del()).statusCode).toBe(403);
    expect(repo.removeMember).not.toHaveBeenCalled();
  });

  test.each(['viewer', 'commenter', 'editor'])('a %s can leave (remove themselves): 204, audited as a self action', async (role) => {
    mockRole = role;
    repo.getMember.mockResolvedValue({ diagramId: ID, userId: ME.id, role });
    const res = await del(ME.id);
    expect(res.statusCode).toBe(204);
    expect(repo.removeMember).toHaveBeenCalledWith(ID, ME.id, role);
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'share.revoke', target: { userId: ME.id, role, self: true } }));
  });

  test('the owner cannot be removed (409), not even by themselves', async () => {
    const res = await del(OWNER_ID);
    expect([res.statusCode, res.body.code]).toEqual([409, 'OWNER_IMMUTABLE']);
    mockUser = { ...ME, id: OWNER_ID };
    const res2 = await del(OWNER_ID);
    expect(res2.statusCode).toBe(409);
    expect(repo.removeMember).not.toHaveBeenCalled();
  });

  test('not a member -> 404; stale role (compare-and-set miss) -> 409 CONFLICT', async () => {
    repo.getMember.mockResolvedValue(null);
    expect((await del()).statusCode).toBe(404);
    repo.getMember.mockResolvedValue(member('viewer'));
    repo.removeMember.mockResolvedValue(false);
    const res = await del();
    expect([res.statusCode, res.body.code]).toEqual([409, 'CONFLICT']);
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  test('no role on the diagram -> 404 and nothing happens', async () => {
    mockRole = null;
    expect((await del()).statusCode).toBe(404);
    expect(repo.getMember).not.toHaveBeenCalled();
  });
});

describe('GET /audit', () => {
  test('owner reads events; limit and cursor are passed through', async () => {
    listAuditEvents.mockResolvedValue({ items: [{ id: 3, action: 'share.grant' }], nextCursor: '3' });
    const res = await call(auditHandler, { method: 'GET', query: { id: ID, limit: '10', cursor: '9' } });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ items: [{ id: 3, action: 'share.grant' }], nextCursor: '3' });
    expect(listAuditEvents).toHaveBeenCalledWith(ID, { limit: '10', cursor: '9' });
  });

  test.each(['editor', 'commenter', 'viewer'])('%s -> 403 (audit.read is owner-only)', async (role) => {
    mockRole = role;
    expect((await call(auditHandler, { method: 'GET' })).statusCode).toBe(403);
    expect(listAuditEvents).not.toHaveBeenCalled();
  });
});

describe('UUID case in /members/{userId}', () => {
  const LOWER = 'abcdefab-abcd-4abc-8abc-abcdefabcdef';
  const del = (userId) => call(memberHandler, { method: 'DELETE', query: { id: ID, userId } });

  test('the owner is immutable whatever the case of the id (409)', async () => {
    mockOwnerId = LOWER;
    const res = await del(LOWER.toUpperCase());
    expect([res.statusCode, res.body.code]).toEqual([409, 'OWNER_IMMUTABLE']);
    const put = await call(memberHandler, { method: 'PUT', query: { id: ID, userId: LOWER.toUpperCase() }, body: { role: 'viewer' } });
    expect(put.statusCode).toBe(409);
    expect(repo.removeMember).not.toHaveBeenCalled();
  });

  test('self-leave works with an uppercase id (acts on the lowercase row)', async () => {
    mockUser = { ...ME, id: LOWER };
    mockRole = 'viewer';
    repo.getMember.mockResolvedValue({ diagramId: ID, userId: LOWER, role: 'viewer' });
    repo.removeMember.mockResolvedValue(true);
    const res = await del(LOWER.toUpperCase());
    expect(res.statusCode).toBe(204);
    expect(repo.removeMember).toHaveBeenCalledWith(ID, LOWER, 'viewer');
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ target: { userId: LOWER, role: 'viewer', self: true } }));
  });
});

describe('owner decisions 2026-10-07', () => {
  test('4a: a viewer may duplicate (diagram.read is sufficient); the copy is theirs', async () => {
    mockRole = 'viewer';
    diagrams.findById.mockResolvedValue({ id: ID, name: 'D', content: { elements: [], connections: [], layers: [], groups: [], viewport: { x: 0, y: 0, zoom: 1 } } });
    diagrams.duplicateDiagram.mockResolvedValue({ id: 'new', name: 'D (copy)', revision: '0' });
    const res = await call(duplicateHandler, { method: 'POST' });
    expect(res.statusCode).toBe(201);
    expect(diagrams.duplicateDiagram).toHaveBeenCalledWith(expect.anything(), ME.email, ME.id);
  });

  test.each(['viewer', 'commenter'])('4b: an editor may change or revoke a %s regardless of who granted them', async (target) => {
    mockRole = 'editor';
    const someoneElse = '44444444-4444-4444-8444-444444444444'; // neither the actor nor the owner
    repo.getMember.mockResolvedValue({ diagramId: ID, userId: TARGET, role: target, grantedBy: someoneElse });
    repo.removeMember.mockResolvedValue(true);
    expect((await call(memberHandler, { method: 'DELETE', query: { id: ID, userId: TARGET } })).statusCode).toBe(204);
    const other = target === 'viewer' ? 'commenter' : 'viewer';
    repo.setRole.mockImplementation(async (d, u, from, to) => ({ diagramId: d, userId: u, role: to }));
    expect((await call(memberHandler, { method: 'PUT', query: { id: ID, userId: TARGET }, body: { role: other } })).statusCode).toBe(200);
  });

  test('4c: the dashboard "shared with me" payload carries the owner name, never the owner address', async () => {
    const { memberRepository: actual } = jest.requireActual('../../lib/memberRepository');
    const { query } = require('../../lib/db');
    query.mockResolvedValueOnce({ rows: [
      { id: 'd1', revision: '1', role: 'viewer', oid: OWNER_ID, oname: 'Alice Owner', oemail: 'alice@corp.example', oimage: null },
      { id: 'd2', revision: '1', role: 'viewer', oid: OWNER_ID, oname: null, oemail: 'bob.smith@corp.example', oimage: null },
    ] });
    const rows = await actual.listSharedWith(ME.id);
    expect(rows[0].owner).toEqual({ id: OWNER_ID, name: 'Alice Owner', image: null });
    expect(rows[1].owner.name).toBe('bob.smith');
    expect(JSON.stringify(rows)).not.toMatch(/corp\.example/);
  });

  describe('4c: GET /api/diagrams/{id} hides stored addresses from non-owners', () => {
    const full = { id: ID, short_id: 'LAB-1', owner_id: OWNER_ID, created_by: 'alice@corp.example', updated_by: 'ed@corp.example', revision: '2', content: { elements: [], connections: [] } };
    test.each(['editor', 'commenter', 'viewer'])('%s sees local parts only', async (role) => {
      mockRole = role;
      diagrams.findById.mockResolvedValue(full);
      const res = await call(diagramHandler, { method: 'GET', query: { id: ID } });
      expect(res.statusCode).toBe(200);
      expect(res.body.created_by).toBe('alice');
      expect(res.body.updated_by).toBe('ed');
      expect(JSON.stringify(res.body)).not.toMatch(/corp\.example/);
    });
    test('the owner still sees the stored values', async () => {
      diagrams.findById.mockResolvedValue(full);
      const res = await call(diagramHandler, { method: 'GET', query: { id: ID } });
      expect(res.body.created_by).toBe('alice@corp.example');
    });
  });

  test('4c: the access list (owner/editor only) keeps full e-mails', async () => {
    mockRole = 'editor';
    repo.listAccess.mockResolvedValue({ owner: ref(OWNER_ID, 'o@x.co'), members: [] });
    const res = await call(accessHandler, { method: 'GET' });
    expect(res.body.owner.email).toBe('o@x.co');
    mockRole = 'viewer';
    expect((await call(accessHandler, { method: 'GET' })).statusCode).toBe(403);
  });
});
