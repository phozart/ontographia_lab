// Slice 2: version repository against a THROWAWAY database (created and dropped here; migrations 0001-0003 applied).
// Skipped when no Postgres is configured. Never touches the shared database.
const util = require('util');
global.TextEncoder = global.TextEncoder || util.TextEncoder;
global.TextDecoder = global.TextDecoder || util.TextDecoder;
const crypto = require('crypto');
const path = require('path');
const { Client } = require('pg');
const { migrate, getConnectionString } = require('../../scripts/migrate');

const BASE_URL = process.env.DATABASE_URL || (process.env.DB_HOST ? getConnectionString() : null);
const dbDescribe = BASE_URL ? describe : describe.skip;

const content = (ids, extra = {}) => ({
  elements: ids.map((id, i) => ({ id, x: i * 10, y: 0, width: 50, height: 30 })),
  connections: [], layers: [], groups: [], viewport: { x: 0, y: 0, zoom: 1 }, ...extra,
});

dbDescribe('versionRepository (throwaway database)', () => {
  const dbName = `diagram_studio_vertest_${process.pid}_${crypto.randomBytes(3).toString('hex')}`;
  let admin; let url; let repo; let dbMod; let pg;
  let userA; let userB; let seq = 0;
  const actor = (u, via = 'web') => ({ userId: u.id, email: u.email, via });

  async function newDiagram(c0 = content(['a'])) {
    seq += 1;
    return (await pg.query(
      "insert into diagrams (short_id,name,type,created_by,owner_id,content) values ($1,'D','infinite-canvas',$2,$3,$4) returning id",
      [`LAB-${seq}`, userA.email, userA.id, JSON.stringify(c0)])).rows[0].id;
  }
  async function head(id) { return (await pg.query('select content, revision::int rev from diagrams where id=$1', [id])).rows[0]; }
  async function writeHead(id, c) {
    await pg.query('update diagrams set content=$2, revision=revision+1 where id=$1', [id, JSON.stringify(c)]);
  }
  async function allVersions(id) {
    return (await pg.query('select version_number n, kind, label, content, restored_from_version_id rf, diagram_revision::int dr, created_by_user_id u from diagram_versions where diagram_id=$1 order by version_number', [id])).rows;
  }

  beforeAll(async () => {
    admin = new Client({ connectionString: BASE_URL });
    await admin.connect();
    await admin.query(`CREATE DATABASE "${dbName}"`);
    const u = new URL(BASE_URL); u.pathname = `/${dbName}`; url = u.toString();
    await migrate({ connectionString: url, dir: path.join(__dirname, '..', '..', 'db', 'migrations'), logger: { log() {}, warn() {} } });
    process.env.DATABASE_URL = url;
    pg = new Client({ connectionString: url });
    await pg.connect();
    const mk = async (email, name) => (await pg.query("insert into users (email,name,status) values ($1,$2,'active') returning id,email", [email, name])).rows[0];
    userA = await mk('a@x.co', 'Alice'); userB = await mk('b@x.co', 'Bob');
    dbMod = require('../../lib/db');
    repo = require('../../lib/versionRepository').versionRepository;
  });
  afterAll(async () => {
    try { await dbMod?.getPool().end(); } catch (_) { /* ignore */ }
    await pg?.end();
    await admin.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
    await admin.end();
  });

  describe('createNamed', () => {
    test('snapshots the head with hash, stats, revision, author; numbering starts at 1', async () => {
      const id = await newDiagram();
      const r = await repo.createNamed(id, { label: 'Rev A', description: 'first issue' }, actor(userA));
      expect(r.created).toBe(true);
      expect(r.version).toMatchObject({ number: 1, kind: 'named', label: 'Rev A', description: 'first issue', elementCount: 1, connectionCount: 0, createdVia: 'web', restoredFrom: null });
      expect(r.version.createdBy).toEqual({ id: userA.id, name: 'Alice' });
      expect(r.version.sizeBytes).toBeGreaterThan(10);
      const [row] = await allVersions(id);
      expect(row.content.elements).toHaveLength(1);
      expect(row.dr).toBe(0);
    });

    test('same content as the latest version -> labels it instead of duplicating (deduplicated)', async () => {
      const id = await newDiagram();
      const first = await repo.createNamed(id, { label: 'One' }, actor(userA));
      const again = await repo.createNamed(id, { label: 'Renamed' }, actor(userA));
      expect(again.created).toBe(false);
      expect(again.version.number).toBe(first.version.number);
      expect(again.version.label).toBe('Renamed');
      expect(await allVersions(id)).toHaveLength(1);
    });

    test('viewport-only change counts as the same content', async () => {
      const id = await newDiagram();
      await repo.createNamed(id, { label: 'One' }, actor(userA));
      await writeHead(id, content(['a'], { viewport: { x: 300, y: 300, zoom: 2 } }));
      expect((await repo.createNamed(id, { label: 'Two' }, actor(userA))).created).toBe(false);
    });

    test('changed content creates the next number; numbers never reused or skipped', async () => {
      const id = await newDiagram();
      await repo.createNamed(id, { label: 'One' }, actor(userA));
      await writeHead(id, content(['a', 'b']));
      const second = await repo.createNamed(id, { label: 'Two' }, actor(userB));
      expect(second.created).toBe(true);
      expect(second.version.number).toBe(2);
      expect(second.version.createdBy.name).toBe('Bob');
      expect(second.version.elementCount).toBe(2);
    });

    test('latest is an auto version with identical content -> it becomes named (exempt from pruning)', async () => {
      const id = await newDiagram();
      await pg.query("insert into diagram_versions (diagram_id,version_number,content,created_by,kind,content_hash) values ($1,1,$2,'a@x.co','auto',$3)",
        [id, JSON.stringify(content(['a'])), require('../../lib/versions/contentHash').contentHash(content(['a']))]);
      await pg.query('update diagrams set version_seq=1 where id=$1', [id]);
      const r = await repo.createNamed(id, { label: 'Milestone' }, actor(userA));
      expect(r.created).toBe(false);
      expect(r.version).toMatchObject({ number: 1, kind: 'named', label: 'Milestone' });
    });

    test('concurrent creates never collide on version_number', async () => {
      const id = await newDiagram();
      const results = await Promise.all([1, 2, 3, 4].map(async (n) => {
        return repo.createNamed(id, { label: `L${n}` }, actor(userA));
      }));
      // identical content: exactly one is created, the rest relabel it; no unique-violation
      expect(results.filter((r) => r.created)).toHaveLength(1);
      expect(await allVersions(id)).toHaveLength(1);
    });
  });

  describe('list / get', () => {
    test('list is metadata only, newest first, paginated by cursor, filterable by kind', async () => {
      const id = await newDiagram();
      for (let i = 1; i <= 5; i += 1) {
        await writeHead(id, content(Array.from({ length: i }, (_, k) => `e${k}`)));
        await repo.createNamed(id, { label: `V${i}` }, actor(userA));
      }
      const p1 = await repo.list(id, { limit: 2 });
      expect(p1.items.map((v) => v.number)).toEqual([5, 4]);
      expect(p1.items[0]).not.toHaveProperty('content');
      expect(p1.nextCursor).toBeTruthy();
      const p2 = await repo.list(id, { limit: 2, cursor: p1.nextCursor });
      expect(p2.items.map((v) => v.number)).toEqual([3, 2]);
      const p3 = await repo.list(id, { limit: 2, cursor: p2.nextCursor });
      expect(p3.items.map((v) => v.number)).toEqual([1]);
      expect(p3.nextCursor).toBeNull();
      expect((await repo.list(id, { kind: 'restore' })).items).toEqual([]);
      expect((await repo.list(id, { kind: 'named' })).items).toHaveLength(5);
    });

    test('get returns content; unknown number and other diagram\'s number -> null', async () => {
      const id = await newDiagram();
      const other = await newDiagram();
      await repo.createNamed(id, { label: 'x' }, actor(userA));
      expect((await repo.get(id, 1)).content.elements).toHaveLength(1);
      expect(await repo.get(id, 99)).toBeNull();
      expect(await repo.get(other, 1)).toBeNull();
    });
  });

  describe('update (rename / describe)', () => {
    test('renames and describes; content and number untouched', async () => {
      const id = await newDiagram();
      await repo.createNamed(id, { label: 'Old' }, actor(userA));
      const v = await repo.update(id, 1, { label: 'New', description: 'why' });
      expect(v).toMatchObject({ number: 1, kind: 'named', label: 'New', description: 'why' });
      const v2 = await repo.update(id, 1, { description: null });
      expect(v2).toMatchObject({ label: 'New', description: null });
    });
    test('naming an auto version turns it named; naming needs a label', async () => {
      const id = await newDiagram();
      await pg.query("insert into diagram_versions (diagram_id,version_number,content,created_by) values ($1,1,'{}','a@x.co')", [id]);
      await expect(repo.update(id, 1, { description: 'x' })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
      expect(await repo.update(id, 1, { label: 'Keep' })).toMatchObject({ kind: 'named', label: 'Keep' });
    });
    test('a named version cannot lose its label; restore/pre_restore may gain one', async () => {
      const id = await newDiagram();
      await repo.createNamed(id, { label: 'L' }, actor(userA));
      await expect(repo.update(id, 1, { label: null })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    });
    test('unknown version -> null', async () => {
      expect(await repo.update(await newDiagram(), 7, { label: 'x' })).toBeNull();
    });
  });

  describe('restore', () => {
    async function twoStates() {
      const id = await newDiagram(content(['a']));
      await repo.createNamed(id, { label: 'Rev A' }, actor(userA)); // v1 = [a]
      await writeHead(id, content(['a', 'b']));                      // head = [a,b], unversioned
      return id;
    }

    test('unversioned head -> pre_restore (old head) + restore (source); head becomes source; revision bumped; nothing deleted', async () => {
      const id = await twoStates();
      const before = await head(id);
      const r = await repo.restore(id, 1, actor(userB));
      expect(r.status).toBe('ok');
      expect(r.preRestoreVersion).toMatchObject({ number: 2, kind: 'pre_restore', elementCount: 2 });
      expect(r.version).toMatchObject({ number: 3, kind: 'restore', restoredFrom: { number: 1 } });
      expect(r.version.createdBy.name).toBe('Bob');
      expect(r.diagram.revision).toBe(before.rev + 1);
      const h = await head(id);
      expect(h.content.elements.map((e) => e.id)).toEqual(['a']);
      expect(h.rev).toBe(before.rev + 1);
      const vs = await allVersions(id);
      expect(vs.map((v) => v.kind)).toEqual(['named', 'pre_restore', 'restore']);
      expect(vs[1].content.elements.map((e) => e.id)).toEqual(['a', 'b']); // the work that would have been lost
      expect(vs[2].dr).toBe(before.rev + 1);
      expect(vs[2].rf).toBeTruthy();
    });

    test('head already equal to the latest version -> no pre_restore', async () => {
      const id = await twoStates();
      await repo.createNamed(id, { label: 'Rev B' }, actor(userA)); // v2 = [a,b] == head
      const r = await repo.restore(id, 1, actor(userA));
      expect(r.preRestoreVersion).toBeUndefined();
      expect((await allVersions(id)).map((v) => v.kind)).toEqual(['named', 'named', 'restore']);
    });

    test('restoring the version that is already the head is a no-op (unchanged), writes nothing', async () => {
      const id = await newDiagram();
      await repo.createNamed(id, { label: 'Rev A' }, actor(userA));
      const before = await head(id);
      const r = await repo.restore(id, 1, actor(userA));
      expect(r.status).toBe('unchanged');
      expect(r.diagram.revision).toBe(before.rev);
      expect(await allVersions(id)).toHaveLength(1);
    });

    test('restore twice from the same source gives two restore versions (history is append-only)', async () => {
      const id = await twoStates();
      await repo.restore(id, 1, actor(userA));
      await writeHead(id, content(['z']));
      const r = await repo.restore(id, 1, actor(userA));
      expect(r.status).toBe('ok');
      expect((await allVersions(id)).filter((v) => v.kind === 'restore')).toHaveLength(2);
    });

    test('stale expected revision -> conflict, nothing changes', async () => {
      const id = await twoStates();
      const before = await head(id);
      const r = await repo.restore(id, 1, actor(userA), { expectedRevision: before.rev - 1 });
      expect(r.status).toBe('conflict');
      expect(r.current.revision).toBe(before.rev);
      expect(await allVersions(id)).toHaveLength(1);
      expect((await head(id)).content.elements).toHaveLength(2);
    });

    test('matching expected revision succeeds', async () => {
      const id = await twoStates();
      const before = await head(id);
      expect((await repo.restore(id, 1, actor(userA), { expectedRevision: before.rev })).status).toBe('ok');
    });

    test('unknown version -> not_found, nothing changes', async () => {
      const id = await twoStates();
      expect((await repo.restore(id, 42, actor(userA))).status).toBe('not_found');
      expect(await allVersions(id)).toHaveLength(1);
    });

    test('source content that no longer validates is refused (422) and nothing changes', async () => {
      const id = await twoStates();
      await pg.query("insert into diagram_versions (diagram_id,version_number,content,created_by,kind) values ($1,50,$2,'a@x.co','auto')", [id, JSON.stringify({ nodes: [] })]);
      await expect(repo.restore(id, 50, actor(userA))).rejects.toMatchObject({ status: 422, code: 'VERSION_CONTENT_INVALID' });
      expect(await allVersions(id)).toHaveLength(2);
    });

    test('concurrent restores serialize (no duplicate version numbers, both applied or no-op)', async () => {
      const id = await twoStates();
      const rs = await Promise.all([repo.restore(id, 1, actor(userA)), repo.restore(id, 1, actor(userB))]);
      expect(rs.map((r) => r.status).sort()).toEqual(['ok', 'unchanged']);
      const nums = (await allVersions(id)).map((v) => v.n);
      expect(new Set(nums).size).toBe(nums.length);
    });

    test('later restore copes with version_seq lagging behind existing rows', async () => {
      const id = await twoStates();
      await pg.query('update diagrams set version_seq = 0 where id=$1', [id]);
      const r = await repo.restore(id, 1, actor(userA));
      expect(r.status).toBe('ok');
      const nums = (await allVersions(id)).map((v) => v.n);
      expect(new Set(nums).size).toBe(nums.length);
    });
  });
});
