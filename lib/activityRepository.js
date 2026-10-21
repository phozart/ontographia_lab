// lib/activityRepository.js
// Activity timeline (ADR-0006 5.3, 7, 8): edit sessions written inside the save transaction, a merged feed over three
// sources (edit sessions, audit events, named versions) and retention for the sessions. Raw SQL.
//
// The feed is one ordered stream, newest first, by (timestamp, source prefix, id): each source is read with its own
// keyset condition and LIMIT limit+1 (at most three indexed queries per page), then merged in memory. The cursor is
// the sort key of the last item returned (opaque base64url). Display names only, never e-mail addresses (Q-S5c).

import { query } from './db';
import { displayName } from './commentRepository';
import { planSession, retentionCutoff, RETENTION_DAYS } from './activity/sessions';
import { sanitizeLabel } from './live/agentActivity';

export const DEFAULT_LIMIT = 30;
export const MAX_LIMIT = 100;
const SHARE_ACTIONS = ['share.grant', 'share.change', 'share.revoke'];
const CONTENT_ACTIONS = ['diagram.agent_edit', 'version.restore'];
const UUID_RE_SQL = '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
const TS_FMT = `'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'`;
const iso = (d) => (d instanceof Date ? d.toISOString() : d || null);
const safeImage = (v) => (typeof v === 'string' && /^https?:\/\//i.test(v) ? v : null);
const person = (id, name, email, image) => (id ? { id, name: displayName(name, email), image: safeImage(image) } : null);
const num = (v) => (v == null ? null : Number(v));
// A human actor; a deleted account (ON DELETE SET NULL) reads as "Someone", never as an e-mail address.
const userActor = (id, name, email, image) => ({ type: 'user', ...(person(id, name, email, image) || { id: null, name: 'Someone', image: null }) });

/**
 * Record a human save in the person's edit session. Call inside the save transaction, after the content UPDATE.
 * @param {{query: Function}} client a pg client in the transaction
 */
export async function recordEditSession(client, { diagramId, userId, revision, now = new Date() }) {
  const open = (await client.query(
    `SELECT id, last_at, revision_to FROM diagram_edit_sessions
      WHERE diagram_id = $1 AND actor_user_id = $2 ORDER BY last_at DESC, id DESC LIMIT 1`,
    [diagramId, userId]
  )).rows[0] || null;
  const plan = planSession(open, now, revision);
  if (plan.action === 'extend') {
    await client.query(
      `UPDATE diagram_edit_sessions
          SET last_at = GREATEST(last_at, $2), save_count = save_count + 1, revision_to = GREATEST(revision_to, $3)
        WHERE id = $1`,
      [plan.id, now, plan.revisionTo]
    );
  } else {
    await client.query(
      `INSERT INTO diagram_edit_sessions (diagram_id, actor_user_id, first_at, last_at, save_count, revision_from, revision_to)
       VALUES ($1, $2, $3, $3, 1, $4, $5)`,
      [diagramId, userId, now, plan.revisionFrom, plan.revisionTo]
    );
  }
}

/** Delete edit sessions whose last save is older than the retention horizon (365 days), in bounded batches. Returns the count. */
export async function pruneEditSessions({ now = new Date(), days = RETENTION_DAYS, batchSize = 1000, maxBatches = 5 } = {}) {
  const cutoff = retentionCutoff(now, days);
  let total = 0;
  for (let i = 0; i < maxBatches; i += 1) {
    const res = await query(
      'DELETE FROM diagram_edit_sessions WHERE id IN (SELECT id FROM diagram_edit_sessions WHERE last_at < $1 ORDER BY last_at LIMIT $2)',
      [cutoff, batchSize]
    );
    const n = res.rowCount || 0;
    total += n;
    if (n < batchSize) break;
  }
  return total;
}

// ---------- cursor ----------
const encodeCursor = (k) => Buffer.from(JSON.stringify({ t: k.ts, p: k.p, i: k.i })).toString('base64url');
function decodeCursor(value) {
  if (typeof value !== 'string' || !value || value.length > 200) return null;
  try {
    const c = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (typeof c.t === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(c.t) && ['a', 's', 'v'].includes(c.p) && Number.isSafeInteger(c.i)) return c;
  } catch (_) { /* fall through */ }
  return null;
}
const cmpKeys = (a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : a.p < b.p ? -1 : a.p > b.p ? 1 : a.i - b.i); // ascending

/**
 * SQL for "comes after the cursor in newest-first order" for one source (`p`), pushing params as needed.
 * Order is (ts, prefix, id) descending, so a source with a smaller prefix than the cursor's includes the same timestamp.
 */
function after(cursor, p, tsExpr, idExpr, params) {
  if (!cursor) return 'TRUE';
  params.push(cursor.t);
  const t = `$${params.length}::timestamptz`;
  if (p < cursor.p) return `${tsExpr} <= ${t}`;
  if (p > cursor.p) return `${tsExpr} < ${t}`;
  params.push(cursor.i);
  return `(${tsExpr} < ${t} OR (${tsExpr} = ${t} AND ${idExpr} < $${params.length}))`;
}

async function readSessions(diagramId, cursor, n, headRevision) {
  const params = [diagramId];
  const cond = after(cursor, 's', 's.last_at', 's.id', params);
  params.push(n);
  const res = await query(
    `SELECT s.id, s.first_at, s.last_at, to_char(s.last_at AT TIME ZONE 'UTC', ${TS_FMT}) AS ts, s.save_count, s.revision_from, s.revision_to,
            u.id AS actor_id, u.name AS actor_name, u.email AS actor_email, u.image AS actor_image,
            f.version_number AS from_n, f.diagram_revision AS from_rev, t.version_number AS to_n, t.diagram_revision AS to_rev
       FROM diagram_edit_sessions s
       LEFT JOIN users u ON u.id = s.actor_user_id
       LEFT JOIN LATERAL (
         SELECT v.version_number, v.diagram_revision FROM diagram_versions v
          WHERE v.diagram_id = s.diagram_id AND v.diagram_revision <= s.revision_from - 1
          ORDER BY v.diagram_revision DESC, v.version_number DESC LIMIT 1) f ON TRUE
       LEFT JOIN LATERAL (
         SELECT v.version_number, v.diagram_revision FROM diagram_versions v
          WHERE v.diagram_id = s.diagram_id AND v.diagram_revision >= s.revision_to
          ORDER BY v.diagram_revision ASC, v.version_number ASC LIMIT 1) t ON TRUE
      WHERE s.diagram_id = $1 AND ${cond}
      ORDER BY s.last_at DESC, s.id DESC
      LIMIT $${params.length}`,
    params
  );
  return res.rows.map((r) => {
    const from = num(r.from_n);
    const rf = Number(r.revision_from);
    const rt = Number(r.revision_to);
    const to = num(r.to_n);
    const compare = from == null ? null : {
      from,
      to: to == null ? 'head' : to,
      // exact only when the bounding versions are exactly the revisions around the session; "now" is exact only when the session is the head
      approximate: Number(r.from_rev) !== rf - 1 || (to == null ? headRevision !== rt : Number(r.to_rev) !== rt),
    };
    return {
      key: { ts: r.ts, p: 's', i: Number(r.id) },
      item: {
        id: `s:${r.id}`,
        kind: 'edit_session',
        at: iso(r.first_at),
        endAt: iso(r.last_at),
        actor: userActor(r.actor_id, r.actor_name, r.actor_email, r.actor_image),
        saves: r.save_count,
        revision: { from: rf, to: rt },
        compare,
      },
    };
  });
}

async function readAudit(diagramId, cursor, n, includeShare) {
  const params = [diagramId, includeShare ? [...CONTENT_ACTIONS, ...SHARE_ACTIONS] : CONTENT_ACTIONS];
  const cond = after(cursor, 'a', 'a.occurred_at', 'a.id', params);
  params.push(n);
  const uuidOf = (expr) => `CASE WHEN (${expr}) ~* '${UUID_RE_SQL}' THEN (${expr})::uuid END`;
  const res = await query(
    `SELECT a.id, a.occurred_at, to_char(a.occurred_at AT TIME ZONE 'UTC', ${TS_FMT}) AS ts, a.actor_type, a.action, a.target,
            u.id AS actor_id, u.name AS actor_name, u.email AS actor_email, u.image AS actor_image,
            b.id AS behalf_id, b.name AS behalf_name, b.email AS behalf_email, b.image AS behalf_image,
            tu.name AS target_name, tu.email AS target_email,
            v.version_number AS v_number,
            (SELECT MAX(p.version_number) FROM diagram_versions p WHERE p.diagram_id = a.diagram_id AND p.version_number < v.version_number) AS prev_number,
            g.client_label
       FROM audit_events a
       LEFT JOIN users u ON u.id = a.actor_user_id
       LEFT JOIN users b ON b.id = a.on_behalf_of
       LEFT JOIN users tu ON a.action LIKE 'share.%' AND tu.id = ${uuidOf("a.target->>'userId'")}
       LEFT JOIN diagram_versions v ON a.action = 'diagram.agent_edit' AND v.id = ${uuidOf("a.target->>'versionId'")}
       LEFT JOIN oauth_grants g ON a.action = 'diagram.agent_edit' AND a.target->>'credential' = 'oauth' AND g.id = ${uuidOf("a.target->>'tokenId'")}
      WHERE a.diagram_id = $1 AND a.action = ANY($2) AND ${cond}
      ORDER BY a.occurred_at DESC, a.id DESC
      LIMIT $${params.length}`,
    params
  );
  return res.rows.map((r) => {
    const target = r.target || {};
    const base = { id: `a:${r.id}`, at: iso(r.occurred_at) };
    const key = { ts: r.ts, p: 'a', i: Number(r.id) };
    if (r.action === 'diagram.agent_edit') {
      // OAuth client names are client-controlled (dynamic registration): the suffix keeps one from posing as a person
      const label = r.client_label && sanitizeLabel(r.client_label)
        ? `${sanitizeLabel(r.client_label)} (connected app)`
        : (target.credential === 'oauth' ? 'Agent (connected app)' : 'Personal token');
      const version = num(r.v_number);
      const previous = num(r.prev_number);
      return {
        key,
        item: {
          ...base,
          kind: 'agent_edit',
          actor: { type: 'agent', id: null, name: label },
          onBehalfOf: person(r.behalf_id, r.behalf_name, r.behalf_email, r.behalf_image),
          agent: { label, tool: typeof target.tool === 'string' ? target.tool : null },
          counts: target.counts && typeof target.counts === 'object' ? target.counts : {},
          revision: { to: num(target.revision) },
          version: version == null ? null : { number: version },
          compare: version != null && previous != null ? { from: previous, to: version, approximate: false } : null,
        },
      };
    }
    if (r.action === 'version.restore') {
      return {
        key,
        item: {
          ...base,
          kind: 'restore',
          actor: userActor(r.actor_id, r.actor_name, r.actor_email, r.actor_image),
          version: target.restoreVersion != null ? { number: Number(target.restoreVersion) } : null,
          restoredFrom: target.fromVersion != null ? Number(target.fromVersion) : null,
        },
      };
    }
    return {
      key,
      item: {
        ...base,
        kind: 'share',
        actor: userActor(r.actor_id, r.actor_name, r.actor_email, r.actor_image),
        share: {
          action: r.action,
          role: typeof target.role === 'string' ? target.role : (typeof target.to === 'string' ? target.to : null),
          target: r.target_name || r.target_email ? { name: displayName(r.target_name, r.target_email) } : null,
        },
      },
    };
  });
}

async function readNamed(diagramId, cursor, n) {
  const params = [diagramId];
  const cond = after(cursor, 'v', 'v.created_at', 'v.version_number', params);
  params.push(n);
  const res = await query(
    `SELECT v.version_number, v.label, v.created_at, to_char(v.created_at AT TIME ZONE 'UTC', ${TS_FMT}) AS ts,
            u.id AS actor_id, u.name AS actor_name, u.email AS actor_email, u.image AS actor_image
       FROM diagram_versions v
       LEFT JOIN users u ON u.id = v.created_by_user_id
      WHERE v.diagram_id = $1 AND v.kind = 'named' AND ${cond}
      ORDER BY v.created_at DESC, v.version_number DESC
      LIMIT $${params.length}`,
    params
  );
  return res.rows.map((r) => ({
    key: { ts: r.ts, p: 'v', i: Number(r.version_number) },
    item: {
      id: `v:${r.version_number}`,
      kind: 'named_version',
      at: iso(r.created_at),
      actor: userActor(r.actor_id, r.actor_name, r.actor_email, r.actor_image),
      version: { number: Number(r.version_number), name: r.label || null },
    },
  }));
}

/**
 * Newest-first page of a board's activity. The caller must have authorized `activity.read`; pass `includeShare` only
 * when the caller also holds `audit.read` (the owner).
 * @param {string} diagramId
 * @param {{limit?: number, cursor?: string|null, includeShare?: boolean, headRevision?: number|null}} [opts]
 * @returns {Promise<{items: object[], nextCursor: string|null}>}
 */
export async function listActivity(diagramId, { limit = DEFAULT_LIMIT, cursor = null, includeShare = false, headRevision = null } = {}) {
  const lim = Math.min(Math.max(parseInt(limit, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const c = decodeCursor(cursor);
  const head = headRevision == null ? null : Number(headRevision);
  const [sessions, audit, named] = await Promise.all([
    readSessions(diagramId, c, lim + 1, head),
    readAudit(diagramId, c, lim + 1, includeShare),
    readNamed(diagramId, c, lim + 1),
  ]);
  const merged = [...sessions, ...audit, ...named].sort((x, y) => cmpKeys(y.key, x.key));
  const page = merged.slice(0, lim);
  const more = merged.length > lim;
  return {
    items: page.map((e) => e.item),
    nextCursor: more && page.length ? encodeCursor(page[page.length - 1].key) : null,
  };
}

export const activityRepository = { recordEditSession, pruneEditSessions, listActivity };
