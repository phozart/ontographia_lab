// components/diagram-studio/connections/geometry/orthogonalRouting.js
// Functions for calculating orthogonal (step/elbow) connection routes

import { getPortDirection, getPortAxis, buildRoundedPath } from './pathBuilders';

// Constants
const MIN_OFFSET = 30; // Minimum perpendicular stub distance from port (visible outside stencil)
const SNAP_TO_STRAIGHT_THRESHOLD = 15; // Snap nearly-aligned endpoints to straight line
const WAYPOINT_SNAP_THRESHOLD = 3; // Floating point cleanup for waypoints

/**
 * Clean up redundant waypoints (remove collinear points)
 * @param {{ x: number, y: number }} sourcePos
 * @param {{ x: number, y: number }[]} waypoints
 * @param {{ x: number, y: number }} targetPos
 * @returns {{ x: number, y: number }[]}
 */
export function cleanupWaypoints(sourcePos, waypoints, targetPos) {
  if (waypoints.length === 0) return waypoints;

  const allPoints = [sourcePos, ...waypoints, targetPos];
  const cleaned = [];

  for (let i = 1; i < allPoints.length - 1; i++) {
    const prev = allPoints[i - 1];
    const curr = allPoints[i];
    const next = allPoints[i + 1];

    // Check if points are collinear (all on same horizontal or vertical line)
    const sameX = Math.abs(prev.x - curr.x) < 1 && Math.abs(curr.x - next.x) < 1;
    const sameY = Math.abs(prev.y - curr.y) < 1 && Math.abs(curr.y - next.y) < 1;

    // Keep the point if it's a corner (not collinear)
    if (!sameX && !sameY) {
      cleaned.push(curr);
    } else if (!sameX || !sameY) {
      // It's a turn, keep it
      cleaned.push(curr);
    }
    // Skip collinear points
  }

  return cleaned;
}

/**
 * Remove direction reversals from path (e.g., up-then-down, left-then-right)
 * This fixes artifacts when obstacle avoidance routes opposite to initial port direction
 * @param {{ x: number, y: number }[]} points - All points including source and target
 * @returns {{ x: number, y: number }[]}
 */
function removeReversals(points) {
  if (points.length < 4) return points;

  const result = [points[0]]; // Always keep source

  for (let i = 1; i < points.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = points[i];
    const next = points[i + 1];

    // Check for vertical reversal: prev->curr goes one direction, curr->next reverses
    const isVerticalSegment = Math.abs(prev.x - curr.x) < 1;
    if (isVerticalSegment && Math.abs(curr.x - next.x) < 1) {
      // Both segments are vertical - check for reversal
      const dir1 = curr.y - prev.y; // Direction from prev to curr
      const dir2 = next.y - curr.y; // Direction from curr to next

      // If directions are opposite AND the middle point is within MIN_OFFSET of start
      // then it's a reversal artifact - skip this point
      if (dir1 * dir2 < 0 && Math.abs(curr.y - prev.y) <= MIN_OFFSET + 5) {
        // Skip this point - it creates a reversal
        continue;
      }
    }

    // Check for horizontal reversal
    const isHorizontalSegment = Math.abs(prev.y - curr.y) < 1;
    if (isHorizontalSegment && Math.abs(curr.y - next.y) < 1) {
      // Both segments are horizontal - check for reversal
      const dir1 = curr.x - prev.x;
      const dir2 = next.x - curr.x;

      if (dir1 * dir2 < 0 && Math.abs(curr.x - prev.x) <= MIN_OFFSET + 5) {
        // Skip this point - it creates a reversal
        continue;
      }
    }

    result.push(curr);
  }

  result.push(points[points.length - 1]); // Always keep target
  return result;
}

/**
 * Check if a line segment intersects with a rectangle (with padding)
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @param {{ x: number, y: number, width: number, height: number }} rect
 * @param {number} padding
 * @returns {boolean}
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

/**
 * Check if a path (series of points) intersects any obstacle
 * @param {{ x: number, y: number }[]} points
 * @param {{ x: number, y: number, width: number, height: number }[]} obstacles
 * @param {number} padding
 * @returns {{ obstacle: Object, segmentIndex: number } | null}
 */
function findFirstIntersection(points, obstacles, padding) {
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    for (const obstacle of obstacles) {
      if (lineIntersectsRect(p1.x, p1.y, p2.x, p2.y, obstacle, padding)) {
        return { obstacle, segmentIndex: i };
      }
    }
  }
  return null;
}

/**
 * Calculate route around an obstacle for orthogonal routing
 * Returns waypoints that go COMPLETELY around the obstacle
 * The key is to ensure the path from p1 to detour to p2 never crosses the obstacle
 * @param {Object} targetPos - Final target position to help choose better routing direction
 * @param {string} sourcePort - Source port direction ('top', 'bottom', 'left', 'right')
 * @param {{ x: number, y: number }} sourcePos - Source position (for calculating directional bias)
 */
function routeAroundObstacle(p1, p2, obstacle, padding, preferVertical = false, targetPos = null, sourcePort = null, sourcePos = null) {
  const obs = obstacle;
  const obsCenterX = obs.x + obs.width / 2;
  const obsCenterY = obs.y + obs.height / 2;

  // Calculate clearance points around obstacle
  const DETOUR_MARGIN = 20;
  const leftX = obs.x - padding - DETOUR_MARGIN;
  const rightX = obs.x + obs.width + padding + DETOUR_MARGIN;
  const topY = obs.y - padding - DETOUR_MARGIN;
  const bottomY = obs.y + obs.height + padding + DETOUR_MARGIN;

  // Detect if segment is primarily horizontal or vertical
  const isHorizontalSegment = Math.abs(p2.x - p1.x) > Math.abs(p2.y - p1.y);
  const isVerticalSegment = !isHorizontalSegment;

  // Determine where p1 and p2 are relative to the obstacle
  const p1Left = p1.x < leftX;
  const p1Right = p1.x > rightX;
  const p1Above = p1.y < topY;
  const p1Below = p1.y > bottomY;

  const p2Left = p2.x < leftX;
  const p2Right = p2.x > rightX;
  const p2Above = p2.y < topY;
  const p2Below = p2.y > bottomY;

  // Calculate distances to each side
  const goAboveDistance = Math.abs(p1.y - topY) + Math.abs(p2.y - topY);
  const goBelowDistance = Math.abs(p1.y - bottomY) + Math.abs(p2.y - bottomY);
  const goLeftDistance = Math.abs(p1.x - leftX) + Math.abs(p2.x - leftX);
  const goRightDistance = Math.abs(p1.x - rightX) + Math.abs(p2.x - rightX);

  // Calculate directional bias from non-center port connections
  // If the connection starts offset from center, prefer routing in that offset direction
  let horizontalBias = 0; // -1 = prefer left, +1 = prefer right
  let verticalBias = 0; // -1 = prefer up, +1 = prefer down

  if (sourcePos && targetPos) {
    // Calculate the overall direction of the connection
    const overallDx = targetPos.x - sourcePos.x;
    const overallDy = targetPos.y - sourcePos.y;

    // For horizontal segments encountering obstacles, prefer vertical detour toward target
    if (overallDy < -50) verticalBias = -1; // Going up overall
    if (overallDy > 50) verticalBias = 1; // Going down overall

    // For vertical segments encountering obstacles, prefer horizontal detour toward target
    if (overallDx < -50) horizontalBias = -1; // Going left overall
    if (overallDx > 50) horizontalBias = 1; // Going right overall
  }

  // Source port direction also provides bias for routing decisions
  if (sourcePort) {
    if (sourcePort === 'top') verticalBias = Math.min(verticalBias, -0.5);
    if (sourcePort === 'bottom') verticalBias = Math.max(verticalBias, 0.5);
    if (sourcePort === 'left') horizontalBias = Math.min(horizontalBias, -0.5);
    if (sourcePort === 'right') horizontalBias = Math.max(horizontalBias, 0.5);
  }

  // For HORIZONTAL segments, we MUST go above or below (not left/right)
  if (isHorizontalSegment) {
    // Consider where the final target is to avoid unnecessary backtracking
    // If target is above this segment, prefer going above the obstacle
    // If target is below, prefer going below
    let goAbove;
    if (targetPos) {
      // Smart routing: go toward the target
      const targetIsAbove = targetPos.y < Math.min(p1.y, p2.y);
      const targetIsBelow = targetPos.y > Math.max(p1.y, p2.y);
      if (targetIsAbove) {
        goAbove = true; // Target is above, go above to minimize backtracking
      } else if (targetIsBelow) {
        goAbove = false; // Target is below, go below
      } else {
        // Target is at similar Y level, apply directional bias then distance
        const biasedAboveDistance = goAboveDistance * (1 + verticalBias * 0.3);
        const biasedBelowDistance = goBelowDistance * (1 - verticalBias * 0.3);
        goAbove = biasedAboveDistance < biasedBelowDistance;
      }
    } else {
      // Fallback: prefer above if either point is above center, or if above is shorter (with bias)
      const biasedAboveDistance = goAboveDistance * (1 + verticalBias * 0.3);
      const biasedBelowDistance = goBelowDistance * (1 - verticalBias * 0.3);
      goAbove = (p1.y < obsCenterY || p2.y < obsCenterY) || biasedAboveDistance < biasedBelowDistance;
    }
    const routeY = goAbove ? topY : bottomY;

    // If one endpoint is already outside on X axis, we need a proper L-shape
    if (p1Left) {
      // p1 is left of obstacle - go up/down from p1, then horizontal, then up/down to p2
      return [
        { x: p1.x, y: routeY },
        { x: p2.x, y: routeY }
      ];
    }
    if (p2Right) {
      // p2 is right of obstacle
      return [
        { x: p1.x, y: routeY },
        { x: p2.x, y: routeY }
      ];
    }
    // Both points are within obstacle X range
    return [
      { x: p1.x, y: routeY },
      { x: p2.x, y: routeY }
    ];
  }

  // For VERTICAL segments, we MUST go left or right (not above/below)
  if (isVerticalSegment) {
    // Consider where the final target is to avoid unnecessary backtracking
    let goLeft;
    if (targetPos) {
      // Smart routing: go toward the target
      const targetIsLeft = targetPos.x < Math.min(p1.x, p2.x);
      const targetIsRight = targetPos.x > Math.max(p1.x, p2.x);
      if (targetIsLeft) {
        goLeft = true; // Target is left, go left to minimize backtracking
      } else if (targetIsRight) {
        goLeft = false; // Target is right, go right
      } else {
        // Target is at similar X level, apply directional bias then distance
        const biasedLeftDistance = goLeftDistance * (1 + horizontalBias * 0.3);
        const biasedRightDistance = goRightDistance * (1 - horizontalBias * 0.3);
        goLeft = biasedLeftDistance < biasedRightDistance;
      }
    } else {
      // Fallback: prefer left if either point is left of center, or if left is shorter (with bias)
      const biasedLeftDistance = goLeftDistance * (1 + horizontalBias * 0.3);
      const biasedRightDistance = goRightDistance * (1 - horizontalBias * 0.3);
      goLeft = (p1.x < obsCenterX || p2.x < obsCenterX) || biasedLeftDistance < biasedRightDistance;
    }
    const routeX = goLeft ? leftX : rightX;

    // If one endpoint is already outside on Y axis, create proper route
    if (p1Above) {
      return [
        { x: routeX, y: p1.y },
        { x: routeX, y: p2.y }
      ];
    }
    if (p2Below) {
      return [
        { x: routeX, y: p1.y },
        { x: routeX, y: p2.y }
      ];
    }
    // Both points are within obstacle Y range
    return [
      { x: routeX, y: p1.y },
      { x: routeX, y: p2.y }
    ];
  }

  // Fallback: diagonal segment - choose shortest path around (with bias)
  const biasedAboveDistance = goAboveDistance * (1 + verticalBias * 0.3);
  const biasedBelowDistance = goBelowDistance * (1 - verticalBias * 0.3);
  const biasedLeftDistance = goLeftDistance * (1 + horizontalBias * 0.3);
  const biasedRightDistance = goRightDistance * (1 - horizontalBias * 0.3);

  const horizontalDetourDist = Math.min(biasedAboveDistance, biasedBelowDistance);
  const verticalDetourDist = Math.min(biasedLeftDistance, biasedRightDistance);

  if (horizontalDetourDist <= verticalDetourDist) {
    const routeY = biasedAboveDistance <= biasedBelowDistance ? topY : bottomY;
    return [
      { x: p1.x, y: routeY },
      { x: p2.x, y: routeY }
    ];
  } else {
    const routeX = biasedLeftDistance <= biasedRightDistance ? leftX : rightX;
    return [
      { x: routeX, y: p1.y },
      { x: routeX, y: p2.y }
    ];
  }
}

/**
 * Avoid obstacles by adjusting waypoints
 * Uses iterative approach to handle multiple obstacles
 * @param {{ x: number, y: number }} sourcePos
 * @param {{ x: number, y: number }} targetPos
 * @param {{ x: number, y: number }[]} waypoints
 * @param {{ x: number, y: number, width: number, height: number }[]} obstacles
 * @param {number} padding
 * @returns {{ x: number, y: number }[]}
 */
/**
 * Remove backtracking segments from a path
 * After obstacle avoidance, the path might have segments that go past the target
 * and then come back. This function cleans those up.
 */
function removeBacktracking(points, targetPos) {
  if (points.length < 4) return points;

  const result = [points[0]];

  for (let i = 1; i < points.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = points[i];
    const next = points[i + 1];

    // Check if this point causes backtracking
    // The key insight: if we go PAST the target and then come BACK, skip the overshoot point

    // For vertical segments (same X)
    if (Math.abs(prev.x - curr.x) < 2 && next) {
      const wentDown = curr.y > prev.y;
      const wentUp = curr.y < prev.y;
      const nextGoesUp = next.y < curr.y;
      const nextGoesDown = next.y > curr.y;

      // If we went DOWN past the target, and next goes back UP toward target - skip curr
      if (wentDown && nextGoesUp && curr.y > targetPos.y) {
        continue;
      }
      // If we went UP past the target, and next goes back DOWN toward target - skip curr
      if (wentUp && nextGoesDown && curr.y < targetPos.y) {
        continue;
      }
    }

    // For horizontal segments (same Y)
    if (Math.abs(prev.y - curr.y) < 2 && next) {
      const wentRight = curr.x > prev.x;
      const wentLeft = curr.x < prev.x;
      const nextGoesLeft = next.x < curr.x;
      const nextGoesRight = next.x > curr.x;

      // If we went RIGHT past the target, and next goes back LEFT toward target - skip curr
      if (wentRight && nextGoesLeft && curr.x > targetPos.x) {
        continue;
      }
      // If we went LEFT past the target, and next goes back RIGHT toward target - skip curr
      if (wentLeft && nextGoesRight && curr.x < targetPos.x) {
        continue;
      }
    }

    result.push(curr);
  }

  result.push(points[points.length - 1]);
  return result;
}

export function avoidObstacles(sourcePos, targetPos, waypoints, obstacles, padding, sourcePort = null) {
  // Guard against null/undefined inputs
  if (!sourcePos || !targetPos ||
      typeof sourcePos.x !== 'number' || typeof sourcePos.y !== 'number' ||
      typeof targetPos.x !== 'number' || typeof targetPos.y !== 'number') {
    return waypoints || [];
  }
  if (!Array.isArray(obstacles) || obstacles.length === 0) return waypoints || [];

  let currentPoints = [sourcePos, ...(waypoints || []), targetPos];
  const maxIterations = 10; // Prevent infinite loops

  // Debug logging
  const DEBUG = typeof window !== 'undefined' && window.DEBUG_ROUTING;
  if (DEBUG) {
    console.log('[avoidObstacles] Starting with:', {
      sourcePos, targetPos,
      waypoints: waypoints.length,
      obstacles: obstacles.length,
      sourcePort,
      currentPoints: JSON.stringify(currentPoints)
    });
  }

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const intersection = findFirstIntersection(currentPoints, obstacles, padding);

    if (!intersection) {
      // No more intersections - clean up backtracking and extract waypoints
      const cleanedPoints = removeBacktracking(currentPoints, targetPos);
      if (DEBUG) console.log('[avoidObstacles] No intersection found, returning:', cleanedPoints.slice(1, -1));
      return cleanedPoints.slice(1, -1);
    }

    const { obstacle, segmentIndex } = intersection;
    const p1 = currentPoints[segmentIndex];
    const p2 = currentPoints[segmentIndex + 1];

    if (DEBUG) {
      console.log(`[avoidObstacles] Iteration ${iteration}: Found intersection at segment ${segmentIndex}`, {
        p1, p2,
        obstacle: { x: obstacle.x, y: obstacle.y, w: obstacle.width, h: obstacle.height }
      });
    }

    // Try routing around the obstacle - pass sourcePort and sourcePos for smarter routing decisions
    const detourPoints = routeAroundObstacle(p1, p2, obstacle, padding, iteration % 2 === 1, targetPos, sourcePort, sourcePos);

    if (DEBUG) {
      console.log('[avoidObstacles] Detour points:', detourPoints);
    }

    // Insert detour points into the path
    currentPoints = [
      ...currentPoints.slice(0, segmentIndex + 1),
      ...detourPoints,
      ...currentPoints.slice(segmentIndex + 1)
    ];

    if (DEBUG) {
      console.log('[avoidObstacles] New path:', JSON.stringify(currentPoints));
    }
  }

  // Return best effort after max iterations - clean up backtracking
  const cleanedPoints = removeBacktracking(currentPoints, targetPos);
  return cleanedPoints.slice(1, -1);
}

/**
 * Calculate orthogonal waypoints based on port directions
 * IMPORTANT: Always ensures perpendicular entry/exit segments at both ends
 * @param {{ x: number, y: number }} sourcePos
 * @param {{ x: number, y: number }} targetPos
 * @param {string} sourcePort
 * @param {string} targetPort
 * @returns {{ x: number, y: number }[]}
 */
export function calculateOrthogonalWaypoints(sourcePos, targetPos, sourcePort, targetPort) {
  // Guard against null/undefined positions
  if (!sourcePos || !targetPos ||
      typeof sourcePos.x !== 'number' || typeof sourcePos.y !== 'number' ||
      typeof targetPos.x !== 'number' || typeof targetPos.y !== 'number') {
    return [];
  }

  const sourceDir = getPortDirection(sourcePort || 'right');
  const targetDir = getPortDirection(targetPort || 'left');

  // Exit point: MIN_OFFSET distance perpendicular from source port
  const exitX = sourcePos.x + sourceDir.x * MIN_OFFSET;
  const exitY = sourcePos.y + sourceDir.y * MIN_OFFSET;
  // Entry point: MIN_OFFSET distance perpendicular from target port
  const entryX = targetPos.x + targetDir.x * MIN_OFFSET;
  const entryY = targetPos.y + targetDir.y * MIN_OFFSET;

  let waypoints = [];

  // Same side ports - need to route around
  if (sourcePort === 'bottom' && targetPort === 'bottom') {
    const midY = Math.max(exitY, entryY) + MIN_OFFSET;
    waypoints = [
      { x: sourcePos.x, y: exitY },
      { x: sourcePos.x, y: midY },
      { x: targetPos.x, y: midY },
      { x: targetPos.x, y: entryY },
    ];
  } else if (sourcePort === 'top' && targetPort === 'top') {
    const midY = Math.min(exitY, entryY) - MIN_OFFSET;
    waypoints = [
      { x: sourcePos.x, y: exitY },
      { x: sourcePos.x, y: midY },
      { x: targetPos.x, y: midY },
      { x: targetPos.x, y: entryY },
    ];
  } else if (sourcePort === 'right' && targetPort === 'right') {
    const midX = Math.max(exitX, entryX) + MIN_OFFSET;
    waypoints = [
      { x: exitX, y: sourcePos.y },
      { x: midX, y: sourcePos.y },
      { x: midX, y: targetPos.y },
      { x: entryX, y: targetPos.y },
    ];
  } else if (sourcePort === 'left' && targetPort === 'left') {
    const midX = Math.min(exitX, entryX) - MIN_OFFSET;
    waypoints = [
      { x: exitX, y: sourcePos.y },
      { x: midX, y: sourcePos.y },
      { x: midX, y: targetPos.y },
      { x: entryX, y: targetPos.y },
    ];
  }
  // Opposite ports (top↔bottom, left↔right)
  else if (sourcePort === 'bottom' && targetPort === 'top') {
    if (exitY < entryY) {
      // Normal case: source above target - simple S-curve with perpendicular segments
      const midY = (exitY + entryY) / 2;
      waypoints = [
        { x: sourcePos.x, y: exitY },  // Exit perpendicular
        { x: sourcePos.x, y: midY },
        { x: targetPos.x, y: midY },
        { x: targetPos.x, y: entryY }, // Entry perpendicular
      ];
    } else {
      // Source below target - route around
      const routeY = Math.min(exitY, entryY) - MIN_OFFSET;
      waypoints = [
        { x: sourcePos.x, y: exitY },
        { x: sourcePos.x, y: routeY },
        { x: targetPos.x, y: routeY },
        { x: targetPos.x, y: entryY },
      ];
    }
  } else if (sourcePort === 'top' && targetPort === 'bottom') {
    if (exitY > entryY) {
      // Normal case: source below target
      const midY = (exitY + entryY) / 2;
      waypoints = [
        { x: sourcePos.x, y: exitY },
        { x: sourcePos.x, y: midY },
        { x: targetPos.x, y: midY },
        { x: targetPos.x, y: entryY },
      ];
    } else {
      // Source above target - route around
      const routeY = Math.max(exitY, entryY) + MIN_OFFSET;
      waypoints = [
        { x: sourcePos.x, y: exitY },
        { x: sourcePos.x, y: routeY },
        { x: targetPos.x, y: routeY },
        { x: targetPos.x, y: entryY },
      ];
    }
  } else if (sourcePort === 'right' && targetPort === 'left') {
    if (exitX < entryX) {
      // Normal case: source left of target
      const midX = (exitX + entryX) / 2;
      waypoints = [
        { x: exitX, y: sourcePos.y },  // Exit perpendicular
        { x: midX, y: sourcePos.y },
        { x: midX, y: targetPos.y },
        { x: entryX, y: targetPos.y }, // Entry perpendicular
      ];
    } else {
      // Source right of target - route around
      const routeX = Math.min(exitX, entryX) - MIN_OFFSET;
      waypoints = [
        { x: exitX, y: sourcePos.y },
        { x: routeX, y: sourcePos.y },
        { x: routeX, y: targetPos.y },
        { x: entryX, y: targetPos.y },
      ];
    }
  } else if (sourcePort === 'left' && targetPort === 'right') {
    if (exitX > entryX) {
      // Normal case: source right of target
      const midX = (exitX + entryX) / 2;
      waypoints = [
        { x: exitX, y: sourcePos.y },
        { x: midX, y: sourcePos.y },
        { x: midX, y: targetPos.y },
        { x: entryX, y: targetPos.y },
      ];
    } else {
      // Source left of target - route around
      const routeX = Math.max(exitX, entryX) + MIN_OFFSET;
      waypoints = [
        { x: exitX, y: sourcePos.y },
        { x: routeX, y: sourcePos.y },
        { x: routeX, y: targetPos.y },
        { x: entryX, y: targetPos.y },
      ];
    }
  }
  // Perpendicular ports - L-shaped or Z-shaped routing with perpendicular entry/exit
  else if ((sourcePort === 'bottom' || sourcePort === 'top') &&
           (targetPort === 'left' || targetPort === 'right')) {
    // Source is vertical port, target is horizontal port
    // Check if simple L-shape would work, or if we need Z-shape
    const sourceExitsDown = sourcePort === 'bottom';
    const targetEntersFromLeft = targetPort === 'left';

    // Determine if we need to route around source stencil
    // If target is horizontally aligned with source Y level, the L may cross source
    const simpleL = sourceExitsDown
      ? (targetPos.y > sourcePos.y) // Target below when exiting down
      : (targetPos.y < sourcePos.y); // Target above when exiting up

    if (simpleL) {
      // Simple L-shape works
      waypoints = [
        { x: sourcePos.x, y: exitY },
        { x: sourcePos.x, y: targetPos.y },
        { x: entryX, y: targetPos.y },
      ];
    } else {
      // Need Z-shape to avoid crossing source
      // Go out from source, then horizontal to target's entry X, then to target's Y
      const midY = exitY;
      waypoints = [
        { x: sourcePos.x, y: exitY },
        { x: entryX, y: exitY },
        { x: entryX, y: targetPos.y },
      ];
    }
  } else if ((sourcePort === 'left' || sourcePort === 'right') &&
             (targetPort === 'bottom' || targetPort === 'top')) {
    // Source is horizontal port, target is vertical port
    // Check if simple L-shape would work, or if we need Z-shape
    const sourceExitsRight = sourcePort === 'right';
    const targetEntersFromTop = targetPort === 'top';

    // Determine if we need to route around source stencil
    const simpleL = sourceExitsRight
      ? (targetPos.x > sourcePos.x) // Target to right when exiting right
      : (targetPos.x < sourcePos.x); // Target to left when exiting left

    if (simpleL) {
      // Simple L-shape works
      waypoints = [
        { x: exitX, y: sourcePos.y },
        { x: targetPos.x, y: sourcePos.y },
        { x: targetPos.x, y: entryY },
      ];
    } else {
      // Need Z-shape to avoid crossing source
      // Go out from source, then vertical to target's entry Y, then to target's X
      waypoints = [
        { x: exitX, y: sourcePos.y },
        { x: exitX, y: entryY },
        { x: targetPos.x, y: entryY },
      ];
    }
  }
  // Fallback - always include perpendicular exit/entry
  else {
    const midX = (exitX + entryX) / 2;
    waypoints = [
      { x: exitX, y: sourcePos.y },
      { x: midX, y: sourcePos.y },
      { x: midX, y: targetPos.y },
      { x: entryX, y: targetPos.y },
    ];
  }

  // Clean up redundant waypoints
  return cleanupWaypoints(sourcePos, waypoints, targetPos);
}

/**
 * Build orthogonal path through user-defined waypoints
 * Ensures all segments are strictly horizontal or vertical
 * @param {{ x: number, y: number }} sourcePos
 * @param {{ x: number, y: number }} targetPos
 * @param {{ x: number, y: number }[]} waypoints
 * @param {string} sourcePort
 * @param {string} targetPort
 * @returns {{ x: number, y: number }[]}
 */
export function buildOrthogonalThroughWaypoints(sourcePos, targetPos, waypoints, sourcePort, targetPort) {
  // Guard against null/undefined positions
  if (!sourcePos || !targetPos ||
      typeof sourcePos.x !== 'number' || typeof sourcePos.y !== 'number' ||
      typeof targetPos.x !== 'number' || typeof targetPos.y !== 'number') {
    return [sourcePos, targetPos].filter(Boolean);
  }

  const points = [];

  // Get port directions for perpendicular stubs
  const sourceDir = getPortDirection(sourcePort || 'right');
  const targetDir = getPortDirection(targetPort || 'left');

  // Calculate perpendicular exit/entry points to ensure proper stubs
  const exitPoint = {
    x: sourcePos.x + sourceDir.x * MIN_OFFSET,
    y: sourcePos.y + sourceDir.y * MIN_OFFSET
  };
  const entryPoint = {
    x: targetPos.x + targetDir.x * MIN_OFFSET,
    y: targetPos.y + targetDir.y * MIN_OFFSET
  };

  // Only snap waypoints that are VERY close (floating point cleanup)
  const snappedWaypoints = (waypoints || []).map((wp, idx) => {
    const prev = idx === 0 ? sourcePos : waypoints[idx - 1];
    let snapped = { ...wp };

    if (Math.abs(wp.x - prev.x) <= WAYPOINT_SNAP_THRESHOLD) {
      snapped.x = prev.x;
    }
    if (Math.abs(wp.y - prev.y) <= WAYPOINT_SNAP_THRESHOLD) {
      snapped.y = prev.y;
    }

    return snapped;
  });

  // Include exit and entry points to ensure perpendicular stubs
  const allPoints = [sourcePos, exitPoint, ...snappedWaypoints, entryPoint, targetPos];

  // Add source point
  points.push(sourcePos);

  // Process each segment between consecutive points
  for (let i = 0; i < allPoints.length - 1; i++) {
    const from = allPoints[i];
    const to = allPoints[i + 1];

    // If points are already aligned, just add destination
    if (Math.abs(from.x - to.x) < 1) {
      points.push(to);
    } else if (Math.abs(from.y - to.y) < 1) {
      points.push(to);
    } else {
      // Need to add intermediate point for orthogonal routing
      let goHorizontalFirst;

      if (i === 0) {
        // First segment - use source port direction
        goHorizontalFirst = getPortAxis(sourcePort) === 'horizontal';
      } else if (i === allPoints.length - 2) {
        // Last segment - use target port direction (inverted)
        goHorizontalFirst = getPortAxis(targetPort) === 'vertical';
      } else {
        // Middle segment - prefer horizontal first if horizontal distance is greater
        goHorizontalFirst = Math.abs(to.x - from.x) > Math.abs(to.y - from.y);
      }

      if (goHorizontalFirst) {
        points.push({ x: to.x, y: from.y });
      } else {
        points.push({ x: from.x, y: to.y });
      }
      points.push(to);
    }
  }

  // Clean up: remove duplicate consecutive points
  const cleanedPoints = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = cleanedPoints[cleanedPoints.length - 1];
    const curr = points[i];
    if (Math.abs(prev.x - curr.x) > 1 || Math.abs(prev.y - curr.y) > 1) {
      cleanedPoints.push(curr);
    }
  }

  return cleanedPoints;
}

/**
 * Calculate segments for a set of orthogonal points
 * Used for rendering draggable segment handles
 * @param {{ x: number, y: number }[]} points
 * @returns {{ index: number, x1: number, y1: number, x2: number, y2: number, isHorizontal: boolean, midX: number, midY: number }[]}
 */
export function calculateSegments(points) {
  const segments = [];

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const isHorizontal = Math.abs(p2.y - p1.y) < 2;
    const isVertical = Math.abs(p2.x - p1.x) < 2;

    // Only add segments that are clearly horizontal or vertical
    if (isHorizontal || isVertical) {
      segments.push({
        index: i,
        x1: p1.x, y1: p1.y,
        x2: p2.x, y2: p2.y,
        isHorizontal,
        midX: (p1.x + p2.x) / 2,
        midY: (p1.y + p2.y) / 2,
      });
    }
  }

  return segments;
}

/**
 * Check if a straight line path intersects any obstacle
 */
function straightLineIntersectsObstacles(sourcePos, targetPos, obstacles, padding) {
  for (const obstacle of obstacles) {
    if (lineIntersectsRect(sourcePos.x, sourcePos.y, targetPos.x, targetPos.y, obstacle, padding)) {
      return true;
    }
  }
  return false;
}

/**
 * Build complete orthogonal path with optional obstacle avoidance
 * Per CLAUDE.md: Nodes are hard obstacles, connectors MUST route around with 8px minimum clearance
 * @param {{ x: number, y: number }} sourcePos
 * @param {{ x: number, y: number }} targetPos
 * @param {string} sourcePort
 * @param {string} targetPort
 * @param {{ sharp?: boolean, obstacles?: Array, waypoints?: Array }} options
 * @returns {{ path: string, points: Array, segments: Array }}
 */
/**
 * Ensure path approaches target from correct direction (perpendicular to port)
 * This fixes cases where obstacle avoidance creates paths that enter from wrong side
 */
function ensureCorrectApproach(points, sourcePos, targetPos, sourcePort, targetPort) {
  if (points.length < 2) return points;

  const sourceDir = getPortDirection(sourcePort);
  const targetDir = getPortDirection(targetPort);
  const result = [...points];

  // Check if first segment exits source correctly (both direction AND alignment)
  const firstPoint = result[1]; // First waypoint after source
  if (firstPoint) {
    const isHorizontalPort = sourcePort === 'left' || sourcePort === 'right';
    if (isHorizontalPort) {
      // Should exit horizontally (same Y as source) AND in correct direction
      const needsCorrection = Math.abs(firstPoint.y - sourcePos.y) > 0.5 ||
        // Also check direction: left port should go left, right should go right
        (sourceDir.x < 0 && firstPoint.x > sourcePos.x) || // Left port but going right
        (sourceDir.x > 0 && firstPoint.x < sourcePos.x);   // Right port but going left

      if (needsCorrection) {
        // Insert correct exit point in the port direction
        const exitPoint = { x: sourcePos.x + sourceDir.x * MIN_OFFSET, y: sourcePos.y };
        result.splice(1, 0, exitPoint);
      }
    } else {
      // Should exit vertically (same X as source) AND in correct direction
      const needsCorrection = Math.abs(firstPoint.x - sourcePos.x) > 0.5 ||
        // Also check direction: top port should go up, bottom should go down
        (sourceDir.y < 0 && firstPoint.y > sourcePos.y) || // Top port but going down
        (sourceDir.y > 0 && firstPoint.y < sourcePos.y);   // Bottom port but going up

      if (needsCorrection) {
        // Insert correct exit point in the port direction
        const exitPoint = { x: sourcePos.x, y: sourcePos.y + sourceDir.y * MIN_OFFSET };
        result.splice(1, 0, exitPoint);
      }
    }
  }

  // Check if last segment enters target correctly (both direction AND alignment)
  const lastWaypoint = result[result.length - 2]; // Last waypoint before target
  if (lastWaypoint) {
    const isHorizontalPort = targetPort === 'left' || targetPort === 'right';
    if (isHorizontalPort) {
      // Should enter horizontally (same Y as target) AND from correct direction
      const needsCorrection = Math.abs(lastWaypoint.y - targetPos.y) > 0.5 ||
        // Also check direction: left port means approach from left, right from right
        (targetDir.x < 0 && lastWaypoint.x < targetPos.x) || // Left port but coming from right
        (targetDir.x > 0 && lastWaypoint.x > targetPos.x);   // Right port but coming from left

      if (needsCorrection) {
        // Insert correct entry point
        const entryPoint = { x: targetPos.x + targetDir.x * MIN_OFFSET, y: targetPos.y };
        result.splice(result.length - 1, 0, entryPoint);
      }
    } else {
      // Should enter vertically (same X as target) AND from correct direction
      const needsCorrection = Math.abs(lastWaypoint.x - targetPos.x) > 0.5 ||
        // Also check direction: top port means approach from above, bottom from below
        (targetDir.y < 0 && lastWaypoint.y < targetPos.y) || // Top port but coming from below
        (targetDir.y > 0 && lastWaypoint.y > targetPos.y);   // Bottom port but coming from above

      if (needsCorrection) {
        // Insert correct entry point
        const entryPoint = { x: targetPos.x, y: targetPos.y + targetDir.y * MIN_OFFSET };
        result.splice(result.length - 1, 0, entryPoint);
      }
    }
  }

  return result;
}

/**
 * Check if a point is inside a rectangle (with padding)
 */
function pointInRect(point, rect, padding = 0) {
  if (!rect) return false;
  return point.x >= rect.x - padding &&
         point.x <= rect.x + rect.width + padding &&
         point.y >= rect.y - padding &&
         point.y <= rect.y + rect.height + padding;
}

/**
 * Check if a line segment crosses through a rectangle
 */
function segmentCrossesRect(p1, p2, rect, padding = 0) {
  if (!rect) return false;

  const left = rect.x - padding;
  const right = rect.x + rect.width + padding;
  const top = rect.y - padding;
  const bottom = rect.y + rect.height + padding;

  // Check if segment endpoints are both outside the rect on same side
  if ((p1.x < left && p2.x < left) || (p1.x > right && p2.x > right)) return false;
  if ((p1.y < top && p2.y < top) || (p1.y > bottom && p2.y > bottom)) return false;

  // Check if the segment passes through the rectangle's interior
  // For orthogonal segments, this is simpler
  const isHorizontal = Math.abs(p1.y - p2.y) < 1;
  const isVertical = Math.abs(p1.x - p2.x) < 1;

  if (isHorizontal) {
    // Horizontal segment - check if Y is inside rect and X range overlaps
    const y = p1.y;
    const minX = Math.min(p1.x, p2.x);
    const maxX = Math.max(p1.x, p2.x);
    if (y > top && y < bottom && maxX > left && minX < right) {
      return true;
    }
  } else if (isVertical) {
    // Vertical segment - check if X is inside rect and Y range overlaps
    const x = p1.x;
    const minY = Math.min(p1.y, p2.y);
    const maxY = Math.max(p1.y, p2.y);
    if (x > left && x < right && maxY > top && minY < bottom) {
      return true;
    }
  }

  return false;
}

export function buildOrthogonalPath(sourcePos, targetPos, sourcePort, targetPort, options = {}) {
  // Guard against null/undefined positions
  if (!sourcePos || !targetPos ||
      typeof sourcePos.x !== 'number' || typeof sourcePos.y !== 'number' ||
      typeof targetPos.x !== 'number' || typeof targetPos.y !== 'number') {
    return { path: '', points: [], segments: [] };
  }

  const { sharp = false, obstacles = [], waypoints = [], sourceBounds = null, targetBounds = null } = options || {};
  const cornerRadius = sharp ? 0 : 12; // Increased for more visible rounded corners
  const selfPadding = 15; // Padding to keep path at least 15px outside stencil bounds

  // Check for snap-to-straight (only if path won't cross through stencils)
  const dy = Math.abs(targetPos.y - sourcePos.y);
  const dx = Math.abs(targetPos.x - sourcePos.x);

  // Only snap to straight if ports face each other correctly
  const horizontalPorts = (sourcePort === 'right' && targetPort === 'left') ||
                          (sourcePort === 'left' && targetPort === 'right');
  const verticalPorts = (sourcePort === 'bottom' && targetPort === 'top') ||
                        (sourcePort === 'top' && targetPort === 'bottom');

  // Check for free-point connection (no elements attached)
  const isFreePointConnection = !sourceBounds && !targetBounds;

  // Get port directions for perpendicular stubs
  const sourceDir = getPortDirection(sourcePort || 'right');
  const targetDir = getPortDirection(targetPort || 'left');
  const MIN_STUB = 30; // Minimum perpendicular stub length (visible line extending from stencil)

  // Skip snap-to-straight if user has defined waypoints (manual breakpoints)
  const hasManualWaypoints = waypoints.length > 0;

  // For free-point connections: snap to simple straight line when nearly aligned
  if (!hasManualWaypoints && isFreePointConnection) {
    // Nearly horizontal - just draw a straight horizontal line
    if (dy <= SNAP_TO_STRAIGHT_THRESHOLD && dx > dy * 2) {
      const midY = sourcePos.y; // Use source Y for horizontal snap
      const points = [sourcePos, { x: targetPos.x, y: midY }];
      const path = `M ${sourcePos.x} ${sourcePos.y} L ${targetPos.x} ${midY}`;
      return { path, points, segments: calculateSegments(points) };
    }
    // Nearly vertical - just draw a straight vertical line
    if (dx <= SNAP_TO_STRAIGHT_THRESHOLD && dy > dx * 2) {
      const midX = sourcePos.x; // Use source X for vertical snap
      const points = [sourcePos, { x: midX, y: targetPos.y }];
      const path = `M ${sourcePos.x} ${sourcePos.y} L ${midX} ${targetPos.y}`;
      return { path, points, segments: calculateSegments(points) };
    }
  }

  // Nearly horizontal - snap to straight (if ports align, no waypoints, and path doesn't cross stencils)
  if (!hasManualWaypoints && dy <= SNAP_TO_STRAIGHT_THRESHOLD && dx > dy && horizontalPorts) {
    // Create path with perpendicular stubs at both ends
    const exitPoint = { x: sourcePos.x + sourceDir.x * MIN_STUB, y: sourcePos.y };
    const entryPoint = { x: targetPos.x + targetDir.x * MIN_STUB, y: targetPos.y };

    // Check if straight line would cross through source or target stencil
    const crossesSource = segmentCrossesRect(exitPoint, entryPoint, sourceBounds, selfPadding);
    const crossesTarget = segmentCrossesRect(exitPoint, entryPoint, targetBounds, selfPadding);

    if (!crossesSource && !crossesTarget) {
      // Use midpoint Y for the horizontal segment
      const midY = (sourcePos.y + targetPos.y) / 2;
      const points = [
        sourcePos,
        { x: exitPoint.x, y: sourcePos.y },
        { x: exitPoint.x, y: midY },
        { x: entryPoint.x, y: midY },
        { x: entryPoint.x, y: targetPos.y },
        targetPos
      ];
      const path = buildRoundedPath(points, cornerRadius);
      return { path, points, segments: calculateSegments(points) };
    }
    // Fall through to orthogonal routing if straight line crosses stencils
  }

  // Nearly vertical - snap to straight (if ports align, no waypoints, and path doesn't cross stencils)
  if (!hasManualWaypoints && dx <= SNAP_TO_STRAIGHT_THRESHOLD && dy > dx && verticalPorts) {
    // Create path with perpendicular stubs at both ends
    const exitPoint = { x: sourcePos.x, y: sourcePos.y + sourceDir.y * MIN_STUB };
    const entryPoint = { x: targetPos.x, y: targetPos.y + targetDir.y * MIN_STUB };

    // Check if straight line would cross through source or target stencil
    const crossesSource = segmentCrossesRect(exitPoint, entryPoint, sourceBounds, selfPadding);
    const crossesTarget = segmentCrossesRect(exitPoint, entryPoint, targetBounds, selfPadding);

    if (!crossesSource && !crossesTarget) {
      // Use midpoint X for the vertical segment
      const midX = (sourcePos.x + targetPos.x) / 2;
      const points = [
        sourcePos,
        { x: sourcePos.x, y: exitPoint.y },
        { x: midX, y: exitPoint.y },
        { x: midX, y: entryPoint.y },
        { x: targetPos.x, y: entryPoint.y },
        targetPos
      ];
      const path = buildRoundedPath(points, cornerRadius);
      return { path, points, segments: calculateSegments(points) };
    }
    // Fall through to orthogonal routing if straight line crosses stencils
  }

  let allPoints;

  if (waypoints.length > 0) {
    // User has defined waypoints - use them directly
    // Users manually route around obstacles by dragging segments
    allPoints = buildOrthogonalThroughWaypoints(sourcePos, targetPos, waypoints, sourcePort, targetPort);
  } else {
    // Calculate initial waypoints based on port directions (4 routing cases)
    const calculatedWaypoints = calculateOrthogonalWaypoints(sourcePos, targetPos, sourcePort, targetPort);
    allPoints = [sourcePos, ...calculatedWaypoints, targetPos];
  }

  // Ensure path approaches source/target from correct direction (perpendicular)
  allPoints = ensureCorrectApproach(allPoints, sourcePos, targetPos, sourcePort, targetPort);

  // Remove any direction reversal artifacts (e.g., UP-then-DOWN at start)
  allPoints = removeReversals(allPoints);

  // Ensure path doesn't cross through source or target stencils
  allPoints = routeAroundSelfStencils(allPoints, sourceBounds, targetBounds, sourcePort, targetPort, selfPadding);

  // Route around other stencils on the canvas (obstacles)
  // Per CLAUDE.md: Nodes are hard obstacles, connectors MUST route around with 8px minimum clearance
  if (obstacles.length > 0) {
    // Extract waypoints from allPoints (exclude source and target)
    const currentWaypoints = allPoints.slice(1, -1);
    // Pass sourcePort for smarter routing decisions with non-center connections
    const routedWaypoints = avoidObstacles(sourcePos, targetPos, currentWaypoints, obstacles, 8, sourcePort);
    allPoints = [sourcePos, ...routedWaypoints, targetPos];

    // Re-ensure correct approach after obstacle avoidance (may have altered entry/exit)
    allPoints = ensureCorrectApproach(allPoints, sourcePos, targetPos, sourcePort, targetPort);
  }

  const path = buildRoundedPath(allPoints, cornerRadius);
  const segments = calculateSegments(allPoints);

  return { path, points: allPoints, segments };
}

/**
 * Adjust path to route around source and target stencils
 * The connection should never pass through its own endpoints
 */
function routeAroundSelfStencils(points, sourceBounds, targetBounds, sourcePort, targetPort, padding) {
  if (points.length < 2) return points;
  if (!sourceBounds && !targetBounds) return points;

  const result = [...points];

  // Check each segment and adjust if it crosses through a stencil
  for (let i = 0; i < result.length - 1; i++) {
    const p1 = result[i];
    const p2 = result[i + 1];

    const isFirstSegment = i === 0;
    const isLastSegment = i === result.length - 2;

    // First segment (source to exit point) can touch source but not target
    // Last segment (entry point to target) can touch target but not source
    // Middle segments should not cross either stencil

    // Check if segment crosses source stencil
    // Skip check for first segment (it's supposed to touch source)
    if (!isFirstSegment && sourceBounds && segmentCrossesRect(p1, p2, sourceBounds, padding)) {
      // Route around the source stencil
      const adjusted = adjustSegmentAroundRect(p1, p2, sourceBounds, padding);
      if (adjusted) {
        result.splice(i, 2, p1, ...adjusted, p2);
        i += adjusted.length;
        continue; // Re-evaluate from current position
      }
    }

    // Check if segment crosses target stencil
    // Skip check for last segment (it's supposed to touch target)
    if (!isLastSegment && targetBounds && segmentCrossesRect(p1, p2, targetBounds, padding)) {
      // Route around the target stencil
      const adjusted = adjustSegmentAroundRect(p1, p2, targetBounds, padding);
      if (adjusted) {
        result.splice(i, 2, p1, ...adjusted, p2);
        i += adjusted.length;
      }
    }
  }

  return result;
}

/**
 * Create waypoints to route a segment around a rectangle
 */
function adjustSegmentAroundRect(p1, p2, rect, padding) {
  const isHorizontal = Math.abs(p1.y - p2.y) < 1;

  const left = rect.x - padding;
  const right = rect.x + rect.width + padding;
  const top = rect.y - padding;
  const bottom = rect.y + rect.height + padding;

  if (isHorizontal) {
    // Horizontal segment crossing rect - go above or below
    const y = p1.y;
    const rectCenterY = rect.y + rect.height / 2;

    // Choose direction that's closer (above or below)
    if (y <= rectCenterY) {
      // Route above
      return [
        { x: p1.x, y: top },
        { x: p2.x, y: top }
      ];
    } else {
      // Route below
      return [
        { x: p1.x, y: bottom },
        { x: p2.x, y: bottom }
      ];
    }
  } else {
    // Vertical segment crossing rect - go left or right
    const x = p1.x;
    const rectCenterX = rect.x + rect.width / 2;

    // Choose direction that's closer (left or right)
    if (x <= rectCenterX) {
      // Route left
      return [
        { x: left, y: p1.y },
        { x: left, y: p2.y }
      ];
    } else {
      // Route right
      return [
        { x: right, y: p1.y },
        { x: right, y: p2.y }
      ];
    }
  }
}
