/**
 * @jest-environment node
 */
import { verifyBearer } from '../../lib/oauth/verify';

const P = { ok: true, principal: { kind: 'agent', userId: 'u', tokenId: 't', roleCap: 'viewer', diagramScope: null } };

describe('verifyBearer dispatch', () => {
  test('ogl_ goes to personal tokens, regardless of the flag', async () => {
    const personal = jest.fn().mockResolvedValue(P);
    const access = jest.fn();
    for (const enabled of [true, false]) {
      expect(await verifyBearer('ogl_x', { verifyPersonal: personal, verifyAccess: access, enabled: () => enabled })).toBe(P);
    }
    expect(access).not.toHaveBeenCalled();
  });
  test('oga_ goes to the OAuth verifier only when the flag is on', async () => {
    const personal = jest.fn();
    const access = jest.fn().mockResolvedValue(P);
    expect(await verifyBearer('oga_x', { verifyPersonal: personal, verifyAccess: access, enabled: () => true })).toBe(P);
    expect(await verifyBearer('oga_x', { verifyPersonal: personal, verifyAccess: access, enabled: () => false })).toEqual({ ok: false, reason: 'invalid' });
    expect(access).toHaveBeenCalledTimes(1);
    expect(personal).not.toHaveBeenCalled();
  });
});
