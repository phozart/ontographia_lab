// lib/versionRepository.js
// Version history persistence (ADR-0001, delivery-plan slice 2). Immutable full-JSONB snapshots in
// diagram_versions; nothing here ever deletes a version. Every write runs in one transaction that first takes
// the diagram row lock (SELECT ... FOR UPDATE), which serializes concurrent version creation / restore per
// diagram and makes version_number allocation race-free.
//
// Slice 2: `named`, `restore` and `pre_restore` versions. Slice 3: throttled `auto` checkpoints created inside the
// content-save transaction (createAutoIfDue), session-end checkpoints (createCheckpoint) and prune-on-write
// retention of `auto` versions only (pruneAuto). Named / restore / pre_restore versions are never deleted here.

import { getClient, query } from './db';
import { contentHash, contentStats } from './versions/contentHash';
import { validateDiagramContent } from './diagramContent';
import { VERSION_AUTO_INTERVAL_MS, PRUNE_SCAN_LIMIT } from './versions/policy';
import { planRetention } from './versions/retention';

export const MAX_LABEL_LENGTH = 120;
export const MAX_DESCRIPTION_LENGTH = 2000;
export const DEFAULT_LIST_LIMIT = 50;
export const MAX_LIST_LIMIT = 100;
export const VERSION_KINDS = Object.freeze(['auto', 'named', 'restore', 'pre_restore']);

export class VersionError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.name = 'VersionError';
    this.status = status;
    this.code = code;
  }
}

const META_SELECT = `
  v.id, v.version_number, v.kind, v.label, v.description, v.created_at, v.created_by, v.created_by_user_id,
  v.created_via, v.size_bytes, v.element_count, v.connection_count,
  u.name AS author_name, u.email AS author_email,
  rf.id AS restored_from_id, rf.version_number AS restored_from_number`;
const META_FROM = `
  FROM diagram_versions v
  LEFT JOIN users u ON u.id = v.created_by_user_id
  LEFT JOIN diagram_versions rf ON rf.id = v.restored_from_version_id`;

/** DB row (META_SELECT columns) -> API VersionMeta (api-contracts section 3). */
export function toVersionMeta(row) {
  const system = row.created_via === 'system';
  const name = row.author_name || row.author_email || row.created_by || null;
  return {
    id: row.id,
    number: row.version_number,
    kind: row.kind,
    label: row.label,
    description: row.description,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    createdBy: system || !name ? null : { id: row.created_by_user_id || null, name },
    createdVia: row.created_via,
    sizeBytes: row.size_bytes == null ? 0 : Number(row.size_bytes),
    elementCount: row.element_count == null ? 0 : Number(row.element_count),
    connectionCount: row.connection_count == null ? 0 : Number(row.connection_count),
    restoredFrom: row.restored_from_id ? { id: row.restored_from_id, number: row.restored_from_number } : null,
  };
}

function cleanLabel(label) {
  if (typeof label !== 'string') throw new VersionError(400, 'VALIDATION_FAILED', 'label must be a string');
  const trimmed = label.trim();
  if (trimmed.length < 1 || trimmed.length > MAX_LABEL_LENGTH) {
    throw new VersionError(400, 'VALIDATION_FAILED', `label must be 1 to ${MAX_LABEL_LENGTH} characters`);
  }
  return trimmed;
}

function cleanDescription(description) {
  if (description === null) return null;
  if (typeof description !== 'string') throw new VersionError(400, 'VALIDATION_FAILED', 'description must be a string or null');
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    throw new VersionError(400, 'VALIDATION_FAILED', `description must be at most ${MAX_DESCRIPTION_LENGTH} characters`);
  }
  const trimmed = description.trim();
  return trimmed === '' ? null : trimmed;
}

async function withTransaction(fn) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { /* connection may be gone */ }
    throw err;
  } finally {
    client.release();
  }
}

async function lockDiagram(client, diagramId) {
  const res = await client.query(
    'SELECT id, content, revision, updated_at FROM diagrams WHERE id = $1 FOR UPDATE',
    [diagramId]
  );
  return res.rows[0] || null;
}

async function latestVersion(client, diagramId) {
  const res = await client.query(
    `SELECT id, version_number, kind, label, content_hash, created_at FROM diagram_versions
      WHERE diagram_id = $1 ORDER BY version_number DESC LIMIT 1`,
    [diagramId]
  );
  return res.rows[0] || null;
}

/** Next version_number from the per-diagram allocator (never below an existing number). Caller holds the row lock. */
async function allocateNumber(client, diagramId) {
  const res = await client.query(
    `UPDATE diagrams
        SET version_seq = GREATEST(version_seq, COALESCE((SELECT MAX(version_number) FROM diagram_versions WHERE diagram_id = $1), 0)) + 1
      WHERE id = $1
      RETURNING version_seq`,
    [diagramId]
  );
  return res.rows[0].version_seq;
}

async function insertVersion(client, diagramId, v) {
  const number = await allocateNumber(client, diagramId);
  const stats = contentStats(v.content);
  const res = await client.query(
    `INSERT INTO diagram_versions
       (diagram_id, version_number, content, created_by, kind, label, description, content_hash, size_bytes,
        element_count, connection_count, diagram_revision, restored_from_version_id, created_by_user_id, created_via, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, COALESCE($16::timestamptz, NOW()))
     RETURNING id`,
    [
      diagramId, number, JSON.stringify(v.content), v.actor.email || 'system', v.kind, v.label || null, v.description || null,
      contentHash(v.content), stats.sizeBytes, stats.elementCount, stats.connectionCount, v.revision,
      v.restoredFromId || null, v.actor.userId || null, v.actor.via || 'web', v.createdAt || null,
    ]
  );
  return res.rows[0].id;
}

/**
 * Retention (Q-V1) for one diagram, bounded: reads at most PRUNE_SCAN_LIMIT `auto` rows (metadata only) and deletes
 * the planned ids. Only kind = 'auto' is ever selected or deleted. Caller holds the diagram row lock.
 */
export async function pruneAuto(client, diagramId, now = new Date()) {
  const res = await client.query(
    `SELECT v.id, v.created_at FROM diagram_versions v WHERE v.diagram_id = $1 AND v.kind = 'auto'
        AND NOT EXISTS (SELECT 1 FROM diagram_versions r WHERE r.restored_from_version_id = v.id)
      ORDER BY created_at DESC, version_number DESC LIMIT $2`,
    [diagramId, PRUNE_SCAN_LIMIT]
  );
  const ids = planRetention(res.rows.map((r) => ({ id: r.id, createdAt: r.created_at })), now);
  if (ids.length) {
    await client.query(
      `DELETE FROM diagram_versions v WHERE v.diagram_id = $1 AND v.kind = 'auto' AND v.id = ANY($2::uuid[])
         AND NOT EXISTS (SELECT 1 FROM diagram_versions r WHERE r.restored_from_version_id = v.id)`,
      [diagramId, ids]
    );
  }
  return ids.length;
}

/**
 * Server-side checkpoint (ADR-0001 decision 2). Inside the caller's transaction, with the diagram row already
 * locked (the content UPDATE holds it): creates an `auto` version of `diagram.content` when the content differs
 * from the latest version's and, unless `force` (session end), the latest version is older than the interval.
 * Then prunes. `diagram` = {id, content, revision}.
 * @returns {Promise<{created: boolean, id?: string}>}
 */
export async function createAutoIfDue(client, diagram, actor, { now = new Date(), force = false } = {}) {
  const latest = await latestVersion(client, diagram.id);
  if (latest) {
    if (latest.content_hash && latest.content_hash === contentHash(diagram.content)) return { created: false };
    if (!force && now.getTime() - new Date(latest.created_at).getTime() < VERSION_AUTO_INTERVAL_MS) return { created: false };
  }
  const id = await insertVersion(client, diagram.id, {
    kind: 'auto', content: diagram.content, revision: Number(diagram.revision), actor, createdAt: now,
  });
  await pruneAuto(client, diagram.id, now);
  return { created: true, id };
}

async function metaById(client, id) {
  const res = await client.query(`SELECT ${META_SELECT} ${META_FROM} WHERE v.id = $1`, [id]);
  return toVersionMeta(res.rows[0]);
}

function encodeCursor(n) { return Buffer.from(String(n), 'utf8').toString('base64url'); }
function decodeCursor(cursor) {
  const n = Number(Buffer.from(String(cursor), 'base64url').toString('utf8'));
  if (!Number.isInteger(n) || n < 1) throw new VersionError(400, 'VALIDATION_FAILED', 'invalid cursor');
  return n;
}

export const versionRepository = {
  /** Metadata only, newest first. `cursor` is opaque (the last number returned). */
  async list(diagramId, { kind = null, limit = DEFAULT_LIST_LIMIT, cursor = null } = {}) {
    if (kind !== null && !VERSION_KINDS.includes(kind)) throw new VersionError(400, 'VALIDATION_FAILED', 'unknown kind');
    const size = Math.min(Math.max(parseInt(limit, 10) || DEFAULT_LIST_LIMIT, 1), MAX_LIST_LIMIT);
    const params = [diagramId];
    let where = 'v.diagram_id = $1';
    if (kind) { params.push(kind); where += ` AND v.kind = $${params.length}`; }
    if (cursor) { params.push(decodeCursor(cursor)); where += ` AND v.version_number < $${params.length}`; }
    params.push(size + 1);
    const res = await query(
      `SELECT ${META_SELECT} ${META_FROM} WHERE ${where} ORDER BY v.version_number DESC LIMIT $${params.length}`,
      params
    );
    const page = res.rows.slice(0, size);
    return {
      items: page.map(toVersionMeta),
      nextCursor: res.rows.length > size ? encodeCursor(page[page.length - 1].version_number) : null,
    };
  },

  /**
   * Session-end checkpoint (Q-V2): snapshot the saved head when it differs from the latest version; the 10-minute
   * throttle is skipped. Same hash dedupe as every other path. Returns null when the diagram does not exist.
   * @returns {Promise<{created: boolean, version?: object} | null>}
   */
  async createCheckpoint(diagramId, actor, { now = new Date() } = {}) {
    return withTransaction(async (client) => {
      const diagram = await lockDiagram(client, diagramId);
      if (!diagram) return null;
      const r = await createAutoIfDue(
        client, { id: diagramId, content: diagram.content, revision: diagram.revision }, actor, { now, force: true }
      );
      if (!r.created) {
        const latest = await latestVersion(client, diagramId);
        return { created: false, version: latest ? await metaById(client, latest.id) : undefined };
      }
      return { created: true, version: await metaById(client, r.id) };
    });
  },

  /** One version with its content, scoped to the diagram (a number from another diagram is "not found"). */
  async get(diagramId, number) {
    const res = await query(
      `SELECT ${META_SELECT}, v.content ${META_FROM} WHERE v.diagram_id = $1 AND v.version_number = $2`,
      [diagramId, number]
    );
    const row = res.rows[0];
    return row ? { ...toVersionMeta(row), content: row.content } : null;
  },

  /**
   * Name the current head. Identical content to the latest version -> that version is labelled instead of
   * duplicated ({created:false}); for restore/pre_restore versions the kind is kept and only the label is set.
   */
  async createNamed(diagramId, { label, description = null }, actor) {
    const cleanedLabel = cleanLabel(label);
    const cleanedDescription = cleanDescription(description);
    return withTransaction(async (client) => {
      const diagram = await lockDiagram(client, diagramId);
      if (!diagram) return null;
      const hash = contentHash(diagram.content);
      const latest = await latestVersion(client, diagramId);

      if (latest && latest.content_hash === hash) {
        const promote = latest.kind === 'auto' || latest.kind === 'named';
        await client.query(
          `UPDATE diagram_versions SET label = $2, description = $3, kind = CASE WHEN $4 THEN 'named' ELSE kind END WHERE id = $1`,
          [latest.id, cleanedLabel, cleanedDescription, promote]
        );
        return { created: false, version: await metaById(client, latest.id) };
      }

      const id = await insertVersion(client, diagramId, {
        kind: 'named', label: cleanedLabel, description: cleanedDescription,
        content: diagram.content, revision: diagram.revision, actor,
      });
      return { created: true, version: await metaById(client, id) };
    });
  },

  /** Rename / describe. Naming an `auto` version turns it `named`. Returns null when the version does not exist. */
  async update(diagramId, number, patch) {
    return withTransaction(async (client) => {
      const diagram = await lockDiagram(client, diagramId);
      if (!diagram) return null;
      const cur = (await client.query(
        'SELECT id, kind, label FROM diagram_versions WHERE diagram_id = $1 AND version_number = $2 FOR UPDATE',
        [diagramId, number]
      )).rows[0];
      if (!cur) return null;

      const has = (k) => Object.prototype.hasOwnProperty.call(patch, k);
      let label = cur.label;
      if (has('label')) {
        if (patch.label === null) {
          if (cur.kind === 'named') throw new VersionError(400, 'VALIDATION_FAILED', 'a named version needs a label');
          label = null;
        } else {
          label = cleanLabel(patch.label);
        }
      }
      let kind = cur.kind;
      if (kind === 'auto') {
        if (!label) throw new VersionError(400, 'VALIDATION_FAILED', 'give the version a label to name it');
        kind = 'named';
      }
      const sets = ['label = $2', 'kind = $3'];
      const params = [cur.id, label, kind];
      if (has('description')) { params.push(cleanDescription(patch.description)); sets.push(`description = $${params.length}`); }
      await client.query(`UPDATE diagram_versions SET ${sets.join(', ')} WHERE id = $1`, params);
      return metaById(client, cur.id);
    });
  },

  /**
   * Restore (ADR-0001 decision 5), one transaction: lock -> optional If-Match check -> pre_restore of the head when
   * it is not already the latest version -> head := source content, revision + 1 -> `restore` version.
   * @returns {Promise<
   *   {status:'ok', diagram:{id,revision,updatedAt}, version:object, preRestoreVersion?:object}
   * | {status:'unchanged', diagram:{id,revision,updatedAt}, version:object}
   * | {status:'conflict', current:{revision,updatedAt}}
   * | {status:'not_found'}>}
   */
  async restore(diagramId, number, actor, { expectedRevision = null } = {}) {
    return withTransaction(async (client) => {
      const diagram = await lockDiagram(client, diagramId);
      if (!diagram) return { status: 'not_found' };
      const headRevision = Number(diagram.revision);
      if (expectedRevision !== null && expectedRevision !== headRevision) {
        return { status: 'conflict', current: { revision: headRevision, updatedAt: diagram.updated_at } };
      }

      const source = (await client.query(
        'SELECT id, version_number, content FROM diagram_versions WHERE diagram_id = $1 AND version_number = $2',
        [diagramId, number]
      )).rows[0];
      if (!source) return { status: 'not_found' };

      // Same guarantees as a normal save: canonical shape, size cap, unsafe URLs stripped.
      const check = validateDiagramContent(source.content);
      if (!check.ok) {
        throw new VersionError(422, 'VERSION_CONTENT_INVALID', 'This version can no longer be restored: its content is not valid');
      }

      const headHash = contentHash(diagram.content);
      if (headHash === contentHash(check.content)) {
        return {
          status: 'unchanged',
          diagram: { id: diagramId, revision: headRevision, updatedAt: diagram.updated_at },
          version: await metaById(client, source.id),
        };
      }

      let preRestoreId = null;
      const latest = await latestVersion(client, diagramId);
      if (!latest || latest.content_hash !== headHash) {
        preRestoreId = await insertVersion(client, diagramId, {
          kind: 'pre_restore', content: diagram.content, revision: headRevision, actor,
        });
      }

      const updated = (await client.query(
        `UPDATE diagrams SET content = $2, updated_at = NOW(), revision = revision + 1, updated_by = $3
          WHERE id = $1 RETURNING revision, updated_at`,
        [diagramId, JSON.stringify(check.content), actor.userId || null]
      )).rows[0];
      const newRevision = Number(updated.revision);

      const restoreId = await insertVersion(client, diagramId, {
        kind: 'restore', content: check.content, revision: newRevision, restoredFromId: source.id, actor,
      });

      const out = {
        status: 'ok',
        diagram: { id: diagramId, revision: newRevision, updatedAt: updated.updated_at },
        version: await metaById(client, restoreId),
      };
      if (preRestoreId) out.preRestoreVersion = await metaById(client, preRestoreId);
      return out;
    });
  },
};
