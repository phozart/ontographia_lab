// lib/mcp/repository.js
// SQL for the MCP tools. These queries only PRE-FILTER candidates (owner or member, token allowlist, paging); the tools
// re-check every row through lib/authz (authorizeMeta/authorize), which stays the single decision point.
// Content is selected only after an authorize() call has succeeded for that diagram.

import { query } from '../db';

// Same column set as lib/authz loadDiagramMeta, so rows can be handed to authorizeMeta().
const META_COLUMNS =
  'id, short_id, name, type, owner_id, created_by, revision, version_seq, updated_at, updated_by, domain_id, project_id';
const CURSOR_COLUMN = `to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS updated_at_cursor`;

/** Escape LIKE wildcards so user input is matched literally. */
export function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export const mcpRepository = {
  /**
   * Diagrams owned by or shared with `userId`, newest first, keyset-paginated on (updated_at, id).
   * @param {string} userId
   * @param {{scope?: string[]|null, type?: string, cursor?: {updatedAt: string, id: string}|null, limit: number}} opts
   */
  async listReadable(userId, { scope = null, type, cursor = null, limit }) {
    const params = [userId];
    let sql = `SELECT ${META_COLUMNS}, ${CURSOR_COLUMN} FROM diagrams WHERE (owner_id = $1 OR id IN (SELECT diagram_id FROM diagram_members WHERE user_id = $1))`;
    if (Array.isArray(scope)) {
      params.push(scope);
      sql += ` AND id = ANY($${params.length}::uuid[])`;
    }
    if (type) {
      params.push(type);
      sql += ` AND type = $${params.length}`;
    }
    if (cursor) {
      params.push(cursor.updatedAt, cursor.id);
      sql += ` AND (updated_at, id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`;
    }
    params.push(limit);
    sql += ` ORDER BY updated_at DESC, id DESC LIMIT $${params.length}`;
    const result = await query(sql, params);
    return result.rows;
  },

  /**
   * Readable (owned or shared) diagrams whose name, description or an element label contains `text` (case-insensitive, literal).
   * Rows carry `matched`: 'name' | 'description' | 'label'.
   */
  async searchReadable(userId, { scope = null, text, type, limit }) {
    const params = [userId, `%${escapeLike(text)}%`];
    const hit = {
      name: 'name ILIKE $2',
      description: 'COALESCE(description, \'\') ILIKE $2',
      label: `(CASE WHEN jsonb_typeof(content->'elements') = 'array' THEN EXISTS (
                SELECT 1 FROM jsonb_array_elements(content->'elements') AS e
                 WHERE jsonb_typeof(e->'label') = 'string' AND e->>'label' ILIKE $2) ELSE FALSE END)`,
    };
    let sql = `SELECT ${META_COLUMNS}, ${CURSOR_COLUMN},
                 CASE WHEN ${hit.name} THEN 'name' WHEN ${hit.description} THEN 'description' ELSE 'label' END AS matched
                 FROM diagrams WHERE (owner_id = $1 OR id IN (SELECT diagram_id FROM diagram_members WHERE user_id = $1)) AND (${hit.name} OR ${hit.description} OR ${hit.label})`;
    if (Array.isArray(scope)) {
      params.push(scope);
      sql += ` AND id = ANY($${params.length}::uuid[])`;
    }
    if (type) {
      params.push(type);
      sql += ` AND type = $${params.length}`;
    }
    params.push(limit);
    sql += ` ORDER BY updated_at DESC, id DESC LIMIT $${params.length}`;
    const result = await query(sql, params);
    return result.rows;
  },

  /** Content for a diagram the caller has ALREADY authorized. */
  async getContent(id) {
    const result = await query('SELECT content, description, tags FROM diagrams WHERE id = $1', [id]);
    return result.rows[0] || null;
  },

  /** Stored thumbnail data URL for a diagram the caller has ALREADY authorized. */
  async getThumbnail(id) {
    const result = await query('SELECT thumbnail FROM diagrams WHERE id = $1', [id]);
    return result.rows[0]?.thumbnail || null;
  },
};
