// Slice 5: the `member` grant source (diagram_members) in lib/authz. DB mocked.
jest.mock('../../lib/db', () => ({ query: jest.fn() }));

import { query } from '../../lib/db';
import { authorize, resolveRole } from '../../lib/authz/index';

const UUID = '123e4567-e89b-12d3-a456-426614174000';
const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const meta = (over = {}) => ({
  id: UUID, short_id: 'LAB-1', name: 'D', type: 'infinite-canvas', owner_id: OWNER, created_by: 'o@x.co',
  revision: '3', version_seq: 0, updated_at: new Date(), updated_by: null, domain_id: null, project_id: null, ...over,
});
const user = (id, platformRole = 'user', status = 'active') => ({ kind: 'user', userId: id, platformRole, status });

// First query = diagram metadata; second = the member lookup (only for non-owners).
function db(memberRole) {
  query.mockReset();
  query.mockImplementation(async (sql) => {
    if (/FROM diagram_members/.test(sql)) return { rows: memberRole ? [{ role: memberRole }] : [] };
    return { rows: [meta()] };
  });
}

describe('member grant source', () => {
  test.each(['viewer', 'commenter', 'editor'])('member role %s resolves with source "member"', async (role) => {
    db(role);
    const r = await authorize(user(OTHER), UUID, 'diagram.read');
    expect(r.role).toBe(role);
    expect(r.source).toBe('member');
    expect(query.mock.calls.find(([s]) => /diagram_members/.test(s))[1]).toEqual([UUID, OTHER]);
  });

  test('viewer cannot write (403), commenter cannot write, editor can', async () => {
    db('viewer');
    await expect(authorize(user(OTHER), UUID, 'diagram.write')).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
    db('commenter');
    await expect(authorize(user(OTHER), UUID, 'diagram.write')).rejects.toMatchObject({ status: 403 });
    await expect(authorize(user(OTHER), UUID, 'comment.create')).resolves.toMatchObject({ role: 'commenter' });
    db('editor');
    await expect(authorize(user(OTHER), UUID, 'diagram.write')).resolves.toMatchObject({ role: 'editor' });
    await expect(authorize(user(OTHER), UUID, 'diagram.delete')).rejects.toMatchObject({ status: 403 });
    await expect(authorize(user(OTHER), UUID, 'audit.read')).rejects.toMatchObject({ status: 403 });
  });

  test('non-member (and admin non-member, Q-S1) -> 404', async () => {
    db(null);
    await expect(authorize(user(OTHER), UUID, 'diagram.read')).rejects.toMatchObject({ status: 404 });
    await expect(authorize(user(OTHER, 'admin'), UUID, 'diagram.read')).rejects.toMatchObject({ status: 404 });
  });

  test('owner wins without a member lookup', async () => {
    db('viewer');
    const r = await authorize(user(OWNER), UUID, 'diagram.delete');
    expect(r.source).toBe('owner');
    expect(query.mock.calls.some(([s]) => /diagram_members/.test(s))).toBe(false);
  });

  test('an unknown / owner role in a member row grants nothing (fail closed)', async () => {
    db('owner');
    await expect(authorize(user(OTHER), UUID, 'diagram.read')).rejects.toMatchObject({ status: 404 });
    db('superuser');
    await expect(authorize(user(OTHER), UUID, 'diagram.read')).rejects.toMatchObject({ status: 404 });
  });

  test('a database error while resolving the member role is not treated as access', async () => {
    query.mockReset();
    query.mockImplementation(async (sql) => {
      if (/FROM diagram_members/.test(sql)) throw new Error('db down');
      return { rows: [meta()] };
    });
    await expect(authorize(user(OTHER), UUID, 'diagram.read')).rejects.toThrow('db down');
  });

  test('agent principal: member role is capped by the token role', async () => {
    db('editor');
    const agent = { kind: 'agent', userId: OTHER, tokenId: 't', roleCap: 'commenter', diagramScope: null };
    const r = await authorize(agent, UUID, 'comment.create');
    expect(r.role).toBe('commenter');
    await expect(authorize(agent, UUID, 'diagram.write')).rejects.toMatchObject({ status: 403 });
  });

  test('agent principal: token allowlist still hides a shared diagram', async () => {
    db('editor');
    const agent = { kind: 'agent', userId: OTHER, tokenId: 't', roleCap: 'viewer', diagramScope: ['99999999-9999-4999-8999-999999999999'] };
    await expect(authorize(agent, UUID, 'diagram.read')).rejects.toMatchObject({ status: 404 });
  });

  test('resolveRole reports member role', async () => {
    db('commenter');
    await expect(resolveRole(user(OTHER), UUID)).resolves.toEqual({ role: 'commenter', source: 'member' });
  });
});
