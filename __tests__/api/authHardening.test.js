jest.mock('../../lib/db', () => ({ query: jest.fn() }));
jest.mock('../../lib/rateLimit', () => {
  const ok = { check: jest.fn(async () => ({ success: true })) };
  return { authLimiter: ok, strictLimiter: ok, apiLimiter: ok };
});
jest.mock('../../lib/email', () => ({
  isEmailConfigured: jest.fn(() => false),
  sendMail: jest.fn(async () => ({})),
}));
jest.mock('bcryptjs', () => ({
  compare: jest.fn(async (pw, hash) => hash === `hash:${pw}`),
  hash: jest.fn(async (pw) => `hash:${pw}`),
}));
jest.mock('next-auth', () => jest.fn(() => jest.fn()));
jest.mock('next-auth/providers/google', () => jest.fn(() => ({ id: 'google' })));
jest.mock('next-auth/providers/github', () => jest.fn(() => ({ id: 'github' })));
jest.mock('next-auth/providers/credentials', () =>
  jest.fn((opts) => ({ id: opts.id, authorize: opts.authorize }))
);

import { query } from '../../lib/db';
import { isEmailConfigured, sendMail } from '../../lib/email';
import { createChallenge } from '../../lib/captcha';
import signup from '../../pages/api/auth/signup';
import forgot from '../../pages/api/auth/forgot-password';
import reset from '../../pages/api/auth/reset-password';
import captchaRoute from '../../pages/api/auth/captcha';
import { authOptions } from '../../pages/api/auth/[...nextauth]';

function mockRes() {
  const res = { headers: {} };
  res.status = jest.fn((c) => { res.statusCode = c; return res; });
  res.json = jest.fn((b) => { res.body = b; return res; });
  res.setHeader = jest.fn((k, v) => { res.headers[k] = v; });
  return res;
}
const post = (body) => ({ method: 'POST', body, headers: {}, socket: {} });

function solve(q) {
  const m = q.match(/^(\d+) ([+\-×]) (\d+)/);
  const a = +m[1], b = +m[3];
  return String(m[2] === '+' ? a + b : m[2] === '-' ? a - b : a * b);
}

const OLD_ENV = process.env;
beforeEach(() => {
  process.env = { ...OLD_ENV, NEXTAUTH_SECRET: 'unit-test-secret' };
  query.mockReset();
  isEmailConfigured.mockReset().mockReturnValue(false);
  sendMail.mockReset().mockResolvedValue({});
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { process.env = OLD_ENV; jest.restoreAllMocks(); });

describe('GET /api/auth/captcha', () => {
  test('returns question and token', async () => {
    const res = mockRes();
    await captchaRoute({ method: 'GET', headers: {}, socket: {} }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.question).toMatch(/= \?$/);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.answer).toBeUndefined();
  });
});

describe('captcha enforcement', () => {
  const good = () => {
    const c = createChallenge();
    return { captchaToken: c.token, captchaAnswer: solve(c.question) };
  };

  test.each([
    ['signup', signup, { email: 'a@b.co', password: 'Passw0rd!x', acceptedTerms: true, acceptedPrivacy: true }],
    ['forgot', forgot, { email: 'a@b.co' }],
    ['reset', reset, { token: 'abc', password: 'Passw0rd!x' }],
  ])('%s ignores client-supplied captchaExpected', async (_n, handler, extra) => {
    const res = mockRes();
    await handler(post({ ...extra, captchaAnswer: '1', captchaExpected: '1' }), res);
    expect(res.statusCode).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  test.each([
    ['signup', signup, { email: 'a@b.co', password: 'Passw0rd!x', acceptedTerms: true, acceptedPrivacy: true }],
    ['forgot', forgot, { email: 'a@b.co' }],
    ['reset', reset, { token: 'abc', password: 'Passw0rd!x' }],
  ])('%s rejects a wrong answer', async (_n, handler, extra) => {
    const c = createChallenge();
    const res = mockRes();
    await handler(post({ ...extra, captchaToken: c.token, captchaAnswer: String(+solve(c.question) + 1) }), res);
    expect(res.statusCode).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  test('signup accepts a valid challenge', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    query.mockResolvedValueOnce({ rows: [{ id: 1, email: 'a@b.co', name: null, role: 'user', status: 'pending' }] });
    const res = mockRes();
    await signup(post({ email: 'a@b.co', password: 'Passw0rd!x', acceptedTerms: true, acceptedPrivacy: true, ...good() }), res);
    expect(res.statusCode).toBe(201);
  });
});

describe('forgot-password reset-link handling', () => {
  const run = async (env) => {
    process.env.NODE_ENV = env;
    process.env.NEXTAUTH_URL = 'http://x.test';
    const c = createChallenge();
    query.mockResolvedValueOnce({ rows: [{ id: 1, email: 'a@b.co', provider: 'email' }] });
    query.mockResolvedValueOnce({ rows: [] });
    const res = mockRes();
    await forgot(post({ email: 'a@b.co', captchaToken: c.token, captchaAnswer: solve(c.question) }), res);
    return res;
  };
  const logged = () => [...console.log.mock.calls, ...console.error.mock.calls].flat().join(' ');

  test('production: no URL in body or logs', async () => {
    const res = await run('production');
    expect(res.statusCode).toBe(200);
    expect(res.body.resetUrl).toBeUndefined();
    expect(logged()).not.toMatch(/reset-password\?token|token=/);
  });

  test('test env behaves like production', async () => {
    const res = await run('test');
    expect(res.body.resetUrl).toBeUndefined();
    expect(logged()).not.toMatch(/token=/);
  });

  test('development: URL returned', async () => {
    const res = await run('development');
    expect(res.body.resetUrl).toMatch(/reset-password\?token=/);
  });
});

describe('forgot-password email delivery', () => {
  const run = async (env) => {
    process.env.NODE_ENV = env;
    process.env.NEXTAUTH_URL = 'http://x.test';
    const c = createChallenge();
    query.mockResolvedValueOnce({ rows: [{ id: 1, email: 'a@b.co', provider: 'email' }] });
    query.mockResolvedValueOnce({ rows: [] });
    const res = mockRes();
    await forgot(post({ email: 'a@b.co', captchaToken: c.token, captchaAnswer: solve(c.question) }), res);
    return res;
  };
  const warned = () => console.warn.mock.calls.flat().join(' ');
  const logged = () =>
    [...console.log.mock.calls, ...console.warn.mock.calls, ...console.error.mock.calls].flat().join(' ');
  beforeEach(() => { jest.spyOn(console, 'warn').mockImplementation(() => {}); });

  test('configured: sends mail with link, generic response, no resetUrl', async () => {
    isEmailConfigured.mockReturnValue(true);
    const res = await run('production');
    expect(res.statusCode).toBe(200);
    expect(res.body.resetUrl).toBeUndefined();
    expect(sendMail).toHaveBeenCalledTimes(1);
    const arg = sendMail.mock.calls[0][0];
    expect(arg.to).toBe('a@b.co');
    expect(arg.text).toMatch(/http:\/\/x\.test\/reset-password\?token=[0-9a-f]{64}/);
    expect(arg.html).toContain('http://x.test/reset-password?token=');
    expect(arg.text).toMatch(/1 hour/);
    expect(logged()).not.toMatch(/token=/);
  });

  test('configured in development: still sends, no resetUrl in body', async () => {
    isEmailConfigured.mockReturnValue(true);
    const res = await run('development');
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(res.body.resetUrl).toBeUndefined();
  });

  test('unconfigured production: no send, warning without token, generic 200', async () => {
    const res = await run('production');
    expect(sendMail).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.resetUrl).toBeUndefined();
    expect(warned()).toMatch(/email transport not configured/);
    expect(logged()).not.toMatch(/token=/);
  });

  test('unconfigured development: unchanged (resetUrl returned, no send)', async () => {
    const res = await run('development');
    expect(sendMail).not.toHaveBeenCalled();
    expect(res.body.resetUrl).toMatch(/reset-password\?token=/);
  });

  test('send failure: generic 200, error logged without token, token not cleared', async () => {
    isEmailConfigured.mockReturnValue(true);
    sendMail.mockRejectedValueOnce(new Error('smtp down'));
    const res = await run('production');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.resetUrl).toBeUndefined();
    expect(console.error).toHaveBeenCalled();
    expect(logged()).not.toMatch(/token=/);
    // only SELECT + UPDATE (store token); nothing clears it afterwards
    expect(query).toHaveBeenCalledTimes(2);
  });
});

describe('credentials authorize', () => {
  const provider = authOptions.providers.find((p) => p.id === 'credentials');
  const user = (over = {}) => ({ id: 1, email: 'a@b.co', name: 'A', image: null, password_hash: 'hash:Secret1!', role: 'user', status: 'active', ...over });

  test('unknown email and wrong password give the same message', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const e1 = await provider.authorize({ email: 'x@y.z', password: 'Secret1!' }).catch((e) => e);
    query.mockResolvedValueOnce({ rows: [user()] });
    const e2 = await provider.authorize({ email: 'a@b.co', password: 'nope' }).catch((e) => e);
    expect(e1.message).toBe('Invalid email or password');
    expect(e2.message).toBe('Invalid email or password');
  });

  test('suspended user with correct password is rejected with clear message', async () => {
    query.mockResolvedValueOnce({ rows: [user({ status: 'suspended' })] });
    const e = await provider.authorize({ email: 'a@b.co', password: 'Secret1!' }).catch((x) => x);
    expect(e.message).toMatch(/suspended/i);
  });

  test('suspended user with wrong password gets the generic message', async () => {
    query.mockResolvedValueOnce({ rows: [user({ status: 'suspended' })] });
    const e = await provider.authorize({ email: 'a@b.co', password: 'bad' }).catch((x) => x);
    expect(e.message).toBe('Invalid email or password');
  });

  test('pending user can still sign in', async () => {
    query.mockResolvedValueOnce({ rows: [user({ status: 'pending' })] });
    query.mockResolvedValueOnce({ rows: [] });
    const r = await provider.authorize({ email: 'a@b.co', password: 'Secret1!' });
    expect(r.email).toBe('a@b.co');
  });
});

describe('captcha message', () => {
  test('answer 0 is treated as provided (not as missing)', async () => {
    const c = createChallenge();
    const res = mockRes();
    await forgot(post({ email: 'a@b.co', captchaToken: c.token, captchaAnswer: 0 }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/Incorrect or expired/);
  });

  test('missing answer gets the complete-challenge message', async () => {
    const res = mockRes();
    await forgot(post({ email: 'a@b.co' }), res);
    expect(res.body.error).toMatch(/complete the verification/);
  });
});

describe('signIn callback', () => {
  test('returns false when the lookup fails', async () => {
    query.mockRejectedValueOnce(new Error('db down'));
    const r = await authOptions.callbacks.signIn({ user: { email: 'a@b.co' }, account: { provider: 'google' } });
    expect(r).toBe(false);
  });

  test('looks up OAuth users by lowercased email', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 1, role: 'user', status: 'active' }] });
    query.mockResolvedValueOnce({ rows: [] });
    await authOptions.callbacks.signIn({ user: { email: 'A@B.Co', name: 'A', image: null }, account: { provider: 'google' } });
    expect(query.mock.calls[0][1]).toEqual(['a@b.co']);
  });

  test('rejects suspended OAuth users', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 1, role: 'user', status: 'suspended' }] });
    const r = await authOptions.callbacks.signIn({ user: { email: 'a@b.co' }, account: { provider: 'google' } });
    expect(r).not.toBe(true);
  });

  test('allows pending OAuth users', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 1, role: 'user', status: 'pending' }] });
    query.mockResolvedValueOnce({ rows: [] });
    const r = await authOptions.callbacks.signIn({ user: { email: 'a@b.co', name: 'A', image: null }, account: { provider: 'google' } });
    expect(r).toBe(true);
  });
});
