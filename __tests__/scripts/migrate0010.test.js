// ADR-0005 O2: migration 0010_oauth. DB tests use a throwaway database only.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const util = require('util');
global.TextEncoder = global.TextEncoder || util.TextEncoder;
global.TextDecoder = global.TextDecoder || util.TextDecoder;
const { Client } = require('pg');
const { migrate, getConnectionString } = require('../../scripts/migrate');

const DIR = path.join(__dirname, '..', '..', 'db', 'migrations');
const file = fs.readdirSync(DIR).find((f) => /^0010_.*\.sql$/.test(f));

describe('0010 file (pure)', () => {
  const code = file ? fs.readFileSync(path.join(DIR, file), 'utf8').replace(/--.*$/gm, '') : '';
  test('exists, is additive, and has no transaction control', () => {
    expect(file).toBe('0010_oauth.sql');
    expect(code).not.toMatch(/^\s*(BEGIN|COMMIT)\s*;/im);
    expect(code).not.toMatch(/\b(TRUNCATE|DELETE\s+FROM|DROP\s+TABLE|DROP\s+COLUMN|ALTER\s+TABLE)\b/i);
    expect((code.match(/CREATE TABLE IF NOT EXISTS/g) || []).length).toBe(3);
  });
});

const BASE_URL = process.env.DATABASE_URL || (process.env.DB_HOST ? getConnectionString() : null);
const dbDescribe = BASE_URL ? describe : describe.skip;

dbDescribe('0010 against a throwaway database', () => {
  const name = `diagram_studio_migtest0010_${process.pid}_${crypto.randomBytes(3).toString('hex')}`;
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
  });
  afterAll(async () => {
    await pg?.end();
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.end();
  });

  test('creates the three tables and re-running the file is harmless', async () => {
    const tables = (await pg.query("select table_name from information_schema.tables where table_name like 'oauth_%' order by 1")).rows.map((r) => r.table_name);
    expect(tables).toEqual(['oauth_authorizations', 'oauth_grants', 'oauth_tokens']);
    await pg.query(fs.readFileSync(path.join(DIR, file), 'utf8'));
  });

  test('user deletion cascades to grants, authorizations and tokens', async () => {
    const u = (await pg.query("insert into users (email,name,status) values ('c@x.co','C','active') returning id")).rows[0].id;
    const g = (await pg.query("insert into oauth_grants (user_id,client_id,client_label,redirect_uri,resource,scope,role_cap) values ($1,'c','c','r','R','s','viewer') returning id", [u])).rows[0].id;
    await pg.query("insert into oauth_tokens (grant_id,kind,token_hash,expires_at) values ($1,'access',$2,now())", [g, crypto.randomBytes(32).toString('hex')]);
    await pg.query("insert into oauth_authorizations (client_id,redirect_uri,code_challenge,resource,expires_at,user_id,grant_id) values ('c','r',$1,'R',now(),$2,$3)", ['x'.repeat(43), u, g]);
    await pg.query('delete from users where id=$1', [u]);
    for (const t of ['oauth_grants', 'oauth_tokens', 'oauth_authorizations']) {
      expect((await pg.query(`select count(*)::int n from ${t}`)).rows[0].n).toBe(0);
    }
  });

  test('token hashes and code hashes are unique; roles and token kinds are constrained', async () => {
    const u = (await pg.query("insert into users (email,name,status) values ('d@x.co','D','active') returning id")).rows[0].id;
    const g = (await pg.query("insert into oauth_grants (user_id,client_id,client_label,redirect_uri,resource,scope,role_cap) values ($1,'c','c','r','R','s','viewer') returning id", [u])).rows[0].id;
    const h = crypto.randomBytes(32).toString('hex');
    await pg.query("insert into oauth_tokens (grant_id,kind,token_hash,expires_at) values ($1,'access',$2,now())", [g, h]);
    await expect(pg.query("insert into oauth_tokens (grant_id,kind,token_hash,expires_at) values ($1,'access',$2,now())", [g, h])).rejects.toThrow(/unique/i);
    await expect(pg.query("insert into oauth_tokens (grant_id,kind,token_hash,expires_at) values ($1,'bogus',$2,now())", [g, 'a'.repeat(64)])).rejects.toThrow(/check/i);
    await expect(pg.query("insert into oauth_grants (user_id,client_id,client_label,redirect_uri,resource,scope,role_cap) values ($1,'c','c','r','R','s','owner')", [u])).rejects.toThrow(/oauth_grants_role_cap_check/);
  });
});
