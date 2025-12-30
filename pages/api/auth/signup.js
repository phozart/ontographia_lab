// pages/api/auth/signup.js
// API endpoint for email/password user registration

import bcrypt from 'bcryptjs';
import { query } from '../../../lib/db';
import { authLimiter } from '../../../lib/rateLimit';

// Password validation requirements
const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true,
};

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate password complexity
 * Returns { valid: boolean, errors: string[] }
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
  // Rate limit: 5 attempts per minute
  const { success } = await authLimiter.check(req, res);
  if (!success) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password, name, acceptedTerms, acceptedPrivacy, website, captchaAnswer, captchaExpected } = req.body;

    // Honeypot check - if 'website' field is filled, it's likely a bot
    if (website) {
      // Silently reject but return success to confuse bots
      return res.status(201).json({
        success: true,
        message: 'Account created successfully. Please wait for admin approval.',
        user: { email: 'submitted' },
      });
    }

    // CAPTCHA verification
    if (!captchaAnswer || !captchaExpected) {
      return res.status(400).json({ error: 'Please complete the verification challenge' });
    }

    if (captchaAnswer.toString().toLowerCase() !== captchaExpected.toString().toLowerCase()) {
      return res.status(400).json({ error: 'Incorrect verification answer. Please try again.' });
    }

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Validate terms and privacy acceptance
    if (!acceptedTerms) {
      return res.status(400).json({ error: 'You must accept the Terms of Service' });
    }

    if (!acceptedPrivacy) {
      return res.status(400).json({ error: 'You must accept the Privacy Policy' });
    }

    // Validate email format
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate password complexity
    const passwordValidation = validatePasswordComplexity(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        error: passwordValidation.errors[0],
        passwordErrors: passwordValidation.errors,
      });
    }

    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    // Hash password with bcrypt (12 rounds)
    const passwordHash = await bcrypt.hash(password, 12);

    // Check if this is the admin email (auto-approve)
    const isAdmin = email.toLowerCase() === process.env.ADMIN_EMAIL?.toLowerCase();
    const status = isAdmin ? 'active' : 'pending';
    const role = isAdmin ? 'admin' : 'user';

    // Create user with terms acceptance
    const result = await query(
      `INSERT INTO users (
        email, name, password_hash, provider, role, status, created_at,
        accepted_terms, accepted_terms_at, accepted_privacy, accepted_privacy_at
      )
       VALUES ($1, $2, $3, 'email', $4, $5, NOW(), $6, NOW(), $7, NOW())
       RETURNING id, email, name, role, status`,
      [email.toLowerCase(), name || null, passwordHash, role, status, acceptedTerms, acceptedPrivacy]
    );

    const user = result.rows[0];

    return res.status(201).json({
      success: true,
      message: isAdmin
        ? 'Account created successfully. You can now sign in.'
        : 'Account created successfully. Please wait for admin approval.',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        status: user.status,
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({ error: 'Failed to create account. Please try again.' });
  }
}
