// pages/api/auth/change-password.js
// API endpoint for authenticated users to change their password

import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './[...nextauth]';
import { query } from '../../../lib/db';

// Password validation requirements
const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true,
};

function validatePasswordComplexity(password) {
  const errors = [];

  if (!password || typeof password !== 'string') {
    return { valid: false, errors: ['Password is required'] };
  }

  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    errors.push(`Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters`);
  }

  if (password.length > PASSWORD_REQUIREMENTS.maxLength) {
    errors.push(`Password must be no more than ${PASSWORD_REQUIREMENTS.maxLength} characters`);
  }

  if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (PASSWORD_REQUIREMENTS.requireNumber && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (PASSWORD_REQUIREMENTS.requireSpecial && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return { valid: errors.length === 0, errors };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check authentication
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'You must be logged in to change your password' });
  }

  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    // Get user from database
    const userResult = await query(
      'SELECT id, email, password_hash, provider FROM users WHERE email = $1',
      [session.user.email]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Check if user has password auth
    if (!user.password_hash) {
      return res.status(400).json({
        error: 'Your account uses Google/GitHub login. Password cannot be changed here.',
      });
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Validate new password complexity
    const validation = validatePasswordComplexity(newPassword);
    if (!validation.valid) {
      return res.status(400).json({
        error: validation.errors[0],
        passwordErrors: validation.errors,
      });
    }

    // Check new password is different
    const isSame = await bcrypt.compare(newPassword, user.password_hash);
    if (isSame) {
      return res.status(400).json({ error: 'New password must be different from current password' });
    }

    // Hash and save new password
    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    await query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [newPasswordHash, user.id]
    );

    console.log(`Password changed for user: ${user.email}`);

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });

  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
}
