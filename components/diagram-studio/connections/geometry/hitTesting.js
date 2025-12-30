// components/diagram-studio/connections/geometry/hitTesting.js
// Functions for testing if points are on or near connection paths

/**
 * Calculate distance from a point to a line segment
 * @param {{ x: number, y: number }} point
 * @param {{ x: number, y: number }} lineStart
 * @param {{ x: number, y: number }} lineEnd
 * @returns {number}
 */
export function distanceToLineSegment(point, lineStart, lineEnd) {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    // Line segment is a point
    return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
  }

  // Calculate projection parameter
  const t = Math.max(0, Math.min(1, (
    (point.x - lineStart.x) * dx +
    (point.y - lineStart.y) * dy
  ) / lengthSquared));

  // Calculate closest point on segment
  const closestX = lineStart.x + t * dx;
  const closestY = lineStart.y + t * dy;

  return Math.hypot(point.x - closestX, point.y - closestY);
}

/**
 * Check if a point is near a straight line path
 * @param {{ x: number, y: number }} point
 * @param {{ x: number, y: number }[]} pathPoints
 * @param {number} tolerance
 * @returns {boolean}
 */
export function isPointNearPath(point, pathPoints, tolerance = 5) {
  for (let i = 0; i < pathPoints.length - 1; i++) {
    const distance = distanceToLineSegment(point, pathPoints[i], pathPoints[i + 1]);
    if (distance <= tolerance) {
      return true;
    }
  }
  return false;
}

/**
 * Find the nearest point on a path to a given point
 * @param {{ x: number, y: number }} point
 * @param {{ x: number, y: number }[]} pathPoints
 * @returns {{ x: number, y: number, segmentIndex: number, t: number }}
 */
export function nearestPointOnPath(point, pathPoints) {
  let minDistance = Infinity;
  let nearestPoint = pathPoints[0];
  let nearestSegmentIndex = 0;
  let nearestT = 0;

  for (let i = 0; i < pathPoints.length - 1; i++) {
    const lineStart = pathPoints[i];
    const lineEnd = pathPoints[i + 1];

    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const lengthSquared = dx * dx + dy * dy;

    let t = 0;
    if (lengthSquared > 0) {
      t = Math.max(0, Math.min(1, (
        (point.x - lineStart.x) * dx +
        (point.y - lineStart.y) * dy
      ) / lengthSquared));
    }

    const closestX = lineStart.x + t * dx;
    const closestY = lineStart.y + t * dy;
    const distance = Math.hypot(point.x - closestX, point.y - closestY);

    if (distance < minDistance) {
      minDistance = distance;
      nearestPoint = { x: closestX, y: closestY };
      nearestSegmentIndex = i;
      nearestT = t;
    }
  }

  return {
    ...nearestPoint,
    segmentIndex: nearestSegmentIndex,
    t: nearestT,
  };
}

/**
 * Check if a point is on an orthogonal segment
 * @param {{ x: number, y: number }} point
 * @param {{ x1: number, y1: number, x2: number, y2: number, isHorizontal: boolean }} segment
 * @param {number} tolerance
 * @returns {boolean}
 */
export function isPointOnSegment(point, segment, tolerance = 5) {
  if (segment.isHorizontal) {
    // Check Y is within tolerance
    if (Math.abs(point.y - segment.y1) > tolerance) return false;
    // Check X is within segment bounds
    const minX = Math.min(segment.x1, segment.x2);
    const maxX = Math.max(segment.x1, segment.x2);
    return point.x >= minX - tolerance && point.x <= maxX + tolerance;
  } else {
    // Vertical segment
    if (Math.abs(point.x - segment.x1) > tolerance) return false;
    const minY = Math.min(segment.y1, segment.y2);
    const maxY = Math.max(segment.y1, segment.y2);
    return point.y >= minY - tolerance && point.y <= maxY + tolerance;
  }
}

/**
 * Find which segment of an orthogonal path a point is on
 * @param {{ x: number, y: number }} point
 * @param {{ x1: number, y1: number, x2: number, y2: number, isHorizontal: boolean, index: number }[]} segments
 * @param {number} tolerance
 * @returns {{ segment: object, index: number } | null}
 */
export function findSegmentAtPoint(point, segments, tolerance = 10) {
  for (let i = 0; i < segments.length; i++) {
    if (isPointOnSegment(point, segments[i], tolerance)) {
      return { segment: segments[i], index: i };
    }
  }
  return null;
}

/**
 * Calculate distance from a point to a quadratic bezier curve
 * Uses numerical approximation by sampling the curve
 * @param {{ x: number, y: number }} point
 * @param {{ x: number, y: number }} p0 - Start point
 * @param {{ x: number, y: number }} p1 - Control point
 * @param {{ x: number, y: number }} p2 - End point
 * @param {number} samples - Number of samples for approximation
 * @returns {{ distance: number, t: number, x: number, y: number }}
 */
export function distanceToQuadraticBezier(point, p0, p1, p2, samples = 50) {
  let minDistance = Infinity;
  let nearestT = 0;
  let nearestPoint = p0;

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const invT = 1 - t;

    // Quadratic bezier formula: B(t) = (1-t)^2 * P0 + 2(1-t)t * P1 + t^2 * P2
    const x = invT * invT * p0.x + 2 * invT * t * p1.x + t * t * p2.x;
    const y = invT * invT * p0.y + 2 * invT * t * p1.y + t * t * p2.y;

    const distance = Math.hypot(point.x - x, point.y - y);

    if (distance < minDistance) {
      minDistance = distance;
      nearestT = t;
      nearestPoint = { x, y };
    }
  }

  return {
    distance: minDistance,
    t: nearestT,
    ...nearestPoint,
  };
}

/**
 * Calculate distance from a point to a cubic bezier curve
 * Uses numerical approximation by sampling the curve
 * @param {{ x: number, y: number }} point
 * @param {{ x: number, y: number }} p0 - Start point
 * @param {{ x: number, y: number }} p1 - First control point
 * @param {{ x: number, y: number }} p2 - Second control point
 * @param {{ x: number, y: number }} p3 - End point
 * @param {number} samples
 * @returns {{ distance: number, t: number, x: number, y: number }}
 */
export function distanceToCubicBezier(point, p0, p1, p2, p3, samples = 50) {
  let minDistance = Infinity;
  let nearestT = 0;
  let nearestPoint = p0;

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const invT = 1 - t;

    // Cubic bezier formula
    const x = invT * invT * invT * p0.x +
              3 * invT * invT * t * p1.x +
              3 * invT * t * t * p2.x +
              t * t * t * p3.x;
    const y = invT * invT * invT * p0.y +
              3 * invT * invT * t * p1.y +
              3 * invT * t * t * p2.y +
              t * t * t * p3.y;

    const distance = Math.hypot(point.x - x, point.y - y);

    if (distance < minDistance) {
      minDistance = distance;
      nearestT = t;
      nearestPoint = { x, y };
    }
  }

  return {
    distance: minDistance,
    t: nearestT,
    ...nearestPoint,
  };
}
