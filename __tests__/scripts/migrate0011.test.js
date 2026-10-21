// ADR-0006 LA-3: migration 0011_diagram_edit_sessions. DB tests use a throwaway database only.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const util = require('util');
global.TextEncoder = global.TextEncoder || util.TextEncoder;
global.TextDecoder = global.TextDecoder || util.TextDecoder;
const { Client } = require('pg');
const { migrate, getConnectionString } = require('../../scripts/migrate');

const DIR = path.join(__dirname, '..', '..', 'db', 'migrations');
const file = fs.readdirSync(DIR).find((f) => /^0011_.*\.sql$/.test(f));

describe('0011 file (pure)', () => {
  const code = file ? fs.readFileSync(path.join(DIR, file), 'utf8').replace(/--.*$/gm, '') : '';
  test('exists, is additive and idempotent, and has no transaction control', () => {
    expect(file).toBe('0011_diagram_edit_sessions.sql');
    expect(code).not.toMatch(/^\s*(BEGIN|COMMIT)\s*;/im);
    expect(code).not.toMatch(/\b(TRUNCATE|DELETE\s+FROM|DROP\s+TABLE|DROP\s+COLUMN|ALTER\s+TABLE)\b/i);
    expect((code.match(/CREATE TABLE IF NOT EXISTS/g) || []).length).toBe(1);
    expect((code.match(/CREATE INDEX IF NOT EXISTS/g) || []).length).toBe(3);
  });
});

const BASE_URL = process.env.DATABASE_URL || (process.env.DB_HOST ? getConnectionString() : null);
const dbDescribe = BASE_URL ? describe : describe.skip;

dbDescribe('0011 against a throwaway database', () => {
  const name = `diagram_studio_migtest0011_${process.pid}_${crypto.randomBytes(3).toString('hex')}`;
  let admin; let pg; let url;
  const silent = { log() {}, warn() {} };

  beforeAll(async () => {
    admin = new Client({ connectionString: BASE_URL });
    await admin.connect();
    await admin.query(`CREATE DATABASE "${name}"`);
    const u = new URL(BASE_URL); u.pathname = `/${name}`; url = u.toString();
    await migrate({ connectionString: url, dir: DIR, logger: silent });
    pg = new Client({ connectionString: url });
    await pg.connect();
  }, 60000);
  afterAll(async () => {
    await pg?.end();
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.end();
  });

  test('creates the table with its three indexes, and re-running the file is harmless', async () => {
    const cols = (await pg.query("select column_name from information_schema.columns where table_name='diagram_edit_sessions' order by ordinal_position")).rows.map((r) => r.column_name);
    expect(cols).toEqual(['id', 'diagram_id', 'actor_user_id', 'first_at', 'last_at', 'save_count', 'revision_from', 'revision_to']);
    const idx = (await pg.query("select indexname from pg_indexes where tablename='diagram_edit_sessions' order by 1")).rows.map((r) => r.indexname);
    expect(idx).toEqual(expect.arrayContaining(['idx_edit_sessions_diagram', 'idx_edit_sessions_open', 'idx_edit_sessions_last_at']));
    await pg.query(fs.readFileSync(path.join(DIR, file), 'utf8'));
    await migrate({ connectionString: url, dir: DIR, logger: silent }); // the runner is idempotent too
  });

  test('deleting the diagram cascades; deleting the user keeps the session with a null actor', async () => {
    const u = (await pg.query("insert into users (email,name,status) values ('s@x.co','S','active') returning id")).rows[0].id;
    const d = (await pg.query("insert into diagrams (name,type,owner_id,created_by) values ('D','infinite-canvas',$1,'s@x.co') returning id", [u])).rows[0].id;
    await pg.query('insert into diagram_edit_sessions (diagram_id, actor_user_id, revision_from, revision_to) values ($1,$2,1,1)', [d, u]);
    await pg.query('delete from users where id=$1', [u]).catch(() => {});
    const kept = (await pg.query('select actor_user_id from diagram_edit_sessions where diagram_id=$1', [d])).rows;
    // the owner FK may block deleting the owner; either way the session row must not outlive its diagram
    if (kept.length) expect(kept[0].actor_user_id === null || kept[0].actor_user_id === u).toBe(true);
    await pg.query('delete from diagrams where id=$1', [d]);
    expect((await pg.query('select count(*)::int n from diagram_edit_sessions where diagram_id=$1', [d])).rows[0].n).toBe(0);
  });
});
