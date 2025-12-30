// components/diagram-studio/connections/geometry/pathBuilders.js
// Pure functions for building SVG path strings

/**
 * Get direction vector for a port
 * @param {string} port - 'top' | 'bottom' | 'left' | 'right'
 * @returns {{ x: number, y: number }}
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
 * Get port direction as string ('horizontal' | 'vertical')
 * @param {string} port
 * @returns {string}
 */
export function getPortAxis(port) {
  switch (port) {
    case 'top':
    case 'bottom':
      return 'vertical';
    case 'left':
    case 'right':
      return 'horizontal';
    default:
      return 'horizontal';
  }
}

// Threshold for snapping nearly-aligned straight lines to perfectly horizontal/vertical
const STRAIGHT_SNAP_THRESHOLD = 15;

/**
 * Build a straight line path
 * Snaps to perfectly horizontal/vertical when endpoints are nearly aligned
 * @param {{ x: number, y: number }} sourcePos
 * @param {{ x: number, y: number }} targetPos
 * @returns {string}
 */
export function buildStraightPath(sourcePos, targetPos) {
  // Guard against null/undefined positions
  if (!sourcePos || !targetPos ||
      typeof sourcePos.x !== 'number' || typeof sourcePos.y !== 'number' ||
      typeof targetPos.x !== 'number' || typeof targetPos.y !== 'number') {
    return '';
  }

  // Snap to horizontal/vertical when nearly aligned
  let endX = targetPos.x;
  let endY = targetPos.y;

  const dx = Math.abs(targetPos.x - sourcePos.x);
  const dy = Math.abs(targetPos.y - sourcePos.y);

  // If nearly horizontal (small Y difference), snap to same Y
  if (dy <= STRAIGHT_SNAP_THRESHOLD && dx > dy * 2) {
    endY = sourcePos.y;
  }
  // If nearly vertical (small X difference), snap to same X
  else if (dx <= STRAIGHT_SNAP_THRESHOLD && dy > dx * 2) {
    endX = sourcePos.x;
  }

  return `M ${sourcePos.x} ${sourcePos.y} L ${endX} ${endY}`;
}

/**
 * Build a straight path through waypoints
 * Applies snap-to-straight logic for each segment
 * @param {{ x: number, y: number }[]} points - Array of points including source, waypoints, and target
 * @returns {string}
 */
export function buildStraightPathThroughPoints(points) {
  if (points.length < 2) return '';

  let path = `M ${points[0].x} ${points[0].y}`;
  let prevPoint = points[0];

  for (let i = 1; i < points.length; i++) {
    const curr = points[i];
    const dx = Math.abs(curr.x - prevPoint.x);
    const dy = Math.abs(curr.y - prevPoint.y);

    let endX = curr.x;
    let endY = curr.y;

    // Snap each segment to horizontal/vertical when nearly aligned
    if (dy <= STRAIGHT_SNAP_THRESHOLD && dx > dy * 2) {
      endY = prevPoint.y; // Snap to horizontal
    } else if (dx <= STRAIGHT_SNAP_THRESHOLD && dy > dx * 2) {
      endX = prevPoint.x; // Snap to vertical
    }

    path += ` L ${endX} ${endY}`;
    // Use snapped position for next segment calculation
    prevPoint = { x: endX, y: endY };
  }
  return path;
}

/**
 * Build a curved (bezier) path
 * @param {{ x: number, y: number }} sourcePos
 * @param {{ x: number, y: number }} targetPos
 * @param {string} sourcePort
 * @param {string} targetPort
 * @param {number|null} curveAmount - If provided, use quadratic bezier with perpendicular offset
 * @returns {string}
 */
export function buildCurvedPath(sourcePos, targetPos, sourcePort, targetPort, curveAmount = null) {
  // Guard against null/undefined positions
  if (!sourcePos || !targetPos ||
      typeof sourcePos.x !== 'number' || typeof sourcePos.y !== 'number' ||
      typeof targetPos.x !== 'number' || typeof targetPos.y !== 'number') {
    return '';
  }

  const dx = targetPos.x - sourcePos.x;
  const dy = targetPos.y - sourcePos.y;

  // If curveAmount is provided, use simple quadratic bezier with perpendicular offset
  if (curveAmount !== null) {
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const perpX = -dy / len;
    const perpY = dx / len;
    const midX = (sourcePos.x + targetPos.x) / 2;
    const midY = (sourcePos.y + targetPos.y) / 2;
    const ctrlX = midX + perpX * curveAmount;
    const ctrlY = midY + perpY * curveAmount;
    return `M ${sourcePos.x} ${sourcePos.y} Q ${ctrlX} ${ctrlY} ${targetPos.x} ${targetPos.y}`;
  }

  // Default: cubic bezier based on port directions
  const offset = Math.min(80, Math.abs(dx) / 2, Math.abs(dy) / 2) || 40;

  const sourceDir = getPortDirection(sourcePort);
  const targetDir = getPortDirection(targetPort);

  // Control points extend in the direction of the port
  const cp1x = sourcePos.x + sourceDir.x * offset;
  const cp1y = sourcePos.y + sourceDir.y * offset;
  const cp2x = targetPos.x + targetDir.x * offset;
  const cp2y = targetPos.y + targetDir.y * offset;

  return `M ${sourcePos.x} ${sourcePos.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${targetPos.x} ${targetPos.y}`;
}

/**
 * Build a curved path through waypoints
 * @param {{ x: number, y: number }[]} points
 * @returns {string}
 */
export function buildCurvedPathThroughPoints(points) {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return buildStraightPath(points[0], points[1]);
  }

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    if (next) {
      // Quadratic curve through control point
      path += ` Q ${curr.x} ${curr.y}, ${(curr.x + next.x) / 2} ${(curr.y + next.y) / 2}`;
    } else {
      // Final segment
      const cpX = (prev.x + curr.x) / 2;
      path += ` Q ${cpX} ${prev.y}, ${curr.x} ${curr.y}`;
    }
  }

  return path;
}

/**
 * Build an arc path with port-aware initial/final direction
 * @param {{ x: number, y: number }} sourcePos
 * @param {{ x: number, y: number }} targetPos
 * @param {string} sourcePort - Port direction ('top'|'bottom'|'left'|'right')
 * @param {string} targetPort - Port direction ('top'|'bottom'|'left'|'right')
 * @param {number|null} curveAmount - If provided, controls curve intensity
 * @returns {string}
 */
export function buildArcPath(sourcePos, targetPos, sourcePort = 'right', targetPort = 'left', curveAmount = null) {
  // Guard against null/undefined positions
  if (!sourcePos || !targetPos ||
      typeof sourcePos.x !== 'number' || typeof sourcePos.y !== 'number' ||
      typeof targetPos.x !== 'number' || typeof targetPos.y !== 'number') {
    return '';
  }

  const dx = targetPos.x - sourcePos.x;
  const dy = targetPos.y - sourcePos.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;

  // Get port directions for proper initial/final tangents
  const sourceDir = getPortDirection(sourcePort);
  const targetDir = getPortDirection(targetPort);

  // Calculate control point offset based on distance and curve amount
  const offset = curveAmount !== null ? Math.abs(curveAmount) : dist * 0.4;

  // Control points extend from source/target in the direction of their ports
  // This ensures the curve exits perpendicular to the stencil edge
  const cp1x = sourcePos.x + sourceDir.x * offset;
  const cp1y = sourcePos.y + sourceDir.y * offset;
  const cp2x = targetPos.x + targetDir.x * offset;
  const cp2y = targetPos.y + targetDir.y * offset;

  // Use cubic bezier for proper port-aware curves
  return `M ${sourcePos.x} ${sourcePos.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${targetPos.x} ${targetPos.y}`;
}

/**
 * Build a path with rounded corners from an array of points
 * @param {{ x: number, y: number }[]} points
 * @param {number} cornerRadius - Radius for rounded corners (0 for sharp)
 * @returns {string}
 */
export function buildRoundedPath(points, cornerRadius = 8) {
  // Guard against null/undefined or empty points array
  if (!Array.isArray(points) || points.length <= 1) return '';

  // Validate first and last points exist and have valid coordinates
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last ||
      typeof first.x !== 'number' || typeof first.y !== 'number' ||
      typeof last.x !== 'number' || typeof last.y !== 'number') {
    return '';
  }

  if (points.length === 2) {
    return `M ${first.x} ${first.y} L ${last.x} ${last.y}`;
  }

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    // Calculate direction vectors
    const d1x = curr.x - prev.x;
    const d1y = curr.y - prev.y;
    const d2x = next.x - curr.x;
    const d2y = next.y - curr.y;

    // Calculate distances
    const len1 = Math.sqrt(d1x * d1x + d1y * d1y);
    const len2 = Math.sqrt(d2x * d2x + d2y * d2y);

    // Limit corner radius to half the shortest segment
    const maxRadius = Math.min(cornerRadius, len1 / 2, len2 / 2);

    if (maxRadius <= 1) {
      path += ` L ${curr.x} ${curr.y}`;
    } else {
      // Normalized directions
      const n1x = d1x / len1;
      const n1y = d1y / len1;
      const n2x = d2x / len2;
      const n2y = d2y / len2;

      // Points for the curve
      const beforeX = curr.x - n1x * maxRadius;
      const beforeY = curr.y - n1y * maxRadius;
      const afterX = curr.x + n2x * maxRadius;
      const afterY = curr.y + n2y * maxRadius;

      path += ` L ${beforeX} ${beforeY}`;
      path += ` Q ${curr.x} ${curr.y} ${afterX} ${afterY}`;
    }
  }

  path += ` L ${points[points.length - 1].x} ${points[points.length - 1].y}`;
  return path;
}

/**
 * Get stroke dash array for a pattern
 * @param {string} pattern - 'solid' | 'dashed' | 'dotted' | 'dash-dot'
 * @param {number} strokeWidth
 * @returns {string|undefined}
 */
export function getDashArray(pattern, strokeWidth = 2) {
  switch (pattern) {
    case 'dashed':
      return `${strokeWidth * 4},${strokeWidth * 2}`;
    case 'dotted':
      return `${strokeWidth},${strokeWidth * 2}`;
    case 'dash-dot':
      return `${strokeWidth * 4},${strokeWidth * 2},${strokeWidth},${strokeWidth * 2}`;
    case 'solid':
    default:
      return undefined;
  }
}

/**
 * Check if two line segments intersect and return intersection point
 * @param {{ x: number, y: number }} p1 - Start of segment 1
 * @param {{ x: number, y: number }} p2 - End of segment 1
 * @param {{ x: number, y: number }} p3 - Start of segment 2
 * @param {{ x: number, y: number }} p4 - End of segment 2
 * @returns {{ x: number, y: number } | null} - Intersection point or null
 */
export function getLineIntersection(p1, p2, p3, p4) {
  const d1x = p2.x - p1.x;
  const d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x;
  const d2y = p4.y - p3.y;

  const cross = d1x * d2y - d1y * d2x;

  // Parallel lines
  if (Math.abs(cross) < 0.0001) return null;

  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / cross;
  const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / cross;

  // Check if intersection is within both segments
  if (t >= 0.01 && t <= 0.99 && u >= 0.01 && u <= 0.99) {
    return {
      x: p1.x + t * d1x,
      y: p1.y + t * d1y
    };
  }

  return null;
}

/**
 * Find all crossing points between a connection's path and other connections
 * @param {{ x: number, y: number }[]} points - Points of the current connection
 * @param {Array<{ points: { x: number, y: number }[] }>} otherPaths - Other connection paths
 * @param {string} connectionId - ID of current connection to exclude self
 * @returns {{ x: number, y: number, isHorizontal: boolean }[]} - Crossing points with orientation
 */
export function findLineCrossings(points, otherPaths, connectionId) {
  const crossings = [];

  if (!points || points.length < 2) return crossings;

  // For each segment in current path
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    // Determine if this segment is horizontal
    const isHorizontal = Math.abs(p2.y - p1.y) < Math.abs(p2.x - p1.x);

    // Check against all segments in other paths
    for (const other of otherPaths) {
      if (!other.points || other.points.length < 2) continue;

      for (let j = 0; j < other.points.length - 1; j++) {
        const p3 = other.points[j];
        const p4 = other.points[j + 1];

        const intersection = getLineIntersection(p1, p2, p3, p4);
        if (intersection) {
          crossings.push({
            ...intersection,
            isHorizontal, // The current segment's orientation
          });
        }
      }
    }
  }

  return crossings;
}

/**
 * Build SVG path for a bridge/hop at a crossing point
 * @param {{ x: number, y: number, isHorizontal: boolean }} crossing
 * @param {number} bridgeSize - Size of the bridge arc
 * @returns {string} - SVG path for the bridge
 */
export function buildBridgePath(crossing, bridgeSize = 6) {
  const { x, y, isHorizontal } = crossing;

  if (isHorizontal) {
    // Horizontal line crossing vertical - arc goes up
    return `M ${x - bridgeSize} ${y} A ${bridgeSize} ${bridgeSize} 0 0 1 ${x + bridgeSize} ${y}`;
  } else {
    // Vertical line crossing horizontal - arc goes right
    return `M ${x} ${y - bridgeSize} A ${bridgeSize} ${bridgeSize} 0 0 1 ${x} ${y + bridgeSize}`;
  }
}
