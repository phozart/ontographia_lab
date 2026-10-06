// Slice 2: migration 0003_versions (extends diagram_versions). DB tests run only when a Postgres is configured
// and use throwaway databases created and dropped here (never the shared database).

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
const FILE = fs.readdirSync(REAL_DIR).find((f) => /^0003_.*\.sql$/.test(f));

describe('0003 file (pure)', () => {
  test('exists, numbered 0003', () => expect(FILE).toBeTruthy());
  const SQL = FILE ? fs.readFileSync(path.join(REAL_DIR, FILE), 'utf8') : '';
  const code = SQL.replace(/--.*$/gm, '');
  test('is additive: no destructive statements', () => {
    expect(code).not.toMatch(/\b(DROP|TRUNCATE|DELETE\s+FROM)\b/i);
    expect(code).not.toMatch(/\bALTER\s+COLUMN\b/i);
  });
  test('every ADD COLUMN / CREATE INDEX is guarded', () => {
    expect(code.match(/ADD COLUMN\s+(?!IF NOT EXISTS)/gi) || []).toEqual([]);
    expect(code.match(/CREATE INDEX\s+(?!IF NOT EXISTS)/gi) || []).toEqual([]);
  });
  test('does not manage its own transaction', () => {
    expect(code).not.toMatch(/^\s*(BEGIN|COMMIT)\s*;/im);
  });
});

const BASE_URL = process.env.DATABASE_URL || (process.env.DB_HOST ? getConnectionString() : null);
const dbDescribe = BASE_URL ? describe : describe.skip;

dbDescribe('0003 against throwaway databases', () => {
  const prefix = `diagram_studio_migtest0003_${process.pid}_${crypto.randomBytes(3).toString('hex')}`;
  const created = [];
  let admin;
  let dirTo0002;
  const quiet = { log: () => {}, warn: () => {} };
  const urlFor = (name) => { const u = new URL(BASE_URL); u.pathname = `/${name}`; return u.toString(); };
  async function withClient(url, fn) {
    const c = new Client({ connectionString: url });
    await c.connect();
    try { return await fn(c); } finally { await c.end(); }
  }
  async function dbAt0002(n) {
    const name = `${prefix}_${n}`;
    await admin.query(`CREATE DATABASE "${name}"`);
    created.push(name);
    const url = urlFor(name);
    await migrate({ connectionString: url, dir: dirTo0002, logger: quiet });
    return url;
  }
  async function seed(c) {
    const u = (await c.query("insert into users (email, status) values ('a@b.co','active') returning id")).rows[0].id;
    const d = (await c.query("insert into diagrams (short_id,name,type,created_by,owner_id) values ('LAB-1','D','infinite-canvas','a@b.co',$1) returning id", [u])).rows[0].id;
    return { u, d };
  }

  beforeAll(async () => {
    admin = new Client({ connectionString: BASE_URL });
    await admin.connect();
    dirTo0002 = fs.mkdtempSync(path.join(os.tmpdir(), 'mig0002-'));
    for (const f of fs.readdirSync(REAL_DIR)) if (/^000[12]_/.test(f)) fs.copyFileSync(path.join(REAL_DIR, f), path.join(dirTo0002, f));
  });
  afterAll(async () => {
    for (const name of created) await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.end();
    fs.rmSync(dirTo0002, { recursive: true, force: true });
  });

  test('applies on existing data: legacy version rows are kept and read as kind auto / via web', async () => {
    const url = await dbAt0002(1);
    const ids = await withClient(url, async (c) => {
      const s = await seed(c);
      await c.query("insert into diagram_versions (diagram_id, version_number, content, created_by) values ($1,1,'{\"elements\":[]}','a@b.co')", [s.d]);
      return s;
    });
    await migrate({ connectionString: url, dir: REAL_DIR, logger: quiet });
    await withClient(url, async (c) => {
      const r = (await c.query('select * from diagram_versions where diagram_id=$1', [ids.d])).rows;
      expect(r).toHaveLength(1);
      expect(r[0]).toMatchObject({ kind: 'auto', created_via: 'web', label: null, content_hash: null, created_by_user_id: ids.u });
      expect(r[0].content).toEqual({ elements: [] });
      const cols = (await c.query("select column_name from information_schema.columns where table_name='diagram_versions'")).rows.map((x) => x.column_name);
      for (const col of ['kind', 'label', 'description', 'content_hash', 'size_bytes', 'element_count', 'connection_count', 'diagram_revision', 'restored_from_version_id', 'created_by_user_id', 'created_via']) expect(cols).toContain(col);
      const idx = (await c.query("select indexname from pg_indexes where tablename='diagram_versions'")).rows.map((x) => x.indexname);
      expect(idx).toEqual(expect.arrayContaining(['idx_versions_diagram_created', 'idx_versions_diagram_kind']));
    });
  });

  test('constraints: kind enum, named needs a label, created_via enum', async () => {
    const url = await dbAt0002(2);
    await migrate({ connectionString: url, dir: REAL_DIR, logger: quiet });
    await withClient(url, async (c) => {
      const { d } = await seed(c);
      const ins = (n, kind, label, via = 'web') => c.query(
        "insert into diagram_versions (diagram_id, version_number, content, created_by, kind, label, created_via) values ($1,$2,'{}','a',$3,$4,$5)", [d, n, kind, label, via]);
      await ins(1, 'named', 'Rev A');
      await ins(2, 'restore', null);
      await ins(3, 'pre_restore', null);
      await expect(ins(4, 'named', null)).rejects.toThrow(/named_has_label/);
      await expect(ins(5, 'bogus', null)).rejects.toThrow();
      await expect(ins(6, 'auto', null, 'carrier-pigeon')).rejects.toThrow();
    });
  });

  test('idempotent: re-running the file after it was applied does not fail or duplicate constraints', async () => {
    const url = await dbAt0002(3);
    await migrate({ connectionString: url, dir: REAL_DIR, logger: quiet });
    await withClient(url, async (c) => {
      await c.query('BEGIN');
      await c.query(fs.readFileSync(path.join(REAL_DIR, FILE), 'utf8'));
      await c.query('COMMIT');
      const n = (await c.query("select count(*)::int n from pg_constraint where conname='diagram_versions_named_has_label'")).rows[0].n;
      expect(n).toBe(1);
    });
    await expect(migrate({ connectionString: url, dir: REAL_DIR, logger: quiet })).resolves.toBeDefined();
  });

  test('deleting a source version nulls restored_from_version_id (restore versions survive)', async () => {
    const url = await dbAt0002(4);
    await migrate({ connectionString: url, dir: REAL_DIR, logger: quiet });
    await withClient(url, async (c) => {
      const { d } = await seed(c);
      const src = (await c.query("insert into diagram_versions (diagram_id,version_number,content,created_by) values ($1,1,'{}','a') returning id", [d])).rows[0].id;
      await c.query("insert into diagram_versions (diagram_id,version_number,content,created_by,kind,restored_from_version_id) values ($1,2,'{}','a','restore',$2)", [d, src]);
      await c.query('delete from diagram_versions where id=$1', [src]);
      const r = (await c.query('select restored_from_version_id from diagram_versions where version_number=2')).rows[0];
      expect(r.restored_from_version_id).toBeNull();
    });
  });
});
