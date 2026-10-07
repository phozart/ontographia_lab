/**
 * Single source of truth for "fit all content in the visible canvas area".
 * Viewport convention: screen = (canvasPoint + viewport.x) * scale, relative to the canvas container.
 */

export const FIT_PADDING = 80;
export const FIT_MAX_SCALE = 1;
export const FIT_MIN_SCALE = 0.02;

/** Container rect minus edge-hugging obstacles (container-relative result). */
export function visibleArea(container, obstacles = []) {
  let left = container.left;
  let top = container.top;
  let right = container.left + container.width;
  let bottom = container.top + container.height;
  obstacles.forEach((o) => {
    const w = o.right - o.left;
    const h = o.bottom - o.top;
    if (w >= container.width * 0.6 && h < container.height * 0.5) {
      if (o.top <= container.top + 16) top = Math.max(top, o.bottom);
      else if (o.bottom >= container.top + container.height - 16) bottom = Math.min(bottom, o.top);
    } else if (h > w) {
      if (o.left <= container.left + 16) left = Math.max(left, o.right);
      else if (o.right >= container.left + container.width - 16) right = Math.min(right, o.left);
    }
  });
  return { left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
}

/**
 * Shrink `area` so it no longer overlaps a floating box (e.g. the minimap), cutting from the
 * side that loses the least area. Rects use container-relative {left, top, right, bottom}.
 */
export function avoidRect(area, rect) {
  const aRight = area.left + area.width;
  const aBottom = area.top + area.height;
  if (rect.right <= area.left || rect.left >= aRight || rect.bottom <= area.top || rect.top >= aBottom) return area;
  const cuts = [];
  if (rect.top > area.top) cuts.push({ ...area, height: rect.top - area.top });            // keep above
  if (rect.bottom < aBottom) cuts.push({ ...area, top: rect.bottom, height: aBottom - rect.bottom }); // keep below
  if (rect.left > area.left) cuts.push({ ...area, width: rect.left - area.left });          // keep left
  if (rect.right < aRight) cuts.push({ ...area, left: rect.right, width: aRight - rect.right });       // keep right
  if (cuts.length === 0) return area;
  return cuts.reduce((best, c) => (c.width * c.height > best.width * best.height ? c : best));
}

export function getElementsBounds(elements) {
  if (!elements || elements.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  elements.forEach((el) => {
    const w = el.size?.width || 100;
    const h = el.size?.height || 60;
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + w);
    maxY = Math.max(maxY, el.y + h);
  });
  return { minX, minY, maxX, maxY };
}

/** Viewport {x, y, scale} placing `bounds` centered in `area` with `padding`. */
export function computeFit(bounds, area, { padding = FIT_PADDING, maxScale = FIT_MAX_SCALE, minScale = FIT_MIN_SCALE } = {}) {
  const w = Math.max(1, bounds.maxX - bounds.minX);
  const h = Math.max(1, bounds.maxY - bounds.minY);
  const sx = (area.width - padding * 2) / w;
  const sy = (area.height - padding * 2) / h;
  const scale = Math.min(maxScale, Math.max(minScale, Math.min(sx, sy)));
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  return {
    x: (area.left + area.width / 2) / scale - cx,
    y: (area.top + area.height / 2) / scale - cy,
    scale,
  };
}

/**
 * Fit `elements` into the live canvas: container rect minus title bar / sidebars / open panels.
 * Returns null when the DOM is unavailable or there is nothing to fit.
 */
export function computeFitForCanvas(elements, { container, obstacles, avoid, padding = FIT_PADDING, fallback } = {}) {
  const bounds = getElementsBounds(elements);
  if (!bounds) return null;
  let rect = null;
  if (container) {
    const r = container.getBoundingClientRect();
    rect = { left: r.left, top: r.top, width: r.width, height: r.height };
  } else if (fallback) {
    rect = { left: 0, top: 0, width: fallback.width, height: fallback.height };
  }
  if (!rect || rect.width <= 0 || rect.height <= 0) return null;
  // Obstacles are in page coordinates; convert to container-relative.
  const rel = (obstacles || []).map((o) => ({
    left: o.left - rect.left,
    top: o.top - rect.top,
    right: o.right - rect.left,
    bottom: o.bottom - rect.top,
  }));
  let area = visibleArea({ left: 0, top: 0, width: rect.width, height: rect.height }, rel);
  (avoid || []).forEach((o) => {
    area = avoidRect(area, {
      left: o.left - rect.left, top: o.top - rect.top, right: o.right - rect.left, bottom: o.bottom - rect.top,
    });
  });
  return computeFit(bounds, area, { padding });
}
