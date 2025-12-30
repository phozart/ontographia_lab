// components/diagram-studio/utils/geometry.js
// Pure geometry utility functions for DiagramStudio canvas

// ============ CONSTANTS ============

export const GRID_SIZE = 20;
export const SNAP_THRESHOLD = 10;
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;

// Infinite canvas virtual size
export const INFINITE_CANVAS_SIZE = 100000;
export const INFINITE_CANVAS_OFFSET = INFINITE_CANVAS_SIZE / 2;

// Canvas bounds for element placement
export const CANVAS_MIN = 1000;
export const CANVAS_MAX = INFINITE_CANVAS_SIZE - 1000;

// Edge-panning constants
export const EDGE_PAN_ZONE = 60;
export const EDGE_PAN_SPEED = 15;

// Snap-to-straight threshold for nearly-aligned points
export const SNAP_TO_STRAIGHT_THRESHOLD = 15;

// ============ BASIC GEOMETRY ============

/**
 * Snap a value to the nearest grid line
 */
export function snapToGrid(value, gridSize = GRID_SIZE) {
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Clamp a position to valid canvas bounds
 */
export function clampToCanvas(value) {
  return Math.max(CANVAS_MIN, Math.min(CANVAS_MAX, value));
}

/**
 * Clamp viewport (currently a no-op for infinite canvas)
 */
export function clampViewport(viewport, containerWidth, containerHeight) {
  return viewport;
}

/**
 * Get direction vector for a port
 */
export function getPortDirection(port) {
  switch (port) {
    case 'top': return { x: 0, y: -1 };
    case 'bottom': return { x: 0, y: 1 };
    case 'left': return { x: -1, y: 0 };
    case 'right': return { x: 1, y: 0 };
    default: return { x: 0, y: 0 };
  }
}

/**
 * Detect if a click is on the border of an element
 * Returns { edge: 'top'|'right'|'bottom'|'left'|null, position: {x, y}, ratio: 0-1 }
 * When click is inside the stencil, detects which edge is CLOSEST to the click point
 *
 * IMPORTANT: Near corners, this function selects the CLOSEST edge rather than using
 * a fixed priority order. This prevents the snap-to-corner bug where clicking near
 * the top of a side would snap to 'top' instead of the intended side.
 */
export function detectBorderClick(clickX, clickY, element, size, borderThreshold = 12) {
  const left = element.x;
  const right = element.x + size.width;
  const top = element.y;
  const bottom = element.y + size.height;

  // Check each edge - distance from edge
  const distFromTop = Math.abs(clickY - top);
  const distFromBottom = Math.abs(clickY - bottom);
  const distFromLeft = Math.abs(clickX - left);
  const distFromRight = Math.abs(clickX - right);

  const withinHorizontal = clickX >= left - borderThreshold && clickX <= right + borderThreshold;
  const withinVertical = clickY >= top - borderThreshold && clickY <= bottom + borderThreshold;
  const isInside = clickX >= left && clickX <= right && clickY >= top && clickY <= bottom;

  // Build list of candidate edges (those within threshold)
  const candidates = [];

  if (distFromTop <= borderThreshold && withinHorizontal) {
    candidates.push({ edge: 'top', dist: distFromTop });
  }
  if (distFromBottom <= borderThreshold && withinHorizontal) {
    candidates.push({ edge: 'bottom', dist: distFromBottom });
  }
  if (distFromLeft <= borderThreshold && withinVertical) {
    candidates.push({ edge: 'left', dist: distFromLeft });
  }
  if (distFromRight <= borderThreshold && withinVertical) {
    candidates.push({ edge: 'right', dist: distFromRight });
  }

  // If multiple edges are within threshold (corner region), pick the CLOSEST one
  let edge = null;
  let position = null;
  let ratio = 0;

  if (candidates.length > 0) {
    // Sort by distance and pick closest
    candidates.sort((a, b) => a.dist - b.dist);
    edge = candidates[0].edge;
  } else if (isInside) {
    // Click is inside the stencil - find the CLOSEST edge
    const distances = [
      { edge: 'top', dist: distFromTop },
      { edge: 'bottom', dist: distFromBottom },
      { edge: 'left', dist: distFromLeft },
      { edge: 'right', dist: distFromRight },
    ];
    distances.sort((a, b) => a.dist - b.dist);
    edge = distances[0].edge;
  }

  // Calculate position and ratio based on selected edge
  if (edge === 'top') {
    position = { x: Math.max(left, Math.min(right, clickX)), y: top };
    ratio = (position.x - left) / size.width;
  } else if (edge === 'bottom') {
    position = { x: Math.max(left, Math.min(right, clickX)), y: bottom };
    ratio = (position.x - left) / size.width;
  } else if (edge === 'left') {
    position = { x: left, y: Math.max(top, Math.min(bottom, clickY)) };
    ratio = (position.y - top) / size.height;
  } else if (edge === 'right') {
    position = { x: right, y: Math.max(top, Math.min(bottom, clickY)) };
    ratio = (position.y - top) / size.height;
  }

  return { edge, position, ratio };
}

/**
 * Check if a line segment intersects with a rectangle (with padding)
 */
export function lineIntersectsRect(x1, y1, x2, y2, rect, padding = 0) {
  const left = rect.x - padding;
  const right = rect.x + rect.width + padding;
  const top = rect.y - padding;
  const bottom = rect.y + rect.height + padding;

  // Check if line is completely outside rectangle bounds
  if ((x1 < left && x2 < left) || (x1 > right && x2 > right)) return false;
  if ((y1 < top && y2 < top) || (y1 > bottom && y2 > bottom)) return false;

  // Check for horizontal line
  if (y1 === y2) {
    return y1 >= top && y1 <= bottom &&
           Math.max(Math.min(x1, x2), left) <= Math.min(Math.max(x1, x2), right);
  }

  // Check for vertical line
  if (x1 === x2) {
    return x1 >= left && x1 <= right &&
           Math.max(Math.min(y1, y2), top) <= Math.min(Math.max(y1, y2), bottom);
  }

  // General case - check intersections with all four sides
  const slope = (y2 - y1) / (x2 - x1);
  const intercept = y1 - slope * x1;

  // Check intersection with left edge
  const yAtLeft = slope * left + intercept;
  if (yAtLeft >= top && yAtLeft <= bottom &&
      left >= Math.min(x1, x2) && left <= Math.max(x1, x2)) return true;

  // Check intersection with right edge
  const yAtRight = slope * right + intercept;
  if (yAtRight >= top && yAtRight <= bottom &&
      right >= Math.min(x1, x2) && right <= Math.max(x1, x2)) return true;

  // Check intersection with top edge
  const xAtTop = (top - intercept) / slope;
  if (xAtTop >= left && xAtTop <= right &&
      top >= Math.min(y1, y2) && top <= Math.max(y1, y2)) return true;

  // Check intersection with bottom edge
  const xAtBottom = (bottom - intercept) / slope;
  if (xAtBottom >= left && xAtBottom <= right &&
      bottom >= Math.min(y1, y2) && bottom <= Math.max(y1, y2)) return true;

  return false;
}
