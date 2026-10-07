// pages/api/diagrams/[id]/members/[userId].js
// PUT    - change a member's role (share.manage; an actor may only touch members at or below what they may grant).
// DELETE - revoke (share.manage) or leave (a member removing themselves). Takes effect on the next request.
// The owner is never a member row: it cannot be demoted or removed (409 OWNER_IMMUTABLE).

import { withDiagramAuth } from '../../../../../lib/authz/next';
import { can, canModifyMember } from '../../../../../lib/authz/policy';
import { memberRepository } from '../../../../../lib/memberRepository';
import { recordAuditEvent } from '../../../../../lib/audit';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const notFound = (res) => res.status(404).json({ error: 'Member not found', code: 'MEMBER_NOT_FOUND' });
const forbidden = (res) => res.status(403).json({ error: 'Your role cannot make this change', code: 'FORBIDDEN' });
const conflict = (res) =>
  res.status(409).json({ error: 'Access was changed by someone else. Reload and try again.', code: 'CONFLICT' });
const ownerImmutable = (res) =>
  res.status(409).json({ error: 'The owner cannot be changed or removed', code: 'OWNER_IMMUTABLE' });

async function handlePut(req, res, { diagram, user, role }, userId) {
  if (userId === String(diagram.owner_id).toLowerCase()) return ownerImmutable(res);
  const newRole = req.body && req.body.role;
  if (typeof newRole !== 'string' || !['viewer', 'commenter', 'editor'].includes(newRole)) {
    return res.status(400).json({ error: 'role must be viewer, commenter or editor', code: 'VALIDATION_FAILED' });
  }
  const member = await memberRepository.getMember(diagram.id, userId);
  if (!member) return notFound(res);
  if (member.role === newRole) return res.status(200).json(member);
  if (!canModifyMember(role, member.role, newRole)) return forbidden(res);

  const updated = await memberRepository.setRole(diagram.id, userId, member.role, newRole);
  if (!updated) return conflict(res);
  await recordAuditEvent({
    action: 'share.change',
    actorUserId: user.id,
    diagramId: diagram.id,
    target: { userId, from: member.role, to: newRole },
  });
  return res.status(200).json(updated);
}

async function handleDelete(req, res, { diagram, user, role }, userId) {
  if (userId === String(diagram.owner_id).toLowerCase()) return ownerImmutable(res);
  const self = userId === String(user.id).toLowerCase();
  // Anyone with a role may leave; removing someone else needs share.manage.
  if (!self && !can(role, 'share.manage')) return forbidden(res);
  const member = await memberRepository.getMember(diagram.id, userId);
  if (!member) return notFound(res);
  if (!self && !canModifyMember(role, member.role, null)) return forbidden(res);

  const removed = await memberRepository.removeMember(diagram.id, userId, member.role);
  if (!removed) return conflict(res);
  await recordAuditEvent({
    action: 'share.revoke',
    actorUserId: user.id,
    diagramId: diagram.id,
    target: self ? { userId, role: member.role, self: true } : { userId, role: member.role },
  });
  return res.status(204).end();
}

// `diagram.read` is the floor for DELETE so members can leave; PUT needs share.manage.
export default withDiagramAuth({ PUT: 'share.manage', DELETE: 'diagram.read' }, async (req, res, ctx) => {
  const raw = req.query && req.query.userId;
  if (typeof raw !== 'string' || !UUID_RE.test(raw)) return notFound(res);
  // UUIDs are case-insensitive: normalize so the owner (409) and self-leave checks cannot be dodged by case
  const userId = raw.toLowerCase();
  return req.method === 'PUT' ? handlePut(req, res, ctx, userId) : handleDelete(req, res, ctx, userId);
});
