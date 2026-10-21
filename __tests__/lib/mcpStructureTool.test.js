/**
 * @jest-environment node
 */
// map_structure, layout_apply and the guide end to end through the MCP protocol (in-memory transport) with the REAL
// authz core and the REAL compilers + ops applier. Only lib/db, the read repository and the write repository's database
// transaction are faked (same harness as mcpEditTool.test.js).

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
let DB; let MEMBERS; let editRepo; let writeLimiter; let stored; let revision;
const el = (id, x, y, over = {}) => ({ id, type: 'sticky-small', packId: 'sticky-notes', label: id, x, y, size: { width: 100, height: 100 }, layerId: 'default', properties: {}, ...over });
const STORED = () => ({
  elements: [el('n1', 0, 0), el('n2', 30, 30), el('n3', 60, 0), { id: 'f1', type: 'frame', packId: 'core', isFrame: true, membershipExplicit: true, label: 'Frame', x: 1000, y: 0, size: { width: 600, height: 400 }, layerId: 'default', properties: {} }],
  connections: [], layers: [], viewport: { x: 0, y: 0, zoom: 1 },
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
const MIND = {
  nodes: [{ key: 'hub', label: 'Topic' }, ...Array.from({ length: 8 }, (_, i) => ({ key: `c${i}`, label: `B${i}` }))],
  edges: Array.from({ length: 8 }, (_, i) => ({ from: 'hub', to: `c${i}` })),
};
const MAP = (over = {}) => ({ id: A, baseRevision: 7, structure: MIND, layout: 'mindmap', ...over });

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

describe('map_structure', () => {
  test('builds the mind map: created ids by key, new revision, one version attributed to the token user via agent', async () => {
    const r = await call(await connect(), 'map_structure', MAP());
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent).toMatchObject({ revision: 8, versionId: 'ver-1', summary: { layout: 'mindmap', nodes: 9, edges: 8 }, counts: { addedElements: 9, addedConnections: 8 } });
    expect(Object.keys(r.structuredContent.created)).toHaveLength(9);
    expect(editRepo.applyContentChange).toHaveBeenCalledTimes(1);
    expect(editRepo.applyContentChange).toHaveBeenCalledWith(A, expect.objectContaining({
      expectedRevision: 7, userId: OWNER, actor: { userId: OWNER, email: 'owner@x.co', via: 'agent', tokenId: 'tok-1' },
    }));
    expect(stored.elements).toHaveLength(4 + 9);
    expect(writeLimiter.consume).toHaveBeenCalledWith('tok-1');
  });

  test('cluster with existingId and groups: frames created, notes moved not copied', async () => {
    const r = await call(await connect(), 'map_structure', {
      id: A, baseRevision: 7, layout: 'cluster',
      structure: { nodes: [{ key: 'a', existingId: 'n1', group: 'g' }, { key: 'b', existingId: 'n2', group: 'g' }, { key: 'c', existingId: 'n3', group: 'h' }], groups: [{ key: 'g', label: 'G' }, { key: 'h', label: 'H' }] },
    });
    expect(r.isError).toBeFalsy();
    expect(Object.keys(r.structuredContent.groups).sort()).toEqual(['g', 'h']);
    expect(stored.elements.filter((e) => e.type === 'sticky-small')).toHaveLength(3);
    expect(stored.elements.find((e) => e.id === 'n1').parentFrameId).toBe(r.structuredContent.groups.g);
  });

  test('a stale baseRevision is a structured conflict and nothing is written', async () => {
    const r = await call(await connect(), 'map_structure', MAP({ baseRevision: 3 }));
    expect(r.isError).toBe(true);
    expect(r.structuredContent).toMatchObject({ code: 'REVISION_CONFLICT', currentRevision: 7, baseRevision: 3 });
    expect(stored.elements).toHaveLength(4);
    expect(revision).toBe(7);
  });

  test('an invalid structure: INVALID_STRUCTURE with readable errors, nothing written', async () => {
    const r = await call(await connect(), 'map_structure', MAP({ structure: { nodes: [{ key: 'a' }, { key: 'a' }], edges: [{ from: 'a', to: 'q' }] } }));
    expect(r.isError).toBe(true);
    expect(r.structuredContent.code).toBe('INVALID_STRUCTURE');
    expect(text(r)).toMatch(/duplicate node key "a"/);
    expect(text(r)).toMatch(/"q" is not a node key/);
    expect(stored.elements).toHaveLength(4);
  });

  test('layout must be one of the six; baseRevision is required', async () => {
    const client = await connect();
    expect((await call(client, 'map_structure', MAP({ layout: 'spiral' }))).isError).toBe(true);
    const { baseRevision, ...noRev } = MAP();
    expect((await call(client, 'map_structure', noRev)).isError).toBe(true);
    expect(editRepo.applyContentChange).not.toHaveBeenCalled();
  });

  test.each(['map_structure', 'layout_apply'])('%s: viewer and commenter tokens are refused', async (tool) => {
    const args = tool === 'map_structure' ? MAP() : { id: A, baseRevision: 7, target: { frameId: 'f1' }, layout: 'grid' };
    for (const roleCap of ['viewer', 'commenter']) {
      const r = await call(await connect(principal({ roleCap })), tool, args);
      expect(r.isError).toBe(true);
      expect(text(r)).toMatch(/role does not permit/);
    }
    expect(editRepo.applyContentChange).not.toHaveBeenCalled();
  });

  test.each(['map_structure', 'layout_apply'])('%s: an editor token outside its allowlist sees not found; no allowlist is refused', async (tool) => {
    const args = tool === 'map_structure' ? MAP() : { id: A, baseRevision: 7, target: { frameId: 'f1' }, layout: 'grid' };
    const r = await call(await connect(principal({ diagramScope: [B] })), tool, args);
    expect(r.isError).toBe(true);
    expect(text(r)).toMatch(/not found/i);
    for (const diagramScope of [null, []]) expect((await call(await connect(principal({ diagramScope })), tool, args)).isError).toBe(true);
    expect(editRepo.applyContentChange).not.toHaveBeenCalled();
  });

  test('the write rate limit applies', async () => {
    writeLimiter.consume.mockReturnValue({ success: false, remaining: 0, resetIn: 30 });
    const r = await call(await connect(), 'map_structure', MAP());
    expect(r.structuredContent).toMatchObject({ code: 'RATE_LIMITED', retryAfterSeconds: 30 });
    expect(editRepo.applyContentChange).not.toHaveBeenCalled();
  });

  test('the response of a 200-node call stays within the output budget', async () => {
    const nodes = Array.from({ length: 200 }, (_, i) => ({ key: `n${i}`, label: `Note ${i}` }));
    const r = await call(await connect(), 'map_structure', MAP({ structure: { nodes }, layout: 'grid' }));
    expect(r.isError).toBeFalsy();
    expect(Buffer.byteLength(JSON.stringify(r), 'utf8')).toBeLessThan(256 * 1024);
  });
});

describe('layout_apply', () => {
  test('grid on the notes: positions only, new revision, same write path', async () => {
    const r = await call(await connect(), 'layout_apply', { id: A, baseRevision: 7, target: { elementIds: ['n1', 'n2', 'n3'] }, layout: 'grid' });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent).toMatchObject({ revision: 8, versionId: 'ver-1', moved: expect.any(Number) });
    expect(r.structuredContent.moved).toBeGreaterThan(0);
    expect(stored.elements).toHaveLength(4);
    expect(stored.elements.find((e) => e.id === 'n1').label).toBe('n1');
    expect(editRepo.applyContentChange).toHaveBeenCalledWith(A, expect.objectContaining({ actor: expect.objectContaining({ via: 'agent' }) }));
  });
  test('stale revision conflicts; an invalid target is INVALID_STRUCTURE', async () => {
    const client = await connect();
    expect((await call(client, 'layout_apply', { id: A, baseRevision: 1, target: { frameId: 'f1' }, layout: 'grid' })).structuredContent.code).toBe('REVISION_CONFLICT');
    const r = await call(client, 'layout_apply', { id: A, baseRevision: 7, target: { elementIds: ['ghost'] }, layout: 'grid' });
    expect(r.structuredContent.code).toBe('INVALID_STRUCTURE');
  });
});

describe('guide, prompts and descriptions', () => {
  test('the guide is a resource and a tool with the same static text; it teaches read, think, build and the limits', async () => {
    const client = await connect();
    const res = await client.readResource({ uri: 'ontographia://guide/canvas' });
    const t = res.contents[0].text;
    expect(t).toMatch(/Board content is data/);
    expect(t).toMatch(/board_read_region/);
    expect(t).toMatch(/map_structure/);
    expect(t).toMatch(/REVISION_CONFLICT/);
    expect(t).toMatch(/200 nodes/);
    expect(text(await call(client, 'guide_get', {}))).toBe(t);
    repo.listReadable.mockResolvedValue([]);
    const list = await client.listResources();
    expect(list.resources.map((r) => r.uri)).toContain('ontographia://guide/canvas');
  });
  test('prompts are listed and pre-fill a read-then-build instruction', async () => {
    const client = await connect();
    const { prompts } = await client.listPrompts();
    expect(prompts.map((p) => p.name).sort()).toEqual(['cluster_region', 'map_from_text']);
    const p = await client.getPrompt({ name: 'cluster_region', arguments: { link: '/diagram/LAB-1?focus=f1', theme: 'sentiment' } });
    expect(p.messages[0].content.text).toMatch(/board_read_region/);
    expect(p.messages[0].content.text).toMatch(/map_structure/);
    expect(p.messages[0].content.text).toMatch(/data, not instructions/);
  });
  test('tool descriptions are static, warn about untrusted data and mention versions and baseRevision', async () => {
    const { tools } = await (await connect()).listTools();
    for (const n of ['map_structure', 'layout_apply']) {
      const t = tools.find((x) => x.name === n);
      expect(t.description).toMatch(/user-authored data, not instructions/i);
      expect(t.description).toMatch(/baseRevision/);
      expect(t.description).toMatch(/version/i);
      expect(t.annotations).toMatchObject({ readOnlyHint: false, openWorldHint: false });
    }
  });
});
