// Shared setup for OAuth database tests: a THROWAWAY database, migrated, with lib/db pointed at it.
const util = require('util');
global.TextEncoder = global.TextEncoder || util.TextEncoder;
global.TextDecoder = global.TextDecoder || util.TextDecoder;
const crypto = require('crypto');
const path = require('path');
const { Client } = require('pg');
const { migrate, getConnectionString } = require('../../scripts/migrate');

const BASE_URL = process.env.DATABASE_URL || (process.env.DB_HOST ? getConnectionString() : null);

async function setupOauthDb(tag) {
  const name = `diagram_studio_${tag}_${process.pid}_${crypto.randomBytes(3).toString('hex')}`;
  const admin = new Client({ connectionString: BASE_URL });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${name}"`);
  const u = new URL(BASE_URL);
  u.pathname = `/${name}`;
  await migrate({ connectionString: u.toString(), dir: path.join(__dirname, '..', '..', 'db', 'migrations'), logger: { log() {}, warn() {} } });
  process.env.DATABASE_URL = u.toString();
  const pg = new Client({ connectionString: u.toString() });
  await pg.connect();
  let seq = 0;
  const db = {
    pg,
    url: u.toString(),
    async user(email, { role = 'user', status = 'active' } = {}) {
      return (await pg.query('insert into users (email,name,role,status) values ($1,$2,$3,$4) returning id,email,role,status', [email, email.split('@')[0], role, status])).rows[0];
    },
    async diagram(owner, content = { elements: [], connections: [], layers: [], groups: [], viewport: { x: 0, y: 0, zoom: 1 } }) {
      seq += 1;
      return (await pg.query(
        "insert into diagrams (short_id,name,type,created_by,owner_id,content) values ($1,'D','infinite-canvas',$2,$3,$4) returning id, short_id",
        [`LAB-${seq + 100}`, owner.email, owner.id, JSON.stringify(content)])).rows[0];
    },
    async member(diagramId, userId, role) {
      await pg.query('insert into diagram_members (diagram_id,user_id,role) values ($1,$2,$3)', [diagramId, userId, role]);
    },
    async teardown() {
      try { await require('../../lib/db').getPool().end(); } catch (_) { /* ignore */ }
      await pg.end();
      await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      await admin.end();
    },
  };
  return db;
}

module.exports = { setupOauthDb, BASE_URL };
