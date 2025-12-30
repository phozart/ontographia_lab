// lib/diagramRepository.js
// Repository for diagram CRUD operations

import { query } from './db';

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
  async findAll(filters = {}, user, role) {
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

    // Non-admins can only see their own diagrams
    if (role !== 'admin') {
      sql += ` AND created_by = $${paramIndex++}`;
      params.push(user);
    }

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

  async createDiagram(data, user) {
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
      `INSERT INTO diagrams (type, name, short_id, description, content, domain_id, project_id, is_template, tags, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        type,
        finalName,
        shortId,
        description || null,
        content || { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
        domainId || null,
        projectId || null,
        isTemplate || false,
        tags || [],
        user
      ]
    );

    return result.rows[0];
  },

  async updateDiagram(id, data) {
    const { name, description, content, thumbnail, tags, isTemplate } = data;

    const result = await query(
      `UPDATE diagrams
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           content = COALESCE($3, content),
           thumbnail = COALESCE($4, thumbnail),
           tags = COALESCE($5, tags),
           is_template = COALESCE($6, is_template),
           updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [name, description, content, thumbnail, tags, isTemplate, id]
    );

    return result.rows[0];
  },

  async deleteDiagram(id) {
    await query('DELETE FROM diagrams WHERE id = $1', [id]);
    return { success: true };
  },

  async checkAccess(id, user, role) {
    const diagram = await this.findByIdOrShortId(id);
    if (!diagram) {
      return { hasAccess: false, diagram: null };
    }

    // Admins have access to everything
    if (role === 'admin') {
      return { hasAccess: true, diagram };
    }

    // Others can only access their own diagrams
    const hasAccess = diagram.created_by === user;
    return { hasAccess, diagram };
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
