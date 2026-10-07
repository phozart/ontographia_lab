// Endpoint x role matrix (slice 5). The REAL authorize() + wrapper + policy run against a mocked database; roles
// come from the owner column / diagram_members rows exactly as in production. The expected minimum role per
// endpoint is written out by hand here (independent of lib/authz/policy.js), so a policy edit that silently widens
// access fails this test.
//
// Principals: owner, editor, commenter, viewer (members), none (signed in, no grant), admin (platform admin
// without a grant: no implicit access, Q-S1), unauth (no session).
// Denied calls must be answered by the wrapper BEFORE the handler touches anything: only the metadata and the
// member lookup may have hit the database.

let mockUser = null;
jest.mock('../../lib/useAuth', () => ({
  requireActiveUser: jest.fn(async (req, res) => {
    if (!mockUser) { res.status(401).json({ error: 'Unauthorized' }); return null; }
    return mockUser;
  }),
}));

let mockMemberRole = null;
let mockOtherQueries = [];
const D = '123e4567-e89b-12d3-a456-426614174000';
const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '33333333-3333-4333-8333-333333333333';
jest.mock('../../lib/db', () => ({
  query: jest.fn(async (sql) => {
    if (/FROM diagrams WHERE (id|short_id) = \$1/.test(sql) && /owner_id/.test(sql) && !/content/.test(sql)) {
      return { rows: [{
        id: '123e4567-e89b-12d3-a456-426614174000', short_id: 'LAB-1', name: 'D', type: 'infinite-canvas',
        owner_id: '11111111-1111-4111-8111-111111111111', created_by: 'o@x.co', revision: '1', version_seq: 0,
        updated_at: new Date(), updated_by: null, domain_id: null, project_id: null,
      }] };
    }
    if (/FROM diagram_members WHERE diagram_id = \$1 AND user_id = \$2/.test(sql) && /SELECT role/.test(sql)) {
      return { rows: mockMemberRole ? [{ role: mockMemberRole }] : [] };
    }
    mockOtherQueries.push(sql);
    return { rows: [] };
  }),
  getClient: jest.fn(async () => { throw new Error('stub: no pool'); }),
}));
jest.mock('../../lib/rateLimit', () => ({ rateLimit: () => ({ check: async () => ({ success: true }) }) }));

import accessH from '../../pages/api/diagrams/[id]/access';
import auditH from '../../pages/api/diagrams/[id]/audit';
import sharesH from '../../pages/api/diagrams/[id]/shares';
import memberH from '../../pages/api/diagrams/[id]/members/[userId]';
import diagramH from '../../pages/api/diagrams/[id]';
import duplicateH from '../../pages/api/diagrams/[id]/duplicate';
import versionsH from '../../pages/api/diagrams/[id]/versions/index';
import versionH from '../../pages/api/diagrams/[id]/versions/[v]/index';
import restoreH from '../../pages/api/diagrams/[id]/versions/[v]/restore';
import threadsH from '../../pages/api/diagrams/[id]/threads/index';
import threadH from '../../pages/api/diagrams/[id]/threads/[t]/index';
import replyH from '../../pages/api/diagrams/[id]/threads/[t]/comments';
import commentH from '../../pages/api/diagrams/[id]/comments/[c]';

const RANK = { viewer: 1, commenter: 2, editor: 3, owner: 4 };
const U = '44444444-4444-4444-8444-444444444444';
const q = { id: D, v: '1', t: U, c: U, userId: OTHER };

// [label, handler, method, minimum role that gets past authorization]
const ENDPOINTS = [
  ['GET /diagrams/{id}', diagramH, 'GET', 'viewer'],
  ['PUT /diagrams/{id}', diagramH, 'PUT', 'editor'],
  ['DELETE /diagrams/{id}', diagramH, 'DELETE', 'owner'],
  ['POST /duplicate', duplicateH, 'POST', 'viewer'],
  ['GET /versions', versionsH, 'GET', 'viewer'],
  ['POST /versions', versionsH, 'POST', 'editor'],
  ['GET /versions/{v}', versionH, 'GET', 'viewer'],
  ['PATCH /versions/{v}', versionH, 'PATCH', 'editor'],
  ['POST /versions/{v}/restore', restoreH, 'POST', 'editor'],
  ['GET /threads', threadsH, 'GET', 'viewer'],
  ['POST /threads', threadsH, 'POST', 'commenter'],
  ['GET /threads/{t}', threadH, 'GET', 'viewer'],
  ['PATCH /threads/{t}', threadH, 'PATCH', 'commenter'],
  ['POST /threads/{t}/comments', replyH, 'POST', 'commenter'],
  ['PATCH /comments/{c}', commentH, 'PATCH', 'commenter'],
  ['DELETE /comments/{c}', commentH, 'DELETE', 'commenter'],
  ['GET /access', accessH, 'GET', 'editor'],
  ['POST /shares', sharesH, 'POST', 'editor'],
  ['PUT /members/{userId}', memberH, 'PUT', 'editor'],
  ['DELETE /members/{userId} (someone else)', memberH, 'DELETE', 'editor'],
  ['GET /audit', auditH, 'GET', 'owner'],
];

const PRINCIPALS = [
  ['owner', { id: OWNER, role: 'user' }, null],
  ['editor', { id: U, role: 'user' }, 'editor'],
  ['commenter', { id: U, role: 'user' }, 'commenter'],
  ['viewer', { id: U, role: 'user' }, 'viewer'],
  ['none', { id: U, role: 'user' }, null],
  ['admin', { id: U, role: 'admin' }, null],
  ['unauth', null, null],
];
const effective = (name) => (['owner', 'editor', 'commenter', 'viewer'].includes(name) ? name : null);

function mockRes() {
  const res = { headers: {} };
  res.status = jest.fn((c) => { res.statusCode = c; return res; });
  res.json = jest.fn((b) => { res.body = b; return res; });
  res.end = jest.fn(() => res);
  res.setHeader = jest.fn();
  return res;
}

let errSpy;
beforeEach(() => { mockOtherQueries = []; errSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => errSpy.mockRestore());

describe.each(ENDPOINTS)('%s', (label, handler, method, minRole) => {
  test.each(PRINCIPALS)('%s', async (name, user, memberRole) => {
    mockUser = user ? { ...user, email: `${name}@x.co`, status: 'active' } : null;
    mockMemberRole = memberRole;
    const res = mockRes();
    await handler({ method, query: { ...q }, body: {}, headers: {} }, res);
    const role = effective(name);

    if (name === 'unauth') {
      expect(res.statusCode).toBe(401);
    } else if (!role) {
      // no grant at all (incl. platform admin): indistinguishable from a missing diagram
      expect([res.statusCode, res.body.code]).toEqual([404, 'NOT_FOUND']);
    } else if (RANK[role] < RANK[minRole]) {
      expect([res.statusCode, res.body.code]).toEqual([403, 'FORBIDDEN']);
    } else {
      // Authorization passed: the handler itself ran (its own queries, a logged stub failure, or its own
      // validation answer). It may then answer anything against the empty stub database, e.g. its own 404.
      expect(res.statusCode).not.toBe(401);
      expect(res.body && res.body.code).not.toBe('FORBIDDEN');
      const handlerRan = mockOtherQueries.length > 0 || errSpy.mock.calls.length > 0 || [400, 409, 422].includes(res.statusCode);
      expect(handlerRan).toBe(true);
      return;
    }
    // Denied: the handler must not have run any query of its own
    expect(mockOtherQueries).toEqual([]);
  });
});

describe('non-matrix rules', () => {
  test('DELETE /members/{self}: every member role may leave, no-access may not (404)', async () => {
    for (const memberRole of ['viewer', 'commenter', 'editor']) {
      mockUser = { id: U, role: 'user', email: 'x@x.co', status: 'active' };
      mockMemberRole = memberRole;
      const res = mockRes();
      await memberH({ method: 'DELETE', query: { id: D, userId: U }, body: {}, headers: {} }, res);
      // the handler ran (looked the membership up) instead of being stopped by the wrapper
      expect(res.statusCode).not.toBe(403);
      expect(mockOtherQueries.length).toBeGreaterThan(0);
      mockOtherQueries = [];
    }
    mockMemberRole = null;
    const none = mockRes();
    await memberH({ method: 'DELETE', query: { id: D, userId: U }, body: {}, headers: {} }, none);
    expect([none.statusCode, none.body.code]).toEqual([404, 'NOT_FOUND']);
  });

  test('viewer/commenter cannot revoke other members even though DELETE only needs read', async () => {
    for (const memberRole of ['viewer', 'commenter']) {
      mockUser = { id: U, role: 'user', email: 'x@x.co', status: 'active' };
      mockMemberRole = memberRole;
      const res = mockRes();
      await memberH({ method: 'DELETE', query: { id: D, userId: OTHER }, body: {}, headers: {} }, res);
      expect([res.statusCode, res.body.code]).toEqual([403, 'FORBIDDEN']);
    }
  });

  test('the owner can never be removed or demoted through the members endpoint', async () => {
    mockUser = { id: OWNER, role: 'user', email: 'o@x.co', status: 'active' };
    mockMemberRole = null;
    for (const method of ['PUT', 'DELETE']) {
      const res = mockRes();
      await memberH({ method, query: { id: D, userId: OWNER }, body: { role: 'viewer' }, headers: {} }, res);
      expect([res.statusCode, res.body.code]).toEqual([409, 'OWNER_IMMUTABLE']);
    }
  });

  test('list and create (no diagram scope) require a session', async () => {
    mockUser = null;
    const indexH = require('../../pages/api/diagrams/index').default;
    for (const method of ['GET', 'POST']) {
      const res = mockRes();
      await indexH({ method, query: {}, body: {}, headers: {} }, res);
      expect(res.statusCode).toBe(401);
    }
  });
});
