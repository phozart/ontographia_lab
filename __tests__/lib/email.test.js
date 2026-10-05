const sendMailMock = jest.fn(async () => ({ messageId: 'x' }));
const createTransport = jest.fn(() => ({ sendMail: sendMailMock }));
jest.mock('nodemailer', () => ({ __esModule: true, default: { createTransport }, createTransport }));

const fs = require('fs');
const path = require('path');

const OLD_ENV = process.env;
let email;
beforeEach(() => {
  jest.resetModules();
  createTransport.mockClear();
  sendMailMock.mockClear();
  process.env = { ...OLD_ENV };
  for (const k of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM']) delete process.env[k];
  email = require('../../lib/email');
});
afterEach(() => { process.env = OLD_ENV; });

describe('isEmailConfigured', () => {
  test('false without SMTP_HOST', () => {
    expect(email.isEmailConfigured()).toBe(false);
  });
  test('false when SMTP_HOST set but EMAIL_FROM missing', () => {
    process.env.SMTP_HOST = 'smtp.example.test';
    expect(email.isEmailConfigured()).toBe(false);
  });
  test('true with SMTP_HOST and EMAIL_FROM', () => {
    process.env.SMTP_HOST = 'smtp.example.test';
    process.env.EMAIL_FROM = 'noreply@example.test';
    expect(email.isEmailConfigured()).toBe(true);
  });
});

describe('sendMail', () => {
  beforeEach(() => {
    process.env.SMTP_HOST = 'smtp.example.test';
    process.env.EMAIL_FROM = 'Ontographia <noreply@example.test>';
  });

  test('creates transport with defaults and sends', async () => {
    await email.sendMail({ to: 'a@b.co', subject: 'S', text: 't', html: '<p>t</p>' });
    expect(createTransport).toHaveBeenCalledWith({ host: 'smtp.example.test', port: 587, secure: false });
    expect(sendMailMock).toHaveBeenCalledWith({
      from: 'Ontographia <noreply@example.test>', to: 'a@b.co', subject: 'S', text: 't', html: '<p>t</p>',
    });
  });

  test('uses port, secure and auth from env', async () => {
    process.env.SMTP_PORT = '465';
    process.env.SMTP_SECURE = 'true';
    process.env.SMTP_USER = 'user';
    process.env.SMTP_PASS = 'pass';
    await email.sendMail({ to: 'a@b.co', subject: 'S', text: 't' });
    expect(createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.test', port: 465, secure: true, auth: { user: 'user', pass: 'pass' },
    });
  });

  test('transport is created once', async () => {
    await email.sendMail({ to: 'a@b.co', subject: 'S', text: 't' });
    await email.sendMail({ to: 'c@d.co', subject: 'S', text: 't' });
    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(sendMailMock).toHaveBeenCalledTimes(2);
  });

  test('throws when not configured', async () => {
    delete process.env.EMAIL_FROM;
    await expect(email.sendMail({ to: 'a@b.co', subject: 'S', text: 't' })).rejects.toThrow(/not configured/i);
    expect(sendMailMock).not.toHaveBeenCalled();
  });
});

describe('passwordResetEmail template', () => {
  test('contains app name, link and expiry in text and html', () => {
    const { passwordResetEmail } = require('../../lib/emailTemplates');
    const m = passwordResetEmail({ resetUrl: 'http://x.test/reset-password?token=abc&x=1', expiresInHours: 1 });
    expect(m.subject).toMatch(/Ontographia Lab/);
    expect(m.text).toContain('http://x.test/reset-password?token=abc&x=1');
    expect(m.text).toMatch(/1 hour/);
    expect(m.html).toContain('token=abc&amp;x=1');
    expect(m.html).toMatch(/1 hour/);
  });
});

describe('.env.example', () => {
  const root = path.join(__dirname, '..', '..');
  const example = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
  const keys = new Set(
    example.split('\n').map((l) => l.match(/^#?\s*([A-Z][A-Z0-9_]*)=/)).filter(Boolean).map((m) => m[1])
  );

  function walk(dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', '.next', '.git', '.claude', '__tests__', 'coverage'].includes(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, out);
      else if (/\.(js|jsx|mjs|cjs)$/.test(e.name)) out.push(p);
    }
    return out;
  }

  test('documents every process.env key used in source', () => {
    const used = new Set();
    for (const f of walk(root)) {
      const src = fs.readFileSync(f, 'utf8');
      for (const m of src.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) used.add(m[1]);
    }
    const ignore = new Set(['NODE_ENV']);
    const missing = [...used].filter((k) => !ignore.has(k) && !keys.has(k));
    expect(missing).toEqual([]);
    for (const k of ['APP_PORT', 'SMTP_HOST', 'EMAIL_FROM']) expect(keys.has(k)).toBe(true);
  });

  test('contains no obviously real secrets', () => {
    expect(example).not.toMatch(/AKIA|ghp_|-----BEGIN/);
  });
});
