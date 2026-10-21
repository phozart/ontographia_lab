// lib/oauth/consentData.js
// Data for the consent screen: the diagrams the signed-in user can read, flagged with whether they can edit.
// Role comes from ownership or membership only (platform admins have no implicit access, Q-S1).

import { query } from '../db';
import { can } from '../authz/policy';

export const CONSENT_DIAGRAM_LIMIT = 200;

/** @returns {Promise<{id: string, shortId: string, name: string, role: string, canEdit: boolean}[]>} */
export async function listDiagramsForConsent(userId) {
  const result = await query(
    `SELECT d.id, d.short_id, d.name, CASE WHEN d.owner_id = $1 THEN 'owner' ELSE m.role END AS role
       FROM diagrams d LEFT JOIN diagram_members m ON m.diagram_id = d.id AND m.user_id = $1
      WHERE d.owner_id = $1 OR m.user_id IS NOT NULL
      ORDER BY d.updated_at DESC, d.id DESC LIMIT $2`,
    [userId, CONSENT_DIAGRAM_LIMIT]
  );
  return result.rows.map((r) => ({
    id: r.id,
    shortId: r.short_id,
    name: String(r.name || 'Untitled').slice(0, 200),
    role: r.role,
    canEdit: can(r.role, 'diagram.write'),
  }));
}
