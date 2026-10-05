import { createChallenge, verifyCaptcha } from '../../lib/captcha';

const SECRET = 'test-secret-value';

function solve(question) {
  const m = question.match(/^(\d+) ([+\-×]) (\d+) = \?$/);
  const a = Number(m[1]);
  const b = Number(m[3]);
  return String(m[2] === '+' ? a + b : m[2] === '-' ? a - b : a * b);
}

describe('captcha', () => {
  let prev;
  beforeEach(() => { prev = process.env.NEXTAUTH_SECRET; process.env.NEXTAUTH_SECRET = SECRET; });
  afterEach(() => { process.env.NEXTAUTH_SECRET = prev; });

  test('accepts the correct answer', () => {
    const { question, token } = createChallenge();
    expect(verifyCaptcha(token, solve(question)).valid).toBe(true);
  });

  test('token does not carry the plain answer', () => {
    const { question, token } = createChallenge();
    const payload = Buffer.from(token.split('.')[0], 'base64url').toString();
    expect(payload).not.toContain('"answer"');
    expect(typeof question).toBe('string');
  });

  test('rejects a wrong answer', () => {
    const { question, token } = createChallenge();
    const wrong = String(Number(solve(question)) + 1);
    expect(verifyCaptcha(token, wrong).valid).toBe(false);
  });

  test('rejects a tampered payload or signature', () => {
    const { question, token } = createChallenge();
    const [p, s] = token.split('.');
    const obj = JSON.parse(Buffer.from(p, 'base64url').toString());
    obj.e += 100000;
    const forged = Buffer.from(JSON.stringify(obj)).toString('base64url');
    expect(verifyCaptcha(`${forged}.${s}`, solve(question)).valid).toBe(false);
    expect(verifyCaptcha(`${p}.${s.slice(0, -2)}AA`, solve(question)).valid).toBe(false);
    expect(verifyCaptcha('garbage', '1').valid).toBe(false);
    expect(verifyCaptcha(undefined, '1').valid).toBe(false);
  });

  test('rejects an expired token', () => {
    const t0 = 1700000000000;
    const { question, token } = createChallenge({ now: t0 });
    expect(verifyCaptcha(token, solve(question), { now: t0 + 1 * 60 * 1000 }).valid).toBe(true);
    expect(verifyCaptcha(token, solve(question), { now: t0 + 3 * 60 * 1000 }).valid).toBe(false);
  });

  test('a token verifies successfully only once', () => {
    const { question, token } = createChallenge();
    const answer = solve(question);
    expect(verifyCaptcha(token, answer).valid).toBe(true);
    expect(verifyCaptcha(token, answer).valid).toBe(false);
  });

  test('a token is spent by a wrong attempt as well', () => {
    const { question, token } = createChallenge();
    expect(verifyCaptcha(token, String(+solve(question) + 1)).valid).toBe(false);
    expect(verifyCaptcha(token, solve(question)).valid).toBe(false);
  });

  test('token signed with a different secret is rejected', () => {
    const { question, token } = createChallenge();
    process.env.NEXTAUTH_SECRET = 'other-secret';
    expect(verifyCaptcha(token, solve(question)).valid).toBe(false);
  });

  test('missing secret: cannot issue and never verifies', () => {
    const { question, token } = createChallenge();
    delete process.env.NEXTAUTH_SECRET;
    expect(() => createChallenge()).toThrow();
    expect(verifyCaptcha(token, solve(question)).valid).toBe(false);
  });
});
