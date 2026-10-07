// Slice 5: migrations 0007_diagram_members and 0008_audit_events. DB tests use throwaway databases only.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const util = require('util');
global.TextEncoder = global.TextEncoder || util.TextEncoder;
global.TextDecoder = global.TextDecoder || util.TextDecoder;
const { Client } = require('pg');
const { migrate, getConnectionString } = require('../../scripts/migrate');

const DIR = path.join(__dirname, '..', '..', 'db', 'migrations');
const find = (n) => fs.readdirSync(DIR).find((f) => new RegExp(`^${n}_.*\\.sql$`).test(f));

describe.each([['0007'], ['0008']])('%s file (pure)', (n) => {
  const file = find(n);
  const code = file ? fs.readFileSync(path.join(DIR, file), 'utf8').replace(/--.*$/gm, '') : '';
  test('exists', () => expect(file).toBeTruthy());
  test('is additive and guarded', () => {
    expect(code).not.toMatch(/\b(DROP|TRUNCATE|DELETE\s+FROM|ALTER\s+COLUMN)\b/i);
    expect(code.match(/CREATE TABLE\s+(?!IF NOT EXISTS)/gi) || []).toEqual([]);
    expect(code.match(/CREATE (UNIQUE )?INDEX\s+(?!IF NOT EXISTS)/gi) || []).toEqual([]);
    expect(code).not.toMatch(/^\s*(BEGIN|COMMIT)\s*;/im);
  });
});

const BASE_URL = process.env.DATABASE_URL || (process.env.DB_HOST ? getConnectionString() : null);
const dbDescribe = BASE_URL ? describe : describe.skip;

dbDescribe('0007 / 0008 against a throwaway database', () => {
  const name = `diagram_studio_migtest0007_${process.pid}_${crypto.randomBytes(3).toString('hex')}`;
  let admin; let url; let pg;
  const quiet = { log: () => {}, warn: () => {} };

  beforeAll(async () => {
    admin = new Client({ connectionString: BASE_URL });
    await admin.connect();
    await admin.query(`CREATE DATABASE "${name}"`);
    const u = new URL(BASE_URL); u.pathname = `/${name}`; url = u.toString();
    await migrate({ connectionString: url, dir: DIR, logger: quiet });
    pg = new Client({ connectionString: url });
    await pg.connect();
  });
  afterAll(async () => {
    await pg?.end();
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.end();
  });

  test('applying again is a no-op and the SQL itself is idempotent', async () => {
    await migrate({ connectionString: url, dir: DIR, logger: quiet });
    for (const n of ['0007', '0008']) await pg.query(fs.readFileSync(path.join(DIR, find(n)), 'utf8'));
    const { rows } = await pg.query("select count(*)::int c from schema_migrations where version like '0007%' or version like '0008%'");
    expect(rows[0].c).toBe(2);
  });

  test('member role is constrained, (diagram,user) is unique, cascades from diagram', async () => {
    const u = (await pg.query("insert into users (email,status) values ('m@x.co','active') returning id")).rows[0].id;
    const d = (await pg.query("insert into diagrams (short_id,name,type,created_by,owner_id) values ('LAB-1','D','infinite-canvas','m@x.co',$1) returning id", [u])).rows[0].id;
    await pg.query("insert into diagram_members (diagram_id,user_id,role) values ($1,$2,'viewer')", [d, u]);
    await expect(pg.query("insert into diagram_members (diagram_id,user_id,role) values ($1,$2,'editor')", [d, u])).rejects.toThrow(/duplicate key/);
    await expect(pg.query("update diagram_members set role='owner' where diagram_id=$1", [d])).rejects.toThrow(/check/);
    await pg.query('delete from diagrams where id=$1', [d]);
    expect((await pg.query('select count(*)::int c from diagram_members')).rows[0].c).toBe(0);
  });

  test('audit actor type is constrained; target defaults to {}; diagram_id has no foreign key', async () => {
    await pg.query("insert into audit_events (actor_type, action, diagram_id) values ('system','x', gen_random_uuid())");
    expect((await pg.query('select target from audit_events limit 1')).rows[0].target).toEqual({});
    await expect(pg.query("insert into audit_events (actor_type, action) values ('root','x')")).rejects.toThrow(/check/);
  });
});
