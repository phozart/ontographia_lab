// lib/oauth/crypto.js
// Token generation/hashing, PKCE S256 and the consent CSRF token (ADR-0005 5.4, 5.6). Pure Node crypto, no I/O.
// High-entropy random secrets do not need a slow hash: only their SHA-256 is ever stored.

import crypto from 'crypto';

export const ACCESS_PREFIX = 'oga_';
export const REFRESH_PREFIX = 'ogr_';

export const randomSecret = (prefix = '') => prefix + crypto.randomBytes(32).toString('base64url');
export const sha256Hex = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

const ACCESS_RE = /^oga_[A-Za-z0-9_-]{43}$/;
const REFRESH_RE = /^ogr_[A-Za-z0-9_-]{43}$/;
// Authorization codes are 32 random bytes, base64url: 43 characters.
const CODE_RE = /^[A-Za-z0-9_-]{43}$/;
export const looksLikeAccessToken = (v) => typeof v === 'string' && ACCESS_RE.test(v);
export const looksLikeRefreshToken = (v) => typeof v === 'string' && REFRESH_RE.test(v);
export const looksLikeCode = (v) => typeof v === 'string' && CODE_RE.test(v);

/** Constant-time string equality (length leaks, which is fine for fixed-length values). */
export function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  if (x.length !== y.length) return false;
  return crypto.timingSafeEqual(x, y);
}

// RFC 7636: challenge = BASE64URL(SHA256(verifier)) = 43 characters; verifier is 43..128 unreserved characters.
const CHALLENGE_RE = /^[A-Za-z0-9_-]{43}$/;
const VERIFIER_RE = /^[A-Za-z0-9\-._~]{43,128}$/;
export const isValidCodeChallenge = (v) => typeof v === 'string' && CHALLENGE_RE.test(v);
export const isValidCodeVerifier = (v) => typeof v === 'string' && VERIFIER_RE.test(v);

export function s256Challenge(verifier) {
  return crypto.createHash('sha256').update(String(verifier)).digest('base64url');
}

export function verifyPkce(verifier, challenge) {
  if (!isValidCodeVerifier(verifier) || !isValidCodeChallenge(challenge)) return false;
  return safeEqual(s256Challenge(verifier), challenge);
}

function csrfKey() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('NEXTAUTH_SECRET is required for the OAuth consent CSRF token');
  return crypto.createHash('sha256').update(`oauth-consent-csrf:${secret}`).digest();
}

/** CSRF token for the consent form: HMAC(server key, rid + session user id), bound to both. */
export function consentCsrfToken(rid, userId) {
  return crypto.createHmac('sha256', csrfKey()).update(`${rid}\n${userId}`).digest('base64url');
}

export function verifyConsentCsrf(token, rid, userId) {
  if (typeof token !== 'string' || !token || !rid || !userId) return false;
  return safeEqual(token, consentCsrfToken(rid, userId));
}
