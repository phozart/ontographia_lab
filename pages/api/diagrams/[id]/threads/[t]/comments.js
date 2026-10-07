// pages/api/diagrams/[id]/threads/[t]/comments.js
// POST reply to a thread (reopens a resolved thread, Q-C2) - comment.reply (commenter)

import { withDiagramAuth } from '../../../../../../lib/authz/next';
import { commentRepository } from '../../../../../../lib/commentRepository';
import { isUuid, validateBody } from '../../../../../../lib/comments/validate';
import { actorFrom, allowCreate, badRequest, notFound, sendValidation, withCommentErrors } from '../../../../../../lib/comments/http';

export default withDiagramAuth({ POST: 'comment.reply' }, async (req, res, { diagram, user }) => {
  if (!isUuid(req.query.t)) return notFound(res);
  if (req.body === null || typeof req.body !== 'object' || Array.isArray(req.body)) return badRequest(res, 'Request body must be a JSON object');
  const body = validateBody(req.body.body);
  if (!body.ok) return sendValidation(res, body);
  if (!(await allowCreate(req, res, user.id))) return undefined;

  return withCommentErrors(res, async () => {
    const comment = await commentRepository.addComment(diagram.id, req.query.t, body.value, actorFrom(user));
    if (!comment) return notFound(res);
    return res.status(201).json(comment);
  });
});
