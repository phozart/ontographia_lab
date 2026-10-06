// lib/versions/http.js
// Small request/response helpers shared by the version routes (pages/api/diagrams/[id]/versions/**).
// Kept out of the page files: __tests__/authz/handlersWrapped.test.js forbids extra function exports there.

import { VersionError } from '../versionRepository';

const IF_MATCH_RE = /^(?:W\/)?"?(\d{1,15})"?$/;

/** `[v]` path segment -> positive integer, or null when malformed. */
export function parseVersionNumber(raw) {
  if (typeof raw !== 'string' || !/^\d{1,9}$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 && n <= 2147483647 ? n : null;
}

/** @returns {{ok: true, revision: number|null} | {ok: false}} */
export function parseIfMatch(req) {
  const header = req.headers && req.headers['if-match'];
  if (header === undefined || header === '') return { ok: true, revision: null };
  const m = IF_MATCH_RE.exec(String(header).trim());
  return m ? { ok: true, revision: Number(m[1]) } : { ok: false };
}

export function sendError(res, status, code, error) {
  return res.status(status).json({ error, code });
}

export function badRequest(res, error) {
  return sendError(res, 400, 'VALIDATION_FAILED', error);
}

export function notFound(res, what = 'Version') {
  return sendError(res, 404, 'NOT_FOUND', `${what} not found`);
}

/** Runs `fn`; a VersionError becomes its status/code response, anything else propagates (-> 500 in the wrapper). */
export async function withVersionErrors(res, fn) {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof VersionError) return sendError(res, err.status, err.code, err.message);
    throw err;
  }
}

/** Session user -> actor recorded on a version. */
export function actorFrom(user, via = 'web') {
  return { userId: user.id, email: user.email, via };
}
