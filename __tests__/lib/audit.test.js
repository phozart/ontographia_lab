import { recordAuditEvent } from '../../lib/audit';

describe('recordAuditEvent (log-only until the audit_events table exists)', () => {
  let info;
  beforeEach(() => { info = jest.spyOn(console, 'info').mockImplementation(() => {}); });
  afterEach(() => info.mockRestore());

  test('writes one structured line: action, actor, diagram, target, timestamp', () => {
    recordAuditEvent({ action: 'version.restore', actorUserId: 'u1', diagramId: 'd1', target: { fromVersion: 2 } });
    expect(info).toHaveBeenCalledTimes(1);
    const line = info.mock.calls[0][0];
    expect(line.startsWith('AUDIT ')).toBe(true);
    const evt = JSON.parse(line.slice(6));
    expect(evt).toMatchObject({ action: 'version.restore', actorUserId: 'u1', diagramId: 'd1', target: { fromVersion: 2 } });
    expect(new Date(evt.occurredAt).getTime()).not.toBeNaN();
  });

  test('never throws (an audit failure must not fail the request)', () => {
    info.mockImplementation(() => { throw new Error('stdout closed'); });
    expect(() => recordAuditEvent({ action: 'x' })).not.toThrow();
  });

  test('requires an action', () => {
    expect(() => recordAuditEvent({})).not.toThrow();
    expect(info).not.toHaveBeenCalled();
  });
});
