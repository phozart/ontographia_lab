// Slice 0: migration runner (scripts/migrate.js) + 0001_baseline.
// Pure tests always run. DB tests run only when a Postgres is configured
// (DATABASE_URL or DB_* env, e.g. from .env) and use a throwaway database
// that the test itself creates and drops; no other database is touched.

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
// The unit project runs under jsdom, which lacks these Node globals that `pg` needs at load time
const util = require('util');
global.TextEncoder = global.TextEncoder || util.TextEncoder;
global.TextDecoder = global.TextDecoder || util.TextDecoder;
const { Client } = require('pg');

const {
  migrate,
  listMigrationFiles,
  checksumOf,
  getConnectionString,
  isFatalConnectError,
} = require('../../scripts/migrate');

const REAL_DIR = path.join(__dirname, '..', '..', 'db', 'migrations');
const INIT_SQL = fs.readFileSync(path.join(__dirname, '..', '..', 'init.sql'), 'utf8');

function tmpMigrationsDir(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migs-'));
  for (const [name, sql] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), sql);
  return dir;
}

describe('migration files (pure)', () => {
  test('0001_baseline exists and names are NNNN_snake_case.sql in order', () => {
    const files = listMigrationFiles(REAL_DIR);
    expect(files.length).toBeGreaterThanOrEqual(1);
    expect(files[0].version).toBe('0001_baseline');
    for (const f of files) expect(f.version).toMatch(/^\d{4}_[a-z0-9_]+$/);
    expect([...files].map((f) => f.version)).toEqual([...files].map((f) => f.version).sort());
  });

  test('rejects malformed names and duplicate numbers', () => {
    expect(() => listMigrationFiles(tmpMigrationsDir({ 'bad name.sql': 'select 1' }))).toThrow(/name/i);
    expect(() => listMigrationFiles(tmpMigrationsDir({ '0001_a.sql': 'select 1', '0001_b.sql': 'select 1' }))).toThrow(/duplicate/i);
  });

  test('ignores non-sql files', () => {
    const dir = tmpMigrationsDir({ '0001_a.sql': 'select 1', 'README.md': '# x' });
    expect(listMigrationFiles(dir).map((f) => f.version)).toEqual(['0001_a']);
  });

  test('checksum is sha256 hex of the file contents', () => {
    expect(checksumOf('abc')).toBe(crypto.createHash('sha256').update('abc').digest('hex'));
  });

  test('migration files may not manage their own transactions', async () => {
    const dir = tmpMigrationsDir({ '0001_a.sql': 'BEGIN;\nselect 1;\nCOMMIT;' });
    expect(() => listMigrationFiles(dir)).toThrow(/transaction/i);
  });

  test('connection string honors DATABASE_URL', () => {
    const prev = process.env.DATABASE_URL;
    process.env.DATABASE_URL = 'postgresql://u:p@h:1/d';
    expect(getConnectionString()).toBe('postgresql://u:p@h:1/d');
    if (prev === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = prev;
  });
});

describe('connect error classification (pure)', () => {
  test('bad password / missing database are fatal; network errors are transient', () => {
    expect(isFatalConnectError({ code: '28P01' })).toBe(true);
    expect(isFatalConnectError({ code: '3D000' })).toBe(true);
    expect(isFatalConnectError({ code: 'ECONNREFUSED' })).toBe(false);
    expect(isFatalConnectError({ code: '57P03' })).toBe(false);
  });
});

const BASE_URL = process.env.DATABASE_URL || (process.env.DB_HOST ? getConnectionString() : null);
const dbDescribe = BASE_URL ? describe : describe.skip;

dbDescribe('migration runner against a throwaway database', () => {
  const dbName = `diagram_studio_migtest_${process.pid}_${crypto.randomBytes(3).toString('hex')}`;
  let admin;
  let testUrl;
  let seq = 0;

  function urlFor(name) {
    const u = new URL(BASE_URL);
    u.pathname = `/${name}`;
    return u.toString();
  }

  async function freshDb() {
    // Each test gets an empty schema by recreating the database
    seq += 1;
    const name = `${dbName}_${seq}`;
    await admin.query(`CREATE DATABASE "${name}"`);
    created.push(name);
    return urlFor(name);
  }
  const created = [];

  async function withClient(url, fn) {
    const c = new Client({ connectionString: url });
    await c.connect();
    try { return await fn(c); } finally { await c.end(); }
  }

  const quiet = { log: () => {}, warn: () => {} };

  beforeAll(async () => {
    admin = new Client({ connectionString: BASE_URL });
    await admin.connect();
  });

  afterAll(async () => {
    for (const name of created) {
      await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    }
    await admin.end();
  });

  test('empty database: baseline alone builds the full schema and records itself', async () => {
    testUrl = await freshDb();
    const res = await migrate({ connectionString: testUrl, dir: REAL_DIR, logger: quiet });
    expect(res.applied).toContain('0001_baseline');
    await withClient(testUrl, async (c) => {
      const t = await c.query("select table_name from information_schema.tables where table_schema='public'");
      const names = t.rows.map((r) => r.table_name);
      for (const n of ['users', 'diagrams', 'diagram_versions', 'diagram_shares', 'user_settings', 'schema_migrations']) {
        expect(names).toContain(n);
      }
      const cols = await c.query("select column_name from information_schema.columns where table_name='diagrams'");
      expect(cols.rows.map((r) => r.column_name)).toContain('short_id');
      const m = await c.query('select version, checksum from schema_migrations order by version');
      expect(m.rows[0].version).toBe('0001_baseline');
      expect(m.rows[0].checksum).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  test('is idempotent: a second run applies nothing', async () => {
    const url = await freshDb();
    await migrate({ connectionString: url, dir: REAL_DIR, logger: quiet });
    const again = await migrate({ connectionString: url, dir: REAL_DIR, logger: quiet });
    expect(again.applied).toEqual([]);
    expect(again.skipped).toContain('0001_baseline');
  });

  test('database created from init.sql (docker fresh volume): migrate succeeds and backfills short_id on sample rows', async () => {
    const url = await freshDb();
    await withClient(url, (c) => c.query(INIT_SQL));
    const before = await withClient(url, (c) => c.query('select count(*)::int n from diagrams'));
    await migrate({ connectionString: url, dir: REAL_DIR, logger: quiet });
    await withClient(url, async (c) => {
      const rows = await c.query('select short_id from diagrams order by short_id');
      expect(rows.rows).toHaveLength(before.rows[0].n);
      expect(rows.rows.every((r) => /^LAB-\d+$/.test(r.short_id))).toBe(true);
    });
  });

  test('existing production-like DB: data intact, short_id preserved, missing columns/indexes repaired', async () => {
    const url = await freshDb();
    await withClient(url, async (c) => {
      await c.query(INIT_SQL);
      // simulate an older prod volume: no short_id yet, older users shape without password/reset columns
      await c.query('DROP INDEX IF EXISTS idx_diagrams_short_id');
      await c.query('ALTER TABLE diagrams DROP COLUMN short_id');
      await c.query('ALTER TABLE users DROP COLUMN password_hash, DROP COLUMN reset_token');
      await c.query("INSERT INTO users (email, name, role, status) VALUES ('a@b.co','A','user','active')");
      await c.query("INSERT INTO diagrams (name, type, created_by, content, created_at) VALUES ('first','bpmn','a@b.co','{\"elements\":[{\"id\":\"x\"}]}', now() - interval '2 days')");
      await c.query("INSERT INTO diagrams (name, type, created_by, content, created_at) VALUES ('second','cld','a@b.co','{\"elements\":[]}', now() - interval '1 day')");
    });
    const fp = async () => withClient(url, async (c) => (await c.query(
      "select md5(string_agg(id::text||name||content::text, '' order by id)) h, count(*)::int n from diagrams")).rows[0]);
    const before = await fp();
    await migrate({ connectionString: url, dir: REAL_DIR, logger: quiet });
    expect(await fp()).toEqual(before);
    await withClient(url, async (c) => {
      const s = await c.query('select name, short_id from diagrams order by created_at');
      expect(s.rows.every((r) => /^LAB-\d+$/.test(r.short_id))).toBe(true);
      expect(new Set(s.rows.map((r) => r.short_id)).size).toBe(s.rows.length);
      const u = await c.query("select column_name from information_schema.columns where table_name='users'");
      expect(u.rows.map((r) => r.column_name)).toEqual(expect.arrayContaining(['password_hash', 'reset_token']));
      const i = await c.query("select 1 from pg_indexes where indexname='idx_diagrams_short_id'");
      expect(i.rowCount).toBe(1);
    });
  });

  test('existing DB that already has short_id values: they are never rewritten, new rows continue the sequence', async () => {
    const url = await freshDb();
    await withClient(url, async (c) => {
      await c.query(INIT_SQL);
      await c.query('DELETE FROM diagrams');
      await c.query("INSERT INTO diagrams (name, type, created_by, short_id) VALUES ('a','bpmn','x','LAB-7'), ('b','bpmn','x','LAB-12')");
      await c.query("INSERT INTO diagrams (name, type, created_by) VALUES ('c','bpmn','x')");
    });
    await migrate({ connectionString: url, dir: REAL_DIR, logger: quiet });
    await withClient(url, async (c) => {
      const r = await c.query('select name, short_id from diagrams order by name');
      expect(r.rows).toEqual([
        { name: 'a', short_id: 'LAB-7' },
        { name: 'b', short_id: 'LAB-12' },
        { name: 'c', short_id: 'LAB-13' },
      ]);
    });
  });

  test('changed checksum of an applied migration fails loudly', async () => {
    const url = await freshDb();
    const dir = tmpMigrationsDir({ '0001_a.sql': 'create table t1(id int);' });
    await migrate({ connectionString: url, dir, logger: quiet });
    fs.writeFileSync(path.join(dir, '0001_a.sql'), 'create table t1(id int, extra int);');
    await expect(migrate({ connectionString: url, dir, logger: quiet })).rejects.toThrow(/checksum/i);
  });

  test('a failing migration rolls back entirely and is not recorded; later runs retry it', async () => {
    const url = await freshDb();
    const dir = tmpMigrationsDir({
      '0001_ok.sql': 'create table ok1(id int);',
      '0002_bad.sql': 'create table half(id int); select * from definitely_missing;',
    });
    await expect(migrate({ connectionString: url, dir, logger: quiet })).rejects.toThrow(/0002_bad/);
    await withClient(url, async (c) => {
      expect((await c.query("select to_regclass('public.half') r")).rows[0].r).toBeNull();
      expect((await c.query("select to_regclass('public.ok1') r")).rows[0].r).not.toBeNull();
      const v = await c.query('select version from schema_migrations order by 1');
      expect(v.rows.map((r) => r.version)).toEqual(['0001_ok']);
    });
    fs.writeFileSync(path.join(dir, '0002_bad.sql'), 'create table half(id int);');
    const res = await migrate({ connectionString: url, dir, logger: quiet });
    expect(res.applied).toEqual(['0002_bad']);
  });

  test('concurrent runners apply each migration exactly once (advisory lock)', async () => {
    const url = await freshDb();
    const dir = tmpMigrationsDir({
      '0001_slow.sql': 'select pg_sleep(0.3); create table once1(id int);',
      '0002_next.sql': 'create table once2(id int);',
    });
    const results = await Promise.all([
      migrate({ connectionString: url, dir, logger: quiet }),
      migrate({ connectionString: url, dir, logger: quiet }),
      migrate({ connectionString: url, dir, logger: quiet }),
    ]);
    const appliedCounts = results.reduce((n, r) => n + r.applied.length, 0);
    expect(appliedCounts).toBe(2);
    await withClient(url, async (c) => {
      const v = await c.query('select count(*)::int n from schema_migrations');
      expect(v.rows[0].n).toBe(2);
    });
  });

  test('applied-but-missing files only warn (e.g. after rolling the app back)', async () => {
    const url = await freshDb();
    const dir = tmpMigrationsDir({ '0001_a.sql': 'create table w1(id int);', '0002_b.sql': 'create table w2(id int);' });
    await migrate({ connectionString: url, dir, logger: quiet });
    fs.unlinkSync(path.join(dir, '0002_b.sql'));
    const warn = jest.fn();
    const res = await migrate({ connectionString: url, dir, logger: { log: () => {}, warn } });
    expect(res.applied).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('0002_b'));
  });
  test('missing database fails fast without retrying', async () => {
    const warn = jest.fn();
    const start = Date.now();
    await expect(migrate({
      connectionString: urlFor(`${dbName}_does_not_exist`), dir: REAL_DIR,
      logger: { log: () => {}, warn }, retries: 5, retryDelayMs: 1000,
    })).rejects.toMatchObject({ code: '3D000' });
    expect(warn).not.toHaveBeenCalled();
    expect(Date.now() - start).toBeLessThan(3000);
  });

  test('a migration blocked by another transaction fails on lock_timeout and is not recorded', async () => {
    const url = await freshDb();
    const dir = tmpMigrationsDir({ '0001_a.sql': 'create table locked1(id int);', '0002_b.sql': 'alter table locked1 add column x int;' });
    await migrate({ connectionString: url, dir: tmpMigrationsDir({ '0001_a.sql': 'create table locked1(id int);' }), logger: quiet });
    const blocker = new Client({ connectionString: url });
    await blocker.connect();
    try {
      await blocker.query('BEGIN');
      await blocker.query('LOCK TABLE locked1 IN ACCESS SHARE MODE');
      const start = Date.now();
      await expect(migrate({ connectionString: url, dir, logger: quiet, lockTimeout: '300ms' })).rejects.toThrow(/0002_b.*lock timeout/i);
      expect(Date.now() - start).toBeLessThan(5000);
    } finally {
      await blocker.query('ROLLBACK');
      await blocker.end();
    }
    await withClient(url, async (c) => {
      const v = await c.query('select version from schema_migrations order by 1');
      expect(v.rows.map((r) => r.version)).toEqual(['0001_a']);
    });
    const res = await migrate({ connectionString: url, dir, logger: quiet });
    expect(res.applied).toEqual(['0002_b']);
  });
});
