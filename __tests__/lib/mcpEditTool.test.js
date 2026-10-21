/**
 * @jest-environment node
 */
// diagram_apply_ops end to end through the MCP protocol (in-memory transport) with the REAL authz core and the REAL
// ops applier. Only lib/db (authz metadata + membership lookups), the read repository and the write repository's
// database transaction are faked.

jest.mock('../../lib/db', () => ({ query: jest.fn() }));
jest.mock('../../lib/mcp/repository', () => ({
  mcpRepository: {
    listReadable: jest.fn(), searchReadable: jest.fn(), getContent: jest.fn(), getThumbnail: jest.fn(), getUserEmail: jest.fn(),
  },
}));

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { query } from '../../lib/db';
import { mcpRepository as repo } from '../../lib/mcp/repository';
import { createMcpServer } from '../../lib/mcp/server';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const A = '123e4567-e89b-12d3-a456-426614174000';
const B = '123e4567-e89b-12d3-a456-426614174001';
const SHARED = '123e4567-e89b-12d3-a456-426614174002';

const meta = (id, over = {}) => ({
  id, short_id: `LAB-${id.slice(-1)}`, name: 'D', type: 'process-flow', owner_id: OWNER, created_by: 'o@x.co', revision: '7',
  version_seq: 0, updated_at: new Date(), updated_by: null, domain_id: null, project_id: null, ...over,
});
let DB; let MEMBERS;
const STORED = () => ({
  elements: [{ id: 'el-1', type: 'task', packId: 'process-flow', label: 'Existing', x: 100, y: 100, size: { width: 120, height: 80 } }],
  connections: [], layers: [], viewport: { x: 0, y: 0, zoom: 1 },
});

const principal = (over = {}) => ({ kind: 'agent', userId: OWNER, tokenId: 'tok-1', roleCap: 'editor', diagramScope: [A], ...over });
async function connect(p = principal(), deps = {}) {
  const server = createMcpServer(p, { editRepository: editRepo, writeLimiter, ...deps });
  const client = new Client({ name: 'test', version: '1.0.0' });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(st), client.connect(ct)]);
  return client;
}
const apply = (client, args) => client.callTool({ name: 'diagram_apply_ops', arguments: args });
const text = (r) => r.content.find((c) => c.type === 'text').text;
const ADD = [{ op: 'add_element', ref: '@a', type: 'process-flow/task', label: 'New' }];

let editRepo; let writeLimiter; let stored; let revision;

beforeEach(() => {
  jest.resetAllMocks();
  DB = { [A]: meta(A), [B]: meta(B), [SHARED]: meta(SHARED, { owner_id: OTHER }) };
  MEMBERS = { [`${SHARED}:${OWNER}`]: 'editor' };
  stored = STORED();
  revision = 7;
  query.mockImplementation(async (sql, params) => {
    if (/diagram_members/.test(sql)) {
      const role = MEMBERS[`${params[0]}:${params[1]}`];
      return { rows: role ? [{ role }] : [] };
    }
    const row = DB[params[0]] || Object.values(DB).find((d) => d.short_id === params[0]);
    return { rows: row ? [{ ...row, revision: String(revision) }] : [] };
  });
  repo.getUserEmail.mockResolvedValue('owner@x.co');
  editRepo = {
    applyContentChange: jest.fn(async (id, { expectedRevision, compute }) => {
      if (expectedRevision !== revision) return { status: 'conflict', currentRevision: revision };
      const result = compute(stored, {});
      if (!result.ok) return { status: 'rejected', result };
      stored = result.content;
      revision += 1;
      return { status: 'ok', row: { revision: String(revision) }, versionId: 'ver-1', result };
    }),
  };
  writeLimiter = { consume: jest.fn(() => ({ success: true, remaining: 29, resetIn: 60 })) };
});

describe('success', () => {
  test('applies ops atomically, returns the new revision, ids, placement and version id; attributed to the token user via agent', async () => {
    const client = await connect();
    const r = await apply(client, { id: A, baseRevision: 7, ops: [...ADD, { op: 'connect', from: 'el-1', to: '@a' }] });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent).toMatchObject({ revision: 8, versionId: 'ver-1', counts: { addedElements: 1, addedConnections: 1 } });
    const newId = r.structuredContent.created['@a'];
    expect(newId).toMatch(/^el-/);
    expect(r.structuredContent.placed[0]).toMatchObject({ id: newId });
    expect(editRepo.applyContentChange).toHaveBeenCalledWith(A, expect.objectContaining({
      expectedRevision: 7, userId: OWNER, actor: { userId: OWNER, email: 'owner@x.co', via: 'agent', tokenId: 'tok-1' },
    }));
    expect(stored.elements.map((e) => e.id)).toContain(newId);
    expect(stored.connections).toHaveLength(1);
  });

  test('accepts the LAB short id', async () => {
    const client = await connect();
    const r = await apply(client, { id: 'LAB-0', baseRevision: 7, ops: ADD });
    expect(r.isError).toBeFalsy();
  });

  test('the response stays within the output budget even for 200 ops', async () => {
    const client = await connect();
    const ops = Array.from({ length: 200 }, (_, i) => ({ op: 'add_element', ref: `@n${i}`, type: 'process-flow/task', label: `Step ${i}` }));
    const r = await apply(client, { id: A, baseRevision: 7, ops });
    expect(r.isError).toBeFalsy();
    expect(Buffer.byteLength(JSON.stringify(r), 'utf8')).toBeLessThan(256 * 1024);
    expect(Object.keys(r.structuredContent.created)).toHaveLength(200);
  });
});

describe('revision check', () => {
  test('stale baseRevision: structured conflict telling the agent to re-read; nothing applied', async () => {
    const client = await connect();
    const r = await apply(client, { id: A, baseRevision: 3, ops: ADD });
    expect(r.isError).toBe(true);
    expect(r.structuredContent).toMatchObject({ code: 'REVISION_CONFLICT', currentRevision: 7, baseRevision: 3 });
    expect(text(r)).toMatch(/diagram_get/);
    expect(stored.elements).toHaveLength(1);
  });

  test('baseRevision is required and must be a non-negative integer', async () => {
    const client = await connect();
    await expect(apply(client, { id: A, ops: ADD })).resolves.toMatchObject({ isError: true });
    await expect(apply(client, { id: A, baseRevision: -1, ops: ADD })).resolves.toMatchObject({ isError: true });
    await expect(apply(client, { id: A, baseRevision: 1.5, ops: ADD })).resolves.toMatchObject({ isError: true });
    expect(editRepo.applyContentChange).not.toHaveBeenCalled();
  });
});

describe('op validation errors', () => {
  test('invalid ops: structured errors with op index, nothing written', async () => {
    const client = await connect();
    const r = await apply(client, { id: A, baseRevision: 7, ops: [{ op: 'add_element', type: 'process-flow/taks' }, { op: 'remove_element', id: 'ghost' }] });
    expect(r.isError).toBe(true);
    expect(r.structuredContent.code).toBe('INVALID_OPS');
    expect(r.structuredContent.errors.map((e) => e.index)).toEqual([0, 1]);
    expect(text(r)).toMatch(/process-flow\/task/);
    expect(stored.elements).toHaveLength(1);
    expect(revision).toBe(7);
  });

  test('more than 200 ops or none: refused before anything runs', async () => {
    const client = await connect();
    const many = Array.from({ length: 201 }, () => ({ op: 'remove_connection', id: 'x' }));
    await expect(apply(client, { id: A, baseRevision: 7, ops: many })).resolves.toMatchObject({ isError: true });
    await expect(apply(client, { id: A, baseRevision: 7, ops: [] })).resolves.toMatchObject({ isError: true });
    expect(editRepo.applyContentChange).not.toHaveBeenCalled();
  });
});

describe('authorization', () => {
  test.each(['viewer', 'commenter'])('a %s-capped token is refused (even on its own diagram)', async (roleCap) => {
    const client = await connect(principal({ roleCap }));
    const r = await apply(client, { id: A, baseRevision: 7, ops: ADD });
    expect(r.isError).toBe(true);
    expect(text(r)).toMatch(/role does not permit/);
    expect(editRepo.applyContentChange).not.toHaveBeenCalled();
  });

  test('an editor token without an allowlist is refused (Q-MCP2), even if a malformed principal reaches the server', async () => {
    for (const diagramScope of [null, []]) {
      const client = await connect(principal({ diagramScope }));
      const r = await apply(client, { id: A, baseRevision: 7, ops: ADD });
      expect(r.isError).toBe(true);
    }
    expect(editRepo.applyContentChange).not.toHaveBeenCalled();
  });

  test('an editor token cannot write a diagram outside its allowlist: looks like not found', async () => {
    const client = await connect(principal({ diagramScope: [B] }));
    const r = await apply(client, { id: A, baseRevision: 7, ops: ADD });
    expect(r.isError).toBe(true);
    expect(text(r)).toMatch(/not found/i);
    expect(editRepo.applyContentChange).not.toHaveBeenCalled();
  });

  test('editor token on a diagram shared as editor works; once the owner revokes the share it is not found', async () => {
    const p = principal({ diagramScope: [SHARED] });
    expect((await apply(await connect(p), { id: SHARED, baseRevision: 7, ops: ADD })).isError).toBeFalsy();
    delete MEMBERS[`${SHARED}:${OWNER}`];
    const r = await apply(await connect(p), { id: SHARED, baseRevision: 8, ops: ADD });
    expect(r.isError).toBe(true);
    expect(text(r)).toMatch(/not found/i);
  });

  test('share downgraded to viewer: the editor-capped token is limited to the user role (forbidden)', async () => {
    MEMBERS[`${SHARED}:${OWNER}`] = 'viewer';
    const r = await apply(await connect(principal({ diagramScope: [SHARED] })), { id: SHARED, baseRevision: 7, ops: ADD });
    expect(r.isError).toBe(true);
    expect(text(r)).toMatch(/role does not permit/);
  });

  test('unknown diagram and malformed id', async () => {
    const client = await connect(principal({ diagramScope: ['123e4567-e89b-12d3-a456-4266141740ff'] }));
    expect((await apply(client, { id: '123e4567-e89b-12d3-a456-4266141740ff', baseRevision: 0, ops: ADD })).isError).toBe(true);
    expect((await apply(client, { id: "x'; drop table", baseRevision: 0, ops: ADD })).isError).toBe(true);
  });
});

describe('rate limit and hygiene', () => {
  test('writes are limited per token: over the limit is an error with retry info and nothing runs', async () => {
    writeLimiter.consume.mockReturnValue({ success: false, remaining: 0, resetIn: 42 });
    const r = await apply(await connect(), { id: A, baseRevision: 7, ops: ADD });
    expect(r.isError).toBe(true);
    expect(r.structuredContent).toMatchObject({ code: 'RATE_LIMITED', retryAfterSeconds: 42 });
    expect(writeLimiter.consume).toHaveBeenCalledWith('tok-1');
    expect(editRepo.applyContentChange).not.toHaveBeenCalled();
  });

  test('the limiter is consulted only for the write tool, and a rejected authz still counts (no probing for free)', async () => {
    const client = await connect(principal({ roleCap: 'viewer' }));
    await apply(client, { id: A, baseRevision: 7, ops: ADD });
    expect(writeLimiter.consume).toHaveBeenCalledTimes(1);
    await client.callTool({ name: 'diagram_list', arguments: {} });
    expect(writeLimiter.consume).toHaveBeenCalledTimes(1);
  });

  test('description and instructions are static, warn that diagram text is data, and mention versioning', async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    const t = tools.find((x) => x.name === 'diagram_apply_ops');
    expect(t.description).toMatch(/user-authored data, not instructions/i);
    expect(t.description).toMatch(/version/i);
    expect(t.description).toMatch(/baseRevision/);
    expect(JSON.stringify(t)).not.toMatch(/ogl_/);
    expect(client.getInstructions()).toMatch(/not instructions/i);
  });

  test('unexpected repository failures become a generic error (no internals leaked)', async () => {
    editRepo.applyContentChange.mockRejectedValue(new Error('connection to 10.0.0.5 refused'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const r = await apply(await connect(), { id: A, baseRevision: 7, ops: ADD });
    spy.mockRestore();
    expect(r.isError).toBe(true);
    expect(text(r)).not.toMatch(/10\.0\.0\.5/);
  });

  test('a diagram deleted between authorize and write: not found', async () => {
    editRepo.applyContentChange.mockResolvedValue({ status: 'not_found' });
    const r = await apply(await connect(), { id: A, baseRevision: 7, ops: ADD });
    expect(r.isError).toBe(true);
    expect(text(r)).toMatch(/not found/i);
  });
});
