// components/diagram-studio/hooks/interaction/placement.js
// Pure placement helpers shared by click-to-place tools and the N shortcut.

const snap = (v, grid) => (grid > 0 ? Math.round(v / grid) * grid : v);

export const DEFAULT_STICKY_SIZE = 150;
export const DEFAULT_STENCIL_SIZE = { width: 120, height: 80 };

/** Top-left position that centers `size` on `point`, snapped to the grid. */
export function placeAtPoint(point, size, grid = 20) {
  return {
    x: snap(point.x - size.width / 2, grid),
    y: snap(point.y - size.height / 2, grid),
  };
}

function hasBox(el) {
  return el && el.size && el.size.width > 0 && el.size.height > 0 && Number.isFinite(el.x) && Number.isFinite(el.y);
}

function overlapsAny(rect, boxes, gap) {
  for (const b of boxes) {
    if (rect.x < b.x + b.width + gap && rect.x + rect.width + gap > b.x &&
        rect.y < b.y + b.height + gap && rect.y + rect.height + gap > b.y) return true;
  }
  return false;
}

/**
 * Nearest non-overlapping top-left for an item of `size`, searching outward
 * from `center`. Frames (backgrounds) and elements without a size are ignored.
 * When `bounds` ({x,y,width,height} in canvas units) is given, a spot fully
 * inside it is preferred; if none exists the nearest free spot anywhere wins.
 */
export function findFreePlacement({ center, size, elements = [], bounds = null, grid = 20, gap = 20, maxSteps = 60 }) {
  const boxes = elements
    .filter((el) => hasBox(el) && el.type !== 'frame')
    .map((el) => ({ x: el.x, y: el.y, width: el.size.width, height: el.size.height }));
  const origin = placeAtPoint(center, size, grid);
  const inside = (p) => !bounds ||
    (p.x >= bounds.x && p.y >= bounds.y &&
     p.x + size.width <= bounds.x + bounds.width && p.y + size.height <= bounds.y + bounds.height);
  const free = (p) => !overlapsAny({ x: p.x, y: p.y, width: size.width, height: size.height }, boxes, gap);

  let firstFreeAnywhere = null;
  // Scan square rings of growing radius; within a ring pick the closest candidate.
  for (let r = 0; r <= maxSteps; r++) {
    let best = null;
    let bestD = Infinity;
    for (let i = -r; i <= r; i++) {
      for (let j = -r; j <= r; j++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
        const p = { x: origin.x + i * grid, y: origin.y + j * grid };
        if (!free(p)) continue;
        const d = i * i + j * j;
        if (d < bestD && inside(p)) { best = p; bestD = d; }
        else if (!firstFreeAnywhere || d < firstFreeAnywhere.d) firstFreeAnywhere = { ...p, d };
      }
    }
    if (best) return best;
    // No in-bounds spot at this radius; keep widening. Stop early only without bounds.
    if (!bounds && firstFreeAnywhere) return { x: firstFreeAnywhere.x, y: firstFreeAnywhere.y };
  }
  return firstFreeAnywhere ? { x: firstFreeAnywhere.x, y: firstFreeAnywhere.y } : origin;
}
