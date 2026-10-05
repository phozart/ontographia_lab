jest.mock('../../lib/useAuth', () => ({
  requireActiveUser: jest.fn(async () => ({ email: 'a@b.co', role: 'user' })),
}));
jest.mock('../../lib/diagramRepository', () => ({
  diagramRepository: {
    checkAccess: jest.fn(),
    updateDiagram: jest.fn(),
    createDiagram: jest.fn(),
    findAll: jest.fn(),
    deleteDiagram: jest.fn(),
    duplicateDiagram: jest.fn(),
  },
}));

import duplicateHandler from '../../pages/api/diagrams/[id]/duplicate';
import { diagramRepository as repo } from '../../lib/diagramRepository';
import idHandler from '../../pages/api/diagrams/[id]';
import indexHandler from '../../pages/api/diagrams/index';

function mockRes() {
  const res = {};
  res.status = jest.fn((c) => { res.statusCode = c; return res; });
  res.json = jest.fn((b) => { res.body = b; return res; });
  return res;
}
const UUID = '123e4567-e89b-12d3-a456-426614174000';

beforeEach(() => {
  Object.values(repo).forEach((f) => f.mockReset());
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('/api/diagrams/[id]', () => {
  test.each(['not-a-valid-id', "1'; DROP", 'LAB-', 'LAB-abc', 'lab-1x'])('malformed id %s -> 404 without DB call', async (id) => {
    const res = mockRes();
    await idHandler({ method: 'GET', query: { id }, body: {} }, res);
    expect(res.statusCode).toBe(404);
    expect(repo.checkAccess).not.toHaveBeenCalled();
  });

  test.each([UUID, 'LAB-12'])('valid id %s reaches the repository', async (id) => {
    repo.checkAccess.mockResolvedValue({ hasAccess: true, diagram: { id: UUID } });
    const res = mockRes();
    await idHandler({ method: 'GET', query: { id }, body: {} }, res);
    expect(res.statusCode).toBe(200);
  });

  test('PUT with name over 255 chars -> 400', async () => {
    repo.checkAccess.mockResolvedValue({ hasAccess: true, diagram: { id: UUID } });
    const res = mockRes();
    await idHandler({ method: 'PUT', query: { id: UUID }, body: { name: 'x'.repeat(256) } }, res);
    expect(res.statusCode).toBe(400);
    expect(repo.updateDiagram).not.toHaveBeenCalled();
  });

  test('500 does not leak details', async () => {
    repo.checkAccess.mockRejectedValue(new Error('relation "secret_table" does not exist'));
    const res = mockRes();
    await idHandler({ method: 'GET', query: { id: UUID }, body: {} }, res);
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/secret_table/);
    expect(res.body.details).toBeUndefined();
  });
});

describe('/api/diagrams', () => {
  test('POST with name over 255 chars -> 400', async () => {
    const res = mockRes();
    await indexHandler({ method: 'POST', query: {}, body: { type: 'flow', name: 'x'.repeat(256) } }, res);
    expect(res.statusCode).toBe(400);
    expect(repo.createDiagram).not.toHaveBeenCalled();
  });

  test('POST with non-string name -> 400', async () => {
    const res = mockRes();
    await indexHandler({ method: 'POST', query: {}, body: { type: 'flow', name: { a: 1 } } }, res);
    expect(res.statusCode).toBe(400);
  });

  test('500 does not leak details', async () => {
    repo.findAll.mockRejectedValue(new Error('password authentication failed for user "pg"'));
    const res = mockRes();
    await indexHandler({ method: 'GET', query: {}, body: {} }, res);
    expect(res.statusCode).toBe(500);
    expect(res.body.details).toBeUndefined();
  });
});

describe('PUT thumbnail validation', () => {
  test('rejects non-png or oversized thumbnails with 400', async () => {
    repo.checkAccess.mockResolvedValue({ hasAccess: true, diagram: { id: UUID } });
    for (const thumbnail of ['data:image/svg+xml;base64,AAAA', 'http://x/y.png', 'data:image/png;base64,' + 'A'.repeat(300 * 1024)]) {
      const res = mockRes();
      await idHandler({ method: 'PUT', query: { id: UUID }, body: { thumbnail } }, res);
      expect(res.statusCode).toBe(400);
    }
    expect(repo.updateDiagram).not.toHaveBeenCalled();
  });

  test('accepts a valid png thumbnail', async () => {
    repo.checkAccess.mockResolvedValue({ hasAccess: true, diagram: { id: UUID } });
    repo.updateDiagram.mockResolvedValue({ id: UUID });
    const res = mockRes();
    await idHandler({ method: 'PUT', query: { id: UUID }, body: { thumbnail: 'data:image/png;base64,AAAA' } }, res);
    expect(res.statusCode).toBe(200);
  });
});

describe('POST /api/diagrams/[id]/duplicate', () => {
  test('405 for other methods', async () => {
    const res = mockRes();
    await duplicateHandler({ method: 'GET', query: { id: UUID }, body: {} }, res);
    expect(res.statusCode).toBe(405);
  });

  test('malformed id -> 404 without DB call', async () => {
    const res = mockRes();
    await duplicateHandler({ method: 'POST', query: { id: 'nope' }, body: {} }, res);
    expect(res.statusCode).toBe(404);
    expect(repo.checkAccess).not.toHaveBeenCalled();
  });

  test('404 when missing, 403 when not owner', async () => {
    repo.checkAccess.mockResolvedValueOnce({ hasAccess: false, diagram: null });
    let res = mockRes();
    await duplicateHandler({ method: 'POST', query: { id: UUID }, body: {} }, res);
    expect(res.statusCode).toBe(404);
    repo.checkAccess.mockResolvedValueOnce({ hasAccess: false, diagram: { id: UUID } });
    res = mockRes();
    await duplicateHandler({ method: 'POST', query: { id: UUID }, body: {} }, res);
    expect(res.statusCode).toBe(403);
    expect(repo.duplicateDiagram).not.toHaveBeenCalled();
  });

  test('201 with the copy for the owner, copy owned by the caller', async () => {
    repo.checkAccess.mockResolvedValue({ hasAccess: true, diagram: { id: UUID, name: 'A' } });
    repo.duplicateDiagram.mockResolvedValue({ id: 'new', name: 'A (copy)' });
    const res = mockRes();
    await duplicateHandler({ method: 'POST', query: { id: UUID }, body: {} }, res);
    expect(res.statusCode).toBe(201);
    expect(repo.duplicateDiagram).toHaveBeenCalledWith({ id: UUID, name: 'A' }, 'a@b.co');
    expect(res.body.id).toBe('new');
  });
});
