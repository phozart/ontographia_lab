// pages/api/auth/captcha.js
// Issues a stateless, signed verification challenge.

import { createChallenge } from '../../../lib/captcha';
import { apiLimiter } from '../../../lib/rateLimit';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { success } = await apiLimiter.check(req, res);
  if (!success) return;

  try {
    const { question, token } = createChallenge();
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ question, token });
  } catch (error) {
    console.error('Captcha issue error:', error.message);
    return res.status(500).json({ error: 'Verification is temporarily unavailable' });
  }
}
