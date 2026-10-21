// GET /api/diagrams/{id}/revision (AI-2 live pickup probe): shape, `since` validation, agent attribution, no writes.
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
      return {
        diagram: { id: ref, revision: '7', updated_at: new Date('2026-10-21T10:00:00Z'), updated_by: 'agent.owner@example.com' },
        role: mockRole, source: 'member', capabilities: policy.capabilitiesFor(mockRole),
      };
    }),
  };
});
jest.mock('../../lib/versionRepository', () => ({ versionRepository: { latestAgentChangeSince: jest.fn(), writerName: jest.fn() } }));

import { versionRepository as repo } from '../../lib/versionRepository';
import { agentActivity } from '../../lib/live/agentActivity';
import handler from '../../pages/api/diagrams/[id]/revision';

function mockRes() {
  const res = { headers: {} };
  res.status = jest.fn((c) => { res.statusCode = c; return res; });
  res.json = jest.fn((b) => { res.body = b; return res; });
  res.setHeader = jest.fn((k, v) => { res.headers[k.toLowerCase()] = v; return res; });
  return res;
}
const call = async (query = {}, method = 'GET') => { const res = mockRes(); await handler({ method, query: { id: 'd1', ...query }, headers: {}, body: {} }, res); return res; };

beforeEach(() => { agentActivity.clear(); mockRole = 'viewer'; repo.latestAgentChangeSince.mockReset(); repo.writerName.mockReset(); repo.writerName.mockResolvedValue('Agent Owner'); });

test('returns the head revision with ETag and no-store; no extra query without since (updatedBy stays null)', async () => {
  const res = await call();
  expect(res.statusCode).toBe(200);
  expect(res.body).toEqual({ revision: 7, updatedAt: '2026-10-21T10:00:00.000Z', updatedBy: null, agentChange: null, agents: [] });
  expect(repo.writerName).not.toHaveBeenCalled();
  expect(res.headers.etag).toBe('"7"');
  expect(res.headers['cache-control']).toBe('no-store');
  expect(repo.latestAgentChangeSince).not.toHaveBeenCalled();
});

test('since equal to the head runs no version query', async () => {
  const res = await call({ since: '7' });
  expect(res.body.agentChange).toBeNull();
  expect(repo.latestAgentChangeSince).not.toHaveBeenCalled();
});

test('since behind the head reports the latest agent change with its pre-change version', async () => {
  repo.latestAgentChangeSince.mockResolvedValue({ number: 12, previousNumber: 11, label: 'agent: map_structure - 14 changes', createdAt: 'x' });
  const res = await call({ since: '5' });
  expect(repo.latestAgentChangeSince).toHaveBeenCalledWith('d1', 5);
  expect(repo.writerName).toHaveBeenCalledWith('agent.owner@example.com');
  expect(res.body.updatedBy).toBe('Agent Owner');
  expect(res.body.agentChange).toEqual({ versionNumber: 12, previousVersionNumber: 11, label: 'agent: map_structure - 14 changes' });
});

test('since behind the head but no agent version: agentChange null', async () => {
  repo.latestAgentChangeSince.mockResolvedValue(null);
  expect((await call({ since: '1' })).body.agentChange).toBeNull();
});

test.each([['abc'], ['-1'], ['1.5'], ['']])('invalid since %p is a 400', async (since) => {
  const res = await call({ since });
  expect([res.statusCode, res.body.code]).toEqual([400, 'VALIDATION_FAILED']);
});

test('only GET is allowed', async () => {
  const res = await call({}, 'POST');
  expect(res.statusCode).toBe(405);
});

// ---- LA-2: agents[] from the in-memory register (ADR-0006 5.1) ----
const CALLER = '11111111-1111-4111-8111-111111111111'; // the mocked session user
const OTHER = '22222222-2222-4222-8222-222222222222';
const noteAs = (over) => agentActivity.note({ diagramId: 'd1', tokenId: 't1', userId: CALLER, kind: 'read', tool: 'diagram_get', clientLabel: 'Claude', userName: 'Peter', ...over });

test("the user an agent acts for sees its reading state and read focus; the ETag carries the activity time", async () => {
  noteAs({ kind: 'read', tool: 'board_read_region', focus: { x: 1, y: 2, w: 30, h: 40 } });
  const res = await call();
  expect(res.body.agents).toEqual([expect.objectContaining({ state: 'reading', mine: true, label: 'Claude', tool: 'board_read_region', focus: { x: 1, y: 2, w: 30, h: 40 } })]);
  expect(res.headers.etag).toMatch(/^"7-a\d+"$/);
});

test("a second user with access sees nothing for another user's agent read, but sees editing for a write", async () => {
  noteAs({ userId: OTHER, kind: 'read', tool: 'diagram_get' });
  expect((await call()).body.agents).toEqual([]);
  noteAs({ userId: OTHER, kind: 'write', tool: 'map_structure' });
  const res = await call();
  expect(res.body.agents).toEqual([expect.objectContaining({ state: 'editing', mine: false, label: 'Agent for Peter', tool: 'map_structure' })]);
  expect(res.body.agents[0].focus).toBeUndefined();
  expect(JSON.stringify(res.body.agents)).not.toContain(OTHER);
});

test('agents of another board are not reported', async () => {
  noteAs({ diagramId: 'other-board', kind: 'write' });
  expect((await call()).body.agents).toEqual([]);
});

test('a caught-up probe with agents present still runs no database query', async () => {
  noteAs({ kind: 'write', tool: 'diagram_apply_ops' });
  const { query } = require('../../lib/db');
  const before = query.mock.calls.length;
  const res = await call({ since: '7' });
  expect(res.body.agents).toHaveLength(1);
  expect(repo.writerName).not.toHaveBeenCalled();
  expect(repo.latestAgentChangeSince).not.toHaveBeenCalled();
  expect(query.mock.calls.length).toBe(before);
});

test('viewers (read-only) get agents too; the ETag is the plain revision when no agent is around', async () => {
  const res = await call();
  expect(res.body.agents).toEqual([]);
  expect(res.headers.etag).toBe('"7"');
});
