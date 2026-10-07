// pages/api/diagrams/[id]/shares.js
// POST - share with an EXISTING ACTIVE user by e-mail (no invitations: slice 7). Requires share.manage.
// Q-S3: editors may grant viewer/commenter only; only the owner grants editor.
// Q-S8: an unknown address gets a clear error (this reveals account existence to users who can share, accepted),
// mitigated by a per-user limit of 20 attempts per hour that counts every attempt.

import { withDiagramAuth } from '../../../../lib/authz/next';
import { canGrant } from '../../../../lib/authz/policy';
import { memberRepository } from '../../../../lib/memberRepository';
import { recordAuditEvent } from '../../../../lib/audit';
import { rateLimit } from '../../../../lib/rateLimit';

const shareLimiter = rateLimit({ interval: 60 * 60 * 1000, limit: 20, prefix: 'share' });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL = 255;
const MAX_MESSAGE = 500;

const bad = (res, error) => res.status(400).json({ error, code: 'VALIDATION_FAILED' });

export default withDiagramAuth({ POST: 'share.manage' }, async (req, res, { diagram, user, role }) => {
  const limited = await shareLimiter.check(req, res, user.id);
  if (!limited.success) return undefined; // the limiter already answered 429

  const { email, role: targetRole, message } = req.body || {};
  if (typeof email !== 'string' || email.length > MAX_EMAIL || !EMAIL_RE.test(email.trim())) {
    return bad(res, 'A valid email address is required');
  }
  if (typeof targetRole !== 'string' || !['viewer', 'commenter', 'editor'].includes(targetRole)) {
    return bad(res, 'role must be viewer, commenter or editor');
  }
  if (message !== undefined && message !== null && (typeof message !== 'string' || message.length > MAX_MESSAGE)) {
    return bad(res, `message must be a string of at most ${MAX_MESSAGE} characters`);
  }

  if (!canGrant(role, targetRole)) {
    return res.status(403).json({ error: `Your role cannot grant "${targetRole}" access`, code: 'ROLE_NOT_GRANTABLE' });
  }

  const target = await memberRepository.findActiveUserByEmail(email);
  if (!target) {
    return res.status(404).json({
      error: 'No active account with that email address. Only existing, approved users can be added.',
      code: 'USER_NOT_FOUND',
    });
  }
  if (target.id === diagram.owner_id) {
    return res.status(409).json({ error: 'That user owns this diagram', code: 'ALREADY_OWNER' });
  }
  if (target.id === user.id) {
    return res.status(409).json({ error: 'You already have access to this diagram', code: 'ALREADY_MEMBER' });
  }

  const member = await memberRepository.addMember(diagram.id, target.id, targetRole, user.id);
  if (!member) {
    return res.status(409).json({ error: 'That user already has access. Change their role instead.', code: 'ALREADY_MEMBER' });
  }

  await recordAuditEvent({
    action: 'share.grant',
    actorUserId: user.id,
    diagramId: diagram.id,
    target: { userId: target.id, role: targetRole },
  });

  return res.status(201).json({
    result: 'granted',
    member: { user: target, role: member.role, grantedBy: user.id, createdAt: member.createdAt },
  });
});
