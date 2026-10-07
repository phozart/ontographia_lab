// Slice 5: audit_events writer and reader. DB mocked.
jest.mock('../../lib/db', () => ({ query: jest.fn() }));

import { query } from '../../lib/db';
import { recordAuditEvent, listAuditEvents } from '../../lib/audit';

const D = '123e4567-e89b-12d3-a456-426614174000';
const U = '11111111-1111-4111-8111-111111111111';

describe('recordAuditEvent', () => {
  let err;
  beforeEach(() => {
    query.mockReset();
    query.mockResolvedValue({ rows: [] });
    err = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => err.mockRestore());

  test('inserts one row: actor type, actor, action, diagram, target JSON', async () => {
    await recordAuditEvent({ action: 'share.grant', actorUserId: U, diagramId: D, target: { userId: 'x', role: 'viewer' } });
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO audit_events/);
    expect(sql).not.toMatch(/UPDATE|DELETE/i);
    expect(params).toEqual(['user', U, null, 'share.grant', D, JSON.stringify({ userId: 'x', role: 'viewer' })]);
  });

  test('agent events carry actor_type agent and on_behalf_of', async () => {
    await recordAuditEvent({ action: 'x.y', actorType: 'agent', actorUserId: U, onBehalfOf: U, diagramId: D });
    expect(query.mock.calls[0][1].slice(0, 3)).toEqual(['agent', U, U]);
  });

  test('unknown actor types fall back to user (CHECK-safe)', async () => {
    await recordAuditEvent({ action: 'x.y', actorType: 'root', actorUserId: U });
    expect(query.mock.calls[0][1][0]).toBe('user');
  });

  test('a non-uuid diagram or actor id is stored as NULL, never as free text', async () => {
    await recordAuditEvent({ action: 'x.y', actorUserId: 'not-a-uuid', diagramId: "x'; DROP" });
    const p = query.mock.calls[0][1];
    expect(p[1]).toBeNull();
    expect(p[4]).toBeNull();
  });

  test('never throws; a failed insert is logged as an AUDIT line instead', async () => {
    query.mockRejectedValue(new Error('db down'));
    await expect(recordAuditEvent({ action: 'share.revoke', actorUserId: U, diagramId: D })).resolves.toBeUndefined();
    expect(err.mock.calls.some(([m]) => String(m).startsWith('AUDIT_FAILED '))).toBe(true);
  });

  test('requires an action', async () => {
    await expect(recordAuditEvent({})).resolves.toBeUndefined();
    await expect(recordAuditEvent(null)).resolves.toBeUndefined();
    expect(query).not.toHaveBeenCalled();
  });
});

describe('listAuditEvents', () => {
  beforeEach(() => query.mockReset());

  test('newest first, joins actor refs, returns nextCursor when more rows exist', async () => {
    const row = (id) => ({
      id: String(id), occurred_at: new Date('2026-01-01T00:00:00Z'), actor_type: 'user', action: 'share.grant', target: { role: 'viewer' },
      actor_id: U, actor_name: 'Al', actor_email: 'a@x.co', actor_image: null,
      behalf_id: null, behalf_name: null, behalf_email: null, behalf_image: null,
    });
    query.mockResolvedValue({ rows: [row(30), row(20), row(10)] });
    const out = await listAuditEvents(D, { limit: 2 });
    expect(query.mock.calls[0][0]).toMatch(/ORDER BY a\.id DESC/);
    expect(query.mock.calls[0][1]).toEqual([D, 3]);
    expect(out.items).toHaveLength(2);
    expect(out.items[0]).toMatchObject({ id: 30, actorType: 'user', action: 'share.grant', actor: { id: U, email: 'a@x.co' }, onBehalfOf: null });
    expect(out.nextCursor).toBe('20');
  });

  test('cursor filters older ids; bad cursor is ignored safely', async () => {
    query.mockResolvedValue({ rows: [] });
    await listAuditEvents(D, { limit: 5, cursor: '20' });
    expect(query.mock.calls[0][0]).toMatch(/a\.id < \$2/);
    expect(query.mock.calls[0][1]).toEqual([D, 20, 6]);
    query.mockClear();
    await listAuditEvents(D, { limit: 5, cursor: "1; DROP TABLE" });
    expect(query.mock.calls[0][1]).toEqual([D, 6]);
  });

  test('limit is clamped to 1..100', async () => {
    query.mockResolvedValue({ rows: [] });
    await listAuditEvents(D, { limit: 100000 });
    expect(query.mock.calls[0][1]).toEqual([D, 101]);
  });
});
