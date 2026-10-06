import { ROLES, ACTIONS, ACTION_MIN_ROLE, can, capabilitiesFor, maxRole, minRole } from '../../lib/authz/policy';

// Independent expectation, transcribed from ADR-0003 section 1 (not derived from the implementation).
const EXPECTED = {
  viewer: ['diagram.read', 'diagram.export', 'version.read', 'comment.read'],
  commenter: ['comment.create', 'comment.reply', 'thread.resolve', 'comment.edit_own', 'comment.delete_own'],
  editor: ['diagram.write', 'version.create', 'version.restore', 'share.read', 'share.manage'],
  owner: ['comment.delete_any', 'diagram.delete', 'ownership.transfer', 'audit.read'],
};
const LADDER = ['viewer', 'commenter', 'editor', 'owner'];

describe('policy matrix', () => {
  test('role ladder order', () => expect([...ROLES]).toEqual(LADDER));

  test('every action is covered by the expectation exactly once', () => {
    const all = Object.values(EXPECTED).flat();
    expect([...all].sort()).toEqual([...ACTIONS].sort());
  });

  const cases = [];
  LADDER.forEach((role, ri) => {
    Object.entries(EXPECTED).forEach(([minimum, actions]) => {
      actions.forEach((action) => cases.push([role, action, ri >= LADDER.indexOf(minimum)]));
    });
  });
  test.each(cases)('%s / %s -> %s', (role, action, allowed) => {
    expect(can(role, action)).toBe(allowed);
  });

  test('null, unknown role and unknown action are denied', () => {
    expect(can(null, 'diagram.read')).toBe(false);
    expect(can('admin', 'diagram.read')).toBe(false);
    expect(can('owner', 'diagram.explode')).toBe(false);
    expect(can('owner', '__proto__')).toBe(false);
    expect(can('toString', 'diagram.read')).toBe(false);
  });

  test('capabilitiesFor is monotonic and complete for owner', () => {
    expect(capabilitiesFor('owner').sort()).toEqual([...ACTIONS].sort());
    expect(capabilitiesFor(null)).toEqual([]);
    for (let i = 1; i < LADDER.length; i++) {
      capabilitiesFor(LADDER[i - 1]).forEach((a) => expect(capabilitiesFor(LADDER[i])).toContain(a));
    }
  });

  test('table is frozen', () => expect(Object.isFrozen(ACTION_MIN_ROLE)).toBe(true));

  test('maxRole / minRole', () => {
    expect(maxRole('viewer', 'editor', null)).toBe('editor');
    expect(maxRole(null, null)).toBeNull();
    expect(minRole('editor', 'commenter')).toBe('commenter');
    expect(minRole('editor', null)).toBeNull();
  });
});
