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

  test('an open editor saving with the old revision after an agent write gets the normal CAS miss (409 flow)', async () => {
    const id = await newDiagram();
    await repo.applyContentChange(id, { expectedRevision: 0, userId: user.id, actor: actor(), compute: (c) => add({ content: c }) });
    const miss = await repo.updateDiagram(id, { content: content(['stale']) }, { expectedRevision: 0, userId: user.id, actor: { userId: user.id, email: user.email, via: 'web' } });
    expect(miss).toBeNull();
    expect((await head(id)).content.elements.map((e) => e.id)).toEqual(['a', 'new']);
  });
});
