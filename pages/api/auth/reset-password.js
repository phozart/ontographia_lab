// pages/api/auth/reset-password.js
// API endpoint for completing a password reset

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { query } from '../../../lib/db';
import { strictLimiter } from '../../../lib/rateLimit';

// Password validation requirements
const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true,
};

/**
 * Validate password complexity
 */
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
    errors.push('Password must contain at least one special character (!@#$%^&*...)');
  }

  return { valid: errors.length === 0, errors };
}

export default async function handler(req, res) {
  // Strict rate limit: 3 attempts per 15 minutes
  const { success } = await strictLimiter.check(req, res);
  if (!success) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token, password, captchaAnswer, captchaExpected } = req.body;

    // CAPTCHA verification
    if (!captchaAnswer || !captchaExpected) {
      return res.status(400).json({ error: 'Please complete the verification challenge' });
    }

    if (captchaAnswer.toString().toLowerCase() !== captchaExpected.toString().toLowerCase()) {
      return res.status(400).json({ error: 'Incorrect verification answer. Please try again.' });
    }

    if (!token) {
      return res.status(400).json({ error: 'Reset token is required' });
    }

    if (!password) {
      return res.status(400).json({ error: 'New password is required' });
    }

    // Validate password complexity
    const passwordValidation = validatePasswordComplexity(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        error: passwordValidation.errors[0],
        passwordErrors: passwordValidation.errors,
      });
    }

    // Hash the token for comparison
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with valid reset token
    const userResult = await query(
      `SELECT id, email, reset_token_expires
       FROM users
       WHERE reset_token = $1 AND reset_token_expires > NOW()`,
      [tokenHash]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({
        error: 'Invalid or expired reset token. Please request a new password reset.',
      });
    }

    const user = userResult.rows[0];

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 12);

    // Update password and clear reset token
    await query(
      `UPDATE users
       SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL
       WHERE id = $2`,
      [passwordHash, user.id]
    );

    console.log(`Password reset completed for user: ${user.email}`);

    return res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. You can now sign in with your new password.',
    });

  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
}
