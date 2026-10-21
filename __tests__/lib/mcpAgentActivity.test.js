/**
 * @jest-environment node
 */
// LA-2: every single-board MCP tool records agent activity AFTER the access check (ADR-0006 5.1), and nothing else
// does. Real MCP protocol (in-memory transport) and the real authz core; only lib/db and the repositories are faked.

jest.mock('../../lib/db', () => ({ query: jest.fn() }));
jest.mock('../../lib/mcp/repository', () => ({
  mcpRepository: {
    listReadable: jest.fn(), searchReadable: jest.fn(), getContent: jest.fn(), getThumbnail: jest.fn(), getUserEmail: jest.fn(), getUserDisplayName: jest.fn(),
  },
}));

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { query } from '../../lib/db';
import { mcpRepository as repo } from '../../lib/mcp/repository';
import { createMcpServer } from '../../lib/mcp/server';
import { createAgentActivity } from '../../lib/live/agentActivity';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const A = '123e4567-e89b-12d3-a456-426614174000';
const B = '123e4567-e89b-12d3-a456-426614174001'; // not in the token's allowlist
const meta = (id, over = {}) => ({
  id, short_id: `LAB-${id.slice(-1)}`, name: 'D', type: 'process-flow', owner_id: OWNER, created_by: 'o@x.co', revision: '7',
  version_seq: 0, updated_at: new Date(), updated_by: null, domain_id: null, project_id: null, ...over,
});
const note = (id, x, y) => ({ id, type: 'sticky-small', packId: 'sticky-notes', label: id, x, y, size: { width: 100, height: 100 }, layerId: 'default', properties: {} });
const STORED = () => ({ elements: [note('n1', 0, 0), note('n2', 30, 30), note('n3', 60, 0)], connections: [], layers: [], viewport: { x: 0, y: 0, zoom: 1 } });

const MIND = { nodes: [{ key: 'hub', label: 'Topic' }, { key: 'c0', label: 'B0' }, { key: 'c1', label: 'B1' }], edges: [{ from: 'hub', to: 'c0' }, { from: 'hub', to: 'c1' }] };

// Arguments for every tool that works on ONE board. A tool missing from both tables fails the coverage test below.
const SINGLE_BOARD = {
  diagram_get: { kind: 'read', args: { id: A } },
  board_read_region: { kind: 'read', args: { id: A, focus: { bbox: { x: 0, y: 0, width: 500, height: 400 } } } },
  diagram_show: { kind: 'read', args: { id: A } },
  diagram_thumbnail: { kind: 'read', args: { id: A } },
  diagram_apply_ops: { kind: 'write', args: { id: A, baseRevision: 7, ops: [{ op: 'add_element', ref: '@a', type: 'process-flow/task', label: 'New' }] } },
  map_structure: { kind: 'write', args: { id: A, baseRevision: 7, structure: MIND, layout: 'mindmap' } },
  layout_apply: { kind: 'write', args: { id: A, baseRevision: 7, target: { elementIds: ['n1', 'n2', 'n3'] }, layout: 'grid' } },
  doc_create: { kind: 'write', args: { id: A, baseRevision: 7, title: 'Notes', markdown: '# Notes\n\nHello' } },
  // these two need a doc on the board first (created through doc_create, then the register is emptied)
  doc_update: { kind: 'write', setup: 'doc', args: (doc) => ({ id: A, baseRevision: 8, elementId: doc, append: '## More\n\ntext' }) },
  doc_get: { kind: 'read', setup: 'doc', args: (doc) => ({ id: A, elementId: doc }) },
};
// Tools that touch no particular board (or create a brand-new one nobody can be watching yet).
const NOT_BOARD = ['diagram_list', 'diagram_search', 'stencil_catalog', 'guide_get', 'diagram_create'];

let reg; let editRepo; let stored; let revision;
const principal = (over = {}) => ({ kind: 'agent', userId: OWNER, tokenId: 'tok-1', roleCap: 'editor', diagramScope: [A], clientLabel: 'Claude', ...over });
async function connect(p = principal(), deps = {}) {
  const server = createMcpServer(p, {
    agentActivity: reg,
    editRepository: editRepo,
    writeLimiter: { consume: () => ({ success: true, remaining: 29, resetIn: 60 }) },
    versionRepository: { latestAgentChangeSince: jest.fn(async () => null), get: jest.fn(async () => null) },
    labOrigin: 'https://lab.example.com',
    ...deps,
  });
  const client = new Client({ name: 'test', version: '1.0.0' });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(st), client.connect(ct)]);
  return client;
}
const call = (client, name, args) => client.callTool({ name, arguments: args });
const agentsFor = (viewer, diagramId = A) => reg.agentsFor(diagramId, viewer);

beforeEach(() => {
  jest.resetAllMocks();
  reg = createAgentActivity();
  stored = STORED();
  revision = 7;
  query.mockImplementation(async (sql, params) => {
    if (/diagram_members/.test(sql)) return { rows: [] };
    const row = [A, B].includes(params[0]) ? meta(params[0]) : null;
    return { rows: row ? [{ ...row, revision: String(revision) }] : [] };
  });
  repo.getUserEmail.mockResolvedValue('owner@x.co');
  repo.getUserDisplayName.mockResolvedValue('Peter');
  repo.getContent.mockImplementation(async () => ({ content: stored, description: '' }));
  repo.getThumbnail.mockResolvedValue(null);
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
});

describe('coverage: every tool is either a recorded single-board tool or an explicit non-board tool', () => {
  test('the tool list is fully classified', async () => {
    const client = await connect();
    const names = (await client.listTools()).tools.map((t) => t.name);
    const unclassified = names.filter((n) => !SINGLE_BOARD[n] && !NOT_BOARD.includes(n));
    expect(unclassified).toEqual([]); // a new tool must call noteAgent (and be added to SINGLE_BOARD) or be declared non-board
    for (const n of Object.keys(SINGLE_BOARD)) expect(names).toContain(n);
  });

  test.each(Object.keys(SINGLE_BOARD))('%s records exactly one entry for (board, token), after the call succeeded', async (tool) => {
    const { kind, setup, args: rawArgs } = SINGLE_BOARD[tool];
    const client = await connect();
    let args = rawArgs;
    if (setup === 'doc') {
      const made = await call(client, 'doc_create', { id: A, baseRevision: 7, title: 'Notes', markdown: '# Notes\n\nHello' });
      args = rawArgs(made.structuredContent.elementId);
      reg.clear();
    }
    expect(agentsFor(OWNER)).toEqual([]);
    const r = await call(client, tool, args);
    expect(r.isError).toBeFalsy();
    const [a] = agentsFor(OWNER);
    expect(a).toMatchObject({ mine: true, tool, state: kind === 'write' ? 'editing' : 'reading', label: 'Claude' });
    expect(agentsFor(OWNER)).toHaveLength(1);
  });

  test.each(['diagram_list', 'diagram_search'])('%s touches many boards and records nothing', async (tool) => {
    repo.listReadable.mockResolvedValue([]);
    repo.searchReadable.mockResolvedValue([]);
    const client = await connect();
    await call(client, tool, tool === 'diagram_search' ? { query: 'x' } : {});
    expect(reg.size()).toBe(0);
  });

  test.each(Object.keys(SINGLE_BOARD))('%s records nothing when the board is not accessible (access check first)', async (tool) => {
    const { args: rawArgs } = SINGLE_BOARD[tool];
    const args = typeof rawArgs === 'function' ? rawArgs('el-x') : rawArgs;
    const client = await connect(principal({ diagramScope: [B] })); // A is outside the allowlist
    const r = await call(client, tool, args);
    expect(r.isError).toBe(true);
    expect(reg.size()).toBe(0);
  });
});

describe('what is recorded', () => {
  test('writes that fail (revision conflict, rejected ops) are not recorded as edits', async () => {
    const client = await connect();
    await call(client, 'diagram_apply_ops', { ...SINGLE_BOARD.diagram_apply_ops.args, baseRevision: 3 });
    expect(reg.size()).toBe(0);
    await call(client, 'diagram_apply_ops', { id: A, baseRevision: 7, ops: [{ op: 'remove_element', id: 'does-not-exist' }] });
    expect(reg.size()).toBe(0);
  });

  test('board_read_region records the bbox of the region as the read focus (acting user only)', async () => {
    const client = await connect();
    await call(client, 'board_read_region', { id: A, focus: { elementIds: ['n1', 'n2'] } });
    const [mine] = agentsFor(OWNER);
    expect(mine.focus).toEqual({ x: 0, y: 0, w: 130, h: 130 });
    expect(agentsFor(OTHER)).toEqual([]);
  });

  test('a write is passed to the repository with the tool name (audit target)', async () => {
    const client = await connect();
    await call(client, 'map_structure', SINGLE_BOARD.map_structure.args);
    expect(editRepo.applyContentChange).toHaveBeenCalledWith(A, expect.objectContaining({ tool: 'map_structure' }));
  });

  test('the acting user name is resolved once and used for the label other users see', async () => {
    const client = await connect();
    await call(client, 'diagram_apply_ops', SINGLE_BOARD.diagram_apply_ops.args);
    await new Promise((r) => setImmediate(r));
    await call(client, 'diagram_get', { id: A });
    await new Promise((r) => setImmediate(r));
    expect(repo.getUserDisplayName).toHaveBeenCalledTimes(1);
    expect(agentsFor(OTHER)[0]).toMatchObject({ label: 'Agent for Peter', state: 'editing', tool: 'diagram_apply_ops' });
  });

  test('personal tokens (no client label) are shown as "Personal token"', async () => {
    const client = await connect(principal({ clientLabel: undefined }));
    await call(client, 'diagram_get', { id: A });
    expect(agentsFor(OWNER)[0].label).toBe('Personal token');
  });

  test('a failing register never breaks a tool call', async () => {
    const broken = { note: () => { throw new Error('boom'); }, needsName: () => false, setName() {} };
    const client = await connect(principal(), { agentActivity: broken });
    const r = await call(client, 'diagram_get', { id: A });
    expect(r.isError).toBeFalsy();
  });

  test('resource reads of a board are recorded as reads', async () => {
    const client = await connect();
    await client.readResource({ uri: `ontographia://diagrams/${A}` });
    expect(agentsFor(OWNER)[0]).toMatchObject({ state: 'reading', tool: 'resource:diagram' });
  });
});
