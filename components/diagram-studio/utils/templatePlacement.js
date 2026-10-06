// components/diagram-studio/utils/templatePlacement.js
// Pure helpers for inserting a template without overlapping existing content.
// All coordinates are canvas coordinates; the viewport maps screen -> canvas as
// canvas = screen / scale - viewport.x (same convention as DiagramCanvas).

const DEFAULT_SIZE = { width: 120, height: 60 };

/** Bounding box ({x, y, width, height}) of a template, in template-relative coordinates. */
export function getTemplateBounds(pack) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const add = (x, y, w, h) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  };
  if (pack?.frame) add(pack.frame.x || 0, pack.frame.y || 0, pack.frame.width, pack.frame.height);
  (pack?.elements || []).forEach((el) => {
    const s = el.size || DEFAULT_SIZE;
    add(el.x || 0, el.y || 0, s.width, s.height);
  });
  if (minX === Infinity) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Bounding box of all existing elements, or null when the canvas is empty. */
export function getContentBounds(elements) {
  if (!Array.isArray(elements) || elements.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  elements.forEach((el) => {
    const s = el.size || DEFAULT_SIZE;
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + s.width);
    maxY = Math.max(maxY, el.y + s.height);
  });
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Offset ({dx, dy}) to add to template-relative coordinates so the template
 * sits to the right of existing content (top-aligned, `gap` apart), or centred
 * in the viewport when the canvas is empty.
 */
export function computeTemplatePlacement({ bounds, contentBounds, viewport, container, gap = 80, canvasMax = 99000 }) {
  if (contentBounds) {
    const rightEdge = contentBounds.x + contentBounds.width + gap + bounds.width;
    if (rightEdge > canvasMax) {
      // No room to the right: first empty region is below the content
      return {
        dx: Math.round(contentBounds.x - bounds.x),
        dy: Math.round(contentBounds.y + contentBounds.height + gap - bounds.y),
      };
    }
    return {
      dx: Math.round(contentBounds.x + contentBounds.width + gap - bounds.x),
      dy: Math.round(contentBounds.y - bounds.y),
    };
  }
  const scale = viewport?.scale || 1;
  const centerX = container.width / 2 / scale - (viewport?.x || 0);
  const centerY = container.height / 2 / scale - (viewport?.y || 0);
  return {
    dx: Math.round(centerX - (bounds.x + bounds.width / 2)),
    dy: Math.round(centerY - (bounds.y + bounds.height / 2)),
  };
}

/** Viewport ({x, y, scale}) that centres `rect` in the container, zooming out only if needed. */
export function computeFitViewport(rect, container, { padding = 60, maxScale = 1, minScale = 0.1 } = {}) {
  const sx = (container.width - padding * 2) / rect.width;
  const sy = (container.height - padding * 2) / rect.height;
  const scale = Math.min(maxScale, Math.max(minScale, Math.min(sx, sy)));
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  return {
    x: container.width / 2 / scale - cx,
    y: container.height / 2 / scale - cy,
    scale,
  };
}
