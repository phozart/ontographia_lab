// lib/authz/index.js
// The single authorization function (ADR-0003 section 3). Framework-free: no req/res, no Next.js imports,
// so API routes, a collaboration socket server and an MCP server can all call it.
//
// Platform admins do NOT get an implicit role on every diagram (Q-S1, accepted).
// Grant sources are resolved by SOURCES below and combined with maxRole(); later slices add
// `member` (diagram_members, slice 5), `link` (slice 6) and `support_access` without changing callers.

import { query } from '../db';
import { can, capabilitiesFor, maxRole, minRole } from './policy';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHORT_ID_RE = /^LAB-\d{1,9}$/;

// Content is deliberately not part of the metadata: authorization must stay cheap for 5 MB diagrams.
const META_COLUMNS =
  'id, short_id, name, type, owner_id, created_by, revision, version_seq, updated_at, updated_by, domain_id, project_id';

export class AuthzError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.name = 'AuthzError';
    this.status = status;
    this.code = code;
  }
}

/** Load diagram metadata by UUID or LAB-n. Returns null for unknown or malformed references. */
export async function loadDiagramMeta(diagramRef) {
  if (typeof diagramRef !== 'string') return null;
  let result;
  if (SHORT_ID_RE.test(diagramRef)) {
    result = await query(`SELECT ${META_COLUMNS} FROM diagrams WHERE short_id = $1`, [diagramRef]);
  } else if (UUID_RE.test(diagramRef)) {
    result = await query(`SELECT ${META_COLUMNS} FROM diagrams WHERE id = $1`, [diagramRef]);
  } else {
    return null;
  }
  return result.rows[0] || null;
}

// Each source returns { role, source } or null for the given user id + diagram metadata.
const userSources = [
  async (userId, diagram) =>
    diagram.owner_id && userId && diagram.owner_id === userId ? { role: 'owner', source: 'owner' } : null,
  // slice 5: diagram_members; slice 6: link; later: support_access, project/workspace
];

async function roleForUser(userId, diagram) {
  let best = { role: null, source: null };
  for (const src of userSources) {
    const hit = await src(userId, diagram);
    if (hit && maxRole(best.role, hit.role) === hit.role && hit.role !== best.role) best = hit;
  }
  return best;
}

async function resolveRoleForMeta(principal, diagram) {
  if (!principal || typeof principal !== 'object') return { role: null, source: null };
  if (principal.kind === 'user') return roleForUser(principal.userId, diagram);
  if (principal.kind === 'agent') {
    const base = await roleForUser(principal.userId, diagram);
    const role = minRole(base.role, principal.roleCap);
    return role ? { role, source: base.source } : { role: null, source: null };
  }
  // 'link' principals: no source exists until the share-links slice. Unknown kinds: no access.
  return { role: null, source: null };
}

export async function resolveRole(principal, diagramId) {
  const diagram = await loadDiagramMeta(diagramId);
  if (!diagram) return { role: null, source: null };
  return resolveRoleForMeta(principal, diagram);
}

/**
 * @returns {Promise<{diagram: object, role: string, source: string, capabilities: string[]}>}
 * @throws {AuthzError} 403 ACCOUNT_INACTIVE | 404 NOT_FOUND (missing OR no role at all) | 403 FORBIDDEN
 */
export async function authorize(principal, diagramRef, action) {
  if (principal && principal.kind === 'user' && principal.status && principal.status !== 'active') {
    throw new AuthzError(403, 'ACCOUNT_INACTIVE', 'Account not activated');
  }
  const diagram = await loadDiagramMeta(diagramRef);
  if (!diagram) throw new AuthzError(404, 'NOT_FOUND', 'Diagram not found');

  const { role, source } = await resolveRoleForMeta(principal, diagram);
  // Do not reveal existence to principals without any role.
  if (!role) throw new AuthzError(404, 'NOT_FOUND', 'Diagram not found');
  if (!can(role, action)) throw new AuthzError(403, 'FORBIDDEN', 'Access denied');

  return { diagram, role, source, capabilities: capabilitiesFor(role) };
}
