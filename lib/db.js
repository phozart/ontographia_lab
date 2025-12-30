// lib/db.js
// Database connection for Diagram Studio

import { Pool } from 'pg';

let pool = null;
let migrationsRun = false;

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

/**
 * Run database migrations automatically
 */
async function runMigrations(pool) {
  if (migrationsRun) return;
  migrationsRun = true;

  try {
    // Check if short_id column exists
    const columnCheck = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'diagrams' AND column_name = 'short_id'
    `);

    if (columnCheck.rows.length === 0) {
      console.log('[Migration] Adding short_id column to diagrams table...');

      // Add the column
      await pool.query(`
        ALTER TABLE diagrams ADD COLUMN short_id VARCHAR(20) UNIQUE
      `);

      // Add index
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_diagrams_short_id ON diagrams(short_id)
      `);

      // Backfill existing diagrams with short IDs
      const existing = await pool.query(`
        SELECT id FROM diagrams WHERE short_id IS NULL ORDER BY created_at ASC
      `);

      if (existing.rows.length > 0) {
        console.log(`[Migration] Backfilling ${existing.rows.length} diagrams with short IDs...`);

        for (let i = 0; i < existing.rows.length; i++) {
          const shortId = `LAB-${i + 1}`;
          await pool.query(
            'UPDATE diagrams SET short_id = $1 WHERE id = $2',
            [shortId, existing.rows[i].id]
          );
        }

        console.log('[Migration] Backfill complete.');
      }

      console.log('[Migration] short_id column added successfully.');
    }
  } catch (err) {
    console.error('[Migration] Error running migrations:', err.message);
    // Don't throw - allow app to continue even if migration fails
  }
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

    // Run migrations on first connection
    runMigrations(pool);
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
