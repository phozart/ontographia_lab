// lib/authz/policy.js
// Pure policy data and functions (no I/O, no framework imports).
// The role ladder and the action -> minimum-role table live in THIS file only (ADR-0003 section 1).
// Usable from API routes today and from a socket / MCP server later.

/** Ordered lowest to highest. */
export const ROLES = Object.freeze(['viewer', 'commenter', 'editor', 'owner']);

/**
 * Action -> minimum role required. The single place to change the permission matrix.
 * Q-S3 (accepted default): editors may share (as viewer/commenter, enforced by the sharing slice);
 * only the owner may grant editor.
 */
export const ACTION_MIN_ROLE = Object.freeze({
  'diagram.read': 'viewer',
  'diagram.export': 'viewer',
  'version.read': 'viewer',
  'comment.read': 'viewer',
  'comment.create': 'commenter',
  'comment.reply': 'commenter',
  'thread.resolve': 'commenter',
  'comment.edit_own': 'commenter',
  'comment.delete_own': 'commenter',
  'diagram.write': 'editor',
  'version.create': 'editor',
  'version.restore': 'editor',
  'share.read': 'editor',
  'share.manage': 'editor',
  'comment.delete_any': 'owner',
  'diagram.delete': 'owner',
  'ownership.transfer': 'owner',
  'audit.read': 'owner',
});

export const ACTIONS = Object.freeze(Object.keys(ACTION_MIN_ROLE));

const RANK = Object.freeze(ROLES.reduce((acc, role, i) => ({ ...acc, [role]: i }), {}));
const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

export function isRole(value) {
  return typeof value === 'string' && has(RANK, value);
}

/** True when `role` meets the minimum role of `action`. Unknown role/action => false (deny by default). */
export function can(role, action) {
  if (!isRole(role)) return false;
  if (typeof action !== 'string' || !has(ACTION_MIN_ROLE, action)) return false;
  return RANK[role] >= RANK[ACTION_MIN_ROLE[action]];
}

/** Roles that can be granted to another user (never owner: ownership is diagrams.owner_id). */
export const GRANTABLE_ROLES = Object.freeze(['viewer', 'commenter', 'editor']);

/**
 * Highest role `actorRole` may hand out (Q-S3): the owner any grantable role, an editor viewer/commenter only,
 * nobody else anything.
 */
function maxGrantable(actorRole) {
  if (actorRole === 'owner') return 'editor';
  if (actorRole === 'editor') return 'commenter';
  return null;
}

const isGrantable = (role) => typeof role === 'string' && GRANTABLE_ROLES.includes(role);

/** May `actorRole` give `targetRole` to someone? Needs share.manage and targetRole <= the actor's grant ceiling. */
export function canGrant(actorRole, targetRole) {
  if (!can(actorRole, 'share.manage') || !isGrantable(targetRole)) return false;
  const ceiling = maxGrantable(actorRole);
  return ceiling !== null && RANK[targetRole] <= RANK[ceiling];
}

/**
 * May `actorRole` change an existing member from `currentRole` to `newRole`, or revoke them (`newRole === null`)?
 * An actor may only touch members at or below their own grant ceiling (an editor cannot demote/remove editors).
 */
export function canModifyMember(actorRole, currentRole, newRole) {
  if (!isGrantable(currentRole)) return false;
  const ceiling = maxGrantable(actorRole);
  if (!can(actorRole, 'share.manage') || ceiling === null || RANK[currentRole] > RANK[ceiling]) return false;
  return newRole === null ? true : canGrant(actorRole, newRole);
}

/** All actions a role may perform, in table order. */
export function capabilitiesFor(role) {
  return isRole(role) ? ACTIONS.filter((action) => can(role, action)) : [];
}

/** Highest of the given roles; null/unknown values are ignored. */
export function maxRole(...roles) {
  let best = null;
  for (const r of roles) {
    if (isRole(r) && (best === null || RANK[r] > RANK[best])) best = r;
  }
  return best;
}

/** Lowest of the given roles; any null/unknown value yields null (a cap of nothing is nothing). */
export function minRole(...roles) {
  let best = null;
  for (const r of roles) {
    if (!isRole(r)) return null;
    if (best === null || RANK[r] < RANK[best]) best = r;
  }
  return best;
}
