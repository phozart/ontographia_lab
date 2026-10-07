// pages/api/diagrams/[id]/threads/index.js
// GET  list threads (anchorState computed against current content)  - comment.read   (viewer)
// POST create a thread with its first comment                       - comment.create (commenter)
// api-contracts.md section 4, ADR-0002. Bodies are plain text; the client renders them as text.

import { withDiagramAuth } from '../../../../../lib/authz/next';
import { commentRepository } from '../../../../../lib/commentRepository';
import { validateAnchor, validateBody, validateListQuery } from '../../../../../lib/comments/validate';
import { actorFrom, allowCreate, badRequest, notFound, sendValidation, withCommentErrors } from '../../../../../lib/comments/http';

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

async function handleList(req, res, { diagram }) {
  const q = validateListQuery(req.query);
  if (!q.ok) return sendValidation(res, q);
  return withCommentErrors(res, async () => {
    const page = await commentRepository.listThreads(diagram.id, q.value);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(page);
  });
}

async function handleCreate(req, res, { diagram, user }) {
  if (!isPlainObject(req.body)) return badRequest(res, 'Request body must be a JSON object');
  const anchor = validateAnchor(req.body.anchor);
  if (!anchor.ok) return sendValidation(res, anchor);
  const body = validateBody(req.body.body);
  if (!body.ok) return sendValidation(res, body);
  if (!(await allowCreate(req, res, user.id))) return undefined;

  return withCommentErrors(res, async () => {
    const thread = await commentRepository.createThread(diagram.id, { anchor: anchor.value, body: body.value }, actorFrom(user));
    if (!thread) return notFound(res, 'Diagram');
    return res.status(201).json(thread);
  });
}

export default withDiagramAuth(
  { GET: 'comment.read', POST: 'comment.create' },
  (req, res, ctx) => (req.method === 'GET' ? handleList(req, res, ctx) : handleCreate(req, res, ctx))
);
