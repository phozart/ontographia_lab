// M2: diagramRepository.applyContentChange (agent edits) against a THROWAWAY database. Skipped when no Postgres is configured.
const util = require('util');
global.TextEncoder = global.TextEncoder || util.TextEncoder;
global.TextDecoder = global.TextDecoder || util.TextDecoder;
const crypto = require('crypto');
const path = require('path');
const { Client } = require('pg');
const { migrate, getConnectionString } = require('../../scripts/migrate');

const BASE_URL = process.env.DATABASE_URL || (process.env.DB_HOST ? getConnectionString() : null);
const dbDescribe = BASE_URL ? describe : describe.skip;

const content = (ids) => ({
  elements: ids.map((id, i) => ({ id, x: i * 10, y: 0, size: { width: 50, height: 30 } })),
  connections: [], layers: [], groups: [], viewport: { x: 0, y: 0, zoom: 1 },
});

dbDescribe('diagramRepository.applyContentChange (throwaway database)', () => {
  const dbName = `diagram_studio_agenttest_${process.pid}_${crypto.randomBytes(3).toString('hex')}`;
  let admin; let pg; let dbMod; let repo; let versions; let user; let seq = 0;
  const actor = () => ({ userId: user.id, email: user.email, via: 'agent' });
  const add = (extra) => ({ ok: true, content: { ...extra.content, elements: [...extra.content.elements, { id: 'new', x: 5, y: 5 }] } });

  async function newDiagram(c0 = content(['a'])) {
    seq += 1;
    return (await pg.query(
      "insert into diagrams (short_id,name,type,created_by,owner_id,content) values ($1,'D','infinite-canvas',$2,$3,$4) returning id",
      [`LAB-${seq}`, user.email, user.id, JSON.stringify(c0)])).rows[0].id;
  }
  const head = async (id) => (await pg.query('select content, revision::int rev, updated_by from diagrams where id=$1', [id])).rows[0];
  const vers = async (id) => (await pg.query(
    'select version_number n, kind, content, created_via via, created_by_user_id u, diagram_revision::int dr from diagram_versions where diagram_id=$1 order by version_number', [id])).rows;

  beforeAll(async () => {
    admin = new Client({ connectionString: BASE_URL });
    await admin.connect();
    await admin.query(`CREATE DATABASE "${dbName}"`);
    const u = new URL(BASE_URL); u.pathname = `/${dbName}`;
    await migrate({ connectionString: u.toString(), dir: path.join(__dirname, '..', '..', 'db', 'migrations'), logger: { log() {}, warn() {} } });
    process.env.DATABASE_URL = u.toString();
    pg = new Client({ connectionString: u.toString() });
    await pg.connect();
    user = (await pg.query("insert into users (email,name,status) values ('a@x.co','Alice','active') returning id,email")).rows[0];
    dbMod = require('../../lib/db');
    repo = require('../../lib/diagramRepository').diagramRepository;
    versions = require('../../lib/versionRepository').versionRepository;
  });
  afterAll(async () => {
    try { await dbMod?.getPool().end(); } catch (_) { /* ignore */ }
    await pg?.end();
    await admin.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
    await admin.end();
  });

  test('success: bumps revision, stores content, records updated_by, creates a pre-agent and an agent version', async () => {
    const id = await newDiagram();
    const r = await repo.applyContentChange(id, { expectedRevision: 0, userId: user.id, actor: actor(), compute: (c) => add({ content: c }) });
    expect(r.status).toBe('ok');
    expect(Number(r.row.revision)).toBe(1);
    expect(r.versionId).toBeTruthy();
    const h = await head(id);
    expect(h.rev).toBe(1);
    expect(h.content.elements.map((e) => e.id)).toEqual(['a', 'new']);
    expect(h.updated_by).toBe(user.id);
    const v = await vers(id);
    expect(v).toHaveLength(2);
    expect(v[0]).toMatchObject({ kind: 'auto', via: 'system', dr: 0 });
    expect(v[0].content.elements.map((e) => e.id)).toEqual(['a']);
    expect(v[1]).toMatchObject({ kind: 'auto', via: 'agent', u: user.id, dr: 1 });
    expect(v[1].content.elements.map((e) => e.id)).toEqual(['a', 'new']);
  });

  test('no duplicate pre-agent version when the head already equals the latest version', async () => {
    const id = await newDiagram();
    await versions.createNamed(id, { label: 'Before' }, { userId: user.id, email: user.email, via: 'web' });
    await repo.applyContentChange(id, { expectedRevision: 0, userId: user.id, actor: actor(), compute: (c) => add({ content: c }) });
    const v = await vers(id);
    expect(v.map((x) => x.kind)).toEqual(['named', 'auto']);
    expect(v[1].via).toBe('agent');
  });

  test('every successful agent write is versioned, even inside the auto-checkpoint interval', async () => {
    const id = await newDiagram();
    const compute = (c) => ({ ok: true, content: { ...c, elements: [...c.elements, { id: `n${c.elements.length}`, x: 1, y: 1 }] } });
    await repo.applyContentChange(id, { expectedRevision: 0, userId: user.id, actor: actor(), compute });
    await repo.applyContentChange(id, { expectedRevision: 1, userId: user.id, actor: actor(), compute });
    const agentVersions = (await vers(id)).filter((x) => x.via === 'agent');
    expect(agentVersions).toHaveLength(2);
  });

  test('stale revision: conflict with the current revision, nothing written, no version', async () => {
    const id = await newDiagram();
    await pg.query('update diagrams set revision = revision + 3 where id=$1', [id]);
    const compute = jest.fn(() => ({ ok: true, content: content(['zzz']) }));
    const r = await repo.applyContentChange(id, { expectedRevision: 1, userId: user.id, actor: actor(), compute });
    expect(r).toEqual({ status: 'conflict', currentRevision: 3 });
    expect(compute).not.toHaveBeenCalled();
    expect((await head(id)).content.elements.map((e) => e.id)).toEqual(['a']);
    expect(await vers(id)).toHaveLength(0);
  });

  test('rejected by compute: nothing written, no version, result handed back', async () => {
    const id = await newDiagram();
    const r = await repo.applyContentChange(id, { expectedRevision: 0, userId: user.id, actor: actor(), compute: () => ({ ok: false, errors: [{ index: 0, message: 'bad' }] }) });
    expect(r.status).toBe('rejected');
    expect(r.result.errors[0].message).toBe('bad');
    expect((await head(id)).rev).toBe(0);
    expect(await vers(id)).toHaveLength(0);
  });

  test('unknown diagram: not_found', async () => {
    const r = await repo.applyContentChange('00000000-0000-4000-8000-000000000000', { expectedRevision: 0, userId: user.id, actor: actor(), compute: () => ({ ok: true, content: {} }) });
    expect(r.status).toBe('not_found');
  });

  test('two concurrent writers on the same base revision: exactly one wins, the other gets a conflict', async () => {
    const id = await newDiagram();
    const mk = (tag) => repo.applyContentChange(id, {
      expectedRevision: 0, userId: user.id, actor: actor(),
      compute: (c) => ({ ok: true, content: { ...c, elements: [...c.elements, { id: tag, x: 1, y: 1 }] } }),
    });
    const results = await Promise.all([mk('p'), mk('q')]);
    expect(results.map((r) => r.status).sort()).toEqual(['conflict', 'ok']);
    expect((await head(id)).rev).toBe(1);
    expect((await head(id)).content.elements).toHaveLength(2);
  });

  test('restoring the pre-agent version undoes the batch', async () => {
    const id = await newDiagram();
    await repo.applyContentChange(id, { expectedRevision: 0, userId: user.id, actor: actor(), compute: (c) => add({ content: c }) });
    const [pre] = await vers(id);
    await versions.restore(id, pre.n, { userId: user.id, email: user.email, via: 'web' });
    expect((await head(id)).content.elements.map((e) => e.id)).toEqual(['a']);
  });

  test('map_structure (AI-3) through the same path: one agent version, the audit row, and restore-before undoes the whole call', async () => {
    const { compileMapStructure } = require('../../lib/mcp/structure');
    const id = await newDiagram();
    const structure = { nodes: [{ key: 'a', label: 'A', group: 'g' }, { key: 'b', label: 'B', group: 'g' }], edges: [{ from: 'a', to: 'b' }], groups: [{ key: 'g', label: 'Group' }] };
    const r = await repo.applyContentChange(id, { expectedRevision: 0, userId: user.id, actor: actor(), compute: (c) => compileMapStructure(c, { structure, layout: 'cluster' }) });
    expect(r.status).toBe('ok');
    expect(r.result.summary).toMatchObject({ nodes: 2, frames: 1 });
    const v = await vers(id);
    expect(v.map((x) => x.via)).toEqual(['system', 'agent']);
    expect(v[1].content.elements.filter((e) => e.parentFrameId)).toHaveLength(2);
    const audit = (await pg.query("select action, on_behalf_of from audit_events where diagram_id=$1 and action='diagram.agent_edit'", [id])).rows;
    expect(audit).toEqual([{ action: 'diagram.agent_edit', on_behalf_of: user.id }]);
    await versions.restore(id, v[0].n, { userId: user.id, email: user.email, via: 'web' });
    expect((await head(id)).content.elements.map((e) => e.id)).toEqual(['a']);
  });

  test('table_create and table_update (AI-4) through the same path: one agent version each, audit rows, links survive the database, restore-before removes the table', async () => {
    const { compileTableCreate, compileTableUpdate } = require('../../lib/mcp/tableTools');
    const id = await newDiagram(content(['a', 'b']));
    const made = await repo.applyContentChange(id, {
      expectedRevision: 0, userId: user.id, actor: actor(),
      compute: (c) => compileTableCreate(c, { title: 'Inventory', columns: ['Name', { name: 'N', type: 'number' }], rows: [{ cells: ['A', 1], elementId: 'a' }, { cells: ['B', 2], elementId: 'b' }] }),
    });
    expect(made.status).toBe('ok');
    const tableId = made.result.elementId;
    const stored = (await head(id)).content.elements.find((e) => e.id === tableId);
    expect(stored.data.table.rows.map((r) => r.elementId)).toEqual(['a', 'b']);
    expect(stored.data.table.rows[1].cells[stored.data.table.columns[1].id]).toBe(2);
    const upd = await repo.applyContentChange(id, {
      expectedRevision: 1, userId: user.id, actor: actor(),
      compute: (c) => compileTableUpdate(c, { elementId: tableId, key: 'Name', upsertRows: [{ cells: { Name: 'A', N: 10 } }, { cells: { Name: 'C', N: 3 } }] }),
    });
    expect(upd.status).toBe('ok');
    expect(upd.result.summary).toMatchObject({ inserted: 1, updated: 1 });
    const v = await vers(id);
    expect(v.map((x) => x.via)).toEqual(['system', 'agent', 'agent']);
    const audit = (await pg.query("select action, on_behalf_of from audit_events where diagram_id=$1 and action='diagram.agent_edit'", [id])).rows;
    expect(audit).toHaveLength(2);
    // a rejected table call writes nothing and makes no version
    const bad = await repo.applyContentChange(id, { expectedRevision: 2, userId: user.id, actor: actor(), compute: (c) => compileTableUpdate(c, { elementId: tableId, upsertRows: [{ cells: { Nope: 1 } }] }) });
    expect(bad.status).toBe('rejected');
    expect((await vers(id))).toHaveLength(3);
    await versions.restore(id, v[0].n, { userId: user.id, email: user.email, via: 'web' });
    expect((await head(id)).content.elements.map((e) => e.id)).toEqual(['a', 'b']);
  test('doc_create / doc_update (AI-5) through the same path: one agent version each, audit rows, sanitized text stored, restore-before removes the doc', async () => {
    const { compileDocCreate, compileDocUpdate } = require('../../lib/mcp/docTools');
    const id = await newDiagram();
    const made = await repo.applyContentChange(id, {
      expectedRevision: 0, userId: user.id, actor: actor(),
      compute: (c) => compileDocCreate(c, { title: 'Findings', markdown: '## Summary\n\nSee [a](#el=a). <script>x</script> [bad](javascript:alert(1))' }),
    });
    expect(made.status).toBe('ok');
    const docId = made.result.docId;
    let v = await vers(id);
    expect(v.map((x) => x.via)).toEqual(['system', 'agent']);
    const stored = (await head(id)).content.elements.find((e) => e.id === docId);
    expect(stored).toMatchObject({ type: 'doc', packId: 'core', label: 'Findings' });
    expect(stored.data.doc.markdown).not.toMatch(/(^|[^\\])<script/);
    expect(stored.data.doc.markdown).not.toMatch(/\]\(javascript:/);
    const upd = await repo.applyContentChange(id, {
      expectedRevision: 1, userId: user.id, actor: actor(),
      compute: (c) => compileDocUpdate(c, { elementId: docId, append: '## More\n\ntext' }),
    });
    expect(upd.status).toBe('ok');
    v = await vers(id);
    expect(v.map((x) => x.via)).toEqual(['system', 'agent', 'agent']);
    expect((await head(id)).content.elements.find((e) => e.id === docId).data.doc.markdown).toMatch(/## More/);
    const audit = (await pg.query("select action, on_behalf_of from audit_events where diagram_id=$1 and action='diagram.agent_edit'", [id])).rows;
    expect(audit).toHaveLength(2);
    await versions.restore(id, v[0].n, { userId: user.id, email: user.email, via: 'web' });
    expect((await head(id)).content.elements.map((e) => e.id)).toEqual(['a']);
  });

  test('an open editor saving with the old revision after an agent write gets the normal CAS miss (409 flow)', async () => {
    const id = await newDiagram();
    await repo.applyContentChange(id, { expectedRevision: 0, userId: user.id, actor: actor(), compute: (c) => add({ content: c }) });
    const miss = await repo.updateDiagram(id, { content: content(['stale']) }, { expectedRevision: 0, userId: user.id, actor: { userId: user.id, email: user.email, via: 'web' } });
    expect(miss).toBeNull();
    expect((await head(id)).content.elements.map((e) => e.id)).toEqual(['a', 'new']);
  });

  test('writes an agent audit row in the same transaction: on behalf of the user, token id, revision, counts, no content', async () => {
    const id = await newDiagram();
    const tokenId = crypto.randomUUID();
    const r = await repo.applyContentChange(id, {
      expectedRevision: 0, userId: user.id, actor: { ...actor(), tokenId },
      compute: (c) => ({ ...add({ content: c }), counts: { addedElements: 1 } }),
    });
    const rows = (await pg.query("select actor_type, actor_user_id, on_behalf_of, action, target from audit_events where diagram_id=$1", [id])).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actor_type: 'agent', actor_user_id: null, on_behalf_of: user.id, action: 'diagram.agent_edit' });
    expect(rows[0].target).toEqual({ tokenId, revision: 1, versionId: r.versionId, counts: { addedElements: 1 } });
    expect(JSON.stringify(rows[0].target)).not.toContain('"elements"');
    // rejected / conflicting batches leave no audit row
    await repo.applyContentChange(id, { expectedRevision: 0, userId: user.id, actor: actor(), compute: (c) => add({ content: c }) });
    await repo.applyContentChange(id, { expectedRevision: 1, userId: user.id, actor: actor(), compute: () => ({ ok: false, errors: [] }) });
    expect((await pg.query('select count(*)::int n from audit_events where diagram_id=$1', [id])).rows[0].n).toBe(1);
  });

  test('agent versions have their own retention budget: they never evict human autosaves, and are capped themselves', async () => {
    const id = await newDiagram();
    const ins = (n, via, ageMs) => pg.query(
      `insert into diagram_versions (diagram_id, version_number, content, created_by, kind, created_via, created_at)
       values ($1,$2,$3,'x','auto',$4, now() - ($5 || ' milliseconds')::interval)`,
      [id, n, JSON.stringify(content(['a'])), via, String(ageMs)]);
    // 100 human autosaves (the human cap) and 110 older agent versions, all within the 24 h keep-all window
    for (let i = 0; i < 100; i++) await ins(i + 1, 'web', 1000 * (i + 1));
    for (let i = 0; i < 110; i++) await ins(101 + i, 'agent', 200000 + 1000 * i);
    await pg.query('update diagrams set version_seq = 300 where id=$1', [id]);
    await repo.applyContentChange(id, { expectedRevision: 0, userId: user.id, actor: actor(), compute: (c) => add({ content: c }) });
    const count = async (via) => (await pg.query("select count(*)::int n from diagram_versions where diagram_id=$1 and kind='auto' and (created_via='agent') = $2", [id, via])).rows[0].n;
    expect(await count(true)).toBe(100);
    // human side: 100 web autosaves + the pre-change version (created_via system) = cap 100 + 1 pruned oldest
    expect(await count(false)).toBe(100);
    const oldestWeb = (await pg.query("select min(version_number)::int n from diagram_versions where diagram_id=$1 and created_via='web'", [id])).rows[0].n;
    expect(oldestWeb).toBeLessThanOrEqual(2); // newest human autosaves are kept; only the single oldest may go for the pre-change restore point
  });
});
