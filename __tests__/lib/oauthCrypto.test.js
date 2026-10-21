/**
 * @jest-environment node
 */
import crypto from 'crypto';
import {
  randomSecret, sha256Hex, looksLikeAccessToken, looksLikeRefreshToken, looksLikeCode,
  verifyPkce, s256Challenge, isValidCodeChallenge, consentCsrfToken, verifyConsentCsrf, safeEqual,
} from '../../lib/oauth/crypto';

describe('tokens', () => {
  test('shapes and uniqueness', () => {
    const a = randomSecret('oga_'); const r = randomSecret('ogr_');
    expect(looksLikeAccessToken(a)).toBe(true);
    expect(looksLikeRefreshToken(r)).toBe(true);
    expect(looksLikeAccessToken(r)).toBe(false);
    expect(looksLikeCode(randomSecret())).toBe(true);
    expect(randomSecret('oga_')).not.toBe(a);
    expect(sha256Hex(a)).toMatch(/^[0-9a-f]{64}$/);
  });
  test('garbage never looks like a token', () => {
    for (const v of [undefined, null, 5, '', 'oga_', 'oga_short', 'ogl_' + 'a'.repeat(43), 'oga_' + 'a'.repeat(300)]) {
      expect(looksLikeAccessToken(v)).toBe(false);
    }
  });
  test('safeEqual', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('PKCE S256', () => {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = s256Challenge(verifier);
  test('RFC 7636 appendix B vector', () => {
    expect(s256Challenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });
  test('correct verifier passes; wrong, short, plain-style and missing fail', () => {
    expect(isValidCodeChallenge(challenge)).toBe(true);
    expect(verifyPkce(verifier, challenge)).toBe(true);
    expect(verifyPkce(crypto.randomBytes(32).toString('base64url'), challenge)).toBe(false);
    expect(verifyPkce('short', challenge)).toBe(false);
    expect(verifyPkce(undefined, challenge)).toBe(false);
    expect(verifyPkce(verifier, verifier)).toBe(false); // "plain": challenge equal to verifier
    expect(verifyPkce(verifier, 'x'.repeat(42))).toBe(false);
  });
});

describe('consent CSRF', () => {
  beforeAll(() => { process.env.NEXTAUTH_SECRET = 'test-secret-for-csrf'; });
  test('bound to rid and user', () => {
    const t = consentCsrfToken('rid-1', 'user-1');
    expect(verifyConsentCsrf(t, 'rid-1', 'user-1')).toBe(true);
    expect(verifyConsentCsrf(t, 'rid-2', 'user-1')).toBe(false);
    expect(verifyConsentCsrf(t, 'rid-1', 'user-2')).toBe(false);
    expect(verifyConsentCsrf('', 'rid-1', 'user-1')).toBe(false);
    expect(verifyConsentCsrf(undefined, 'rid-1', 'user-1')).toBe(false);
    expect(verifyConsentCsrf(t + 'x', 'rid-1', 'user-1')).toBe(false);
  });
});
