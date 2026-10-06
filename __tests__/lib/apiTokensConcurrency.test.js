/**
 * @jest-environment node
 */
// createToken must hold the per-user limit under concurrency. Needs a Postgres; uses a throwaway database
// (created and dropped here, never the shared one).

const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');

const BASE_URL = process.env.DATABASE_URL || (process.env.DB_HOST ? require('../../scripts/migrate').getConnectionString() : null);
const dbDescribe = BASE_URL ? describe : describe.skip;

dbDescribe('createToken concurrency (throwaway database)', () => {
  const name = `diagram_studio_tokrace_${process.pid}_${crypto.randomBytes(3).toString('hex')}`;
  const urlFor = (n) => { const u = new URL(BASE_URL); u.pathname = `/${n}`; return u.toString(); };
  let admin;
  let lib;
  let db;
  let userId;

  beforeAll(async () => {
    admin = new Client({ connectionString: BASE_URL });
    await admin.connect();
    await admin.query(`CREATE DATABASE "${name}"`);
    const { migrate } = require('../../scripts/migrate');
    await migrate({ connectionString: urlFor(name), dir: path.join(__dirname, '..', '..', 'db', 'migrations'), logger: { log() {}, warn() {} } });
    const u = new URL(urlFor(name));
    process.env.DATABASE_URL = u.toString();
    process.env.DB_NAME = name;
    process.env.DB_HOST = u.hostname;
    process.env.DB_PORT = u.port;
    if (u.username) process.env.DB_USER = decodeURIComponent(u.username);
    if (u.password) process.env.DB_PASSWORD = decodeURIComponent(u.password);
    jest.resetModules();
    db = require('../../lib/db');
    lib = require('../../lib/apiTokens');
    userId = (await db.query("insert into users (email, status) values ('race@x.co','active') returning id")).rows[0].id;
  });

  afterAll(async () => {
    try { await db.getPool().end(); } catch {}
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.end();
  });

  test('30 parallel creates yield exactly the maximum active tokens', async () => {
    const input = { name: 'race', roleCap: 'viewer', diagramIds: null, expiresAt: null };
    const results = await Promise.allSettled(Array.from({ length: 30 }, () => lib.createToken(userId, input)));
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const limited = results.filter((r) => r.status === 'rejected' && r.reason.code === 'TOKEN_LIMIT').length;
    expect(ok).toBe(lib.MAX_ACTIVE_TOKENS_PER_USER);
    expect(limited).toBe(30 - ok);
    const n = (await db.query('select count(*)::int as n from api_tokens where user_id=$1 and revoked_at is null', [userId])).rows[0].n;
    expect(n).toBe(lib.MAX_ACTIVE_TOKENS_PER_USER);
  });
});
