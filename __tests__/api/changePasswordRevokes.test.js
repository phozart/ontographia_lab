/**
 * @jest-environment node
 */
jest.mock('../../lib/db', () => ({ query: jest.fn() }));
jest.mock('bcryptjs', () => ({
  compare: jest.fn(async (pw, hash) => hash === `hash:${pw}`),
  hash: jest.fn(async (pw) => `hash:${pw}`),
}));
jest.mock('next-auth/next', () => ({ getServerSession: jest.fn(async () => ({ user: { email: 'u@x.co' } })) }));
jest.mock('../../pages/api/auth/[...nextauth]', () => ({ authOptions: {} }));
jest.mock('../../lib/oauth/repository', () => ({ revokeAllGrantsForUser: jest.fn(async () => 2) }));

import { query } from '../../lib/db';
import { revokeAllGrantsForUser } from '../../lib/oauth/repository';
import handler from '../../pages/api/auth/change-password';

const res = () => { const r = { headers: {} }; r.status = jest.fn((c) => { r.statusCode = c; return r; }); r.json = jest.fn((b) => { r.body = b; return r; }); r.setHeader = jest.fn(); return r; };
const call = (body) => { const r = res(); return handler({ method: 'POST', body, headers: {}, socket: {} }, r).then(() => r); };

beforeEach(() => {
  jest.clearAllMocks();
  query.mockImplementation(async (sql) => (/SELECT/.test(sql) ? { rows: [{ id: 'user-1', email: 'u@x.co', password_hash: 'hash:OldPass1!', provider: 'credentials' }] } : { rows: [] }));
});

test('a successful password change disconnects every connected app', async () => {
  const r = await call({ currentPassword: 'OldPass1!', newPassword: 'NewPass2@x' });
  expect(r.statusCode).toBe(200);
  expect(revokeAllGrantsForUser).toHaveBeenCalledWith('user-1', 'password_change');
});

test('a failed change (wrong current password, weak or identical new password) revokes nothing', async () => {
  for (const body of [{ currentPassword: 'wrong', newPassword: 'NewPass2@x' }, { currentPassword: 'OldPass1!', newPassword: 'weak' }, { currentPassword: 'OldPass1!', newPassword: 'OldPass1!' }]) {
    expect((await call(body)).statusCode).toBe(400);
  }
  expect(revokeAllGrantsForUser).not.toHaveBeenCalled();
});

test('a revocation failure does not fail the password change', async () => {
  revokeAllGrantsForUser.mockRejectedValueOnce(new Error('db down'));
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  expect((await call({ currentPassword: 'OldPass1!', newPassword: 'NewPass2@x' })).statusCode).toBe(200);
  spy.mockRestore();
});
