// pages/api/auth/forgot-password.js
// API endpoint for requesting a password reset

import crypto from 'crypto';
import { verifyCaptcha, isProvided } from '../../../lib/captcha';
import { query } from '../../../lib/db';
import { strictLimiter } from '../../../lib/rateLimit';
import { isEmailConfigured, sendMail } from '../../../lib/email';
import { passwordResetEmail } from '../../../lib/emailTemplates';

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
    const { email, captchaAnswer, captchaToken } = req.body;

    // CAPTCHA verification (server-issued, signed challenge)
    const captcha = verifyCaptcha(captchaToken, captchaAnswer);
    if (!captcha.valid) {
      return res.status(400).json({
        error: isProvided(captchaAnswer) && isProvided(captchaToken)
          ? 'Incorrect or expired verification. Please try again.'
          : 'Please complete the verification challenge',
      });
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
      console.log('Password reset requested for an OAuth-only account');
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

    const isDev = process.env.NODE_ENV === 'development';
    const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${resetToken}`;
    const emailConfigured = isEmailConfigured();

    if (emailConfigured) {
      // Fire-and-forget: awaiting delivery would make response time reveal
      // whether the account exists. A failure is only logged (no token) and
      // the stored token stays valid so a retry works.
      const logFailure = (sendError) =>
        console.error('Password reset email delivery failed:', sendError && sendError.message);
      try {
        const message = passwordResetEmail({ resetUrl, expiresInHours: TOKEN_EXPIRY_HOURS });
        Promise.resolve(sendMail({ to: user.email, ...message })).catch(logFailure);
      } catch (sendError) {
        logFailure(sendError);
      }
    } else if (isDev) {
      // Local development without SMTP: surface the link directly.
      console.log(`[dev] Password reset link for ${email}: ${resetUrl}`);
    } else {
      // Never log the token or URL outside development.
      console.warn('Password reset requested but email transport not configured (set SMTP_HOST and EMAIL_FROM); no email sent.');
    }

    return res.status(200).json({
      success: true,
      message: successMessage,
      ...(isDev && !emailConfigured && { resetUrl }),
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
}
