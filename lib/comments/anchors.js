// lib/comments/anchors.js
// Anchor resolution is a READ-TIME projection (ADR-0002 decision 2): nothing is stored when an element is
// deleted or comes back. A thread whose target id is missing from the current content is `detached`; the same
// thread is `attached` again as soon as the id exists (a later edit, or a version restore that brings the element
// back). Pure; used by the server (list, for agents) and the client (marker placement).

/** @param {{type:string, targetId?:string}} anchor @param {{elementIds: Set<string>, connectionIds: Set<string>}} ids */
export function anchorState(anchor, ids) {
  if (!anchor || anchor.type === 'canvas') return 'canvas';
  const pool = anchor.type === 'connection' ? ids.connectionIds : ids.elementIds;
  return pool.has(anchor.targetId) ? 'attached' : 'detached';
}

/** Ids present in diagram content. Tolerates missing / malformed collections. */
export function contentIds(content) {
  const pick = (list) => new Set(Array.isArray(list) ? list.map((x) => x && x.id).filter((id) => typeof id === 'string') : []);
  return { elementIds: pick(content && content.elements), connectionIds: pick(content && content.connections) };
}

/**
 * Where to draw a thread's marker, in absolute canvas coordinates.
 * attached element  -> element origin + stored offset (follows moves)
 * attached connection / detached -> fallback position (position at creation; a hint for detached threads)
 * canvas -> the stored point
 * @returns {{state: 'attached'|'detached'|'canvas', x: number, y: number}}
 */
export function resolveMarker(anchor, { elements = [], connections = [] } = {}) {
  const state = anchorState(anchor, contentIds({ elements, connections }));
  if (state === 'canvas') return { state, x: anchor.x, y: anchor.y };
  if (state === 'attached' && anchor.type === 'element') {
    const el = elements.find((e) => e && e.id === anchor.targetId);
    const ox = Number(el && el.x);
    const oy = Number(el && el.y);
    if (Number.isFinite(ox) && Number.isFinite(oy)) return { state, x: ox + anchor.x, y: oy + anchor.y };
  }
  return { state, x: anchor.fallbackX ?? anchor.x, y: anchor.fallbackY ?? anchor.y };
}

/** Topmost element containing the canvas point (later in the array = drawn on top), or null. */
export function elementAtPoint(elements, x, y) {
  for (let i = (elements || []).length - 1; i >= 0; i--) {
    const e = elements[i];
    if (!e || typeof e.id !== 'string') continue;
    // Elements carry their size in `size` (stencil default 120x60 when absent); flat width/height also accepted.
    const w = Number(e.size?.width ?? e.width ?? 120);
    const h = Number(e.size?.height ?? e.height ?? 60);
    if ([e.x, e.y, w, h].some((n) => !Number.isFinite(Number(n)))) continue;
    if (x >= e.x && x <= e.x + w && y >= e.y && y <= e.y + h) return e;
  }
  return null;
}
