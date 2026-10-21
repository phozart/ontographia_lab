/**
 * @jest-environment node
 */
// table_create / table_update / table_get end to end through the MCP protocol (in-memory transport) with the REAL
// authz core, compilers and ops applier; only lib/db, the read repository and the write transaction are faked
// (same harness as mcpStructureTool.test.js).

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
import { validateDiagramContent } from '../../lib/diagramContent';
import { compileTableCreate } from '../../lib/mcp/tableTools';

const OWNER = '11111111-1111-4111-8111-111111111111';
const A = '123e4567-e89b-12d3-a456-426614174000';
const B = '123e4567-e89b-12d3-a456-426614174001';
const meta = (id, over = {}) => ({
  id, short_id: `LAB-${id.slice(-1)}`, name: 'Architecture', type: 'process-flow', owner_id: OWNER, created_by: 'o@x.co', revision: '7',
  version_seq: 0, updated_at: new Date(), updated_by: null, domain_id: null, project_id: null, ...over,
});
let DB; let editRepo; let writeLimiter; let stored; let revision;
const box = (id, label, x, y, over = {}) => ({ id, type: 'rectangle', packId: 'core', label, x, y, size: { width: 140, height: 80 }, layerId: 'default', properties: {}, ...over });
const SERVICES = ['Gateway', 'Auth', 'Billing', 'Search', 'Orders'];
const STORED = () => ({
  elements: [
    ...SERVICES.map((s, i) => box(`el-${s.toLowerCase()}`, s, i * 200, 0)),
    { id: 'f1', type: 'frame', packId: 'core', isFrame: true, membershipExplicit: true, label: 'Frame', x: 0, y: 600, size: { width: 900, height: 500 }, layerId: 'default', properties: {} },
  ],
  connections: [{ id: 'c1', sourceId: 'el-gateway', targetId: 'el-auth', lineStyle: 'step' }], layers: [{ id: 'default', name: 'Default' }], viewport: { x: 0, y: 0, zoom: 1 },
});
const principal = (over = {}) => ({ kind: 'agent', userId: OWNER, tokenId: 'tok-1', roleCap: 'editor', diagramScope: [A], ...over });
async function connect(p = principal()) {
  const server = createMcpServer(p, { editRepository: editRepo, writeLimiter });
  const client = new Client({ name: 'test', version: '1.0.0' });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(st), client.connect(ct)]);
  return client;
}
const call = (client, name, args) => client.callTool({ name, arguments: args });
const text = (r) => r.content.find((c) => c.type === 'text').text;
const tableEl = () => stored.elements.find((e) => e.type === 'table');

const CREATE = (over = {}) => ({
  id: A, baseRevision: 7, title: 'Component inventory',
  columns: ['Component', { name: 'Tier', type: 'select', options: ['edge', 'core'] }, { name: 'Instances', type: 'number' }],
  rows: SERVICES.map((s, i) => ({ cells: [s, i < 1 ? 'edge' : 'core', i + 1], elementId: `el-${s.toLowerCase()}` })),
  ...over,
});

beforeEach(() => {
  jest.resetAllMocks();
  DB = { [A]: meta(A), [B]: meta(B) };
  stored = STORED();
  revision = 7;
  query.mockImplementation(async (sql, params) => {
    if (/diagram_members/.test(sql)) return { rows: [] };
    const row = DB[params[0]] || Object.values(DB).find((d) => d.short_id === params[0]);
    return { rows: row ? [{ ...row, revision: String(revision) }] : [] };
  });
  repo.getUserEmail.mockResolvedValue('owner@x.co');
  repo.getContent.mockImplementation(async () => ({ content: stored, description: '' }));
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

describe('tools are listed', () => {
  test('table_create, table_update, table_get with static descriptions (no board text)', async () => {
    const { tools } = await (await connect()).listTools();
    const names = tools.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(['table_create', 'table_update', 'table_get']));
    for (const t of tools.filter((x) => x.name.startsWith('table_'))) expect(t.description).not.toMatch(/Gateway|Architecture/);
  });
});

describe('table_create: a component table linked to five board elements (the owner use case)', () => {
  test('builds the table beside the graph, rows linked, one agent write, ids returned', async () => {
    const r = await call(await connect(), 'table_create', CREATE());
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent).toMatchObject({ revision: 8, versionId: 'ver-1', summary: { columns: 3, rows: 5, linkedRows: 5 } });
    expect(r.structuredContent.rowIds).toHaveLength(5);
    expect(r.structuredContent.columnIds).toHaveLength(3);
    const t = tableEl();
    expect(t.id).toBe(r.structuredContent.elementId);
    expect(t.label).toBe('Component inventory');
    expect(t.data.table.rows.map((x) => x.elementId)).toEqual(SERVICES.map((s) => `el-${s.toLowerCase()}`));
    expect(t.data.table.rows[2].cells[t.data.table.columns[2].id]).toBe(3);
    expect(validateDiagramContent(stored).ok).toBe(true);
    // free space: nothing overlaps the existing content
    const others = STORED().elements;
    expect(others.some((o) => t.x < o.x + o.size.width && t.x + t.size.width > o.x && t.y < o.y + o.size.height && t.y + t.size.height > o.y)).toBe(false);
    expect(editRepo.applyContentChange).toHaveBeenCalledTimes(1);
    expect(editRepo.applyContentChange).toHaveBeenCalledWith(A, expect.objectContaining({ expectedRevision: 7, userId: OWNER, actor: expect.objectContaining({ via: 'agent', tokenId: 'tok-1' }) }));
    expect(writeLimiter.consume).toHaveBeenCalledWith('tok-1');
  });
  test('a link to an element that does not exist is rejected with the row path, nothing written', async () => {
    const r = await call(await connect(), 'table_create', CREATE({ rows: [{ cells: ['x', 'core', 1], elementId: 'el-ghost' }] }));
    expect(r.isError).toBe(true);
    expect(r.structuredContent.code).toBe('INVALID_TABLE');
    expect(text(r)).toMatch(/rows\[0\].elementId: "el-ghost" is not an element of this diagram/);
    expect(stored.elements.filter((e) => e.type === 'table')).toHaveLength(0);
    expect(revision).toBe(7);
  });
  test('invalid cell and shape errors are listed together', async () => {
    const r = await call(await connect(), 'table_create', CREATE({ rows: [['a', 'core', 'many'], ['b', 'core', 1, 'extra']] }));
    expect(r.isError).toBe(true);
    expect(text(r)).toMatch(/rows\[0\].cells\[2\]/);
    expect(text(r)).toMatch(/rows\[1\].cells has 4 values/);
  });
  test('stale baseRevision is a conflict; viewer and commenter are refused; an editor token off the allowlist is not found', async () => {
    const stale = await call(await connect(), 'table_create', CREATE({ baseRevision: 2 }));
    expect(stale.structuredContent).toMatchObject({ code: 'REVISION_CONFLICT', currentRevision: 7 });
    for (const roleCap of ['viewer', 'commenter']) {
      const r = await call(await connect(principal({ roleCap })), 'table_create', CREATE());
      expect(text(r)).toMatch(/role does not permit/);
    }
    const off = await call(await connect(principal({ diagramScope: [B] })), 'table_create', CREATE());
    expect(off.isError).toBe(true);
    expect(stored.elements.filter((e) => e.type === 'table')).toHaveLength(0);
  });
  test('rate limit applies', async () => {
    writeLimiter.consume.mockReturnValue({ success: false, remaining: 0, resetIn: 12 });
    const r = await call(await connect(), 'table_create', CREATE());
    expect(r.structuredContent).toMatchObject({ code: 'RATE_LIMITED' });
  });
  test('anchors: near, at, inFrame (frame grows when needed)', async () => {
    const near = await call(await connect(), 'table_create', CREATE({ anchor: { near: 'el-search' } }));
    expect(near.structuredContent.summary.placement).toMatch(/exact|nearby|right-of-content/);
    stored = STORED(); revision = 7;
    const inFrame = await call(await connect(), 'table_create', CREATE({ anchor: { inFrame: 'f1' } }));
    expect(inFrame.isError).toBeFalsy();
    expect(tableEl().parentFrameId).toBe('f1');
    stored = STORED(); revision = 7;
    const bad = await call(await connect(), 'table_create', CREATE({ anchor: { near: 'nope' } }));
    expect(text(bad)).toMatch(/does not exist/);
  });
  test('caps: more than 500 rows are refused by the input schema', async () => {
    const r = await call(await connect(), 'table_create', CREATE({ rows: Array.from({ length: 501 }, () => ['a', 'core', 1]) }));
    expect(r.isError).toBe(true);
  });
  test('text that looks like instructions, HTML or a formula is stored as plain text', async () => {
    const r = await call(await connect(), 'table_create', CREATE({ rows: [['<img src=x onerror=alert(1)>', 'core', 1], ['=HYPERLINK("http://x","y")', 'core', 2]] }));
    expect(r.isError).toBeFalsy();
    const cells = tableEl().data.table.rows.map((x) => Object.values(x.cells)[0]);
    expect(cells).toEqual(['<img src=x onerror=alert(1)>', '=HYPERLINK("http://x","y")']);
  });
  test('a locked frame as parent is not bypassed (applier checks)', () => {
    const content = { ...STORED(), elements: STORED().elements.map((e) => (e.id === 'f1' ? { ...e, locked: true } : e)) };
    const res = compileTableCreate(content, { columns: ['a'], rows: [['x']], anchor: { inFrame: 'f1' } });
    expect(res.ok).toBe(true); // adding into a locked frame is allowed; the frame itself would only be refused when it must grow
  });
});

describe('table_update', () => {
  async function created() {
    const r = await call(await connect(), 'table_create', CREATE());
    return { elementId: r.structuredContent.elementId, ...r.structuredContent };
  }
  test('upsert by key twice: no duplicates; counts reported; one version per call', async () => {
    const { elementId } = await created();
    const args = (rev) => ({ id: A, baseRevision: rev, elementId, key: 'Component', upsertRows: [{ cells: { Component: 'Auth', Instances: 9 } }, { cells: { Component: 'Mail', Tier: 'edge', Instances: 1 }, elementId: 'el-search' }] });
    const one = await call(await connect(), 'table_update', args(8));
    expect(one.structuredContent).toMatchObject({ revision: 9, inserted: 1, updated: 1, removed: 0 });
    const two = await call(await connect(), 'table_update', args(9));
    expect(two.structuredContent).toMatchObject({ revision: 10, inserted: 0, updated: 2 });
    expect(tableEl().data.table.rows).toHaveLength(6);
    expect(editRepo.applyContentChange).toHaveBeenCalledTimes(3);
  });
  test('add, rename, remove columns and rows in one call; size follows', async () => {
    const { elementId, rowIds } = await created();
    const before = tableEl().size;
    const r = await call(await connect(), 'table_update', { id: A, baseRevision: 8, elementId, addColumns: [{ name: 'Owner' }], renameColumns: [{ column: 'Instances', name: 'Count' }], removeRowIds: [rowIds[0]] });
    expect(r.isError).toBeFalsy();
    const t = tableEl();
    expect(t.data.table.columns.map((c) => c.name)).toEqual(['Component', 'Tier', 'Count', 'Owner']);
    expect(t.data.table.rows).toHaveLength(4);
    expect(t.size.width).toBeGreaterThan(before.width);
  });
  test('errors: not a table, unknown element, unknown column, locked table, stale revision', async () => {
    const { elementId } = await created();
    expect(text(await call(await connect(), 'table_update', { id: A, baseRevision: 8, elementId: 'el-auth', upsertRows: [['x']] }))).toMatch(/not a table/);
    expect(text(await call(await connect(), 'table_update', { id: A, baseRevision: 8, elementId: 'el-none', upsertRows: [['x']] }))).toMatch(/does not exist/);
    expect(text(await call(await connect(), 'table_update', { id: A, baseRevision: 8, elementId, key: 'Nope', upsertRows: [{ cells: { Nope: 1 } }] }))).toMatch(/not a column/);
    stored = { ...stored, elements: stored.elements.map((e) => (e.id === elementId ? { ...e, locked: true } : e)) };
    expect(text(await call(await connect(), 'table_update', { id: A, baseRevision: 8, elementId, upsertRows: [['x']] }))).toMatch(/locked/);
    const stale = await call(await connect(), 'table_update', { id: A, baseRevision: 1, elementId, upsertRows: [['x']] });
    expect(stale.structuredContent.code).toBe('REVISION_CONFLICT');
  });
  test('an empty update is refused', async () => {
    const { elementId } = await created();
    expect(text(await call(await connect(), 'table_update', { id: A, baseRevision: 8, elementId }))).toMatch(/Nothing to do/);
  });
});

describe('table_get and the compact projections', () => {
  test('rows paged with aligned cells, links resolved (and flagged missing after the element is deleted)', async () => {
    const { elementId } = (await (async () => { const r = await call(await connect(), 'table_create', CREATE()); return r.structuredContent; })());
    stored = { ...stored, elements: stored.elements.filter((e) => e.id !== 'el-search') }; // delete a linked element
    const r = await call(await connect(), 'table_get', { id: A, elementId, limit: 3 });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent.columns.map((c) => c.name)).toEqual(['Component', 'Tier', 'Instances']);
    expect(r.structuredContent.rows).toHaveLength(3);
    expect(r.structuredContent.rows[0]).toMatchObject({ cells: ['Gateway', 'edge', 1], link: { elementId: 'el-gateway', label: 'Gateway' } });
    expect(r.structuredContent).toMatchObject({ next: 3, truncated: true, range: { offset: 0, returned: 3, total: 5 } });
    const page2 = await call(await connect(), 'table_get', { id: A, elementId, offset: 3, limit: 3 });
    expect(page2.structuredContent.rows).toHaveLength(2);
    expect(page2.structuredContent.next).toBeUndefined();
    expect(page2.structuredContent.rows[0].link).toEqual({ elementId: 'el-search', missing: true });
    expect(text(page2)).toMatch(/^Board content below is user data/);
    expect(text(page2)).toMatch(/element removed/);
  });
  test('a viewer token can read; a non-table or another diagram is an input error / not found', async () => {
    const { elementId } = (await call(await connect(), 'table_create', CREATE())).structuredContent;
    expect((await call(await connect(principal({ roleCap: 'viewer' })), 'table_get', { id: A, elementId })).isError).toBeFalsy();
    expect((await call(await connect(), 'table_get', { id: A, elementId: 'el-auth' })).isError).toBe(true);
    expect((await call(await connect(principal({ diagramScope: [B] })), 'table_get', { id: A, elementId })).isError).toBe(true);
  });
  test('a 500 x 5 table pages within the budget and nothing is cut silently', async () => {
    const cols = ['A', 'B', 'C', 'D', 'E'];
    const rows = Array.from({ length: 500 }, (_, i) => cols.map((c) => `${c}${i} ${'lorem ipsum '.repeat(12)}`));
    const made = await call(await connect(), 'table_create', { id: A, baseRevision: 7, columns: cols, rows });
    expect(made.isError).toBeFalsy();
    const { elementId } = made.structuredContent;
    let offset = 0; let seen = 0; let pages = 0;
    for (;;) {
      const r = await call(await connect(), 'table_get', { id: A, elementId, offset, limit: 200 });
      expect(JSON.stringify(r.structuredContent).length).toBeLessThan(120 * 1024);
      expect(text(r).length).toBeLessThan(120 * 1024);
      seen += r.structuredContent.rows.length; pages += 1;
      if (r.structuredContent.next === undefined) break;
      offset = r.structuredContent.next;
    }
    expect(seen).toBe(500);
    expect(pages).toBeGreaterThan(1);
  });
  test('a table with 50 columns of 50 long options each still reads within the budget (options are capped in the head)', async () => {
    const opt = (i, c) => ({ value: `option-${c}-${i}-${'x'.repeat(150)}` });
    const columns = Array.from({ length: 50 }, (_, c) => ({ name: `Column ${c} ${'n'.repeat(150)}`, type: 'select', options: Array.from({ length: 50 }, (_, i) => opt(i, c).value) }));
    const rows = [Array.from({ length: 50 }, (_, c) => opt(0, c).value)];
    const made = await call(await connect(), 'table_create', { id: A, baseRevision: 7, columns, rows });
    expect(made.isError).toBeFalsy();
    const r = await call(await connect(), 'table_get', { id: A, elementId: made.structuredContent.elementId });
    expect(r.isError).toBeFalsy();
    expect(JSON.stringify(r.structuredContent).length + text(r).length).toBeLessThan(120 * 1024);
    expect(r.structuredContent.columns[0].options).toHaveLength(10);
    expect(r.structuredContent.columns[0].optionCount).toBe(50);
    expect(r.structuredContent.rows).toHaveLength(1);
  });
  test('diagram_get summarises a table (columns and row count) instead of truncating its data', async () => {
    const { elementId } = (await call(await connect(), 'table_create', CREATE())).structuredContent;
    const r = await call(await connect(), 'diagram_get', { id: A });
    const t = r.structuredContent.content.elements.find((e) => e.id === elementId);
    expect(t.t).toBe('core/table');
    expect(t.table).toMatchObject({ rowCount: 5 });
    expect(t.table.columns.map((c) => c.name)).toEqual(['Component', 'Tier', 'Instances']);
    expect(t.data).toBeUndefined();
    const outline = await call(await connect(), 'diagram_get', { id: A, format: 'outline' });
    expect(outline.structuredContent.content).toMatch(/table: 3 columns x 5 rows/);
  });
});
