// pages/api/auth/forgot-password.js
// API endpoint for requesting a password reset

import crypto from 'crypto';
import { query } from '../../../lib/db';
import { strictLimiter } from '../../../lib/rateLimit';

// Token expires in 1 hour
const TOKEN_EXPIRY_HOURS = 1;

export default async function handler(req, res) {
  // Strict rate limit: 3 attempts per 15 minutes
  const { success } = await strictLimiter.check(req, res);
  if (!success) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, captchaAnswer, captchaExpected } = req.body;

    // CAPTCHA verification
    if (!captchaAnswer || !captchaExpected) {
      return res.status(400).json({ error: 'Please complete the verification challenge' });
    }

    if (captchaAnswer.toString().toLowerCase() !== captchaExpected.toString().toLowerCase()) {
      return res.status(400).json({ error: 'Incorrect verification answer. Please try again.' });
    }

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if user exists with email provider
    const userResult = await query(
      'SELECT id, email, name, provider FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    // Always return success to prevent email enumeration
    const successMessage = 'If an account with that email exists, you will receive a password reset link.';

    if (userResult.rows.length === 0) {
      // User doesn't exist - return success anyway to prevent enumeration
      return res.status(200).json({ success: true, message: successMessage });
    }

    const user = userResult.rows[0];

    // Check if user has email/password auth
    if (user.provider && user.provider !== 'email') {
      // User signed up with OAuth - return success to prevent enumeration
      // but don't create token
      console.log(`Password reset requested for OAuth user: ${email}`);
      return res.status(200).json({ success: true, message: successMessage });
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    // Store hashed token in database
    await query(
      `UPDATE users
       SET reset_token = $1, reset_token_expires = $2
       WHERE id = $3`,
      [resetTokenHash, expiresAt, user.id]
    );

    // In production, send email here
    // For development, log the reset URL
    const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${resetToken}`;

    console.log('═'.repeat(60));
    console.log('PASSWORD RESET LINK (Development Only):');
    console.log(`Email: ${email}`);
    console.log(`URL: ${resetUrl}`);
    console.log('This link expires in 1 hour.');
    console.log('═'.repeat(60));

    // TODO: In production, integrate with email service
    // await sendPasswordResetEmail(user.email, user.name, resetUrl);

    return res.status(200).json({
      success: true,
      message: successMessage,
      // Include reset URL in development for testing
      ...(process.env.NODE_ENV === 'development' && { resetUrl }),
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
}
