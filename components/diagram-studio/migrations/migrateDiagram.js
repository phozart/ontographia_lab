// components/diagram-studio/migrations/migrateDiagram.js
// Pure, idempotent migration of saved diagram content to current element types.

import { normalizePoints } from '../connections/geometry/orthogonalRouter';

// Legacy element types (old starter templates) -> current stencil id + pack
const LEGACY_TYPE_MAP = {
  'central-idea': { type: 'central-topic', packId: 'mind-map' },
  branch: { type: 'main-topic', packId: 'mind-map' },
  'sticky-yellow': { type: 'sticky-medium', packId: 'sticky-notes' },
};

function migrateElements(list) {
  if (!Array.isArray(list)) return list;
  let changed = false;
  const next = list.map((el) => {
    const target = el && LEGACY_TYPE_MAP[el.type];
    if (!target) return el;
    changed = true;
    return { ...el, type: target.type, packId: target.packId };
  });
  return changed ? next : list;
}

const EPS = 0.5;
const same = (a, b) => Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS;

function elementBounds(el) {
  const size = el && el.size;
  if (!el || typeof el.x !== 'number' || typeof el.y !== 'number' || !size ||
      typeof size.width !== 'number' || typeof size.height !== 'number') return null;
  return { x: el.x, y: el.y, width: size.width, height: size.height };
}

function portPoint(b, port, ratio) {
  const r = Math.max(0, Math.min(1, typeof ratio === 'number' ? ratio : 0.5));
  switch (port) {
    case 'top': return { x: b.x + b.width * r, y: b.y };
    case 'bottom': return { x: b.x + b.width * r, y: b.y + b.height };
    case 'left': return { x: b.x, y: b.y + b.height * r };
    default: return { x: b.x + b.width, y: b.y + b.height * r };
  }
}

// True if the polyline has consecutive duplicate points or a 180-degree
// reversal along one axis (the "stub" that doubles back through a shape).
function hasStub(points) {
  for (let i = 0; i < points.length - 1; i++) {
    if (same(points[i], points[i + 1])) return true;
    if (i < points.length - 2) {
      const [a, b, c] = [points[i], points[i + 1], points[i + 2]];
      if (Math.abs(a.x - b.x) < EPS && Math.abs(b.x - c.x) < EPS && (b.y - a.y) * (c.y - b.y) < 0) return true;
      if (Math.abs(a.y - b.y) < EPS && Math.abs(b.y - c.y) < EPS && (b.x - a.x) * (c.x - b.x) < 0) return true;
    }
  }
  return false;
}

function migrateConnections(list, elements) {
  if (!Array.isArray(list)) return list;
  const byId = new Map();
  if (Array.isArray(elements)) elements.forEach((el) => el && byId.set(el.id, el));
  let changed = false;
  const next = list.map((conn) => {
    const wps = conn && conn.waypoints;
    if (!Array.isArray(wps) || wps.length === 0) return conn;
    if (!wps.every((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))) return conn;

    // Include the port positions when computable so a stub at the very start
    // or end of the path (port -> waypoint -> back through the shape) is seen.
    const sb = elementBounds(byId.get(conn.sourceId));
    const tb = elementBounds(byId.get(conn.targetId));
    const sPos = sb ? portPoint(sb, conn.sourcePort || 'right', conn.sourceRatio) : null;
    const tPos = tb ? portPoint(tb, conn.targetPort || 'left', conn.targetRatio) : null;
    const full = [...(sPos ? [sPos] : []), ...wps, ...(tPos ? [tPos] : [])];
    if (!hasStub(full)) return conn;

    const cleaned = normalizePoints(full);
    let interior = cleaned.slice(sPos ? 1 : 0, tPos ? cleaned.length - 1 : cleaned.length);
    // Without both end points, normalize keeps first/last as-is
    interior = interior.map((p) => ({ x: p.x, y: p.y }));
    changed = true;
    const out = { ...conn, waypoints: interior };
    if (interior.length === 0 && 'hasManualWaypoints' in conn) out.hasManualWaypoints = false;
    return out;
  });
  return changed ? next : list;
}

/**
 * Migrate diagram content. Returns the same reference if nothing changed.
 * @param {object|null|undefined} content
 */
export function migrateDiagram(content) {
  if (!content || typeof content !== 'object') return content;
  const elements = migrateElements(content.elements);
  const nodes = migrateElements(content.nodes);
  const connections = migrateConnections(content.connections, elements);
  if (elements === content.elements && nodes === content.nodes && connections === content.connections) return content;
  const out = { ...content };
  if (connections !== content.connections) out.connections = connections;
  if (elements !== content.elements) out.elements = elements;
  if (nodes !== content.nodes) out.nodes = nodes;
  return out;
}

export default migrateDiagram;
