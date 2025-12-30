#!/usr/bin/env node
/**
 * Admin Account Seeding Script
 *
 * Creates the initial admin account from environment variables.
 * Run with: npm run db:seed
 *
 * Environment variables required:
 * - DATABASE_URL: PostgreSQL connection string
 * - ADMIN_EMAIL: Admin account email
 * - ADMIN_PASSWORD: Admin account password (min 8 characters)
 * - ADMIN_NAME: Admin display name (optional, defaults to "Administrator")
 */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Load environment variables
require('dotenv').config();

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

const pool = new Pool({
  connectionString: getConnectionString(),
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function seedAdmin() {
  const client = await pool.connect();

  try {
    console.log('🌱 Starting admin account seeding...\n');

    // Validate environment variables
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminName = process.env.ADMIN_NAME || 'Administrator';

    if (!adminEmail) {
      console.error('❌ Error: ADMIN_EMAIL environment variable is required');
      process.exit(1);
    }

    if (!adminPassword) {
      console.error('❌ Error: ADMIN_PASSWORD environment variable is required');
      process.exit(1);
    }

    if (adminPassword.length < 8) {
      console.error('❌ Error: ADMIN_PASSWORD must be at least 8 characters');
      process.exit(1);
    }

    // Check if admin already exists
    const existingUser = await client.query(
      'SELECT id, email, role, status, provider FROM users WHERE email = $1',
      [adminEmail]
    );

    if (existingUser.rows.length > 0) {
      const user = existingUser.rows[0];
      console.log(`ℹ️  User with email ${adminEmail} already exists`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Status: ${user.status}`);
      console.log(`   Provider: ${user.provider}`);

      // Ensure user is admin and active
      if (user.role !== 'admin' || user.status !== 'active') {
        console.log('\n🔄 Updating user to admin with active status...');
        await client.query(
          `UPDATE users
           SET role = 'admin',
               status = 'active',
               approved_at = NOW()
           WHERE email = $1`,
          [adminEmail]
        );
        console.log('✅ User updated to admin');
      }

      // Update password if it's an email provider account
      if (user.provider === 'email' || !user.provider) {
        console.log('\n🔄 Updating admin password...');
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        await client.query(
          'UPDATE users SET password_hash = $1 WHERE email = $2',
          [hashedPassword, adminEmail]
        );
        console.log('✅ Admin password updated');
      }

      console.log('\n✅ Admin account ready!');
      return;
    }

    // Create new admin account
    console.log(`📝 Creating admin account for: ${adminEmail}`);

    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    const result = await client.query(
      `INSERT INTO users (
        email,
        name,
        password_hash,
        provider,
        role,
        status,
        subscription_tier,
        created_at,
        approved_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING id, email, name, role, status`,
      [
        adminEmail,
        adminName,
        hashedPassword,
        'email',
        'admin',
        'active',
        'enterprise', // Give admin enterprise tier
      ]
    );

    const newUser = result.rows[0];
    console.log('\n✅ Admin account created successfully!');
    console.log(`   ID: ${newUser.id}`);
    console.log(`   Email: ${newUser.email}`);
    console.log(`   Name: ${newUser.name}`);
    console.log(`   Role: ${newUser.role}`);
    console.log(`   Status: ${newUser.status}`);

  } catch (error) {
    console.error('\n❌ Error seeding admin account:', error.message);

    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Hint: Make sure the database is running');
      console.error('   Run: docker-compose up -d db');
    }

    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Additional function to list all admins
async function listAdmins() {
  const client = await pool.connect();

  try {
    const result = await client.query(
      `SELECT id, email, name, role, status, provider, created_at, last_login
       FROM users
       WHERE role = 'admin'
       ORDER BY created_at ASC`
    );

    console.log('\n👑 Admin Accounts:\n');

    if (result.rows.length === 0) {
      console.log('   No admin accounts found');
      return;
    }

    result.rows.forEach((admin, i) => {
      console.log(`   ${i + 1}. ${admin.email}`);
      console.log(`      Name: ${admin.name || 'N/A'}`);
      console.log(`      Provider: ${admin.provider || 'email'}`);
      console.log(`      Status: ${admin.status}`);
      console.log(`      Created: ${admin.created_at?.toISOString() || 'N/A'}`);
      console.log(`      Last Login: ${admin.last_login?.toISOString() || 'Never'}`);
      console.log('');
    });

  } finally {
    client.release();
    await pool.end();
  }
}

// Parse command line arguments
const command = process.argv[2];

if (command === 'list') {
  listAdmins();
} else {
  seedAdmin();
}
