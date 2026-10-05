#!/usr/bin/env node
// scripts/migrate.js
// Minimal forward-only SQL migration runner (docs/architecture/data-model.md §1).
//
//   npm run db:migrate            apply pending migrations
//   node scripts/migrate.js status   list applied / pending, change nothing
//
// - Files: db/migrations/NNNN_snake_case.sql, applied in lexical order.
// - Ledger: schema_migrations(version, checksum, applied_at). An applied file whose
//   sha256 no longer matches is a hard error (edit-after-apply is never silent).
// - Each file runs in its own transaction together with its ledger insert, so a failing
//   migration leaves no trace. Files therefore must not contain BEGIN/COMMIT themselves.
// - A session-level pg_advisory_lock serializes concurrent runners (e.g. two containers).
// - Rollback is forward-fix only: write a new migration. Back up (pg_dump) before deploys.
// - Migrations must be idempotent (IF NOT EXISTS / guarded DDL) because production was created
//   from init.sql before this ledger existed.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');

const DEFAULT_DIR = path.join(__dirname, '..', 'db', 'migrations');
// Arbitrary constant shared by all runners of this app ("DSMIGR")
const ADVISORY_LOCK_KEY = 4407243;
const NAME_RE = /^(\d{4})_[a-z0-9_]+\.sql$/;

function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    const value = rest.join('=').replace(/^["']|["']$/g, '');
    if (key && !process.env[key]) process.env[key] = value;
  }
}

// Same resolution order as lib/db.js
function getConnectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const user = process.env.DB_USER || 'diagram_studio';
  const password = process.env.DB_PASSWORD || 'diagram_studio';
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5434';
  const database = process.env.DB_NAME || 'diagram_studio';
  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

function checksumOf(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/** @returns {{version:string, file:string, sql:string, checksum:string}[]} sorted */
function listMigrationFiles(dir = DEFAULT_DIR) {
  const entries = fs.readdirSync(dir).filter((f) => !f.startsWith('.') && f.endsWith('.sql')).sort();
  const seen = new Map();
  const files = [];
  for (const file of entries) {
    const m = NAME_RE.exec(file);
    if (!m) throw new Error(`Invalid migration file name "${file}" (expected NNNN_snake_case.sql)`);
    if (seen.has(m[1])) throw new Error(`Duplicate migration number ${m[1]}: "${seen.get(m[1])}" and "${file}"`);
    seen.set(m[1], file);
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    if (/^\s*(BEGIN|COMMIT|ROLLBACK|END)\s*;|^\s*START\s+TRANSACTION\b/im.test(sql)) {
      throw new Error(`Migration "${file}" manages its own transaction; the runner wraps each file in one`);
    }
    files.push({ version: file.replace(/\.sql$/, ''), file, sql, checksum: checksumOf(sql) });
  }
  return files;
}

// Errors that retrying cannot fix: 28P01 bad password, 28000 invalid authorization, 3D000 database missing
const FATAL_CONNECT_CODES = new Set(['28P01', '28000', '3D000']);
function isFatalConnectError(err) {
  return !!err && FATAL_CONNECT_CODES.has(err.code);
}

async function connectWithRetry(connectionString, { attempts = 10, delayMs = 2000, logger }) {
  let lastErr;
  for (let i = 1; i <= attempts; i += 1) {
    const client = new Client({ connectionString });
    try {
      await client.connect();
      return client;
    } catch (err) {
      lastErr = err;
      try { await client.end(); } catch (_) { /* ignore */ }
      if (isFatalConnectError(err)) throw err;
      if (i < attempts) {
        logger.warn(`[migrate] database not reachable (${err.code || err.message}); retry ${i}/${attempts - 1}`);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  throw lastErr;
}

const LEDGER_DDL = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version     TEXT PRIMARY KEY,
    checksum    TEXT NOT NULL,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

/**
 * Apply pending migrations.
 * @param {{connectionString?:string, dir?:string, logger?:{log:Function,warn:Function}, dryRun?:boolean, retries?:number, retryDelayMs?:number, lockTimeout?:string, statementTimeout?:string}} opts
 * @returns {Promise<{applied:string[], skipped:string[], pending:string[]}>}
 */
async function migrate({ connectionString = getConnectionString(), dir = DEFAULT_DIR, logger = console, dryRun = false, retries, retryDelayMs, lockTimeout = '15s', statementTimeout = '5min' } = {}) {
  const files = listMigrationFiles(dir);
  const client = await connectWithRetry(connectionString, { logger, attempts: retries || 10, delayMs: retryDelayMs === undefined ? 2000 : retryDelayMs });
  const applied = [];
  const skipped = [];
  const pending = [];
  try {
    await client.query('SELECT pg_advisory_lock($1)', [ADVISORY_LOCK_KEY]);
    try {
      if (!dryRun) await client.query(LEDGER_DDL);
      const ledgerExists = (await client.query("SELECT to_regclass('public.schema_migrations') AS r")).rows[0].r !== null;
      const rows = ledgerExists
        ? (await client.query('SELECT version, checksum FROM schema_migrations ORDER BY version')).rows
        : [];
      const done = new Map(rows.map((r) => [r.version, r.checksum]));

      for (const f of files) {
        if (done.has(f.version)) {
          if (done.get(f.version) !== f.checksum) {
            throw new Error(
              `Checksum mismatch for applied migration ${f.version}: the file changed after it was applied. ` +
              'Never edit an applied migration; add a new one instead.'
            );
          }
          skipped.push(f.version);
        }
      }
      for (const v of done.keys()) {
        if (!files.some((f) => f.version === v)) {
          logger.warn(`[migrate] applied migration ${v} has no file in ${dir} (app rolled back?)`);
        }
      }

      for (const f of files) {
        if (done.has(f.version)) continue;
        if (dryRun) { pending.push(f.version); continue; }
        logger.log(`[migrate] applying ${f.version}`);
        try {
          await client.query('BEGIN');
          // Fail (and let the container retry) instead of queueing behind a long-running transaction
          // and, in turn, blocking application traffic behind our DDL lock request.
          await client.query(`SET LOCAL lock_timeout = '${lockTimeout}'`);
          await client.query(`SET LOCAL statement_timeout = '${statementTimeout}'`);
          await client.query(f.sql);
          await client.query('INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)', [f.version, f.checksum]);
          await client.query('COMMIT');
        } catch (err) {
          try { await client.query('ROLLBACK'); } catch (_) { /* connection already aborted */ }
          const wrapped = new Error(`Migration ${f.version} failed: ${err.message}`);
          wrapped.cause = err;
          throw wrapped;
        }
        applied.push(f.version);
      }
      if (applied.length === 0 && pending.length === 0) logger.log('[migrate] database is up to date');
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]).catch(() => {});
    }
  } finally {
    await client.end().catch(() => {});
  }
  return { applied, skipped, pending };
}

async function main() {
  loadEnvFile();
  const command = process.argv[2];
  try {
    if (command === 'status') {
      const res = await migrate({ dryRun: true });
      console.log(`applied: ${res.skipped.join(', ') || '(none)'}`);
      console.log(`pending: ${res.pending.join(', ') || '(none)'}`);
    } else if (!command) {
      await migrate();
    } else {
      console.error(`Unknown command "${command}". Usage: migrate.js [status]`);
      process.exit(2);
    }
  } catch (err) {
    console.error(`[migrate] FAILED: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { migrate, isFatalConnectError, listMigrationFiles, checksumOf, getConnectionString, ADVISORY_LOCK_KEY };
