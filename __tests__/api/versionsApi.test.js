// API tests for every endpoint x role of pages/api/diagrams/[id]/versions/** (slice 2).
// The real policy table (lib/authz/policy.js) and the real withDiagramAuth wrapper run; only role resolution
// (members arrive in slice 5), the session, and the repository are mocked.
let mockUser = null;
let mockRole = 'owner';
jest.mock('../../lib/useAuth', () => ({
  requireActiveUser: jest.fn(async (req, res) => {
    if (!mockUser) { res.status(401).json({ error: 'Unauthorized' }); return null; }
    return mockUser;
  }),
}));
jest.mock('../../lib/db', () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock('../../lib/authz/index', () => {
  const actual = jest.requireActual('../../lib/authz/index');
  const policy = jest.requireActual('../../lib/authz/policy');
  return {
    ...actual,
    authorize: jest.fn(async (principal, ref, action) => {
      if (ref === 'LAB-404') throw new actual.AuthzError(404, 'NOT_FOUND', 'Diagram not found');
      if (!mockRole) throw new actual.AuthzError(404, 'NOT_FOUND', 'Diagram not found');
      if (!policy.can(mockRole, action)) throw new actual.AuthzError(403, 'FORBIDDEN', 'Access denied');
      return { diagram: { id: ref, short_id: 'LAB-1', revision: '5' }, role: mockRole, source: 'owner', capabilities: policy.capabilitiesFor(mockRole) };
    }),
  };
});
jest.mock('../../lib/versionRepository', () => {
  const actual = jest.requireActual('../../lib/versionRepository');
  return {
    ...actual,
    versionRepository: { list: jest.fn(), get: jest.fn(), createNamed: jest.fn(), update: jest.fn(), restore: jest.fn() },
  };
});
jest.mock('../../lib/audit', () => ({ recordAuditEvent: jest.fn() }));

import { versionRepository as repo, VersionError } from '../../lib/versionRepository';
import { recordAuditEvent } from '../../lib/audit';
import listHandler from '../../pages/api/diagrams/[id]/versions/index';
import oneHandler from '../../pages/api/diagrams/[id]/versions/[v]/index';
import restoreHandler from '../../pages/api/diagrams/[id]/versions/[v]/restore';

const ID = '123e4567-e89b-12d3-a456-426614174000';
const USER = { id: '11111111-1111-4111-8111-111111111111', email: 'a@b.co', role: 'user', status: 'active' };
const meta = (n, extra = {}) => ({
  id: `v-${n}`, number: n, kind: 'named', label: `V${n}`, description: null, createdAt: '2026-01-01T00:00:00.000Z',
  createdBy: { id: USER.id, name: 'A' }, createdVia: 'web', sizeBytes: 10, elementCount: 1, connectionCount: 0, restoredFrom: null, ...extra,
});

function mockRes() {
  const res = { headers: {} };
  res.status = jest.fn((c) => { res.statusCode = c; return res; });
  res.json = jest.fn((b) => { res.body = b; return res; });
  res.setHeader = jest.fn((k, v) => { res.headers[k.toLowerCase()] = v; return res; });
  return res;
}
const call = (handler, req) => { const res = mockRes(); return handler({ query: { id: ID }, body: {}, headers: {}, ...req }, res).then(() => res); };

beforeEach(() => {
  Object.values(repo).forEach((f) => f.mockReset());
  recordAuditEvent.mockReset();
  mockUser = USER;
  mockRole = 'owner';
  repo.list.mockResolvedValue({ items: [meta(2), meta(1)], nextCursor: null });
  repo.get.mockResolvedValue({ ...meta(1), content: { elements: [] } });
  repo.createNamed.mockResolvedValue({ created: true, version: meta(3) });
  repo.update.mockResolvedValue(meta(1, { label: 'New' }));
  repo.restore.mockResolvedValue({
    status: 'ok', diagram: { id: ID, revision: 7, updatedAt: '2026-01-02T00:00:00.000Z' }, version: meta(4, { kind: 'restore', label: null, restoredFrom: { id: 'v-1', number: 1 } }),
    preRestoreVersion: meta(3, { kind: 'pre_restore', label: null }),
  });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

// role -> expected status for each endpoint (the policy matrix: read=viewer, create/restore=editor)
const MATRIX = {
  list:    { owner: 200, editor: 200, commenter: 200, viewer: 200, none: 404 },
  create:  { owner: 201, editor: 201, commenter: 403, viewer: 403, none: 404 },
  get:     { owner: 200, editor: 200, commenter: 200, viewer: 200, none: 404 },
  patch:   { owner: 200, editor: 200, commenter: 403, viewer: 403, none: 404 },
  restore: { owner: 200, editor: 200, commenter: 403, viewer: 403, none: 404 },
};
const REQS = {
  list: () => call(listHandler, { method: 'GET' }),
  create: () => call(listHandler, { method: 'POST', body: { kind: 'named', label: 'Rev A' } }),
  get: () => call(oneHandler, { method: 'GET', query: { id: ID, v: '1' } }),
  patch: () => call(oneHandler, { method: 'PATCH', query: { id: ID, v: '1' }, body: { label: 'New' } }),
  restore: () => call(restoreHandler, { method: 'POST', query: { id: ID, v: '1' } }),
};
const repoFn = { list: 'list', create: 'createNamed', get: 'get', patch: 'update', restore: 'restore' };

describe('role matrix', () => {
  for (const [endpoint, byRole] of Object.entries(MATRIX)) {
    describe(endpoint, () => {
      test.each(Object.entries(byRole))('%s -> %s', async (role, status) => {
        mockRole = role === 'none' ? null : role;
        const res = await REQS[endpoint]();
        expect(res.statusCode).toBe(status);
        if (status >= 400) {
          expect(repo[repoFn[endpoint]]).not.toHaveBeenCalled(); // no data touched when denied
          expect(res.body.code).toBe(status === 404 ? 'NOT_FOUND' : 'FORBIDDEN');
        }
      });
      test('unauthenticated -> 401', async () => {
        mockUser = null;
        const res = await REQS[endpoint]();
        expect(res.statusCode).toBe(401);
        expect(repo[repoFn[endpoint]]).not.toHaveBeenCalled();
      });
    });
  }
  test('unknown diagram -> 404', async () => {
    const res = await call(listHandler, { method: 'GET', query: { id: 'LAB-404' } });
    expect(res.statusCode).toBe(404);
  });
  test('wrong methods -> 405 with Allow', async () => {
    const a = await call(listHandler, { method: 'DELETE' });
    expect(a.statusCode).toBe(405);
    expect(a.headers.allow).toMatch(/GET/);
    expect((await call(oneHandler, { method: 'PUT', query: { id: ID, v: '1' } })).statusCode).toBe(405);
    expect((await call(oneHandler, { method: 'DELETE', query: { id: ID, v: '1' } })).statusCode).toBe(405); // versions are immutable (Q-V3)
    expect((await call(restoreHandler, { method: 'GET', query: { id: ID, v: '1' } })).statusCode).toBe(405);
  });
});

describe('GET /versions', () => {
  test('returns { items, nextCursor } and passes filters through', async () => {
    repo.list.mockResolvedValue({ items: [meta(2)], nextCursor: 'abc' });
    const res = await call(listHandler, { method: 'GET', query: { id: ID, kind: 'named', limit: '10', cursor: 'zzz' } });
    expect(res.body).toEqual({ items: [meta(2)], nextCursor: 'abc' });
    expect(repo.list).toHaveBeenCalledWith(ID, { kind: 'named', limit: 10, cursor: 'zzz' });
    expect(res.headers['cache-control']).toMatch(/no-store/);
  });
  test('rejects an unknown kind and a non-numeric limit', async () => {
    expect((await call(listHandler, { method: 'GET', query: { id: ID, kind: 'bogus' } })).statusCode).toBe(400);
    expect((await call(listHandler, { method: 'GET', query: { id: ID, limit: 'x' } })).statusCode).toBe(400);
    expect(repo.list).not.toHaveBeenCalled();
  });
  test('uses the resolved diagram id (LAB-n works)', async () => {
    await call(listHandler, { method: 'GET', query: { id: 'LAB-1' } });
    expect(repo.list.mock.calls[0][0]).toBe('LAB-1'); // mocked authorize returns ref as id; real one returns the row's UUID
  });
  test('list items carry no content', async () => {
    const res = await call(listHandler, { method: 'GET' });
    for (const i of res.body.items) expect(i).not.toHaveProperty('content');
  });
});

describe('POST /versions', () => {
  test('201 with VersionMeta; actor is the session user via web', async () => {
    const res = await call(listHandler, { method: 'POST', body: { kind: 'named', label: ' Rev A ', description: 'issued' } });
    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual(meta(3));
    expect(repo.createNamed).toHaveBeenCalledWith(ID, { label: ' Rev A ', description: 'issued' }, { userId: USER.id, email: USER.email, via: 'web' });
  });
  test('kind defaults to named when omitted', async () => {
    expect((await call(listHandler, { method: 'POST', body: { label: 'x' } })).statusCode).toBe(201);
  });
  test('identical content -> 200 { deduplicated: true, version }', async () => {
    repo.createNamed.mockResolvedValue({ created: false, version: meta(2) });
    const res = await call(listHandler, { method: 'POST', body: { kind: 'named', label: 'x' } });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ deduplicated: true, version: meta(2) });
  });
  test.each([
    [{ kind: 'auto', reason: 'session_end' }],
    [{ kind: 'restore', label: 'x' }],
    [{ kind: 'named' }],
    [{ kind: 'named', label: 5 }],
    [{ kind: 'named', label: 'x', description: 5 }],
    [null],
    [[]],
  ])('invalid body %j -> 400', async (body) => {
    const res = await call(listHandler, { method: 'POST', body });
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(repo.createNamed).not.toHaveBeenCalled();
  });
  test('repository validation errors surface with their status/code (label length)', async () => {
    repo.createNamed.mockRejectedValue(new VersionError(400, 'VALIDATION_FAILED', 'label must be 1 to 120 characters'));
    const res = await call(listHandler, { method: 'POST', body: { kind: 'named', label: 'x'.repeat(500) } });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/label/);
  });
  test('diagram vanished mid-request -> 404', async () => {
    repo.createNamed.mockResolvedValue(null);
    expect((await call(listHandler, { method: 'POST', body: { label: 'x' } })).statusCode).toBe(404);
  });
  test('unexpected error -> 500 without leaking details', async () => {
    repo.createNamed.mockRejectedValue(new Error('connection string leaked'));
    const res = await call(listHandler, { method: 'POST', body: { label: 'x' } });
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/leaked/);
  });
});

describe('GET /versions/[v]', () => {
  test('returns VersionMeta & content', async () => {
    const res = await call(oneHandler, { method: 'GET', query: { id: ID, v: '1' } });
    expect(res.body.content).toEqual({ elements: [] });
    expect(res.body.number).toBe(1);
    expect(repo.get).toHaveBeenCalledWith(ID, 1);
  });
  test('missing version -> 404 NOT_FOUND', async () => {
    repo.get.mockResolvedValue(null);
    const res = await call(oneHandler, { method: 'GET', query: { id: ID, v: '9' } });
    expect(res.statusCode).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
  test.each(['0', '-1', 'abc', '1.5', '99999999999'])('malformed version number %s -> 400', async (v) => {
    const res = await call(oneHandler, { method: 'GET', query: { id: ID, v } });
    expect(res.statusCode).toBe(400);
    expect(repo.get).not.toHaveBeenCalled();
  });
});

describe('PATCH /versions/[v]', () => {
  test('renames; only given fields are passed', async () => {
    const res = await call(oneHandler, { method: 'PATCH', query: { id: ID, v: '1' }, body: { label: 'New' } });
    expect(res.statusCode).toBe(200);
    expect(res.body.label).toBe('New');
    expect(repo.update).toHaveBeenCalledWith(ID, 1, { label: 'New' });
  });
  test('description may be cleared with null', async () => {
    await call(oneHandler, { method: 'PATCH', query: { id: ID, v: '1' }, body: { description: null } });
    expect(repo.update).toHaveBeenCalledWith(ID, 1, { description: null });
  });
  test('content / kind / unknown keys cannot be patched (immutability)', async () => {
    for (const body of [{ content: {} }, { kind: 'auto' }, { number: 9 }, {}, { label: 'ok', content: {} }]) {
      const res = await call(oneHandler, { method: 'PATCH', query: { id: ID, v: '1' }, body });
      expect(res.statusCode).toBe(400);
    }
    expect(repo.update).not.toHaveBeenCalled();
  });
  test('missing version -> 404; repository validation -> 400', async () => {
    repo.update.mockResolvedValue(null);
    expect((await call(oneHandler, { method: 'PATCH', query: { id: ID, v: '9' }, body: { label: 'x' } })).statusCode).toBe(404);
    repo.update.mockRejectedValue(new VersionError(400, 'VALIDATION_FAILED', 'a named version needs a label'));
    expect((await call(oneHandler, { method: 'PATCH', query: { id: ID, v: '1' }, body: { label: null } })).statusCode).toBe(400);
  });
});

describe('POST /versions/[v]/restore', () => {
  test('200 { diagram, version(kind restore), preRestoreVersion } and one audit event', async () => {
    const res = await call(restoreHandler, { method: 'POST', query: { id: ID, v: '1' } });
    expect(res.statusCode).toBe(200);
    expect(res.body.diagram).toEqual({ id: ID, revision: 7, updatedAt: '2026-01-02T00:00:00.000Z' });
    expect(res.body.version.kind).toBe('restore');
    expect(res.body.preRestoreVersion.kind).toBe('pre_restore');
    expect(res.headers.etag).toBe('"7"');
    expect(repo.restore).toHaveBeenCalledWith(ID, 1, { userId: USER.id, email: USER.email, via: 'web' }, { expectedRevision: null });
    expect(recordAuditEvent).toHaveBeenCalledTimes(1);
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'version.restore', actorUserId: USER.id, diagramId: ID,
      target: expect.objectContaining({ fromVersion: 1, restoreVersion: 4, preRestoreVersion: 3, revision: 7 }),
    }));
  });
  test('no pre_restore key when the head was already versioned', async () => {
    repo.restore.mockResolvedValue({ status: 'ok', diagram: { id: ID, revision: 7, updatedAt: 'x' }, version: meta(4, { kind: 'restore' }) });
    const res = await call(restoreHandler, { method: 'POST', query: { id: ID, v: '1' } });
    expect(res.body).not.toHaveProperty('preRestoreVersion');
  });
  test('If-Match is parsed (quoted, weak, bare) and passed as expectedRevision', async () => {
    for (const h of ['"5"', 'W/"5"', '5']) {
      repo.restore.mockClear();
      await call(restoreHandler, { method: 'POST', query: { id: ID, v: '1' }, headers: { 'if-match': h } });
      expect(repo.restore.mock.calls[0][3]).toEqual({ expectedRevision: 5 });
    }
  });
  test('garbage If-Match -> 400', async () => {
    const res = await call(restoreHandler, { method: 'POST', query: { id: ID, v: '1' }, headers: { 'if-match': 'banana' } });
    expect(res.statusCode).toBe(400);
    expect(repo.restore).not.toHaveBeenCalled();
  });
  test('stale revision -> 409 REVISION_CONFLICT with current; no audit event', async () => {
    repo.restore.mockResolvedValue({ status: 'conflict', current: { revision: 9, updatedAt: 'x' } });
    const res = await call(restoreHandler, { method: 'POST', query: { id: ID, v: '1' }, headers: { 'if-match': '"5"' } });
    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('REVISION_CONFLICT');
    expect(res.body.current.revision).toBe(9);
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });
  test('restoring the current head is an explicit no-op (200 unchanged, no audit)', async () => {
    repo.restore.mockResolvedValue({ status: 'unchanged', diagram: { id: ID, revision: 5, updatedAt: 'x' }, version: meta(1) });
    const res = await call(restoreHandler, { method: 'POST', query: { id: ID, v: '1' } });
    expect(res.statusCode).toBe(200);
    expect(res.body.unchanged).toBe(true);
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });
  test('unknown version -> 404', async () => {
    repo.restore.mockResolvedValue({ status: 'not_found' });
    expect((await call(restoreHandler, { method: 'POST', query: { id: ID, v: '9' } })).statusCode).toBe(404);
  });
  test('un-restorable content -> 422 with the repository code', async () => {
    repo.restore.mockRejectedValue(new VersionError(422, 'VERSION_CONTENT_INVALID', 'bad'));
    const res = await call(restoreHandler, { method: 'POST', query: { id: ID, v: '1' } });
    expect(res.statusCode).toBe(422);
    expect(res.body.code).toBe('VERSION_CONTENT_INVALID');
  });
  test.each(['0', 'x', '-3'])('malformed version number %s -> 400', async (v) => {
    expect((await call(restoreHandler, { method: 'POST', query: { id: ID, v } })).statusCode).toBe(400);
    expect(repo.restore).not.toHaveBeenCalled();
  });
});
