// lib/captcha.js
// Stateless, server-issued math challenge. The token is
//   base64url(JSON{ h, n, e }) + '.' + base64url(HMAC-SHA256(payload))
// where h is a keyed hash of the answer, n a nonce and e the expiry (ms epoch).
// The secret is NEXTAUTH_SECRET; without it nothing is issued or accepted.

import crypto from 'crypto';

const TTL_MS = 10 * 60 * 1000;

function getSecret() {
  const s = process.env.NEXTAUTH_SECRET;
  return s && s.length > 0 ? s : null;
}

function hmac(secret, data) {
  return crypto.createHmac('sha256', secret).update(data).digest();
}

function answerHash(secret, nonce, answer) {
  return hmac(secret, `captcha-answer:${nonce}:${answer}`).toString('base64url');
}

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function generate() {
  const ops = ['+', '-', '×'];
  const op = ops[crypto.randomInt(ops.length)];
  let a, b, answer;
  if (op === '+') {
    a = crypto.randomInt(1, 21);
    b = crypto.randomInt(1, 21);
    answer = a + b;
  } else if (op === '-') {
    a = crypto.randomInt(10, 30);
    b = crypto.randomInt(0, a);
    answer = a - b;
  } else {
    a = crypto.randomInt(1, 11);
    b = crypto.randomInt(1, 11);
    answer = a * b;
  }
  return { question: `${a} ${op} ${b} = ?`, answer: String(answer) };
}

export function createChallenge({ now = Date.now() } = {}) {
  const secret = getSecret();
  if (!secret) throw new Error('NEXTAUTH_SECRET is not configured');
  const { question, answer } = generate();
  const n = crypto.randomBytes(12).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ h: answerHash(secret, n, answer), n, e: now + TTL_MS })
  ).toString('base64url');
  const sig = hmac(secret, payload).toString('base64url');
  return { question, token: `${payload}.${sig}` };
}

export function verifyCaptcha(token, answer, { now = Date.now() } = {}) {
  const secret = getSecret();
  if (!secret) return { valid: false, reason: 'unconfigured' };
  if (typeof token !== 'string' || answer === undefined || answer === null || answer === '') {
    return { valid: false, reason: 'missing' };
  }
  const parts = token.split('.');
  if (parts.length !== 2) return { valid: false, reason: 'malformed' };
  const [payload, sig] = parts;
  if (!safeEqual(hmac(secret, payload).toString('base64url'), sig)) {
    return { valid: false, reason: 'signature' };
  }
  let data;
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString());
  } catch {
    return { valid: false, reason: 'malformed' };
  }
  if (!data || typeof data.e !== 'number' || now > data.e) {
    return { valid: false, reason: 'expired' };
  }
  const given = answerHash(secret, data.n, String(answer).trim());
  if (!safeEqual(given, data.h)) return { valid: false, reason: 'answer' };
  return { valid: true };
}
