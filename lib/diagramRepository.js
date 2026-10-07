// lib/diagramRepository.js
// Repository for diagram CRUD operations

import { query, getClient } from './db';
import { createAutoIfDue } from './versionRepository';

/**
 * Generate next short ID in format LAB-1, LAB-2, etc.
 */
async function getNextShortId() {
  // Get the highest existing short_id number
  const result = await query(
    `SELECT short_id FROM diagrams
     WHERE short_id IS NOT NULL AND short_id LIKE 'LAB-%'
     ORDER BY CAST(SUBSTRING(short_id FROM 5) AS INTEGER) DESC
     LIMIT 1`
  );

  if (result.rows.length === 0) {
    return 'LAB-1';
  }

  const lastId = result.rows[0].short_id;
  const lastNum = parseInt(lastId.substring(4), 10);
  return `LAB-${lastNum + 1}`;
}

export const diagramRepository = {
  /**
   * Diagrams owned by `ownerId`. Everyone, platform admins included, sees only the diagrams they own
   * (Q-S1); diagrams shared with the user are added by the sharing slice.
   */
  async findAll(filters = {}, ownerId) {
    const { type, domainId, projectId } = filters;
    let sql = 'SELECT * FROM diagrams WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (type) {
      sql += ` AND type = $${paramIndex++}`;
      params.push(type);
    }

    if (domainId) {
      sql += ` AND domain_id = $${paramIndex++}`;
      params.push(domainId);
    }

    if (projectId) {
      sql += ` AND project_id = $${paramIndex++}`;
      params.push(projectId);
    }

    sql += ` AND owner_id = $${paramIndex++}`;
    params.push(ownerId);

    sql += ' ORDER BY updated_at DESC';

    const result = await query(sql, params);
    return result.rows;
  },

  async findById(id) {
    const result = await query('SELECT * FROM diagrams WHERE id = $1', [id]);
    return result.rows[0] || null;
  },

  async findByShortId(shortId) {
    const result = await query('SELECT * FROM diagrams WHERE short_id = $1', [shortId]);
    return result.rows[0] || null;
  },

  /**
   * Find by either UUID or short_id (LAB-xxx)
   */
  async findByIdOrShortId(identifier) {
    // Check if it's a short ID format (LAB-xxx)
    if (identifier.startsWith('LAB-')) {
      return this.findByShortId(identifier);
    }
    // Otherwise try as UUID
    return this.findById(identifier);
  },

  async createDiagram(data, user, ownerId) {
    const { type, name, description, content, domainId, projectId, isTemplate, tags } = data;

    const validTypes = [
      'bpmn', 'mindmap', 'uml-class', 'erd', 'cld', 'togaf',
      'itil', 'capability-map', 'process-flow', 'product-design', 'sticky-notes',
      'infinite-canvas'
    ];

    if (!validTypes.includes(type)) {
      throw new Error(`Invalid type: ${type}. Must be one of: ${validTypes.join(', ')}`);
    }

    // Auto-increment name if duplicate exists for this user
    let finalName = name;
    const existingNames = await query(
      `SELECT name FROM diagrams WHERE created_by = $1 AND name LIKE $2`,
      [user, `${name}%`]
    );

    if (existingNames.rows.length > 0) {
      const names = existingNames.rows.map(r => r.name);
      // Check if exact name exists
      if (names.includes(name)) {
        // Find the highest number suffix
        let maxNum = 1;
        const pattern = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\((\\d+)\\)$`);
        for (const existingName of names) {
          const match = existingName.match(pattern);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num >= maxNum) {
              maxNum = num + 1;
            }
          }
        }
        finalName = `${name} (${maxNum})`;
      }
    }

    // Generate a readable short ID (LAB-1, LAB-2, etc.)
    const shortId = await getNextShortId();

    const result = await query(
      `INSERT INTO diagrams (type, name, short_id, description, content, domain_id, project_id, is_template, tags, created_by, owner_id, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
       RETURNING *`,
      [
        type,
        finalName,
        shortId,
        description || null,
        content || { elements: [], connections: [], layers: [], groups: [], viewport: { x: 0, y: 0, zoom: 1 } },
        domainId || null,
        projectId || null,
        isTemplate || false,
        tags || [],
        user,
        ownerId
      ]
    );

    return result.rows[0];
  },

  /**
   * Copy a diagram (content, description, tags, thumbnail) as a new diagram owned by `user`.
   * Never copies the template flag. Name becomes "<name> (copy)" (de-duplicated by createDiagram).
   */
  async duplicateDiagram(source, user, ownerId) {
    const base = `${source.name}`.slice(0, 240);
    const copy = await this.createDiagram(
      {
        type: source.type,
        name: `${base} (copy)`,
        description: source.description,
        content: source.content,
        tags: source.tags,
      },
      user,
      ownerId
    );
    if (source.thumbnail) {
      const result = await query('UPDATE diagrams SET thumbnail = $1 WHERE id = $2 RETURNING *', [
        source.thumbnail,
        copy.id,
      ]);
      return result.rows[0] || copy;
    }
    return copy;
  },

  /**
   * Update a diagram. Bumps `revision` and records `updated_by`. When `expectedRevision` is given the update
   * only applies if the stored revision still matches (atomic compare-and-set); returns null when it does not
   * (or the row is gone), so the caller can answer 409 with the current revision.
   */
  async updateDiagram(id, data, { expectedRevision = null, userId = null, actor = null, now = new Date() } = {}) {
    const { name, description, content, thumbnail, tags, isTemplate } = data;

    const sql = `UPDATE diagrams
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           content = COALESCE($3, content),
           thumbnail = COALESCE($4, thumbnail),
           tags = COALESCE($5, tags),
           is_template = COALESCE($6, is_template),
           updated_at = NOW(),
           revision = revision + 1,
           updated_by = $8
       WHERE id = $7 AND ($9::bigint IS NULL OR revision = $9::bigint)
       RETURNING *`;
    const params = [name, description, content, thumbnail, tags, isTemplate, id, userId, expectedRevision];

    // No content in this update: nothing to version, no transaction needed.
    if (content === undefined || content === null) {
      const result = await query(sql, params);
      return result.rows[0] || null;
    }

    // Content save: the UPDATE and the throttled auto checkpoint (+ prune) share one transaction; the UPDATE's
    // row lock serializes concurrent saves. A checkpoint failure rolls the save back rather than losing history.
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const result = await client.query(sql, params);
      const row = result.rows[0] || null;
      if (row) await createAutoIfDue(client, row, actor || { userId, email: null, via: 'web' }, { now });
      await client.query('COMMIT');
      return row;
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (_) { /* connection may be gone */ }
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Thumbnail-only update (background preview refresh). Deliberately does NOT touch revision, updated_at,
   * updated_by or versions: it is derived data and must never make the next content save conflict (409).
   * @returns {Promise<{id: string, revision: string}|null>}
   */
  async updateThumbnail(id, thumbnail) {
    const result = await query(
      'UPDATE diagrams SET thumbnail = $1 WHERE id = $2 RETURNING id, revision',
      [thumbnail, id]
    );
    return result.rows[0] || null;
  },

  async deleteDiagram(id) {
    await query('DELETE FROM diagrams WHERE id = $1', [id]);
    return { success: true };
  },

  async saveVersion(diagramId, content, user) {
    // Get current max version number
    const versionResult = await query(
      'SELECT COALESCE(MAX(version_number), 0) as max_version FROM diagram_versions WHERE diagram_id = $1',
      [diagramId]
    );
    const nextVersion = versionResult.rows[0].max_version + 1;

    const result = await query(
      `INSERT INTO diagram_versions (diagram_id, version_number, content, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [diagramId, nextVersion, content, user]
    );

    return result.rows[0];
  },

  async getVersions(diagramId) {
    const result = await query(
      'SELECT * FROM diagram_versions WHERE diagram_id = $1 ORDER BY version_number DESC',
      [diagramId]
    );
    return result.rows;
  }
};
