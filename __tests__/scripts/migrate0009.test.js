// M2: migration 0009_editor_api_tokens. DB tests use a throwaway database only.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const util = require('util');
global.TextEncoder = global.TextEncoder || util.TextEncoder;
global.TextDecoder = global.TextDecoder || util.TextDecoder;
const { Client } = require('pg');
const { migrate, getConnectionString } = require('../../scripts/migrate');

const DIR = path.join(__dirname, '..', '..', 'db', 'migrations');
const file = fs.readdirSync(DIR).find((f) => /^0009_.*\.sql$/.test(f));

describe('0009 file (pure)', () => {
  const code = file ? fs.readFileSync(path.join(DIR, file), 'utf8').replace(/--.*$/gm, '') : '';
  test('exists and has no transaction control or data deletion', () => {
    expect(file).toBeTruthy();
    expect(code).not.toMatch(/^\s*(BEGIN|COMMIT)\s*;/im);
    expect(code).not.toMatch(/\b(TRUNCATE|DELETE\s+FROM|DROP\s+TABLE|DROP\s+COLUMN)\b/i);
  });
});

const BASE_URL = process.env.DATABASE_URL || (process.env.DB_HOST ? getConnectionString() : null);
const dbDescribe = BASE_URL ? describe : describe.skip;

dbDescribe('0009 against a throwaway database', () => {
  const name = `diagram_studio_migtest0009_${process.pid}_${crypto.randomBytes(3).toString('hex')}`;
  let admin; let pg; let url; let user; let diagram;
  const silent = { log() {}, warn() {} };

  beforeAll(async () => {
    admin = new Client({ connectionString: BASE_URL });
    await admin.connect();
    await admin.query(`CREATE DATABASE "${name}"`);
    const u = new URL(BASE_URL); u.pathname = `/${name}`; url = u.toString();
    await migrate({ connectionString: url, dir: DIR, logger: silent });
    pg = new Client({ connectionString: url });
    await pg.connect();
    user = (await pg.query("insert into users (email,name,status) values ('t@x.co','T','active') returning id")).rows[0].id;
    diagram = (await pg.query("insert into diagrams (short_id,name,type,created_by,owner_id,content) values ('LAB-9','D','infinite-canvas','t@x.co',$1,'{}') returning id", [user])).rows[0].id;
  });
  afterAll(async () => {
    await pg?.end();
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.end();
  });

  const insert = (role, ids) => pg.query(
    'insert into api_tokens (user_id,name,token_prefix,token_hash,role_cap,diagram_ids) values ($1,$2,$3,$4,$5,$6)',
    [user, 't', 'ogl_', crypto.randomBytes(32).toString('hex'), role, ids]
  );

  test('editor with an allowlist is accepted', async () => {
    await expect(insert('editor', [diagram])).resolves.toBeDefined();
  });
  test('editor without an allowlist (NULL or empty) is refused by the database', async () => {
    await expect(insert('editor', null)).rejects.toThrow(/api_tokens_editor_requires_allowlist/);
    await expect(insert('editor', [])).rejects.toThrow(/api_tokens_editor_requires_allowlist/);
  });
  test('viewer and commenter work with or without an allowlist; owner/unknown roles are refused', async () => {
    await insert('viewer', null);
    await insert('commenter', [diagram]);
    await expect(insert('owner', [diagram])).rejects.toThrow(/api_tokens_role_cap_check/);
    await expect(insert('admin', [diagram])).rejects.toThrow(/api_tokens_role_cap_check/);
  });
  test('re-running the migration is a no-op', async () => {
    await migrate({ connectionString: url, dir: DIR, logger: silent });
    await expect(insert('editor', null)).rejects.toThrow(/api_tokens_editor_requires_allowlist/);
  });
});
