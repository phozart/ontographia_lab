// lib/auth.js
// Authentication using central Ontographia database

import { Pool } from 'pg';

let authPool = null;

function getAuthPool() {
  if (!authPool) {
    // Use AUTH_DATABASE_URL if set, otherwise fall back to main DATABASE_URL
    const connectionString = process.env.AUTH_DATABASE_URL || process.env.DATABASE_URL;

    authPool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    authPool.on('error', (err) => {
      console.error('Auth database connection error', err);
    });
  }
  return authPool;
}

export async function validateSession(token) {
  if (!token) return null;

  try {
    const pool = getAuthPool();
    const result = await pool.query(
      `SELECT s.*, u.username, u.role
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token = $1 AND s.expires_at > NOW()`,
      [token]
    );

    if (result.rows.length === 0) return null;

    const session = result.rows[0];
    return {
      user: session.username,
      role: session.role,
      userId: session.user_id,
    };
  } catch (err) {
    console.error('Session validation error:', err);
    return null;
  }
}

export async function login(username, password) {
  try {
    const pool = getAuthPool();

    // Find user
    const userResult = await pool.query(
      'SELECT id, username, password_hash, role FROM users WHERE username = $1',
      [username]
    );

    if (userResult.rows.length === 0) {
      return { success: false, error: 'Invalid credentials' };
    }

    const user = userResult.rows[0];

    // Simple password check (in production, use bcrypt.compare)
    // This assumes password_hash stores a simple hash or the password itself for dev
    const isValid = user.password_hash === password ||
                    user.password_hash === `hashed_${password}`;

    if (!isValid) {
      return { success: false, error: 'Invalid credentials' };
    }

    // Create session
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await pool.query(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    );

    return {
      success: true,
      token,
      user: {
        username: user.username,
        role: user.role,
      },
    };
  } catch (err) {
    console.error('Login error:', err);
    return { success: false, error: 'Login failed' };
  }
}

export async function logout(token) {
  try {
    const pool = getAuthPool();
    await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
    return { success: true };
  } catch (err) {
    console.error('Logout error:', err);
    return { success: false };
  }
}

function generateToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// Middleware helper to get user from request
export function getUserFromRequest(req) {
  // First check headers (for API calls)
  const headerUser = req.headers['x-user'];
  const headerRole = req.headers['x-role'];
  if (headerUser && headerRole) {
    return { user: headerUser, role: headerRole };
  }

  // Then check cookies (for browser sessions)
  const token = req.cookies?.['diagram-studio-session'];
  if (token) {
    // Note: This would need to be async in real usage
    return null; // Return null here, use validateSession for async
  }

  return null;
}
