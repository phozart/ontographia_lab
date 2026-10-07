// lib/comments/http.js
// Request/response helpers shared by the comment routes. Kept out of the page files:
// __tests__/authz/handlersWrapped.test.js forbids extra function exports there.

import { CommentError } from '../commentRepository';
import { rateLimit } from '../rateLimit';

// Per-user cap on creating threads/replies (ADR-0002 decision 10). Keyed by user id, not IP.
const createLimiter = rateLimit({ interval: 60 * 1000, limit: 30, prefix: 'comment-create' });

// Separate per-user cap on edits and resolve/reopen.
const editLimiter = rateLimit({ interval: 60 * 1000, limit: 60, prefix: 'comment-edit' });

/** Sends 429 itself and returns false when over the edit/resolve limit. */
export async function allowEdit(req, res, userId) {
  const { success } = await editLimiter.check(req, res, `u:${userId}`);
  return success;
}

/** Sends 429 itself and returns false when over the limit. */
export async function allowCreate(req, res, userId) {
  const { success } = await createLimiter.check(req, res, `u:${userId}`);
  return success;
}

export function sendError(res, status, code, error) {
  return res.status(status).json({ error, code });
}
export const badRequest = (res, error) => sendError(res, 400, 'VALIDATION_FAILED', error);
export const notFound = (res, what = 'Thread') => sendError(res, 404, 'NOT_FOUND', `${what} not found`);
export const sendValidation = (res, v) => sendError(res, v.status, v.code, v.error);

/** Runs `fn`; a CommentError becomes its status/code response, anything else propagates (-> 500 in the wrapper). */
export async function withCommentErrors(res, fn) {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof CommentError) return sendError(res, err.status, err.code, err.message);
    throw err;
  }
}

/** Session user -> actor recorded on a comment. */
export const actorFrom = (user, via = 'web') => ({ userId: user.id, via });
