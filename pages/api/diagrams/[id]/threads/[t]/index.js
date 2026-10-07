// pages/api/diagrams/[id]/threads/[t]/index.js
// GET   one thread with all its comments      - comment.read   (viewer)
// PATCH resolve / reopen                      - thread.resolve (commenter; Q-C2: any commenter or above)

import { withDiagramAuth } from '../../../../../../lib/authz/next';
import { commentRepository } from '../../../../../../lib/commentRepository';
import { isUuid, validateStatusPatch } from '../../../../../../lib/comments/validate';
import { actorFrom, allowEdit, notFound, sendValidation, withCommentErrors } from '../../../../../../lib/comments/http';

async function handleGet(req, res, { diagram }) {
  return withCommentErrors(res, async () => {
    const thread = await commentRepository.getThread(diagram.id, req.query.t);
    if (!thread) return notFound(res);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(thread);
  });
}

async function handlePatch(req, res, { diagram, user }) {
  const status = validateStatusPatch(req.body);
  if (!status.ok) return sendValidation(res, status);
  if (!(await allowEdit(req, res, user.id))) return undefined;
  return withCommentErrors(res, async () => {
    const thread = await commentRepository.setStatus(diagram.id, req.query.t, status.value, actorFrom(user));
    if (!thread) return notFound(res);
    return res.status(200).json(thread);
  });
}

export default withDiagramAuth(
  { GET: 'comment.read', PATCH: 'thread.resolve' },
  (req, res, ctx) => {
    if (!isUuid(req.query.t)) return notFound(res);
    return req.method === 'GET' ? handleGet(req, res, ctx) : handlePatch(req, res, ctx);
  }
);
