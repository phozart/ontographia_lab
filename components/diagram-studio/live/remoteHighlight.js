// components/diagram-studio/live/remoteHighlight.js
// LA-1 change highlight (ADR-0006 section 5.2): pure geometry. After a pickup the editor knows which element and
// connection ids another writer added, changed or removed; this turns them into rings, ghosts and an off-screen
// hint. No React, no DOM, so the transport (polling today, a socket later) and the renderer can change freely.

export const COLOR_PERSON = '#4FB3CE'; // Deep Cyan
export const COLOR_AGENT = '#9A8AC8'; // Deep Lavender, used for agents and nothing else
export const RING_FADE_MS = 1600;
export const GHOST_FADE_MS = 1200;
export const REDUCED_HOLD_MS = 3000; // reduced motion: a static ring, no fade
export const CHIP_LIFETIME_MS = 10000;
export const MAX_INDIVIDUAL_RINGS = 150;
const DEFAULT_SIZE = { width: 120, height: 60 };

export const highlightColor = (agent) => (agent ? COLOR_AGENT : COLOR_PERSON);

let seq = 0;

function rectOf(el) {
  const w = el.size?.width || DEFAULT_SIZE.width;
  const h = el.size?.height || DEFAULT_SIZE.height;
  return { x: el.x, y: el.y, w, h };
}

function unionOf(rects) {
  let x1 = Infinity; let y1 = Infinity; let x2 = -Infinity; let y2 = -Infinity;
  for (const r of rects) {
    x1 = Math.min(x1, r.x); y1 = Math.min(y1, r.y);
    x2 = Math.max(x2, r.x + r.w); y2 = Math.max(y2, r.y + r.h);
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

const finite = (r) => r && [r.x, r.y, r.w, r.h].every(Number.isFinite);

/**
 * @param {{ids: {added: string[], changed: string[], removed: string[], truncated?: boolean}|null,
 *          elements: object[], connections: object[], before: object[], agent?: boolean, who?: string|null}} input
 *   `elements`/`connections` are the merged result; `before` is the local elements before the merge (ghost source).
 * @returns {null | {key: string, agent: boolean, who: string|null, color: string, items: object[], union: object,
 *                   collapsed: boolean, count: number}}
 */
export function buildRemoteHighlight({ ids, elements, connections, before, agent = false, who = null }) {
  if (!ids) return null;
  const elById = new Map(elements.map((e) => [String(e.id), e]));
  const beforeById = new Map((before || []).map((e) => [String(e.id), e]));
  const connById = new Map(connections.map((c) => [String(c.id), c]));
  const live = [...(ids.added || []), ...(ids.changed || [])].map(String);
  const items = [];

  for (const id of live) {
    const e = elById.get(id);
    if (e) {
      const rect = rectOf(e);
      if (finite(rect)) items.push({ id, kind: 'element', rect });
      continue;
    }
    const c = connById.get(id);
    if (!c) continue;
    const s = elById.get(String(c.sourceId));
    const t = elById.get(String(c.targetId));
    if (!s || !t) continue;
    const center = (el) => { const r = rectOf(el); return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; };
    const mids = (Array.isArray(c.waypoints) ? c.waypoints : []).filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y));
    const points = [center(s), ...mids.map((p) => ({ x: p.x, y: p.y })), center(t)];
    const rect = unionOf(points.map((p) => ({ x: p.x, y: p.y, w: 0, h: 0 })));
    if (finite(rect)) items.push({ id, kind: 'connection', points, rect });
  }
  const ghosts = [];
  for (const id of (ids.removed || []).map(String)) {
    const e = beforeById.get(id);
    if (!e) continue; // connections (and anything we never had) leave no ghost
    const rect = rectOf(e);
    if (finite(rect)) ghosts.push({ id, kind: 'ghost', rect });
  }

  const all = [...items, ...ghosts];
  if (all.length === 0) return null;
  const union = unionOf(all.map((i) => i.rect));
  const t = ids.totals;
  const trueTotal = t ? Number(t.added || 0) + Number(t.changed || 0) + Number(t.removed || 0) : 0;
  const count = ids.truncated && trueTotal > items.length + ghosts.length ? trueTotal : items.length + ghosts.length;
  const collapsed = !!ids.truncated || count > MAX_INDIVIDUAL_RINGS;
  seq += 1;
  return {
    key: `hl-${seq}`,
    agent: !!agent,
    who,
    color: highlightColor(agent),
    items: collapsed ? [{ id: 'union', kind: 'union', rect: union }] : all,
    union,
    collapsed,
    count,
  };
}

const intersects = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function direction(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) > 2 * Math.abs(dy)) return dx > 0 ? 'e' : 'w';
  if (Math.abs(dy) > 2 * Math.abs(dx)) return dy > 0 ? 's' : 'n';
  return `${dy > 0 ? 's' : 'n'}${dx > 0 ? 'e' : 'w'}`;
}

/**
 * Which part of the highlight is outside the viewport (canvas units)? Items that overlap the view at all count as
 * visible. Returns null when everything is visible.
 * @returns {null | {count: number, bbox: {x,y,w,h}, direction: 'n'|'ne'|'e'|'se'|'s'|'sw'|'w'|'nw'}}
 */
export function offscreenSummary(highlight, view) {
  if (!highlight || !view) return null;
  const off = highlight.items.filter((i) => !intersects(i.rect, view));
  if (off.length === 0) return null;
  const bbox = unionOf(off.map((i) => i.rect));
  // A collapsed highlight is one group standing for every change; a normal one counts its own items.
  const count = highlight.collapsed ? highlight.count : off.length;
  const center = { x: view.x + view.w / 2, y: view.y + view.h / 2 };
  return { count, bbox, direction: direction(center, { x: bbox.x + bbox.w / 2, y: bbox.y + bbox.h / 2 }) };
}

/** New viewport (same scale) that centers `bbox` (canvas units) in a container; screen = (canvas + viewport) * scale. */
export function panToViewport(bbox, viewport, container) {
  const cx = bbox.x + bbox.w / 2;
  const cy = bbox.y + bbox.h / 2;
  return {
    ...viewport,
    x: container.width / (2 * viewport.scale) - cx,
    y: container.height / (2 * viewport.scale) - cy,
  };
}

/** Viewport rectangle in canvas units for the current pan/zoom and container size. */
export function viewRect(viewport, container) {
  return { x: -viewport.x, y: -viewport.y, w: container.width / viewport.scale, h: container.height / viewport.scale };
}
