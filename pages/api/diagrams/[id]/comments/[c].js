// pages/api/diagrams/[id]/comments/[c].js
// PATCH edit own comment body         - comment.edit_own   (commenter + author, enforced in the repository)
// DELETE soft delete                  - comment.delete_own (commenter; author) or comment.delete_any (owner)

import { withDiagramAuth } from '../../../../../lib/authz/next';
import { can } from '../../../../../lib/authz/policy';
import { commentRepository } from '../../../../../lib/commentRepository';
import { isUuid, validateBody } from '../../../../../lib/comments/validate';
import { badRequest, notFound, sendValidation, withCommentErrors } from '../../../../../lib/comments/http';

async function handleEdit(req, res, { diagram, user }) {
  if (req.body === null || typeof req.body !== 'object' || Array.isArray(req.body)) return badRequest(res, 'Request body must be a JSON object');
  const body = validateBody(req.body.body);
  if (!body.ok) return sendValidation(res, body);
  return withCommentErrors(res, async () => {
    const comment = await commentRepository.editComment(diagram.id, req.query.c, body.value, { userId: user.id });
    if (!comment) return notFound(res, 'Comment');
    return res.status(200).json(comment);
  });
}

async function handleDelete(req, res, { diagram, user, role }) {
  return withCommentErrors(res, async () => {
    const found = await commentRepository.deleteComment(diagram.id, req.query.c, { userId: user.id, canDeleteAny: can(role, 'comment.delete_any') });
    if (!found) return notFound(res, 'Comment');
    return res.status(204).end();
  });
}

export default withDiagramAuth(
  { PATCH: 'comment.edit_own', DELETE: 'comment.delete_own' },
  (req, res, ctx) => {
    if (!isUuid(req.query.c)) return notFound(res, 'Comment');
    return req.method === 'PATCH' ? handleEdit(req, res, ctx) : handleDelete(req, res, ctx);
  }
);
