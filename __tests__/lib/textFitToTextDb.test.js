/**
 * @jest-environment node
 */
// ADR-0008 T1: fit_to_text through the real MCP write path (agentWrite) against a THROWAWAY database: one saved
// version attributed to the agent, one audit event, the revision bumped once, and locked elements left alone.
// Skipped when no Postgres is configured (set DATABASE_URL to a throwaway server).
const { setupOauthDb, BASE_URL } = require('../helpers/oauthDb');

const dbDescribe = BASE_URL ? describe : describe.skip;
const C140 = 'Aggregate all inbound partner shipment notifications, reconcile them against open purchase orders and flag any discrepancies for review';

const el = (id, type, packId, label, x, w, h, extra = {}) => ({ id, type, packId, label, x, y: 0, size: { width: w, height: h }, layerId: 'default', properties: {}, ...extra });
const board = () => ({
  elements: [
    el('a', 'rectangle', 'core', 'Billing', 0, 120, 80),
    el('b', 'task', 'process-flow', C140, 400, 140, 70),
    el('c', 'rectangle', 'core', C140, 800, 120, 80, { locked: true }),
    el('d', 'sticky-medium', 'sticky-notes', C140, 1200, 150, 150),
  ],
  connections: [], layers: [], groups: [], viewport: { x: 0, y: 0, zoom: 1 },
});

dbDescribe('fit_to_text via agentWrite (throwaway database)', () => {
  let db; let apiTokens; let Client; let InMemoryTransport; let createMcpServer; let verifyBearer; let user; let diagram;

  beforeAll(async () => {
    db = await setupOauthDb('fittotext');
    apiTokens = require('../../lib/apiTokens');
    ({ verifyBearer } = require('../../lib/oauth/verify'));
    ({ Client } = require('@modelcontextprotocol/sdk/client/index.js'));
    ({ InMemoryTransport } = require('@modelcontextprotocol/sdk/inMemory.js'));
    ({ createMcpServer } = require('../../lib/mcp/server'));
    user = await db.user('fit@x.co');
    diagram = await db.diagram(user, board());
  });
  afterAll(() => db.teardown());

  async function editorClient() {
    const t = await apiTokens.createToken(user.id, { name: 'fit', roleCap: 'editor', diagramIds: [diagram.id], expiresAt: null });
    const auth = await verifyBearer(t.token);
    if (!auth.ok) throw new Error(`token not accepted: ${auth.reason}`);
    const server = createMcpServer(auth.principal, {});
    const client = new Client({ name: 'test', version: '1.0.0' });
    const [ct, st] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(st), client.connect(ct)]);
    return client;
  }
  const rows = async (sql) => (await db.pg.query(sql, [diagram.id])).rows;

  test('fit_to_text all: one agent version, one audit event, one revision; locked elements untouched', async () => {
    const client = await editorClient();
    const got = await client.callTool({ name: 'diagram_get', arguments: { id: diagram.id } });
    const rev = got.structuredContent.diagram.revision;
    const versionsBefore = (await rows("select 1 from diagram_versions where diagram_id=$1 and created_via='agent'")).length;
    const auditBefore = (await rows('select 1 from audit_events where diagram_id=$1')).length;

    const r = await client.callTool({ name: 'diagram_apply_ops', arguments: { id: diagram.id, baseRevision: rev, ops: [{ op: 'fit_to_text', all: true }] } });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent.fittedCount).toBe(2); // the task and the sticky; the locked rectangle is skipped, "Billing" already fits
    expect(r.structuredContent.fitted.map((f) => f.id).sort()).toEqual(['b', 'd']);

    const head = (await rows('select content, revision::int rev from diagrams where id=$1'))[0];
    expect(head.rev).toBe(rev + 1);
    const byId = Object.fromEntries(head.content.elements.map((e) => [e.id, e]));
    expect(byId.a.size).toEqual({ width: 120, height: 80 });
    expect(byId.b.size.width).toBeGreaterThan(140);
    expect(byId.c.size).toEqual({ width: 120, height: 80 });
    expect(byId.d.textFit).toBe('auto');

    const versionsAfter = (await rows("select 1 from diagram_versions where diagram_id=$1 and created_via='agent'")).length;
    expect(versionsAfter - versionsBefore).toBe(1);
    expect((await rows('select 1 from audit_events where diagram_id=$1')).length - auditBefore).toBe(1);
  });

  test('an explicit locked id is skipped with a warning (the batch still succeeds)', async () => {
    const client = await editorClient();
    const got = await client.callTool({ name: 'diagram_get', arguments: { id: diagram.id } });
    const rev = got.structuredContent.diagram.revision;
    const r = await client.callTool({ name: 'diagram_apply_ops', arguments: { id: diagram.id, baseRevision: rev, ops: [{ op: 'fit_to_text', ids: ['c'] }] } });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent.warnings.join(' ')).toMatch(/locked/);
    const head = (await rows('select content from diagrams where id=$1'))[0];
    expect(head.content.elements.find((e) => e.id === 'c').size).toEqual({ width: 120, height: 80 });
  });

  test('a second fit_to_text all changes nothing and still saves cleanly (no fitted entries)', async () => {
    const client = await editorClient();
    const got = await client.callTool({ name: 'diagram_get', arguments: { id: diagram.id } });
    const r = await client.callTool({ name: 'diagram_apply_ops', arguments: { id: diagram.id, baseRevision: got.structuredContent.diagram.revision, ops: [{ op: 'fit_to_text', all: true }] } });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent.fittedCount).toBeUndefined();
  });
});
