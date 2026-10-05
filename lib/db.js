// lib/db.js
// Database connection for Diagram Studio
// Schema changes are NOT applied here: see db/migrations/ and scripts/migrate.js (npm run db:migrate).

import { Pool } from 'pg';

let pool = null;

/**
 * Get database connection string
 * Uses DATABASE_URL if set, otherwise constructs from individual variables
 */
function getConnectionString() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  // Construct from individual environment variables
  const user = process.env.DB_USER || 'diagram_studio';
  const password = process.env.DB_PASSWORD || 'diagram_studio';
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5434';
  const database = process.env.DB_NAME || 'diagram_studio';

  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: getConnectionString(),
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }
  return pool;
}

export async function query(text, params) {
  const pool = getPool();
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV === 'development') {
    console.log('Query:', { text: text.substring(0, 100), duration, rows: res.rowCount });
  }
  return res;
}

export async function getClient() {
  const pool = getPool();
  const client = await pool.connect();
  return client;
}
