// lib/oauth/connectedApps.js
// "Connected apps" in Account > API tokens (ADR-0005 5.7): the user's live OAuth connections, shaped for the UI.
// Diagram names are shown only for diagrams the user can still read (a connection never reveals more than the user sees).

import { query } from '../db';
import { listGrants } from './repository';

const MAX_NAMES = 50;

/**
 * @returns {Promise<{id: string, clientLabel: string, roleCap: string, scope: string, allDiagrams: boolean,
 *   scopeKind: 'all_editable'|'all_readable'|'selected', diagramCount: number|null,
 *   diagrams: {id: string, shortId: string, name: string}[], createdAt: string, lastUsedAt: string|null, expiresAt: string|null}[]>}
 */
export async function listConnectedApps(userId, now = new Date()) {
  const grants = await listGrants(userId, now);
  const ids = [...new Set(grants.flatMap((g) => (Array.isArray(g.diagram_ids) ? g.diagram_ids : [])))];
  let names = new Map();
  if (ids.length > 0) {
    const res = await query(
      `SELECT d.id, d.short_id, d.name FROM diagrams d
        WHERE d.id = ANY($2::uuid[])
          AND (d.owner_id = $1 OR EXISTS (SELECT 1 FROM diagram_members m WHERE m.diagram_id = d.id AND m.user_id = $1))`,
      [userId, ids]
    );
    names = new Map(res.rows.map((r) => [r.id, { id: r.id, shortId: r.short_id, name: String(r.name || 'Untitled').slice(0, 200) }]));
  }
  return grants.map((g) => {
    const selected = Array.isArray(g.diagram_ids) ? g.diagram_ids : null;
    return {
      id: g.id,
      clientLabel: g.client_label,
      roleCap: g.role_cap,
      scope: g.scope,
      allDiagrams: !!g.all_diagrams,
      scopeKind: g.all_diagrams ? 'all_editable' : selected ? 'selected' : 'all_readable',
      diagramCount: selected ? selected.length : null,
      diagrams: selected ? selected.map((id) => names.get(id)).filter(Boolean).slice(0, MAX_NAMES) : [],
      createdAt: g.created_at,
      lastUsedAt: g.last_used_at,
      expiresAt: g.expires_at,
    };
  });
}
