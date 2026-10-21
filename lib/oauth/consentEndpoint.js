// lib/oauth/consentEndpoint.js
// POST /api/oauth/consent (ADR-0005 5.4): approve, deny or release ("switch account") a pending request.
// Protections, in order: flag, method, same origin, form content type, signed-in active user (live from the database),
// per-user rate limit, CSRF token = HMAC(server key, rid + user id), then the consent rules (lib/oauth/consent.js).
// The response is a 303 so the browser follows with GET: to the client's redirect_uri on approve/deny, or back to the
// consent page with a fixed error code (never free text) when the form was refused.

import { isOAuthEnabled } from './config';
import { verifyConsentCsrf } from './crypto';
import { decideConsent } from './consent';
import { unbindAuthorization, isUuid } from './repository';
import { isSameOriginRequest } from '../sameOrigin';
import { rateLimit } from '../rateLimit';

const consentLimiter = rateLimit({ interval: 60 * 1000, limit: 10, prefix: 'oauth-consent' });

const str = (v) => (typeof v === 'string' ? v : undefined);

/**
 * @param {{getUser: (req, res) => Promise<{id: string, email: string, role?: string, status?: string}|null>, decide?: typeof decideConsent}} deps
 */
export function createConsentHandler({ getUser, decide = decideConsent }) {
  return async function consentHandler(req, res) {
    if (!isOAuthEnabled()) return res.status(404).json({ error: 'Not found' });
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    if (!isSameOriginRequest(req)) return res.status(403).json({ error: 'Cross-origin request rejected' });
    if (!/^application\/x-www-form-urlencoded\b/i.test(String(req.headers['content-type'] || ''))) {
      return res.status(415).json({ error: 'Content-Type must be application/x-www-form-urlencoded' });
    }
    const user = await getUser(req, res);
    if (!user) return res.status(401).json({ error: 'Sign in first' });
    if (user.status !== 'active') return res.status(403).json({ error: 'Account not activated' });
    if (!consentLimiter.consume(user.id).success) {
      res.setHeader('Retry-After', '60');
      return res.status(429).json({ error: 'Too many requests' });
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const rid = str(body.rid);
    if (!isUuid(rid) || !verifyConsentCsrf(str(body.csrf), rid, user.id)) {
      return res.status(403).json({ error: 'Invalid or missing CSRF token' });
    }

    if (body.decision === 'switch') {
      await unbindAuthorization(rid, user.id);
      return res.status(204).end();
    }

    const out = await decide({ rid, user, form: body });
    const destination = out.ok ? out.redirect : `/oauth/authorize?rid=${rid}${out.error === 'expired' || out.error === 'inactive' ? '' : `&e=${out.error}`}`;
    res.setHeader('Location', destination);
    return res.status(303).end();
  };
}
