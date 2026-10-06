jest.mock('../../lib/db', () => ({ query: jest.fn() }));

import { query } from '../../lib/db';
import { authorize, resolveRole, AuthzError } from '../../lib/authz/index';

const UUID = '123e4567-e89b-12d3-a456-426614174000';
const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

const meta = (over = {}) => ({
  id: UUID, short_id: 'LAB-1', name: 'D', type: 'infinite-canvas', owner_id: OWNER, created_by: 'o@x.co',
  revision: '3', version_seq: 0, updated_at: new Date(), updated_by: null, domain_id: null, project_id: null, ...over,
});
const user = (id, platformRole = 'user', status = 'active') => ({ kind: 'user', userId: id, platformRole, status });

beforeEach(() => query.mockReset());

async function fails(p, ref, action, status, code) {
  await expect(authorize(p, ref, action)).rejects.toMatchObject({ status, code });
}

describe('authorize', () => {
  test('owner gets owner role, source and capabilities', async () => {
    query.mockResolvedValue({ rows: [meta()] });
    const r = await authorize(user(OWNER), UUID, 'diagram.delete');
    expect(r.role).toBe('owner');
    expect(r.source).toBe('owner');
    expect(r.capabilities).toContain('diagram.write');
    expect(r.diagram.id).toBe(UUID);
    expect(r.diagram.content).toBeUndefined();
  });

  test('metadata query never selects content', async () => {
    query.mockResolvedValue({ rows: [meta()] });
    await authorize(user(OWNER), UUID, 'diagram.read');
    expect(query.mock.calls[0][0]).not.toMatch(/content|\*/);
  });

  test('LAB-n reference resolves by short_id', async () => {
    query.mockResolvedValue({ rows: [meta()] });
    await authorize(user(OWNER), 'LAB-1', 'diagram.read');
    expect(query.mock.calls[0][0]).toMatch(/short_id/);
    expect(query.mock.calls[0][1]).toEqual(['LAB-1']);
  });

  test('non-owner has no role -> 404 NOT_FOUND (same as missing)', async () => {
    query.mockResolvedValue({ rows: [meta()] });
    await fails(user(OTHER), UUID, 'diagram.read', 404, 'NOT_FOUND');
    query.mockResolvedValue({ rows: [] });
    await fails(user(OWNER), UUID, 'diagram.read', 404, 'NOT_FOUND');
  });

  test('platform admins get no implicit access (Q-S1)', async () => {
    query.mockResolvedValue({ rows: [meta()] });
    await fails(user(OTHER, 'admin'), UUID, 'diagram.read', 404, 'NOT_FOUND');
  });

  test('NULL owner_id grants nobody access', async () => {
    query.mockResolvedValue({ rows: [meta({ owner_id: null })] });
    await fails(user(OWNER), UUID, 'diagram.read', 404, 'NOT_FOUND');
    await fails(user(undefined), UUID, 'diagram.read', 404, 'NOT_FOUND');
  });

  test.each(['bad', "1'; DROP", 'LAB-', 'lab-1', ''])('malformed ref %j -> 404 without a query', async (ref) => {
    await fails(user(OWNER), ref, 'diagram.read', 404, 'NOT_FOUND');
    expect(query).not.toHaveBeenCalled();
  });

  test('inactive account -> 403 ACCOUNT_INACTIVE', async () => {
    await fails(user(OWNER, 'user', 'pending'), UUID, 'diagram.read', 403, 'ACCOUNT_INACTIVE');
    expect(query).not.toHaveBeenCalled();
  });

  test('agent role is capped by roleCap (and never exceeds it)', async () => {
    query.mockResolvedValue({ rows: [meta()] });
    const agent = { kind: 'agent', userId: OWNER, tokenId: 't', roleCap: 'commenter' };
    const r = await authorize(agent, UUID, 'comment.create');
    expect(r.role).toBe('commenter');
    await fails(agent, UUID, 'diagram.write', 403, 'FORBIDDEN');
  });

  test('link principals have no role until the links slice', async () => {
    query.mockResolvedValue({ rows: [meta()] });
    await fails({ kind: 'link', linkTokenHash: 'x' }, UUID, 'diagram.read', 404, 'NOT_FOUND');
  });

  test('unknown principal kind / missing principal -> 404', async () => {
    query.mockResolvedValue({ rows: [meta()] });
    await fails({ kind: 'weird' }, UUID, 'diagram.read', 404, 'NOT_FOUND');
    await fails(null, UUID, 'diagram.read', 404, 'NOT_FOUND');
  });

  test('role present but action above role -> 403 FORBIDDEN (via agent cap)', async () => {
    query.mockResolvedValue({ rows: [meta()] });
    const agent = { kind: 'agent', userId: OWNER, tokenId: 't', roleCap: 'viewer' };
    await fails(agent, UUID, 'diagram.write', 403, 'FORBIDDEN');
  });

  test('unknown action is denied', async () => {
    query.mockResolvedValue({ rows: [meta()] });
    await fails(user(OWNER), UUID, 'diagram.explode', 403, 'FORBIDDEN');
  });

  test('AuthzError carries status and code', () => {
    const e = new AuthzError(404, 'NOT_FOUND');
    expect(e).toBeInstanceOf(Error);
    expect(e.status).toBe(404);
  });
});

describe('resolveRole', () => {
  test('returns {role: null, source: null} for strangers', async () => {
    query.mockResolvedValue({ rows: [meta()] });
    expect(await resolveRole(user(OTHER), UUID)).toEqual({ role: null, source: null });
  });
});
