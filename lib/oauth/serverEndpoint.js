// lib/oauth/serverEndpoint.js
// Next.js glue for the token and revoke endpoints: method, content type, rate limits, no-store, no CORS
// (these endpoints are server to server). Flag off: 404.

import { isOAuthEnabled } from './config';
import { rateLimit, getClientId } from '../rateLimit';

const ipLimiter = rateLimit({ interval: 60 * 1000, limit: 60, prefix: 'oauth-token-ip' });
const grantLimiter = rateLimit({ interval: 60 * 1000, limit: 20, prefix: 'oauth-token-grant' });
// Failed grants share one budget per client address (like the MCP auth-failure limiter).
const failLimiter = rateLimit({ interval: 60 * 1000, limit: 30, prefix: 'oauth-token-fail' });

const hdr = (res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
};

/**
 * @param {(params: object) => Promise<{status: number, body: object, grantId?: string, failed?: boolean}>} core
 * @param {{limits?: boolean}} [opts]
 */
export function oauthPostEndpoint(core, { limits = true } = {}) {
  return async function handler(req, res) {
    if (!isOAuthEnabled()) return res.status(404).json({ error: 'Not found' });
    hdr(res);
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'invalid_request', error_description: 'Use POST' });
    }
    if (!/^application\/x-www-form-urlencoded\b/i.test(String(req.headers['content-type'] || ''))) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'Content-Type must be application/x-www-form-urlencoded' });
    }
    if (limits) {
      const ip = await ipLimiter.check(req, res);
      if (!ip.success) return undefined;
    }
    const out = await core(req.body);
    if (limits && out.failed) {
      const f = failLimiter.consume(getClientId(req));
      const g = out.grantId ? grantLimiter.consume(out.grantId) : { success: true };
      if (!f.success || !g.success) {
        res.setHeader('Retry-After', String(Math.max(f.resetIn || 1, 1)));
        return res.status(429).json({ error: 'invalid_request', error_description: 'Too many failed attempts. Try again later.' });
      }
    }
    return res.status(out.status).json(out.body);
  };
}
