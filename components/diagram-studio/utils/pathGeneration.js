// components/diagram-studio/utils/pathGeneration.js
// SVG path generation utilities for connections

import { getPortDirection, lineIntersectsRect, SNAP_TO_STRAIGHT_THRESHOLD } from './geometry';

/**
 * Generate connection path based on line style
 */
export function getConnectionPath(sourcePos, targetPos, sourcePort, targetPort, lineStyle = 'curved', obstacles = [], curveAmount = null) {
  const dx = targetPos.x - sourcePos.x;
  const dy = targetPos.y - sourcePos.y;

  // Straight line
  if (lineStyle === 'straight') {
    return `M ${sourcePos.x} ${sourcePos.y} L ${targetPos.x} ${targetPos.y}`;
  }

  // Arc line - use curveAmount for draggable arc, otherwise default arc
  if (lineStyle === 'arc') {
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
    const dist = Math.sqrt(dx * dx + dy * dy);
    const arcRadius = dist * 0.5;
    return `M ${sourcePos.x} ${sourcePos.y} A ${arcRadius} ${arcRadius} 0 0 1 ${targetPos.x} ${targetPos.y}`;
  }

  // Smart routing - uses A* pathfinding with obstacle avoidance
  if (lineStyle === 'smart') {
    return getSmartPath(sourcePos, targetPos, sourcePort, targetPort, obstacles);
  }

  // Step line (orthogonal/right-angle)
  if (lineStyle === 'step' || lineStyle === 'step-sharp') {
    return getOrthogonalPath(sourcePos, targetPos, sourcePort, targetPort, obstacles, lineStyle);
  }

  // Curved (default)
  return getCurvedPath(sourcePos, targetPos, sourcePort, targetPort, curveAmount);
}

/**
 * Smart path using collision-aware routing
 */
export function getSmartPath(sourcePos, targetPos, sourcePort, targetPort, obstacles = []) {
  if (obstacles.length === 0) {
    return getCurvedPath(sourcePos, targetPos, sourcePort, targetPort);
  }

  // Check if straight line intersects any obstacle
  let hasCollision = false;
  for (const obs of obstacles) {
    if (lineIntersectsRect(sourcePos.x, sourcePos.y, targetPos.x, targetPos.y, obs, 15)) {
      hasCollision = true;
      break;
    }
  }

  if (!hasCollision) {
    return getCurvedPath(sourcePos, targetPos, sourcePort, targetPort);
  }

  return getOrthogonalPath(sourcePos, targetPos, sourcePort, targetPort, obstacles);
}

/**
 * Smart curved routing using cubic bezier
 */
export function getCurvedPath(sourcePos, targetPos, sourcePort, targetPort, curveAmount = null) {
  // If curveAmount is provided, use simple quadratic bezier with perpendicular offset
  if (curveAmount !== null) {
    const dx = targetPos.x - sourcePos.x;
    const dy = targetPos.y - sourcePos.y;
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
  const dx = targetPos.x - sourcePos.x;
  const dy = targetPos.y - sourcePos.y;
  const offset = Math.min(80, Math.abs(dx) / 2, Math.abs(dy) / 2) || 40;

  const sourceDir = getPortDirection(sourcePort);
  const targetDir = getPortDirection(targetPort);

  const cp1x = sourcePos.x + sourceDir.x * offset;
  const cp1y = sourcePos.y + sourceDir.y * offset;
  const cp2x = targetPos.x + targetDir.x * offset;
  const cp2y = targetPos.y + targetDir.y * offset;

  return `M ${sourcePos.x} ${sourcePos.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${targetPos.x} ${targetPos.y}`;
}

/**
 * Smart orthogonal routing that respects port directions
 */
export function getOrthogonalPath(sourcePos, targetPos, sourcePort, targetPort, obstacles = [], lineStyle = 'step') {
  const minOffset = 25;
  const padding = 20;

  const dy = Math.abs(targetPos.y - sourcePos.y);
  const dx = Math.abs(targetPos.x - sourcePos.x);

  // Snap-to-straight: If endpoints are nearly aligned, make a straight line
  if (dy <= SNAP_TO_STRAIGHT_THRESHOLD && dx > dy) {
    const snapY = (sourcePos.y + targetPos.y) / 2;
    return `M ${sourcePos.x} ${snapY} L ${targetPos.x} ${snapY}`;
  }

  if (dx <= SNAP_TO_STRAIGHT_THRESHOLD && dy > dx) {
    const snapX = (sourcePos.x + targetPos.x) / 2;
    return `M ${snapX} ${sourcePos.y} L ${snapX} ${targetPos.y}`;
  }

  const sourceDir = getPortDirection(sourcePort);
  const targetDir = getPortDirection(targetPort);

  const exitX = sourcePos.x + sourceDir.x * minOffset;
  const exitY = sourcePos.y + sourceDir.y * minOffset;
  const entryX = targetPos.x + targetDir.x * minOffset;
  const entryY = targetPos.y + targetDir.y * minOffset;

  let waypoints = [];

  // Same side ports - need to route around
  if (sourcePort === 'bottom' && targetPort === 'bottom') {
    const midY = Math.max(sourcePos.y, targetPos.y) + minOffset * 2;
    waypoints = [
      { x: sourcePos.x, y: exitY },
      { x: sourcePos.x, y: midY },
      { x: targetPos.x, y: midY },
      { x: targetPos.x, y: entryY },
    ];
  } else if (sourcePort === 'top' && targetPort === 'top') {
    const midY = Math.min(sourcePos.y, targetPos.y) - minOffset * 2;
    waypoints = [
      { x: sourcePos.x, y: exitY },
      { x: sourcePos.x, y: midY },
      { x: targetPos.x, y: midY },
      { x: targetPos.x, y: entryY },
    ];
  } else if (sourcePort === 'right' && targetPort === 'right') {
    const midX = Math.max(sourcePos.x, targetPos.x) + minOffset * 2;
    waypoints = [
      { x: exitX, y: sourcePos.y },
      { x: midX, y: sourcePos.y },
      { x: midX, y: targetPos.y },
      { x: entryX, y: targetPos.y },
    ];
  } else if (sourcePort === 'left' && targetPort === 'left') {
    const midX = Math.min(sourcePos.x, targetPos.x) - minOffset * 2;
    waypoints = [
      { x: exitX, y: sourcePos.y },
      { x: midX, y: sourcePos.y },
      { x: midX, y: targetPos.y },
      { x: entryX, y: targetPos.y },
    ];
  }
  // Opposite ports
  else if (sourcePort === 'bottom' && targetPort === 'top') {
    if (sourcePos.y < targetPos.y) {
      const midY = (sourcePos.y + targetPos.y) / 2;
      waypoints = [
        { x: sourcePos.x, y: midY },
        { x: targetPos.x, y: midY },
      ];
    } else {
      const routeY = Math.min(sourcePos.y, targetPos.y) - minOffset * 2;
      waypoints = [
        { x: sourcePos.x, y: exitY },
        { x: sourcePos.x, y: routeY },
        { x: targetPos.x, y: routeY },
        { x: targetPos.x, y: entryY },
      ];
    }
  } else if (sourcePort === 'top' && targetPort === 'bottom') {
    if (sourcePos.y > targetPos.y) {
      const midY = (sourcePos.y + targetPos.y) / 2;
      waypoints = [
        { x: sourcePos.x, y: midY },
        { x: targetPos.x, y: midY },
      ];
    } else {
      const routeY = Math.max(sourcePos.y, targetPos.y) + minOffset * 2;
      waypoints = [
        { x: sourcePos.x, y: exitY },
        { x: sourcePos.x, y: routeY },
        { x: targetPos.x, y: routeY },
        { x: targetPos.x, y: entryY },
      ];
    }
  } else if (sourcePort === 'right' && targetPort === 'left') {
    if (sourcePos.x < targetPos.x) {
      const midX = (sourcePos.x + targetPos.x) / 2;
      waypoints = [
        { x: midX, y: sourcePos.y },
        { x: midX, y: targetPos.y },
      ];
    } else {
      const routeX = Math.min(sourcePos.x, targetPos.x) - minOffset * 2;
      waypoints = [
        { x: exitX, y: sourcePos.y },
        { x: routeX, y: sourcePos.y },
        { x: routeX, y: targetPos.y },
        { x: entryX, y: targetPos.y },
      ];
    }
  } else if (sourcePort === 'left' && targetPort === 'right') {
    if (sourcePos.x > targetPos.x) {
      const midX = (sourcePos.x + targetPos.x) / 2;
      waypoints = [
        { x: midX, y: sourcePos.y },
        { x: midX, y: targetPos.y },
      ];
    } else {
      const routeX = Math.max(sourcePos.x, targetPos.x) + minOffset * 2;
      waypoints = [
        { x: exitX, y: sourcePos.y },
        { x: routeX, y: sourcePos.y },
        { x: routeX, y: targetPos.y },
        { x: entryX, y: targetPos.y },
      ];
    }
  }
  // Perpendicular ports - L-shaped routing
  else if ((sourcePort === 'bottom' || sourcePort === 'top') &&
           (targetPort === 'left' || targetPort === 'right')) {
    waypoints = [
      { x: sourcePos.x, y: exitY },
      { x: sourcePos.x, y: targetPos.y },
      { x: entryX, y: targetPos.y },
    ];
  } else if ((sourcePort === 'left' || sourcePort === 'right') &&
             (targetPort === 'bottom' || targetPort === 'top')) {
    waypoints = [
      { x: exitX, y: sourcePos.y },
      { x: targetPos.x, y: sourcePos.y },
      { x: targetPos.x, y: entryY },
    ];
  }
  // Fallback
  else {
    const midX = (sourcePos.x + targetPos.x) / 2;
    waypoints = [
      { x: exitX, y: sourcePos.y },
      { x: midX, y: sourcePos.y },
      { x: midX, y: targetPos.y },
      { x: entryX, y: targetPos.y },
    ];
  }

  waypoints = cleanupWaypoints(sourcePos, waypoints, targetPos);

  if (obstacles.length > 0) {
    waypoints = avoidObstacles(sourcePos, targetPos, waypoints, obstacles, padding);
  }

  return buildRoundedPath(sourcePos, waypoints, targetPos, lineStyle);
}

/**
 * Build path string with rounded corners
 */
function buildRoundedPath(sourcePos, waypoints, targetPos, lineStyle) {
  const cornerRadius = lineStyle === 'step-sharp' ? 0 : 8;
  const allPoints = [sourcePos, ...waypoints, targetPos];

  if (allPoints.length <= 2) {
    return `M ${sourcePos.x} ${sourcePos.y} L ${targetPos.x} ${targetPos.y}`;
  }

  let path = `M ${allPoints[0].x} ${allPoints[0].y}`;

  for (let i = 1; i < allPoints.length - 1; i++) {
    const prev = allPoints[i - 1];
    const curr = allPoints[i];
    const next = allPoints[i + 1];

    const d1x = curr.x - prev.x;
    const d1y = curr.y - prev.y;
    const d2x = next.x - curr.x;
    const d2y = next.y - curr.y;

    const len1 = Math.sqrt(d1x * d1x + d1y * d1y);
    const len2 = Math.sqrt(d2x * d2x + d2y * d2y);

    const maxRadius = Math.min(cornerRadius, len1 / 2, len2 / 2);

    if (maxRadius <= 1) {
      path += ` L ${curr.x} ${curr.y}`;
    } else {
      const n1x = d1x / len1;
      const n1y = d1y / len1;
      const n2x = d2x / len2;
      const n2y = d2y / len2;

      const beforeX = curr.x - n1x * maxRadius;
      const beforeY = curr.y - n1y * maxRadius;
      const afterX = curr.x + n2x * maxRadius;
      const afterY = curr.y + n2y * maxRadius;

      path += ` L ${beforeX} ${beforeY}`;
      path += ` Q ${curr.x} ${curr.y} ${afterX} ${afterY}`;
    }
  }

  path += ` L ${allPoints[allPoints.length - 1].x} ${allPoints[allPoints.length - 1].y}`;

  return path;
}

/**
 * Clean up redundant waypoints (remove collinear points)
 */
export function cleanupWaypoints(sourcePos, waypoints, targetPos) {
  if (waypoints.length === 0) return waypoints;

  const allPoints = [sourcePos, ...waypoints, targetPos];
  const cleaned = [];

  for (let i = 1; i < allPoints.length - 1; i++) {
    const prev = allPoints[i - 1];
    const curr = allPoints[i];
    const next = allPoints[i + 1];

    const sameX = Math.abs(prev.x - curr.x) < 1 && Math.abs(curr.x - next.x) < 1;
    const sameY = Math.abs(prev.y - curr.y) < 1 && Math.abs(curr.y - next.y) < 1;

    if (!sameX && !sameY) {
      cleaned.push(curr);
    } else if (!sameX || !sameY) {
      cleaned.push(curr);
    }
  }

  return cleaned;
}

/**
 * Avoid obstacles by adjusting waypoints
 */
export function avoidObstacles(sourcePos, targetPos, waypoints, obstacles, padding) {
  const allPoints = [sourcePos, ...waypoints, targetPos];
  const result = [];

  for (let i = 0; i < allPoints.length - 1; i++) {
    const p1 = allPoints[i];
    const p2 = allPoints[i + 1];

    let intersectingObstacle = null;
    for (const obstacle of obstacles) {
      if (lineIntersectsRect(p1.x, p1.y, p2.x, p2.y, obstacle, padding)) {
        intersectingObstacle = obstacle;
        break;
      }
    }

    if (i > 0) {
      result.push(p1);
    }

    if (intersectingObstacle) {
      const obs = intersectingObstacle;
      const obsCenterX = obs.x + obs.width / 2;
      const obsCenterY = obs.y + obs.height / 2;

      const goLeft = p1.x < obsCenterX && p2.x < obsCenterX;
      const goRight = p1.x > obsCenterX && p2.x > obsCenterX;
      const goTop = p1.y < obsCenterY && p2.y < obsCenterY;
      const goBottom = p1.y > obsCenterY && p2.y > obsCenterY;

      if (Math.abs(p2.x - p1.x) > Math.abs(p2.y - p1.y)) {
        const routeY = goTop ? obs.y - padding - 10 :
                       goBottom ? obs.y + obs.height + padding + 10 :
                       (p1.y < obsCenterY ? obs.y - padding - 10 : obs.y + obs.height + padding + 10);
        result.push({ x: p1.x, y: routeY });
        result.push({ x: p2.x, y: routeY });
      } else {
        const routeX = goLeft ? obs.x - padding - 10 :
                       goRight ? obs.x + obs.width + padding + 10 :
                       (p1.x < obsCenterX ? obs.x - padding - 10 : obs.x + obs.width + padding + 10);
        result.push({ x: routeX, y: p1.y });
        result.push({ x: routeX, y: p2.y });
      }
    }
  }

  return result;
}

/**
 * Insert a waypoint in the correct sorted position along the path
 */
export function insertWaypointSorted(existingWaypoints, newWaypoint, sourcePos, targetPos) {
  if (!existingWaypoints || existingWaypoints.length === 0) {
    return [newWaypoint];
  }

  const distFromSource = (pt) => {
    const dx = pt.x - sourcePos.x;
    const dy = pt.y - sourcePos.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const newDist = distFromSource(newWaypoint);
  const waypointsWithDist = existingWaypoints.map((wp, idx) => ({
    wp,
    dist: distFromSource(wp),
    idx,
  }));

  let insertIdx = waypointsWithDist.length;
  for (let i = 0; i < waypointsWithDist.length; i++) {
    if (newDist < waypointsWithDist[i].dist) {
      insertIdx = i;
      break;
    }
  }

  const result = [...existingWaypoints];
  result.splice(insertIdx, 0, newWaypoint);
  return result;
}

/**
 * Get dash array for different patterns
 */
export function getDashArray(pattern, strokeWidth = 2) {
  switch (pattern) {
    case 'dashed': return `${strokeWidth * 4},${strokeWidth * 2}`;
    case 'dotted': return `${strokeWidth},${strokeWidth * 2}`;
    case 'dash-dot': return `${strokeWidth * 4},${strokeWidth * 2},${strokeWidth},${strokeWidth * 2}`;
    case 'solid':
    default: return undefined;
  }
}
