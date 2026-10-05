// API tests for every endpoint row of pages/api/diagrams/** (slice 1). Real authorization code runs;
// only the database query function, the repository and the session are mocked.
let mockUser = null;
jest.mock('../../lib/useAuth', () => ({
  requireActiveUser: jest.fn(async (req, res) => {
    if (!mockUser) { res.status(401).json({ error: 'Unauthorized' }); return null; }
    return mockUser;
  }),
}));
jest.mock('../../lib/db', () => ({ query: jest.fn() }));
jest.mock('../../lib/diagramRepository', () => ({
  diagramRepository: {
    findById: jest.fn(),
    updateDiagram: jest.fn(),
    updateThumbnail: jest.fn(),
    createDiagram: jest.fn(),
    findAll: jest.fn(),
    deleteDiagram: jest.fn(),
  },
}));

import { query } from '../../lib/db';
import { diagramRepository as repo } from '../../lib/diagramRepository';
import idHandler from '../../pages/api/diagrams/[id]';
import indexHandler from '../../pages/api/diagrams/index';

function mockRes() {
  const res = { headers: {} };
  res.status = jest.fn((c) => { res.statusCode = c; return res; });
  res.json = jest.fn((b) => { res.body = b; return res; });
  res.setHeader = jest.fn((k, v) => { res.headers[k.toLowerCase()] = v; return res; });
  return res;
}
const UUID = '123e4567-e89b-12d3-a456-426614174000';
const OWNER = '11111111-1111-4111-8111-111111111111';
const STRANGER = '22222222-2222-4222-8222-222222222222';
const ADMIN = '33333333-3333-4333-8333-333333333333';
const users = {
  owner: { id: OWNER, email: 'a@b.co', role: 'user', status: 'active' },
  stranger: { id: STRANGER, email: 's@b.co', role: 'user', status: 'active' },
  admin: { id: ADMIN, email: 'admin@b.co', role: 'admin', status: 'active' },
};
const meta = { id: UUID, short_id: 'LAB-1', owner_id: OWNER, created_by: 'a@b.co', revision: '3', version_seq: 0, updated_at: new Date(), updated_by: null };
const row = { ...meta, name: 'D', type: 'infinite-canvas', content: { elements: [], connections: [], layers: [], groups: [], viewport: { x: 0, y: 0, zoom: 1 } } };
const good = { elements: [{ id: 'el-1', x: 0, y: 0 }], connections: [], layers: [], groups: [], viewport: { x: 0, y: 0, zoom: 1 } };

const call = (handler, req) => { const res = mockRes(); return handler({ query: {}, body: {}, headers: {}, ...req }, res).then(() => res); };

beforeEach(() => {
  Object.values(repo).forEach((f) => f.mockReset());
  query.mockReset();
  query.mockResolvedValue({ rows: [meta] });
  mockUser = users.owner;
  repo.findById.mockResolvedValue(row);
  repo.updateDiagram.mockResolvedValue({ ...row, revision: '4' });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('GET /api/diagrams/[id]', () => {
  test('owner: 200 with access block and numeric revision', async () => {
    const res = await call(idHandler, { method: 'GET', query: { id: UUID } });
    expect(res.statusCode).toBe(200);
    expect(res.body.access.role).toBe('owner');
    expect(res.body.access.source).toBe('owner');
    expect(res.body.access.capabilities).toEqual(expect.arrayContaining(['diagram.read', 'diagram.write', 'diagram.delete']));
    expect(res.body.revision).toBe(3);
    expect(res.headers.etag).toBe('"3"');
    expect(res.body.content.elements).toEqual([]);
  });

  test('LAB-n reference works', async () => {
    const res = await call(idHandler, { method: 'GET', query: { id: 'LAB-1' } });
    expect(res.statusCode).toBe(200);
  });

  test.each(['stranger', 'admin'])('%s (no grant) -> 404 and no content read (admins have no implicit access)', async (who) => {
    mockUser = users[who];
    const res = await call(idHandler, { method: 'GET', query: { id: UUID } });
    expect(res.statusCode).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
    expect(repo.findById).not.toHaveBeenCalled();
  });

  test('missing diagram and no-access diagram are indistinguishable', async () => {
    mockUser = users.stranger;
    const denied = await call(idHandler, { method: 'GET', query: { id: UUID } });
    query.mockResolvedValue({ rows: [] });
    const missing = await call(idHandler, { method: 'GET', query: { id: UUID } });
    expect(denied.statusCode).toBe(missing.statusCode);
    expect(denied.body).toEqual(missing.body);
  });

  test('unauthenticated -> 401', async () => {
    mockUser = null;
    expect((await call(idHandler, { method: 'GET', query: { id: UUID } })).statusCode).toBe(401);
  });

  test.each(['not-a-valid-id', "1'; DROP", 'LAB-', 'LAB-abc', 'lab-1x'])('malformed id %s -> 404 without DB call', async (id) => {
    const res = await call(idHandler, { method: 'GET', query: { id } });
    expect(res.statusCode).toBe(404);
    expect(query).not.toHaveBeenCalled();
  });

  test('500 does not leak details', async () => {
    query.mockRejectedValue(new Error('relation "secret_table" does not exist'));
    const res = await call(idHandler, { method: 'GET', query: { id: UUID } });
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/secret_table/);
  });

  test('POST/PATCH -> 405', async () => {
    for (const method of ['POST', 'PATCH', 'OPTIONS']) {
      expect((await call(idHandler, { method, query: { id: UUID } })).statusCode).toBe(405);
    }
  });
});

describe('PUT /api/diagrams/[id]', () => {
  const put = (body, headers = {}, who) => { if (who) mockUser = users[who]; return call(idHandler, { method: 'PUT', query: { id: UUID }, body, headers }); };

  test('owner: 200, returns row with numeric revision, ETag and no warnings', async () => {
    const res = await put({ name: 'N', content: good });
    expect(res.statusCode).toBe(200);
    expect(res.body.revision).toBe(4);
    expect(res.headers.etag).toBe('"4"');
    expect(res.body.warnings).toBeUndefined();
    expect(repo.updateDiagram).toHaveBeenCalledWith(UUID, expect.objectContaining({ name: 'N', content: good }), { expectedRevision: null, userId: OWNER });
  });

  test.each(['stranger', 'admin'])('%s -> 404, nothing written', async (who) => {
    const res = await put({ name: 'N', content: good }, {}, who);
    expect(res.statusCode).toBe(404);
    expect(repo.updateDiagram).not.toHaveBeenCalled();
  });

  test('non-owner gets 404 even for an invalid body (no validation oracle)', async () => {
    const res = await put({ name: 'x'.repeat(300), content: { evil: 1 } }, {}, 'stranger');
    expect(res.statusCode).toBe(404);
  });

  test('If-Match matching -> expectedRevision passed (quoted and bare forms)', async () => {
    await put({ content: good }, { 'if-match': '"3"' });
    expect(repo.updateDiagram.mock.calls[0][2].expectedRevision).toBe(3);
    await put({ content: good }, { 'if-match': '3' });
    expect(repo.updateDiagram.mock.calls[1][2].expectedRevision).toBe(3);
  });

  test('stale If-Match -> 409 REVISION_CONFLICT with current revision', async () => {
    repo.updateDiagram.mockResolvedValue(null);
    repo.findById.mockResolvedValue({ ...row, revision: '7', updated_by: OWNER });
    const res = await put({ content: good }, { 'if-match': '"3"' });
    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('REVISION_CONFLICT');
    expect(res.body.current).toEqual(expect.objectContaining({ revision: 7, updatedBy: OWNER }));
  });

  test('malformed If-Match -> 400', async () => {
    const res = await put({ content: good }, { 'if-match': 'abc' });
    expect(res.statusCode).toBe(400);
    expect(repo.updateDiagram).not.toHaveBeenCalled();
  });

  test('no If-Match -> unconditional update (rollout compatibility)', async () => {
    const res = await put({ content: good });
    expect(res.statusCode).toBe(200);
  });

  test('name over 255 chars -> 400', async () => {
    const res = await put({ name: 'x'.repeat(256) });
    expect(res.statusCode).toBe(400);
    expect(repo.updateDiagram).not.toHaveBeenCalled();
  });

  describe('server-side content validation', () => {
    test('unknown top-level key -> 400 VALIDATION_FAILED', async () => {
      const res = await put({ content: { ...good, diagram: {} } });
      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
      expect(res.body.error).toMatch(/diagram/);
      expect(repo.updateDiagram).not.toHaveBeenCalled();
    });
    test('forbidden key at depth -> 400', async () => {
      const content = JSON.parse('{"elements":[{"id":"a","x":0,"y":0,"d":{"__proto__":{"x":1}}}]}');
      expect((await put({ content })).statusCode).toBe(400);
    });
    test('too many elements -> 400', async () => {
      const content = { elements: Array.from({ length: 5001 }, (_, i) => ({ id: `e${i}` })) };
      expect((await put({ content })).statusCode).toBe(400);
    });
    test('too deep -> 400', async () => {
      let o = { id: 'a' }; const root = o;
      for (let i = 0; i < 40; i++) { o.n = {}; o = o.n; }
      expect((await put({ content: { elements: [root] } })).statusCode).toBe(400);
    });
    test('oversized content -> 413 PAYLOAD_TOO_LARGE', async () => {
      const res = await put({ content: { elements: [{ id: 'a', t: 'x'.repeat(5 * 1024 * 1024 + 1) }] } });
      expect(res.statusCode).toBe(413);
      expect(res.body.code).toBe('PAYLOAD_TOO_LARGE');
    });
    test('content must be an object', async () => {
      expect((await put({ content: 'str' })).statusCode).toBe(400);
      expect((await put({ content: [] })).statusCode).toBe(400);
    });
    test('unsafe URLs are stripped, saved content is the stripped copy, warnings returned', async () => {
      const content = { elements: [{ id: 'a', x: 0, y: 0, imageUrl: 'javascript:alert(1)', link: 'https://ok.example/' }] };
      const res = await put({ content });
      expect(res.statusCode).toBe(200);
      const saved = repo.updateDiagram.mock.calls[0][1].content;
      expect('imageUrl' in saved.elements[0]).toBe(false);
      expect(saved.elements[0].link).toBe('https://ok.example/');
      expect(res.body.warnings[0]).toMatch(/unsafe URL/);
    });
    test('null content is allowed (name-only update)', async () => {
      expect((await put({ name: 'n', content: null })).statusCode).toBe(200);
    });
  });
});

describe('PUT thumbnail-only (background preview refresh)', () => {
  const PNG = 'data:image/png;base64,AAAA';
  const put = (body, headers = {}) => call(idHandler, { method: 'PUT', query: { id: UUID }, body, headers });
  beforeEach(() => repo.updateThumbnail.mockResolvedValue({ id: UUID, revision: '3' }));

  test('does not touch revision: no updateDiagram call, no If-Match required, revision echoed unchanged', async () => {
    const res = await put({ thumbnail: PNG });
    expect(res.statusCode).toBe(200);
    expect(repo.updateThumbnail).toHaveBeenCalledWith(UUID, PNG);
    expect(repo.updateDiagram).not.toHaveBeenCalled();
    expect(res.body.revision).toBe(3);
  });

  test('ignores a stale If-Match (never a false 409)', async () => {
    expect((await put({ thumbnail: PNG }, { 'if-match': '"1"' })).statusCode).toBe(200);
  });

  test('thumbnail PUT between two content saves: both content saves succeed with consistent revisions', async () => {
    repo.updateDiagram.mockResolvedValueOnce({ ...row, revision: '4' }).mockResolvedValueOnce({ ...row, revision: '5' });
    const a = await put({ content: good }, { 'if-match': '"3"' });
    const t = await put({ thumbnail: PNG });
    repo.updateThumbnail.mockResolvedValue({ id: UUID, revision: '4' });
    const t2 = await put({ thumbnail: PNG });
    const b = await put({ content: good }, { 'if-match': `"${a.body.revision}"` });
    expect([a.statusCode, t.statusCode, t2.statusCode, b.statusCode]).toEqual([200, 200, 200, 200]);
    expect(t2.body.revision).toBe(a.body.revision);
    expect(repo.updateDiagram.mock.calls[1][2].expectedRevision).toBe(4);
  });

  test('with other fields present it is an ordinary (revision-bumping) save', async () => {
    await put({ thumbnail: PNG, name: 'x' });
    expect(repo.updateDiagram).toHaveBeenCalled();
    expect(repo.updateThumbnail).not.toHaveBeenCalled();
  });

  test.each([['javascript:alert(1)'], [123], ['data:image/png;base64,' + 'A'.repeat(300000)]])('invalid thumbnail %#, -> 400', async (t) => {
    expect((await put({ thumbnail: t })).statusCode).toBe(400);
    expect(repo.updateThumbnail).not.toHaveBeenCalled();
  });

  test('requires editor-level write access: non-owner -> 404', async () => {
    mockUser = users.stranger;
    expect((await put({ thumbnail: PNG })).statusCode).toBe(404);
    expect(repo.updateThumbnail).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/diagrams/[id]', () => {
  test('owner: 200', async () => {
    const res = await call(idHandler, { method: 'DELETE', query: { id: UUID } });
    expect(res.statusCode).toBe(200);
    expect(repo.deleteDiagram).toHaveBeenCalledWith(UUID);
  });
  test.each(['stranger', 'admin'])('%s -> 404, not deleted', async (who) => {
    mockUser = users[who];
    const res = await call(idHandler, { method: 'DELETE', query: { id: UUID } });
    expect(res.statusCode).toBe(404);
    expect(repo.deleteDiagram).not.toHaveBeenCalled();
  });
});

describe('GET/POST /api/diagrams', () => {
  test('GET lists only the caller\'s own diagrams (owner id passed to the repository)', async () => {
    repo.findAll.mockResolvedValue([row]);
    const res = await call(indexHandler, { method: 'GET', query: { type: 'bpmn' } });
    expect(res.statusCode).toBe(200);
    expect(repo.findAll).toHaveBeenCalledWith({ type: 'bpmn', domainId: undefined, projectId: undefined }, OWNER);
  });

  test('GET as admin is scoped to the admin\'s own diagrams', async () => {
    mockUser = users.admin;
    repo.findAll.mockResolvedValue([]);
    await call(indexHandler, { method: 'GET' });
    expect(repo.findAll).toHaveBeenCalledWith(expect.any(Object), ADMIN);
  });

  test('unauthenticated -> 401', async () => {
    mockUser = null;
    expect((await call(indexHandler, { method: 'GET' })).statusCode).toBe(401);
  });

  test('POST creates with owner id and validated content', async () => {
    repo.createDiagram.mockResolvedValue(row);
    const res = await call(indexHandler, { method: 'POST', body: { type: 'infinite-canvas', name: 'X', content: good } });
    expect(res.statusCode).toBe(201);
    expect(repo.createDiagram).toHaveBeenCalledWith(expect.objectContaining({ name: 'X', content: good }), 'a@b.co', OWNER);
  });

  test('POST without content is fine', async () => {
    repo.createDiagram.mockResolvedValue(row);
    expect((await call(indexHandler, { method: 'POST', body: { type: 'infinite-canvas', name: 'X' } })).statusCode).toBe(201);
  });

  test('POST content validation: unknown key 400, forbidden key 400, oversize 413, unsafe URL stripped', async () => {
    repo.createDiagram.mockResolvedValue(row);
    const post = (content) => call(indexHandler, { method: 'POST', body: { type: 'infinite-canvas', name: 'X', content } });
    expect((await post({ ...good, extra: 1 })).statusCode).toBe(400);
    expect((await post(JSON.parse('{"elements":[{"__proto__":{"a":1}}]}'))).statusCode).toBe(400);
    expect((await post({ elements: [{ t: 'x'.repeat(5 * 1024 * 1024 + 1) }] })).statusCode).toBe(413);
    expect(repo.createDiagram).not.toHaveBeenCalled();
    const ok = await post({ elements: [{ id: 'a', src: 'javascript:1' }] });
    expect(ok.statusCode).toBe(201);
    expect(repo.createDiagram.mock.calls[0][0].content.elements[0]).toEqual({ id: 'a' });
    expect(ok.body.warnings[0]).toMatch(/unsafe URL/);
  });

  test('POST with name over 255 chars / non-string name -> 400', async () => {
    const a = await call(indexHandler, { method: 'POST', body: { type: 'flow', name: 'x'.repeat(256) } });
    const b = await call(indexHandler, { method: 'POST', body: { type: 'flow', name: { a: 1 } } });
    expect([a.statusCode, b.statusCode]).toEqual([400, 400]);
    expect(repo.createDiagram).not.toHaveBeenCalled();
  });

  test('invalid type -> 400', async () => {
    repo.createDiagram.mockRejectedValue(new Error('Invalid type: x'));
    expect((await call(indexHandler, { method: 'POST', body: { type: 'x', name: 'n' } })).statusCode).toBe(400);
  });

  test('PUT/DELETE -> 405', async () => {
    for (const method of ['PUT', 'DELETE']) expect((await call(indexHandler, { method })).statusCode).toBe(405);
  });

  test('500 does not leak details', async () => {
    repo.findAll.mockRejectedValue(new Error('password authentication failed for user "pg"'));
    const res = await call(indexHandler, { method: 'GET' });
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/password/);
  });
});
