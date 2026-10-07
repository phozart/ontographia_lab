// API tests for every endpoint x role of pages/api/diagrams/[id]/threads/** and comments/** (slice 4).
// The real policy table (lib/authz/policy.js) and the real withDiagramAuth wrapper run; only role resolution
// (members arrive in slice 5), the session, the rate limiter and the repository are mocked.
let mockUser = null;
let mockRole = 'owner';
let mockLimited = false;
jest.mock('../../lib/useAuth', () => ({
  requireActiveUser: jest.fn(async (req, res) => {
    if (!mockUser) { res.status(401).json({ error: 'Unauthorized' }); return null; }
    return mockUser;
  }),
}));
jest.mock('../../lib/db', () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock('../../lib/rateLimit', () => ({
  rateLimit: () => ({
    check: jest.fn(async (req, res) => {
      if (mockLimited) { res.status(429).json({ error: 'Too many requests' }); return { success: false }; }
      return { success: true };
    }),
  }),
}));
jest.mock('../../lib/authz/index', () => {
  const actual = jest.requireActual('../../lib/authz/index');
  const policy = jest.requireActual('../../lib/authz/policy');
  return {
    ...actual,
    authorize: jest.fn(async (principal, ref, action) => {
      if (ref === 'LAB-404' || !mockRole) throw new actual.AuthzError(404, 'NOT_FOUND', 'Diagram not found');
      if (!policy.can(mockRole, action)) throw new actual.AuthzError(403, 'FORBIDDEN', 'Access denied');
      return { diagram: { id: ref, short_id: 'LAB-1', revision: '5' }, role: mockRole, source: 'owner', capabilities: policy.capabilitiesFor(mockRole) };
    }),
  };
});
jest.mock('../../lib/commentRepository', () => {
  const actual = jest.requireActual('../../lib/commentRepository');
  return {
    ...actual,
    commentRepository: {
      listThreads: jest.fn(), getThread: jest.fn(), createThread: jest.fn(), setStatus: jest.fn(),
      addComment: jest.fn(), editComment: jest.fn(), deleteComment: jest.fn(),
    },
  };
});

import { commentRepository as repo, CommentError } from '../../lib/commentRepository';
import threadsHandler from '../../pages/api/diagrams/[id]/threads/index';
import threadHandler from '../../pages/api/diagrams/[id]/threads/[t]/index';
import replyHandler from '../../pages/api/diagrams/[id]/threads/[t]/comments';
import commentHandler from '../../pages/api/diagrams/[id]/comments/[c]';

const ID = '123e4567-e89b-12d3-a456-426614174000';
const T = '223e4567-e89b-12d3-a456-426614174000';
const C = '323e4567-e89b-12d3-a456-426614174000';
const USER = { id: '11111111-1111-4111-8111-111111111111', email: 'a@b.co', role: 'user', status: 'active' };
const thread = (extra = {}) => ({ id: T, diagramId: ID, anchor: { type: 'canvas', x: 1, y: 2 }, anchorState: 'canvas', status: 'open', comments: [], commentCount: 1, ...extra });
const comment = (extra = {}) => ({ id: C, threadId: T, author: { id: USER.id, name: 'A', image: null }, body: 'hi', createdVia: 'web', deleted: false, ...extra });

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
  mockUser = USER; mockRole = 'owner'; mockLimited = false;
  repo.listThreads.mockResolvedValue({ items: [thread()], nextCursor: null });
  repo.getThread.mockResolvedValue(thread());
  repo.createThread.mockResolvedValue(thread());
  repo.setStatus.mockResolvedValue(thread({ status: 'resolved' }));
  repo.addComment.mockResolvedValue(comment());
  repo.editComment.mockResolvedValue(comment({ body: 'edited' }));
  repo.deleteComment.mockResolvedValue(true);
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

// role -> expected status. Policy: read=viewer; create/reply/resolve/edit_own/delete_own=commenter; delete_any=owner.
const MATRIX = {
  list:    { owner: 200, editor: 200, commenter: 200, viewer: 200, none: 404 },
  create:  { owner: 201, editor: 201, commenter: 201, viewer: 403, none: 404 },
  get:     { owner: 200, editor: 200, commenter: 200, viewer: 200, none: 404 },
  resolve: { owner: 200, editor: 200, commenter: 200, viewer: 403, none: 404 },
  reply:   { owner: 201, editor: 201, commenter: 201, viewer: 403, none: 404 },
  edit:    { owner: 200, editor: 200, commenter: 200, viewer: 403, none: 404 },
  delete:  { owner: 204, editor: 204, commenter: 204, viewer: 403, none: 404 },
};
const REQS = {
  list: () => call(threadsHandler, { method: 'GET' }),
  create: () => call(threadsHandler, { method: 'POST', body: { anchor: { type: 'canvas', x: 1, y: 2 }, body: 'hello' } }),
  get: () => call(threadHandler, { method: 'GET', query: { id: ID, t: T } }),
  resolve: () => call(threadHandler, { method: 'PATCH', query: { id: ID, t: T }, body: { status: 'resolved' } }),
  reply: () => call(replyHandler, { method: 'POST', query: { id: ID, t: T }, body: { body: 'reply' } }),
  edit: () => call(commentHandler, { method: 'PATCH', query: { id: ID, c: C }, body: { body: 'edited' } }),
  delete: () => call(commentHandler, { method: 'DELETE', query: { id: ID, c: C } }),
};
const repoFn = { list: 'listThreads', create: 'createThread', get: 'getThread', resolve: 'setStatus', reply: 'addComment', edit: 'editComment', delete: 'deleteComment' };

describe('role matrix', () => {
  for (const [endpoint, byRole] of Object.entries(MATRIX)) {
    describe(endpoint, () => {
      test.each(Object.entries(byRole))('%s -> %s', async (role, status) => {
        mockRole = role === 'none' ? null : role;
        const res = await REQS[endpoint]();
        expect(res.statusCode).toBe(status);
        if (status >= 400) {
          expect(repo[repoFn[endpoint]]).not.toHaveBeenCalled();
          expect(res.body.code).toBe(status === 404 ? 'NOT_FOUND' : 'FORBIDDEN');
        }
      });
      test('unauthenticated -> 401', async () => {
        mockUser = null;
        expect((await REQS[endpoint]()).statusCode).toBe(401);
        expect(repo[repoFn[endpoint]]).not.toHaveBeenCalled();
      });
    });
  }
  test('unknown diagram -> 404', async () => {
    expect((await call(threadsHandler, { method: 'GET', query: { id: 'LAB-404' } })).statusCode).toBe(404);
  });
  test('wrong methods -> 405 with Allow', async () => {
    const a = await call(threadsHandler, { method: 'DELETE' });
    expect(a.statusCode).toBe(405);
    expect(a.headers.allow).toMatch(/GET/);
    expect((await call(threadHandler, { method: 'DELETE', query: { id: ID, t: T } })).statusCode).toBe(405);
    expect((await call(replyHandler, { method: 'GET', query: { id: ID, t: T } })).statusCode).toBe(405);
    expect((await call(commentHandler, { method: 'POST', query: { id: ID, c: C } })).statusCode).toBe(405);
  });
});

describe('GET /threads', () => {
  test('passes filters; defaults status to open', async () => {
    await call(threadsHandler, { method: 'GET', query: { id: ID, status: 'all', anchorTarget: 'el1', limit: '10', cursor: 'c' } });
    expect(repo.listThreads).toHaveBeenCalledWith(ID, { status: 'all', anchorTarget: 'el1', limit: 10, cursor: 'c' });
    await call(threadsHandler, { method: 'GET' });
    expect(repo.listThreads.mock.calls[1][1].status).toBe('open');
  });
  test.each([[{ status: 'bogus' }], [{ limit: 'x' }], [{ limit: '0' }], [{ anchorTarget: 'x'.repeat(200) }]])('invalid query %j -> 400', async (q) => {
    const res = await call(threadsHandler, { method: 'GET', query: { id: ID, ...q } });
    expect(res.statusCode).toBe(400);
    expect(repo.listThreads).not.toHaveBeenCalled();
  });
  test('no-store cache header', async () => {
    expect((await call(threadsHandler, { method: 'GET' })).headers['cache-control']).toMatch(/no-store/);
  });
});

describe('POST /threads', () => {
  test('201 with the thread; actor is the session user via web; body is trimmed-agnostic text', async () => {
    const res = await call(threadsHandler, { method: 'POST', body: { anchor: { type: 'element', targetId: 'e1', x: 3, y: 4, fallbackX: 10, fallbackY: 20 }, body: '<b>hi</b>' } });
    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual(thread());
    expect(repo.createThread).toHaveBeenCalledWith(
      ID,
      { anchor: { type: 'element', targetId: 'e1', x: 3, y: 4, fallbackX: 10, fallbackY: 20 }, body: '<b>hi</b>' },
      { userId: USER.id, via: 'web' },
    );
  });
  test.each([
    [null], [[]], [{ body: 'x' }], [{ anchor: { type: 'canvas', x: 1, y: 2 } }],
    [{ anchor: { type: 'canvas', x: 1, y: 2 }, body: '' }],
    [{ anchor: { type: 'canvas', x: 1, y: 2 }, body: '   ' }],
    [{ anchor: { type: 'canvas', x: 1, y: 2 }, body: 5 }],
    [{ anchor: { type: 'canvas', x: 1, y: 2 }, body: 'a\u0000b' }],
    [{ anchor: { type: 'canvas', x: 'a', y: 2 }, body: 'x' }],
    [{ anchor: { type: 'canvas', x: Infinity, y: 2 }, body: 'x' }],
    [{ anchor: { type: 'canvas', x: 1e12, y: 2 }, body: 'x' }],
    [{ anchor: { type: 'nope', x: 1, y: 2 }, body: 'x' }],
    [{ anchor: { type: 'element', x: 1, y: 2, fallbackX: 1, fallbackY: 1 }, body: 'x' }],
    [{ anchor: { type: 'element', targetId: '', x: 1, y: 2, fallbackX: 1, fallbackY: 1 }, body: 'x' }],
    [{ anchor: { type: 'element', targetId: 'y'.repeat(129), x: 1, y: 2, fallbackX: 1, fallbackY: 1 }, body: 'x' }],
    [{ anchor: { type: 'element', targetId: 'e', x: 1, y: 2 }, body: 'x' }],
    [{ anchor: { type: 'canvas', x: 1, y: 2, targetId: 'e' }, body: 'x' }],
  ])('invalid body %j -> 400', async (body) => {
    const res = await call(threadsHandler, { method: 'POST', body });
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(repo.createThread).not.toHaveBeenCalled();
  });
  test('body over 10000 chars -> 413', async () => {
    const res = await call(threadsHandler, { method: 'POST', body: { anchor: { type: 'canvas', x: 1, y: 2 }, body: 'x'.repeat(10001) } });
    expect(res.statusCode).toBe(413);
    expect(res.body.code).toBe('PAYLOAD_TOO_LARGE');
  });
  test('exactly 10000 chars is accepted', async () => {
    const res = await call(threadsHandler, { method: 'POST', body: { anchor: { type: 'canvas', x: 1, y: 2 }, body: 'x'.repeat(10000) } });
    expect(res.statusCode).toBe(201);
  });
  test('rate limited -> 429 and nothing written', async () => {
    mockLimited = true;
    const res = await call(threadsHandler, { method: 'POST', body: { anchor: { type: 'canvas', x: 1, y: 2 }, body: 'x' } });
    expect(res.statusCode).toBe(429);
    expect(repo.createThread).not.toHaveBeenCalled();
  });
  test('diagram vanished -> 404', async () => {
    repo.createThread.mockResolvedValue(null);
    expect((await call(threadsHandler, { method: 'POST', body: { anchor: { type: 'canvas', x: 1, y: 2 }, body: 'x' } })).statusCode).toBe(404);
  });
  test('unexpected error -> 500 without details', async () => {
    repo.createThread.mockRejectedValue(new Error('connection string leaked'));
    const res = await call(threadsHandler, { method: 'POST', body: { anchor: { type: 'canvas', x: 1, y: 2 }, body: 'x' } });
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/leaked/);
  });
});

describe('GET/PATCH /threads/[t]', () => {
  test('get passes ids; missing thread -> 404', async () => {
    await call(threadHandler, { method: 'GET', query: { id: ID, t: T } });
    expect(repo.getThread).toHaveBeenCalledWith(ID, T);
    repo.getThread.mockResolvedValue(null);
    expect((await call(threadHandler, { method: 'GET', query: { id: ID, t: T } })).statusCode).toBe(404);
  });
  test('malformed thread id -> 404 without touching the repository', async () => {
    expect((await call(threadHandler, { method: 'GET', query: { id: ID, t: 'not-a-uuid' } })).statusCode).toBe(404);
    expect(repo.getThread).not.toHaveBeenCalled();
  });
  test('resolve / reopen pass the actor', async () => {
    await call(threadHandler, { method: 'PATCH', query: { id: ID, t: T }, body: { status: 'open' } });
    expect(repo.setStatus).toHaveBeenCalledWith(ID, T, 'open', { userId: USER.id, via: 'web' });
  });
  test.each([[{}], [{ status: 'deleted' }], [null], [{ status: 5 }]])('invalid patch %j -> 400', async (body) => {
    expect((await call(threadHandler, { method: 'PATCH', query: { id: ID, t: T }, body })).statusCode).toBe(400);
    expect(repo.setStatus).not.toHaveBeenCalled();
  });
  test('missing thread on patch -> 404', async () => {
    repo.setStatus.mockResolvedValue(null);
    expect((await call(threadHandler, { method: 'PATCH', query: { id: ID, t: T }, body: { status: 'resolved' } })).statusCode).toBe(404);
  });
});

describe('POST /threads/[t]/comments', () => {
  test('201 with comment; validates body', async () => {
    const res = await call(replyHandler, { method: 'POST', query: { id: ID, t: T }, body: { body: 'reply' } });
    expect(res.statusCode).toBe(201);
    expect(repo.addComment).toHaveBeenCalledWith(ID, T, 'reply', { userId: USER.id, via: 'web' });
    expect((await call(replyHandler, { method: 'POST', query: { id: ID, t: T }, body: { body: ' ' } })).statusCode).toBe(400);
    expect((await call(replyHandler, { method: 'POST', query: { id: ID, t: T }, body: { body: 'x'.repeat(10001) } })).statusCode).toBe(413);
  });
  test('missing thread -> 404; rate limited -> 429', async () => {
    repo.addComment.mockResolvedValue(null);
    expect((await call(replyHandler, { method: 'POST', query: { id: ID, t: T }, body: { body: 'x' } })).statusCode).toBe(404);
    mockLimited = true;
    repo.addComment.mockClear();
    expect((await call(replyHandler, { method: 'POST', query: { id: ID, t: T }, body: { body: 'x' } })).statusCode).toBe(429);
    expect(repo.addComment).not.toHaveBeenCalled();
  });
});

describe('PATCH/DELETE /comments/[c]', () => {
  test('edit passes the author check to the repository', async () => {
    await call(commentHandler, { method: 'PATCH', query: { id: ID, c: C }, body: { body: 'edited' } });
    expect(repo.editComment).toHaveBeenCalledWith(ID, C, 'edited', { userId: USER.id });
  });
  test('editing someone else\'s comment -> 403 (repository reports NOT_AUTHOR)', async () => {
    repo.editComment.mockRejectedValue(new CommentError(403, 'FORBIDDEN', 'Only the author can edit'));
    const res = await call(commentHandler, { method: 'PATCH', query: { id: ID, c: C }, body: { body: 'x' } });
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });
  test('invalid edit body -> 400/413; missing comment -> 404', async () => {
    expect((await call(commentHandler, { method: 'PATCH', query: { id: ID, c: C }, body: { body: '' } })).statusCode).toBe(400);
    expect((await call(commentHandler, { method: 'PATCH', query: { id: ID, c: C }, body: { body: 'x'.repeat(10001) } })).statusCode).toBe(413);
    repo.editComment.mockResolvedValue(null);
    expect((await call(commentHandler, { method: 'PATCH', query: { id: ID, c: C }, body: { body: 'x' } })).statusCode).toBe(404);
  });
  test('delete: owner may delete any (canDeleteAny), commenter only own', async () => {
    mockRole = 'owner';
    await call(commentHandler, { method: 'DELETE', query: { id: ID, c: C } });
    expect(repo.deleteComment).toHaveBeenLastCalledWith(ID, C, { userId: USER.id, canDeleteAny: true });
    mockRole = 'commenter';
    await call(commentHandler, { method: 'DELETE', query: { id: ID, c: C } });
    expect(repo.deleteComment).toHaveBeenLastCalledWith(ID, C, { userId: USER.id, canDeleteAny: false });
  });
  test('delete someone else\'s comment as commenter -> 403; missing -> 404', async () => {
    repo.deleteComment.mockRejectedValue(new CommentError(403, 'FORBIDDEN', 'Only the author or the owner can delete'));
    expect((await call(commentHandler, { method: 'DELETE', query: { id: ID, c: C } })).statusCode).toBe(403);
    repo.deleteComment.mockResolvedValue(false);
    expect((await call(commentHandler, { method: 'DELETE', query: { id: ID, c: C } })).statusCode).toBe(404);
  });
  test('malformed comment id -> 404 without touching the repository', async () => {
    expect((await call(commentHandler, { method: 'DELETE', query: { id: ID, c: 'zzz' } })).statusCode).toBe(404);
    expect(repo.deleteComment).not.toHaveBeenCalled();
  });
});
