// pages/api/admin/users/index.js
// Admin API for user management

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { requireAdmin } from '../../../../lib/useAuth';
import { query } from '../../../../lib/db';

// Generate a random password
function generateRandomPassword(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
  let password = '';
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    password += chars[randomBytes[i] % chars.length];
  }
  return password;
}

export default async function handler(req, res) {
  // Check admin authentication
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (req.method === 'GET') {
    // List all users
    try {
      const result = await query(
        `SELECT id, email, name, image, provider, role, status,
                subscription_tier, created_at, approved_at, last_login
         FROM users
         ORDER BY created_at DESC`
      );

      return res.status(200).json(result.rows);
    } catch (error) {
      console.error('Error fetching users:', error);
      return res.status(500).json({ error: 'Failed to fetch users' });
    }
  }

  if (req.method === 'POST') {
    const { userId, action, role, email, name, password, userRole, status } = req.body;

    try {
      // Create new user
      if (action === 'create') {
        if (!email) {
          return res.status(400).json({ error: 'Email is required' });
        }

        // Check if user already exists
        const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
        if (existing.rows.length > 0) {
          return res.status(409).json({ error: 'A user with this email already exists' });
        }

        // Generate password if not provided
        const userPassword = password || generateRandomPassword();
        const passwordHash = await bcrypt.hash(userPassword, 12);

        const result = await query(
          `INSERT INTO users (email, name, password_hash, provider, role, status, approved_at, approved_by, created_at)
           VALUES ($1, $2, $3, 'email', $4, $5, NOW(), $6, NOW())
           RETURNING id, email, name, role, status`,
          [
            email.toLowerCase(),
            name || null,
            passwordHash,
            userRole || 'user',
            status || 'active',
            admin.id,
          ]
        );

        return res.status(201).json({
          success: true,
          user: result.rows[0],
          temporaryPassword: password ? undefined : userPassword, // Only return if auto-generated
        });
      }

      // Reset user password
      if (action === 'reset-password') {
        if (!userId) {
          return res.status(400).json({ error: 'User ID is required' });
        }

        // Check if user exists
        const userResult = await query('SELECT id, email, provider FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) {
          return res.status(404).json({ error: 'User not found' });
        }

        const user = userResult.rows[0];

        // Generate new password
        const newPassword = password || generateRandomPassword();
        const passwordHash = await bcrypt.hash(newPassword, 12);

        // Update user with new password and set provider to 'email' if needed
        await query(
          `UPDATE users SET password_hash = $1, provider = COALESCE(NULLIF(provider, ''), 'email') WHERE id = $2`,
          [passwordHash, userId]
        );

        return res.status(200).json({
          success: true,
          temporaryPassword: password ? undefined : newPassword, // Only return if auto-generated
          message: `Password reset for ${user.email}`,
        });
      }

      // Existing actions...
      if (!userId || !action) {
        return res.status(400).json({ error: 'Missing userId or action' });
      }

      if (action === 'active' || action === 'suspended' || action === 'pending') {
        // Update status
        const approvalFields =
          action === 'active'
            ? ', approved_at = NOW(), approved_by = $3'
            : '';

        const params =
          action === 'active'
            ? [action, userId, admin.id]
            : [action, userId];

        await query(
          `UPDATE users SET status = $1${approvalFields} WHERE id = $2`,
          params
        );

        return res.status(200).json({ success: true, status: action });
      }

      if (action === 'role' && role) {
        // Update role
        if (!['user', 'admin'].includes(role)) {
          return res.status(400).json({ error: 'Invalid role' });
        }

        await query('UPDATE users SET role = $1 WHERE id = $2', [role, userId]);

        return res.status(200).json({ success: true, role });
      }

      return res.status(400).json({ error: 'Invalid action' });
    } catch (error) {
      console.error('Error managing user:', error);
      return res.status(500).json({ error: 'Failed to manage user' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
