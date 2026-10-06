// Slice 1: migration 0002_diagram_identity_and_revision (owner_id backfill, revision, version_seq, updated_by).
// DB tests run only when a Postgres is configured and use throwaway databases created and dropped here.

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const util = require('util');
global.TextEncoder = global.TextEncoder || util.TextEncoder;
global.TextDecoder = global.TextDecoder || util.TextDecoder;
const { Client } = require('pg');
const { migrate, getConnectionString } = require('../../scripts/migrate');

const REAL_DIR = path.join(__dirname, '..', '..', 'db', 'migrations');
const SQL_0002 = fs.readFileSync(path.join(REAL_DIR, '0002_diagram_identity_and_revision.sql'), 'utf8');

describe('0002 file (pure)', () => {
  test('is additive: no destructive statements', () => {
    const code = SQL_0002.replace(/--.*$/gm, '');
    expect(code).not.toMatch(/\b(DROP|TRUNCATE|DELETE\s+FROM)\b/i);
    expect(code).not.toMatch(/\bALTER\s+COLUMN\b/i);
  });
  test('every ADD COLUMN / CREATE INDEX is guarded', () => {
    const code = SQL_0002.replace(/--.*$/gm, '');
    for (const m of code.match(/ADD COLUMN\s+(?!IF NOT EXISTS)/gi) || []) throw new Error(`unguarded: ${m}`);
    for (const m of code.match(/CREATE INDEX\s+(?!IF NOT EXISTS)/gi) || []) throw new Error(`unguarded: ${m}`);
  });
});

const BASE_URL = process.env.DATABASE_URL || (process.env.DB_HOST ? getConnectionString() : null);
const dbDescribe = BASE_URL ? describe : describe.skip;

dbDescribe('0002 against throwaway databases', () => {
  const prefix = `diagram_studio_migtest0002_${process.pid}_${crypto.randomBytes(3).toString('hex')}`;
  const created = [];
  let admin;
  let seq = 0;
  let dir0001;
  const quiet = { log: () => {}, warn: () => {} };

  const urlFor = (name) => { const u = new URL(BASE_URL); u.pathname = `/${name}`; return u.toString(); };
  async function withClient(url, fn) {
    const c = new Client({ connectionString: url });
    await c.connect();
    try { return await fn(c); } finally { await c.end(); }
  }
  async function freshDbAt0001() {
    seq += 1;
    const name = `${prefix}_${seq}`;
    await admin.query(`CREATE DATABASE "${name}"`);
    created.push(name);
    const url = urlFor(name);
    await migrate({ connectionString: url, dir: dir0001, logger: quiet });
    return url;
  }
  async function user(c, email, role = 'user', createdAt = 'now()') {
    return (await c.query(
      'insert into users (email, role, status, created_at) values ($1,$2,$3,' + createdAt + ') returning id', [email, role, 'active']
    )).rows[0].id;
  }
  async function diagram(c, shortId, createdBy, ownerId = null) {
    return (await c.query(
      "insert into diagrams (short_id, name, type, created_by, owner_id) values ($1,$1,'infinite-canvas',$2,$3) returning id",
      [shortId, createdBy, ownerId]
    )).rows[0].id;
  }
  const withEnv = async (adminEmail, fn) => {
    const prev = process.env.ADMIN_EMAIL;
    if (adminEmail === undefined) delete process.env.ADMIN_EMAIL; else process.env.ADMIN_EMAIL = adminEmail;
    try { return await fn(); } finally { if (prev === undefined) delete process.env.ADMIN_EMAIL; else process.env.ADMIN_EMAIL = prev; }
  };

  beforeAll(async () => {
    admin = new Client({ connectionString: BASE_URL });
    await admin.connect();
    dir0001 = fs.mkdtempSync(path.join(os.tmpdir(), 'mig0001-'));
    fs.copyFileSync(path.join(REAL_DIR, '0001_baseline.sql'), path.join(dir0001, '0001_baseline.sql'));
  });
  afterAll(async () => {
    for (const name of created) await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.end();
  });

  test('backfills owner by email (case-insensitive), assigns unmatched to ADMIN_EMAIL, reports them, keeps existing owners', async () => {
    const url = await freshDbAt0001();
    let ids;
    await withClient(url, async (c) => {
      const alice = await user(c, 'alice@x.co');
      const adminId = await user(c, 'boss@x.co', 'admin');
      const bob = await user(c, 'bob@x.co');
      ids = {
        a: await diagram(c, 'LAB-1', 'alice@x.co'),
        b: await diagram(c, 'LAB-2', 'Alice@X.co'),
        seed: await diagram(c, 'LAB-3', 'admin'),
        gone: await diagram(c, 'LAB-4', 'deleted-user@x.co'),
        kept: await diagram(c, 'LAB-5', 'alice@x.co', bob),
      };
      ids.users = { alice, adminId, bob };
      await c.query("insert into diagram_versions (diagram_id, version_number, content, created_by) values ($1,1,'{}','x'),($1,4,'{}','x')", [ids.a]);
    });
    const logs = [];
    const res = await withEnv('boss@x.co', () => migrate({ connectionString: url, dir: REAL_DIR, logger: { log: (m) => logs.push(m), warn: () => {} } }));
    expect(res.applied[0]).toBe('0002_diagram_identity_and_revision'); // later migrations apply after it
    await withClient(url, async (c) => {
      const rows = (await c.query('select id, owner_id, revision, version_seq, updated_by from diagrams')).rows;
      const by = Object.fromEntries(rows.map((r) => [r.id, r]));
      expect(by[ids.a].owner_id).toBe(ids.users.alice);
      expect(by[ids.b].owner_id).toBe(ids.users.alice);
      expect(by[ids.seed].owner_id).toBe(ids.users.adminId);
      expect(by[ids.gone].owner_id).toBe(ids.users.adminId);
      expect(by[ids.kept].owner_id).toBe(ids.users.bob);
      expect(rows.every((r) => String(r.revision) === '0' && r.updated_by === null)).toBe(true);
      expect(by[ids.a].version_seq).toBe(4);
      expect(by[ids.seed].version_seq).toBe(0);
      expect((await c.query("select 1 from pg_indexes where indexname='idx_diagrams_owner_updated'")).rowCount).toBe(1);
    });
    const out = logs.join('\n');
    expect(out).toMatch(/LAB-3/);
    expect(out).toMatch(/LAB-4/);
    expect(out).toMatch(/ADMIN_EMAIL \(boss@x\.co\)/);
    expect(out).not.toMatch(/LAB-5/);
  });

  test('second run is a no-op (idempotent), and the SQL itself is re-runnable', async () => {
    const url = await freshDbAt0001();
    await withClient(url, async (c) => { await user(c, 'boss@x.co', 'admin'); await diagram(c, 'LAB-1', 'admin'); });
    await withEnv('boss@x.co', () => migrate({ connectionString: url, dir: REAL_DIR, logger: quiet }));
    const again = await migrate({ connectionString: url, dir: REAL_DIR, logger: quiet });
    expect(again.applied).toEqual([]);
    await withClient(url, async (c) => {
      await c.query(SQL_0002); // guards make a direct re-run harmless
      expect((await c.query('select count(*)::int n from diagrams where owner_id is null')).rows[0].n).toBe(0);
    });
  });

  test('ADMIN_EMAIL unset or unknown -> oldest admin user', async () => {
    for (const envValue of [undefined, 'nobody@x.co']) {
      const url = await freshDbAt0001();
      let oldest;
      await withClient(url, async (c) => {
        await user(c, 'late-admin@x.co', 'admin', "now()");
        oldest = await user(c, 'first-admin@x.co', 'admin', "now() - interval '1 day'");
        await diagram(c, 'LAB-1', 'admin');
      });
      await withEnv(envValue, () => migrate({ connectionString: url, dir: REAL_DIR, logger: quiet }));
      await withClient(url, async (c) => {
        expect((await c.query('select owner_id from diagrams')).rows[0].owner_id).toBe(oldest);
      });
    }
  });

  test('no admin account at all -> owner stays NULL and the rows are reported', async () => {
    const url = await freshDbAt0001();
    await withClient(url, async (c) => { await user(c, 'u@x.co'); await diagram(c, 'LAB-9', 'admin'); });
    const logs = [];
    await withEnv(undefined, () => migrate({ connectionString: url, dir: REAL_DIR, logger: { log: (m) => logs.push(m), warn: () => {} } }));
    await withClient(url, async (c) => {
      expect((await c.query('select owner_id from diagrams')).rows[0].owner_id).toBeNull();
    });
    expect(logs.join('\n')).toMatch(/UNASSIGNED.*LAB-9/);
  });

  test('empty database: baseline + 0002 apply cleanly', async () => {
    seq += 1;
    const name = `${prefix}_${seq}`;
    await admin.query(`CREATE DATABASE "${name}"`);
    created.push(name);
    const res = await migrate({ connectionString: urlFor(name), dir: REAL_DIR, logger: quiet });
    expect(res.applied.slice(0, 2)).toEqual(['0001_baseline', '0002_diagram_identity_and_revision']);
  });
});
