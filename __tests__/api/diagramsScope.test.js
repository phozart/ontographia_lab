// Slice 5: GET /api/diagrams?scope=owned|shared|all
jest.mock('../../lib/useAuth', () => ({
  requireActiveUser: jest.fn(async () => ({ id: 'u1', email: 'u@x.co', role: 'admin', status: 'active' })),
}));
jest.mock('../../lib/db', () => ({ query: jest.fn() }));
jest.mock('../../lib/diagramRepository', () => ({ diagramRepository: { findAll: jest.fn(), createDiagram: jest.fn() } }));
jest.mock('../../lib/memberRepository', () => ({ memberRepository: { listSharedWith: jest.fn() } }));

import { diagramRepository } from '../../lib/diagramRepository';
import { memberRepository } from '../../lib/memberRepository';
import handler from '../../pages/api/diagrams/index';

const run = async (query) => {
  const res = { headers: {} };
  res.status = jest.fn((c) => { res.statusCode = c; return res; });
  res.json = jest.fn((b) => { res.body = b; return res; });
  res.setHeader = jest.fn();
  await handler({ method: 'GET', query, headers: {} }, res);
  return res;
};
const owned = { id: 'o1', name: 'Mine', revision: '2', updated_at: '2026-01-02T00:00:00Z' };
const shared = { id: 's1', name: 'Theirs', revision: 4, updated_at: '2026-01-03T00:00:00Z', role: 'viewer', owner: { id: 'x', email: 'x@x.co' } };

beforeEach(() => {
  diagramRepository.findAll.mockReset().mockResolvedValue([owned]);
  memberRepository.listSharedWith.mockReset().mockResolvedValue([shared]);
});

describe('GET /api/diagrams scope', () => {
  test('default is owned only (unchanged behavior; admins get no extra diagrams, Q-S1)', async () => {
    const res = await run({});
    expect(res.body.map((d) => d.id)).toEqual(['o1']);
    expect(memberRepository.listSharedWith).not.toHaveBeenCalled();
    expect(diagramRepository.findAll.mock.calls[0][1]).toBe('u1');
  });

  test('shared: metadata with role and owner, no owned rows', async () => {
    const res = await run({ scope: 'shared' });
    expect(res.body).toEqual([expect.objectContaining({ id: 's1', access: { role: 'viewer' }, owner: shared.owner })]);
    expect(diagramRepository.findAll).not.toHaveBeenCalled();
    expect(res.body[0]).not.toHaveProperty('content');
  });

  test('all: both, newest first, each with access.role', async () => {
    const res = await run({ scope: 'all' });
    expect(res.body.map((d) => [d.id, d.access.role])).toEqual([['s1', 'viewer'], ['o1', 'owner']]);
  });

  test('type filter reaches the shared query; unknown scope -> 400', async () => {
    await run({ scope: 'shared', type: 'cld' });
    expect(memberRepository.listSharedWith).toHaveBeenCalledWith('u1', { type: 'cld' });
    const res = await run({ scope: 'everything' });
    expect(res.statusCode).toBe(400);
  });
});
