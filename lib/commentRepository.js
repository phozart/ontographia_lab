// lib/commentRepository.js
// Comment threads persistence (ADR-0002, delivery-plan slice 4). Comments live in their own tables, never in
// diagrams.content, and are not versioned. Deletes are soft (body cleared, placeholder kept so replies stay
// coherent); a thread whose comments are all deleted is hidden. Anchor attachment is derived at read time from
// the diagram's current content (lib/comments/anchors.js), so deleting an element detaches its threads and a
// version restore that brings the element back re-attaches them without any write to the comment tables.

import { getClient, query } from './db';
import { anchorState } from './comments/anchors';

export const DEFAULT_LIST_LIMIT = 50;
export const MAX_LIST_LIMIT = 100;
export const COMMENTS_PER_THREAD_IN_LIST = 20;

export class CommentError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.name = 'CommentError';
    this.status = status;
    this.code = code;
  }
}

const iso = (d) => (d instanceof Date ? d.toISOString() : d || null);
const safeImage = (v) => (typeof v === 'string' && /^https?:\/\//i.test(v) ? v : null);
// Display name for an author: the profile name, else the local part of the e-mail (never the full address:
// commenters and viewers of a shared diagram see authors but not each other's e-mail), else "Unknown".
export const displayName = (name, email) => {
  if (typeof name === 'string' && name.trim()) return name.trim();
  if (typeof email === 'string' && email.includes('@')) return email.split('@')[0] || 'Unknown';
  return 'Unknown';
};
const userRef = (id, name, email, image) => (id ? { id, name: displayName(name, email), image: safeImage(image) } : null);

export function toComment(row) {
  const deleted = row.deleted_at != null;
  return {
    id: row.id,
    threadId: row.thread_id,
    author: userRef(row.author_id, row.author_name, row.author_email, row.author_image),
    body: deleted ? '' : row.body,
    createdVia: row.created_via,
    createdAt: iso(row.created_at),
    editedAt: iso(row.edited_at) || undefined,
    deleted,
  };
}

function toThread(row, comments, ids) {
  const anchor = row.anchor_type === 'canvas'
    ? { type: 'canvas', x: row.anchor_x, y: row.anchor_y }
    : { type: row.anchor_type, targetId: row.anchor_target_id, x: row.anchor_x, y: row.anchor_y, fallbackX: row.fallback_x, fallbackY: row.fallback_y };
  return {
    id: row.id,
    diagramId: row.diagram_id,
    anchor,
    anchorState: anchorState(anchor, ids),
    status: row.status,
    resolvedBy: row.resolved_by ? userRef(row.resolved_by, row.resolver_name, row.resolver_email, null) : undefined,
    resolvedAt: iso(row.resolved_at) || undefined,
    createdBy: userRef(row.created_by, row.creator_name, row.creator_email, row.creator_image),
    createdAt: iso(row.created_at),
    createdAtRevision: row.created_at_revision == null ? null : Number(row.created_at_revision),
    lastActivityAt: iso(row.last_activity_at),
    comments,
    commentCount: Number(row.comment_count),
  };
}

const THREAD_SELECT = `
  t.*, cu.name AS creator_name, cu.email AS creator_email, cu.image AS creator_image,
  ru.name AS resolver_name, ru.email AS resolver_email,
  (SELECT count(*) FROM comments c WHERE c.thread_id = t.id) AS comment_count,
  t.last_activity_at::text AS la_text`;
const THREAD_FROM = `
  FROM comment_threads t
  LEFT JOIN users cu ON cu.id = t.created_by
  LEFT JOIN users ru ON ru.id = t.resolved_by`;
const VISIBLE = 'EXISTS (SELECT 1 FROM comments c WHERE c.thread_id = t.id AND c.deleted_at IS NULL)';

/** Ids of elements/connections currently in the diagram (ids only: never ships the whole content). */
async function currentIds(db, diagramId) {
  const res = await db.query(
    `SELECT
       COALESCE((SELECT array_agg(e->>'id') FROM jsonb_array_elements(CASE WHEN jsonb_typeof(d.content->'elements') = 'array' THEN d.content->'elements' ELSE '[]'::jsonb END) e), '{}') AS element_ids,
       COALESCE((SELECT array_agg(e->>'id') FROM jsonb_array_elements(CASE WHEN jsonb_typeof(d.content->'connections') = 'array' THEN d.content->'connections' ELSE '[]'::jsonb END) e), '{}') AS connection_ids
     FROM diagrams d WHERE d.id = $1`,
    [diagramId]
  );
  const row = res.rows[0];
  return { elementIds: new Set(row ? row.element_ids : []), connectionIds: new Set(row ? row.connection_ids : []) };
}

async function loadComments(db, threadIds, perThread) {
  const byThread = new Map(threadIds.map((id) => [id, []]));
  if (!threadIds.length) return byThread;
  const res = await db.query(
    `SELECT * FROM (
       SELECT c.*, u.name AS author_name, u.email AS author_email, u.image AS author_image,
              row_number() OVER (PARTITION BY c.thread_id ORDER BY c.created_at DESC, c.id DESC) AS rn
         FROM comments c LEFT JOIN users u ON u.id = c.author_id
        WHERE c.thread_id = ANY($1::uuid[])) x
      WHERE ($2::int IS NULL OR rn <= $2)
      ORDER BY created_at ASC, id ASC`,
    [threadIds, perThread || null]
  );
  for (const r of res.rows) byThread.get(r.thread_id).push(toComment(r));
  return byThread;
}

function encodeCursor(laText, id) {
  return Buffer.from(JSON.stringify([laText, id])).toString('base64url');
}
function decodeCursor(cursor) {
  try {
    const [la, id] = JSON.parse(Buffer.from(String(cursor), 'base64url').toString('utf8'));
    if (typeof la === 'string' && typeof id === 'string' && !Number.isNaN(Date.parse(la))) return { la, id };
  } catch (_) { /* fall through */ }
  throw new CommentError(400, 'VALIDATION_FAILED', 'invalid cursor');
}

async function withTx(fn) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
}

async function loadOne(db, diagramId, threadId, { allComments }) {
  const res = await db.query(`SELECT ${THREAD_SELECT} ${THREAD_FROM} WHERE t.id = $1 AND t.diagram_id = $2 AND ${VISIBLE}`, [threadId, diagramId]);
  if (!res.rows[0]) return null;
  const [ids, comments] = await Promise.all([
    currentIds(db, diagramId),
    loadComments(db, [threadId], allComments ? null : COMMENTS_PER_THREAD_IN_LIST),
  ]);
  return toThread(res.rows[0], comments.get(threadId), ids);
}

async function loadComment(id) {
  const res = await query(
    `SELECT c.*, u.name AS author_name, u.email AS author_email, u.image AS author_image
       FROM comments c LEFT JOIN users u ON u.id = c.author_id WHERE c.id = $1`, [id]);
  return res.rows[0] ? toComment(res.rows[0]) : null;
}

export const commentRepository = {
  async listThreads(diagramId, { status = 'open', anchorTarget = null, limit, cursor = null } = {}) {
    const lim = Math.min(Math.max(Number(limit) || DEFAULT_LIST_LIMIT, 1), MAX_LIST_LIMIT);
    const params = [diagramId];
    const where = ['t.diagram_id = $1', VISIBLE];
    if (status !== 'all') { params.push(status); where.push(`t.status = $${params.length}`); }
    if (anchorTarget) { params.push(anchorTarget); where.push(`t.anchor_target_id = $${params.length}`); }
    if (cursor) {
      const c = decodeCursor(cursor);
      params.push(c.la, c.id);
      where.push(`(t.last_activity_at, t.id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`);
    }
    params.push(lim + 1);
    const res = await query(
      `SELECT ${THREAD_SELECT} ${THREAD_FROM} WHERE ${where.join(' AND ')}
        ORDER BY t.last_activity_at DESC, t.id DESC LIMIT $${params.length}`,
      params
    );
    const page = res.rows.slice(0, lim);
    const [ids, comments] = await Promise.all([
      currentIds({ query }, diagramId),
      loadComments({ query }, page.map((r) => r.id), COMMENTS_PER_THREAD_IN_LIST),
    ]);
    const items = page.map((r) => toThread(r, comments.get(r.id), ids));
    const last = page[page.length - 1];
    return { items, nextCursor: res.rows.length > lim && last ? encodeCursor(last.la_text, last.id) : null };
  },

  async getThread(diagramId, threadId) {
    return loadOne({ query }, diagramId, threadId, { allComments: true });
  },

  /** @returns {Promise<object|null>} the new thread, or null when the diagram no longer exists */
  async createThread(diagramId, { anchor, body }, actor) {
    const threadId = await withTx(async (db) => {
      const d = await db.query('SELECT revision FROM diagrams WHERE id = $1', [diagramId]);
      if (!d.rows[0]) return null;
      const isCanvas = anchor.type === 'canvas';
      const t = await db.query(
        `INSERT INTO comment_threads (diagram_id, anchor_type, anchor_target_id, anchor_x, anchor_y, fallback_x, fallback_y, created_by, created_at_revision)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [diagramId, anchor.type, isCanvas ? null : anchor.targetId, anchor.x, anchor.y,
          isCanvas ? anchor.x : anchor.fallbackX, isCanvas ? anchor.y : anchor.fallbackY, actor.userId, d.rows[0].revision]
      );
      await db.query('INSERT INTO comments (thread_id, author_id, body, created_via) VALUES ($1,$2,$3,$4)', [t.rows[0].id, actor.userId, body, actor.via || 'web']);
      return t.rows[0].id;
    });
    return threadId ? loadOne({ query }, diagramId, threadId, { allComments: true }) : null;
  },

  /** Reply; reopens a resolved thread (Q-C2). @returns {Promise<object|null>} comment, or null when the thread is gone */
  async addComment(diagramId, threadId, body, actor) {
    const id = await withTx(async (db) => {
      const t = await db.query(`SELECT t.id FROM comment_threads t WHERE t.id = $1 AND t.diagram_id = $2 AND ${VISIBLE} FOR UPDATE`, [threadId, diagramId]);
      if (!t.rows[0]) return null;
      const c = await db.query('INSERT INTO comments (thread_id, author_id, body, created_via) VALUES ($1,$2,$3,$4) RETURNING id', [threadId, actor.userId, body, actor.via || 'web']);
      await db.query(`UPDATE comment_threads SET last_activity_at = NOW(), status = 'open', resolved_by = NULL, resolved_at = NULL WHERE id = $1`, [threadId]);
      return c.rows[0].id;
    });
    return id ? loadComment(id) : null;
  },

  /** Resolve / reopen (Q-C2: any commenter or above). @returns {Promise<object|null>} */
  async setStatus(diagramId, threadId, status, actor) {
    const res = await query(
      `UPDATE comment_threads t
          SET status = $3, resolved_by = CASE WHEN $3 = 'resolved' THEN $4::uuid ELSE NULL END,
              resolved_at = CASE WHEN $3 = 'resolved' THEN NOW() ELSE NULL END, last_activity_at = NOW()
        WHERE t.id = $1 AND t.diagram_id = $2 AND ${VISIBLE} RETURNING t.id`,
      [threadId, diagramId, status, actor.userId]
    );
    return res.rows[0] ? loadOne({ query }, diagramId, threadId, { allComments: true }) : null;
  },

  /** @returns {Promise<object|null>} null when missing or already deleted; CommentError 403 when not the author */
  async editComment(diagramId, commentId, body, actor) {
    const id = await withTx(async (db) => {
      const c = await db.query(
        `SELECT c.id, c.author_id, c.deleted_at FROM comments c JOIN comment_threads t ON t.id = c.thread_id
          WHERE c.id = $1 AND t.diagram_id = $2 FOR UPDATE OF c`, [commentId, diagramId]);
      const row = c.rows[0];
      if (!row || row.deleted_at) return null;
      if (row.author_id !== actor.userId) throw new CommentError(403, 'FORBIDDEN', 'Only the author can edit a comment');
      await db.query('UPDATE comments SET body = $2, edited_at = NOW() WHERE id = $1', [commentId, body]);
      return commentId;
    });
    return id ? loadComment(id) : null;
  },

  /** Soft delete. @returns {Promise<boolean>} false when the comment does not exist; CommentError 403 when not allowed */
  async deleteComment(diagramId, commentId, { userId, canDeleteAny = false }) {
    return withTx(async (db) => {
      const c = await db.query(
        `SELECT c.id, c.author_id, c.deleted_at FROM comments c JOIN comment_threads t ON t.id = c.thread_id
          WHERE c.id = $1 AND t.diagram_id = $2 FOR UPDATE OF c`, [commentId, diagramId]);
      const row = c.rows[0];
      if (!row) return false;
      if (row.author_id !== userId && !canDeleteAny) throw new CommentError(403, 'FORBIDDEN', 'Only the author or the owner can delete a comment');
      if (!row.deleted_at) await db.query(`UPDATE comments SET body = '', deleted_at = NOW() WHERE id = $1`, [commentId]);
      return true;
    });
  },
};
