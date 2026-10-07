// lib/audit.js
// Append-only audit trail (data-model.md `audit_events`, migration 0008). Application code only INSERTs.
// recordAuditEvent never throws: an audit failure must not fail the request that triggered it; on failure the event is
// emitted as a single "AUDIT_FAILED {json}" error line so it is not silently lost. No IP addresses or secrets are stored.

import { query } from './db';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTOR_TYPES = ['user', 'link', 'agent', 'admin', 'system'];
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const uuidOrNull = (v) => (typeof v === 'string' && UUID_RE.test(v) ? v : null);

/**
 * @param {{action: string, actorType?: string, actorUserId?: string|null, onBehalfOf?: string|null, diagramId?: string|null, target?: object}} event
 * @returns {Promise<void>} always resolves
 */
export async function recordAuditEvent(event) {
  try {
    if (!event || typeof event.action !== 'string' || !event.action) return;
    const actorType = ACTOR_TYPES.includes(event.actorType) ? event.actorType : 'user';
    const target = event.target && typeof event.target === 'object' ? event.target : {};
    try {
      await query(
        `INSERT INTO audit_events (actor_type, actor_user_id, on_behalf_of, action, diagram_id, target)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
        [
          actorType,
          uuidOrNull(event.actorUserId),
          uuidOrNull(event.onBehalfOf),
          event.action.slice(0, 100),
          uuidOrNull(event.diagramId),
          JSON.stringify(target),
        ]
      );
    } catch (err) {
      console.error(
        `AUDIT_FAILED ${JSON.stringify({ at: new Date().toISOString(), actorType, action: event.action, actorUserId: event.actorUserId || null, diagramId: event.diagramId || null, target, error: err && err.message })}`
      );
    }
  } catch (_) {
    // swallow
  }
}

const userRef = (id, name, email, image) => (id ? { id, name: name || null, email, image: image || null } : null);

/**
 * Newest-first page of a diagram's audit events (keyset on id). Callers must have authorized `audit.read`.
 * @returns {Promise<{items: object[], nextCursor: string|null}>}
 */
export async function listAuditEvents(diagramId, { limit = DEFAULT_LIMIT, cursor } = {}) {
  const lim = Math.min(Math.max(parseInt(limit, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const params = [diagramId];
  let where = 'a.diagram_id = $1';
  if (typeof cursor === 'string' && /^\d{1,15}$/.test(cursor)) {
    params.push(Number(cursor));
    where += ` AND a.id < $${params.length}`;
  }
  params.push(lim + 1);
  const result = await query(
    `SELECT a.id, a.occurred_at, a.actor_type, a.action, a.target,
            u.id AS actor_id, u.name AS actor_name, u.email AS actor_email, u.image AS actor_image,
            b.id AS behalf_id, b.name AS behalf_name, b.email AS behalf_email, b.image AS behalf_image
       FROM audit_events a
       LEFT JOIN users u ON u.id = a.actor_user_id
       LEFT JOIN users b ON b.id = a.on_behalf_of
      WHERE ${where}
      ORDER BY a.id DESC
      LIMIT $${params.length}`,
    params
  );
  const rows = result.rows;
  const page = rows.slice(0, lim);
  const items = page.map((r) => ({
    id: Number(r.id),
    occurredAt: r.occurred_at instanceof Date ? r.occurred_at.toISOString() : r.occurred_at,
    actorType: r.actor_type,
    actor: userRef(r.actor_id, r.actor_name, r.actor_email, r.actor_image),
    onBehalfOf: userRef(r.behalf_id, r.behalf_name, r.behalf_email, r.behalf_image),
    action: r.action,
    target: r.target || {},
  }));
  return { items, nextCursor: rows.length > lim && page.length ? String(page[page.length - 1].id) : null };
}
