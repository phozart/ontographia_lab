// lib/memberRepository.js
// Direct grants (diagram_members, migration 0007) and the "shared with me" listing.
//
// Every write emits NOTIFY authz_changed from the same statement (so it is delivered only if the write commits).
// A future real-time server (ADR-0004) LISTENs on this channel to drop sockets whose role changed. The payload
// carries ids and the role only (no emails). This module makes no authorization decisions: callers
// (pages/api/diagrams/[id]/**) check lib/authz/policy first; setRole/removeMember are compare-and-set on the role
// the caller authorized against, so a concurrent change cannot widen what the caller was allowed to do.

import { query } from './db';
import { GRANTABLE_ROLES } from './authz/policy';

const NOTIFY_CHANNEL = 'authz_changed';

const userRef = (id, name, email, image) => (id ? { id, name: name || null, email, image: image || null } : null);

function toMember(row) {
  return {
    diagramId: row.diagram_id,
    userId: row.user_id,
    role: row.role,
    grantedBy: row.granted_by,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
}

function assertGrantable(role) {
  if (!GRANTABLE_ROLES.includes(role)) throw new Error(`Invalid member role: ${String(role)}`);
}

export const memberRepository = {
  /** Active account by e-mail (case-insensitive); null when unknown OR not active (pending/suspended). */
  async findActiveUserByEmail(email) {
    if (typeof email !== 'string') return null;
    const normalized = email.trim().toLowerCase();
    if (!normalized) return null;
    const result = await query(
      "SELECT id, name, email, image FROM users WHERE lower(email) = $1 AND status = 'active' LIMIT 1",
      [normalized]
    );
    const row = result.rows[0];
    return row ? userRef(row.id, row.name, row.email, row.image) : null;
  },

  async getMember(diagramId, userId) {
    const result = await query('SELECT * FROM diagram_members WHERE diagram_id = $1 AND user_id = $2', [diagramId, userId]);
    return result.rows[0] ? toMember(result.rows[0]) : null;
  },

  /** The owner plus every direct member, with who granted them. */
  async listAccess(diagramId) {
    const ownerResult = await query(
      `SELECT u.id, u.name, u.email, u.image FROM diagrams d JOIN users u ON u.id = d.owner_id WHERE d.id = $1`,
      [diagramId]
    );
    const o = ownerResult.rows[0];
    const members = await query(
      `SELECT m.role, m.created_at, m.granted_by,
              u.id AS uid, u.name AS uname, u.email AS uemail, u.image AS uimage,
              g.id AS gid, g.name AS gname, g.email AS gemail, g.image AS gimage
         FROM diagram_members m
         JOIN users u ON u.id = m.user_id
         LEFT JOIN users g ON g.id = m.granted_by
        WHERE m.diagram_id = $1
        ORDER BY m.created_at ASC, u.email ASC`,
      [diagramId]
    );
    return {
      owner: o ? userRef(o.id, o.name, o.email, o.image) : null,
      members: members.rows.map((r) => ({
        user: userRef(r.uid, r.uname, r.uemail, r.uimage),
        role: r.role,
        grantedBy: userRef(r.gid, r.gname, r.gemail, r.gimage),
        createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
      })),
    };
  },

  /** Insert a grant. Returns the member, or null when the user is already a member (existing role is kept). */
  async addMember(diagramId, userId, role, grantedBy) {
    assertGrantable(role);
    const result = await query(
      `WITH ins AS (
         INSERT INTO diagram_members (diagram_id, user_id, role, granted_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (diagram_id, user_id) DO NOTHING
         RETURNING *
       )
       SELECT ins.*, pg_notify('${NOTIFY_CHANNEL}', json_build_object('diagramId', ins.diagram_id, 'userId', ins.user_id, 'change', 'grant', 'role', ins.role)::text) AS notified
         FROM ins`,
      [diagramId, userId, role, grantedBy || null]
    );
    return result.rows[0] ? toMember(result.rows[0]) : null;
  },

  /** Change a member's role if it is still `fromRole`. Returns the member, or null when nothing matched. */
  async setRole(diagramId, userId, fromRole, toRole) {
    assertGrantable(fromRole);
    assertGrantable(toRole);
    const result = await query(
      `WITH upd AS (
         UPDATE diagram_members SET role = $4, updated_at = NOW()
          WHERE diagram_id = $1 AND user_id = $2 AND role = $3
          RETURNING *
       )
       SELECT upd.*, pg_notify('${NOTIFY_CHANNEL}', json_build_object('diagramId', upd.diagram_id, 'userId', upd.user_id, 'change', 'role', 'role', upd.role)::text) AS notified
         FROM upd`,
      [diagramId, userId, fromRole, toRole]
    );
    return result.rows[0] ? toMember(result.rows[0]) : null;
  },

  /** Revoke a member if their role is still `fromRole`. Returns true when a row was removed. */
  async removeMember(diagramId, userId, fromRole) {
    assertGrantable(fromRole);
    const result = await query(
      `WITH del AS (
         DELETE FROM diagram_members WHERE diagram_id = $1 AND user_id = $2 AND role = $3 RETURNING *
       )
       SELECT pg_notify('${NOTIFY_CHANNEL}', json_build_object('diagramId', del.diagram_id, 'userId', del.user_id, 'change', 'revoke', 'role', del.role)::text) AS notified
         FROM del`,
      [diagramId, userId, fromRole]
    );
    return result.rows.length > 0;
  },

  /**
   * Diagrams shared with `userId` (member grants only), newest first. Metadata only: no `content`.
   * @returns {Promise<Array<object>>} rows with `role` and `owner: UserRef`
   */
  async listSharedWith(userId, { type } = {}) {
    const params = [userId];
    let sql = `SELECT d.id, d.short_id, d.name, d.type, d.description, d.tags, d.thumbnail, d.created_at, d.updated_at, d.revision,
                      m.role, o.id AS oid, o.name AS oname, o.email AS oemail, o.image AS oimage
                 FROM diagram_members m
                 JOIN diagrams d ON d.id = m.diagram_id
                 LEFT JOIN users o ON o.id = d.owner_id
                WHERE m.user_id = $1 AND d.owner_id IS DISTINCT FROM $1`;
    if (type) {
      params.push(type);
      sql += ` AND d.type = $${params.length}`;
    }
    sql += ' ORDER BY d.updated_at DESC, d.id DESC';
    const result = await query(sql, params);
    return result.rows.map(({ oid, oname, oemail, oimage, ...row }) => ({
      ...row,
      revision: Number(row.revision),
      owner: userRef(oid, oname, oemail, oimage),
    }));
  },
};
