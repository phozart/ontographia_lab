#!/usr/bin/env node
// scripts/init-db.js
// Database initialization script - creates required tables if they don't exist

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load .env file manually (no dotenv dependency needed)
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        if (key && !process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  }
}

loadEnv();

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

async function initDatabase() {
  const connectionString = getConnectionString();

  if (!connectionString) {
    console.error('❌ Database connection not configured. Please check your .env file.');
    console.error('   Set either DATABASE_URL or individual DB_* variables.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: connectionString,
  });

  console.log('🔧 Initializing database...\n');

  try {
    // Create user_settings table
    console.log('Creating user_settings table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_settings (
        id SERIAL PRIMARY KEY,
        user_email TEXT NOT NULL UNIQUE,
        settings JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('✓ user_settings table ready');

    // Create index if not exists
    console.log('Creating indexes...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_settings_email ON user_settings(user_email);
    `);
    console.log('✓ Indexes ready');

    // Add password_hash column to users table for email/password auth
    console.log('Adding password_hash column to users table...');
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
    `);
    console.log('✓ password_hash column ready');

    // Add email_verified column to users table
    console.log('Adding email_verified column to users table...');
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
    `);
    console.log('✓ email_verified column ready');

    // Add password reset columns to users table
    console.log('Adding password reset columns to users table...');
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT;
    `);
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP WITH TIME ZONE;
    `);
    console.log('✓ Password reset columns ready');

    // Add terms acceptance columns to users table
    console.log('Adding terms acceptance columns to users table...');
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS accepted_terms BOOLEAN DEFAULT FALSE;
    `);
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS accepted_terms_at TIMESTAMP WITH TIME ZONE;
    `);
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS accepted_privacy BOOLEAN DEFAULT FALSE;
    `);
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS accepted_privacy_at TIMESTAMP WITH TIME ZONE;
    `);
    console.log('✓ Terms acceptance columns ready');

    console.log('\n✅ Database initialization complete!');
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initDatabase();
