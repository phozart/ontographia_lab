// lib/comments/validate.js
// Pure request validation for the comment endpoints (api-contracts section 4, ADR-0002). Bodies are PLAIN TEXT:
// stored as given and rendered as text by the client; nothing here interprets markup.

export const MAX_BODY_LENGTH = 10000;
export const MAX_TARGET_ID_LENGTH = 128;
export const MAX_COORD = 1e7; // canvas coordinates are far below this; rejects absurd / overflow values
export const ANCHOR_TYPES = Object.freeze(['canvas', 'element', 'connection']);
export const THREAD_STATUSES = Object.freeze(['open', 'resolved']);

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isCoord = (n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= MAX_COORD;
const ok = (value) => ({ ok: true, value });
const fail = (status, code, error) => ({ ok: false, status, code, error });
const invalid = (error) => fail(400, 'VALIDATION_FAILED', error);

/** @returns {{ok:true,value:string}|{ok:false,status,code,error}} body kept verbatim (not trimmed) once non-blank */
export function validateBody(body) {
  if (typeof body !== 'string') return invalid('body is required (1 to 10000 characters of text)');
  if (body.includes('\u0000')) return invalid('body must not contain NUL characters');
  if (body.trim().length === 0) return invalid('body must not be empty');
  // Code points, like the DB char_length constraint (UTF-16 length would over-count emoji).
  if ([...body].length > MAX_BODY_LENGTH) return fail(413, 'PAYLOAD_TOO_LARGE', `body must be at most ${MAX_BODY_LENGTH} characters`);
  return ok(body);
}

/** @returns {{ok:true,value:object}|{ok:false,status,code,error}} normalized Anchor (only known keys kept) */
export function validateAnchor(a) {
  if (!isPlainObject(a)) return invalid('anchor is required');
  if (!ANCHOR_TYPES.includes(a.type)) return invalid(`anchor.type must be one of ${ANCHOR_TYPES.join(', ')}`);
  if (!isCoord(a.x) || !isCoord(a.y)) return invalid('anchor.x and anchor.y must be finite numbers');
  if (a.type === 'canvas') {
    if (a.targetId !== undefined && a.targetId !== null) return invalid('a canvas anchor must not have a targetId');
    return ok({ type: 'canvas', x: a.x, y: a.y });
  }
  if (typeof a.targetId !== 'string' || a.targetId.length < 1 || a.targetId.length > MAX_TARGET_ID_LENGTH) {
    return invalid(`anchor.targetId is required (1 to ${MAX_TARGET_ID_LENGTH} characters)`);
  }
  if (!isCoord(a.fallbackX) || !isCoord(a.fallbackY)) return invalid('anchor.fallbackX and anchor.fallbackY are required numbers');
  return ok({ type: a.type, targetId: a.targetId, x: a.x, y: a.y, fallbackX: a.fallbackX, fallbackY: a.fallbackY });
}

export function validateStatusPatch(body) {
  if (!isPlainObject(body) || !THREAD_STATUSES.includes(body.status)) return invalid("status must be 'open' or 'resolved'");
  return ok(body.status);
}

/** Thread-list query string. */
export function validateListQuery(q) {
  const status = q.status === undefined ? 'open' : q.status;
  if (status !== 'all' && !THREAD_STATUSES.includes(status)) return invalid("status must be 'open', 'resolved' or 'all'");
  let limit;
  if (q.limit !== undefined) {
    if (!/^\d{1,4}$/.test(String(q.limit)) || Number(q.limit) < 1) return invalid('limit must be a positive integer');
    limit = Number(q.limit);
  }
  let anchorTarget = null;
  if (q.anchorTarget !== undefined) {
    if (typeof q.anchorTarget !== 'string' || q.anchorTarget.length < 1 || q.anchorTarget.length > MAX_TARGET_ID_LENGTH) return invalid('invalid anchorTarget');
    anchorTarget = q.anchorTarget;
  }
  if (q.cursor !== undefined && typeof q.cursor !== 'string') return invalid('invalid cursor');
  return ok({ status, anchorTarget, limit, cursor: q.cursor ?? null });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s) => typeof s === 'string' && UUID_RE.test(s);
