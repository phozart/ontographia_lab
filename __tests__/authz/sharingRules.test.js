// Slice 5: who may grant / change / revoke which role (Q-S3: editors share as viewer/commenter only;
// only the owner grants editor). Pure policy, no I/O.
import { GRANTABLE_ROLES, canGrant, canModifyMember } from '../../lib/authz/policy';

describe('sharing rules', () => {
  test('grantable roles never include owner', () => {
    expect(GRANTABLE_ROLES).toEqual(['viewer', 'commenter', 'editor']);
  });

  test.each([
    ['owner', 'viewer', true], ['owner', 'commenter', true], ['owner', 'editor', true],
    ['editor', 'viewer', true], ['editor', 'commenter', true], ['editor', 'editor', false],
    ['commenter', 'viewer', false], ['viewer', 'viewer', false],
    ['owner', 'owner', false], ['editor', 'owner', false],
    ['owner', 'admin', false], ['owner', undefined, false], [null, 'viewer', false], ['bogus', 'viewer', false],
  ])('%s grants %s -> %s', (actor, target, expected) => {
    expect(canGrant(actor, target)).toBe(expected);
  });

  test.each([
    // [actorRole, currentRole, newRole (null = revoke), allowed]
    ['owner', 'viewer', 'editor', true], ['owner', 'editor', 'viewer', true], ['owner', 'editor', null, true],
    ['editor', 'viewer', 'commenter', true], ['editor', 'commenter', 'viewer', true], ['editor', 'viewer', null, true],
    ['editor', 'viewer', 'editor', false], // cannot promote to editor
    ['editor', 'editor', 'viewer', false], // cannot demote another editor
    ['editor', 'editor', null, false], // cannot revoke another editor
    ['commenter', 'viewer', null, false], ['viewer', 'viewer', null, false],
    ['owner', 'owner', 'viewer', false], ['owner', 'viewer', 'owner', false], ['owner', 'viewer', 'bogus', false],
  ])('%s changes member %s -> %s : %s', (actor, current, next, expected) => {
    expect(canModifyMember(actor, current, next)).toBe(expected);
  });
});
