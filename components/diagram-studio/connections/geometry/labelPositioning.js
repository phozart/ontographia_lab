// components/diagram-studio/connections/geometry/labelPositioning.js
// Functions for calculating label positions on connections

/**
 * Calculate position for the mid-section label (the main label on the connection)
 * @param {{ x: number, y: number }} sourcePos
 * @param {{ x: number, y: number }} targetPos
 * @param {{ x: number, y: number }[]} waypoints
 * @returns {{ x: number, y: number }}
 */
export function calculateMidLabelPosition(sourcePos, targetPos, waypoints = []) {
  if (!sourcePos || !targetPos) {
    return { x: 0, y: 0 };
  }

  if (waypoints.length === 0) {
    return {
      x: (sourcePos.x + targetPos.x) / 2,
      y: (sourcePos.y + targetPos.y) / 2 - 15,
    };
  }

  // Put label at middle waypoint or between waypoints
  const midIdx = Math.floor(waypoints.length / 2);
  if (waypoints.length % 2 === 1) {
    return { x: waypoints[midIdx].x, y: waypoints[midIdx].y - 15 };
  }

  const wp1 = waypoints[midIdx - 1];
  const wp2 = waypoints[midIdx];
  return {
    x: (wp1.x + wp2.x) / 2,
    y: (wp1.y + wp2.y) / 2 - 15,
  };
}

/**
 * Calculate position for an endpoint label (source or target label)
 * These are positioned near the connection endpoints with an offset
 * @param {{ x: number, y: number }} position - The endpoint position
 * @param {string} port - 'top' | 'bottom' | 'left' | 'right'
 * @param {number} offset - Distance from endpoint
 * @returns {{ x: number, y: number }}
 */
export function calculateEndpointLabelPosition(position, port, offset = 12) {
  if (!position) {
    return { x: 0, y: 0 };
  }

  switch (port) {
    case 'top':
      return { x: position.x + offset, y: position.y - offset };
    case 'bottom':
      return { x: position.x + offset, y: position.y + offset };
    case 'left':
      return { x: position.x - offset, y: position.y - offset };
    case 'right':
      return { x: position.x + offset, y: position.y - offset };
    default:
      return { x: position.x + offset, y: position.y - offset };
  }
}

/**
 * Calculate the angle of the connection at the label position
 * Useful for rotating labels to follow the line
 * @param {{ x: number, y: number }} sourcePos
 * @param {{ x: number, y: number }} targetPos
 * @param {{ x: number, y: number }[]} waypoints
 * @returns {number} - Angle in degrees
 */
export function calculateLabelAngle(sourcePos, targetPos, waypoints = []) {
  let p1, p2;

  if (waypoints.length === 0) {
    p1 = sourcePos;
    p2 = targetPos;
  } else if (waypoints.length === 1) {
    // Use the segment from source to waypoint or waypoint to target (whichever is longer)
    const d1 = Math.hypot(waypoints[0].x - sourcePos.x, waypoints[0].y - sourcePos.y);
    const d2 = Math.hypot(targetPos.x - waypoints[0].x, targetPos.y - waypoints[0].y);
    if (d1 > d2) {
      p1 = sourcePos;
      p2 = waypoints[0];
    } else {
      p1 = waypoints[0];
      p2 = targetPos;
    }
  } else {
    // Use the middle segment
    const midIdx = Math.floor(waypoints.length / 2);
    p1 = waypoints[midIdx - 1] || sourcePos;
    p2 = waypoints[midIdx];
  }

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  let angle = Math.atan2(dy, dx) * (180 / Math.PI);

  // Normalize angle to be readable (not upside down)
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;

  return angle;
}

/**
 * Find the best position for a label that doesn't overlap nodes
 * @param {{ x: number, y: number }} preferredPosition
 * @param {{ x: number, y: number, width: number, height: number }[]} obstacles
 * @param {{ width: number, height: number }} labelSize
 * @returns {{ x: number, y: number }}
 */
export function findNonOverlappingLabelPosition(preferredPosition, obstacles, labelSize = { width: 60, height: 20 }) {
  const halfW = labelSize.width / 2;
  const halfH = labelSize.height / 2;

  // Check if preferred position overlaps any obstacle
  const overlaps = (pos) => {
    const labelRect = {
      x: pos.x - halfW,
      y: pos.y - halfH,
      width: labelSize.width,
      height: labelSize.height,
    };

    return obstacles.some(obs =>
      labelRect.x < obs.x + obs.width &&
      labelRect.x + labelRect.width > obs.x &&
      labelRect.y < obs.y + obs.height &&
      labelRect.y + labelRect.height > obs.y
    );
  };

  if (!overlaps(preferredPosition)) {
    return preferredPosition;
  }

  // Try different offsets
  const offsets = [
    { x: 0, y: -30 },  // above
    { x: 0, y: 30 },   // below
    { x: 30, y: 0 },   // right
    { x: -30, y: 0 },  // left
    { x: 30, y: -30 }, // top-right
    { x: -30, y: -30 }, // top-left
    { x: 30, y: 30 },  // bottom-right
    { x: -30, y: 30 }, // bottom-left
  ];

  for (const offset of offsets) {
    const testPos = {
      x: preferredPosition.x + offset.x,
      y: preferredPosition.y + offset.y,
    };
    if (!overlaps(testPos)) {
      return testPos;
    }
  }

  // If all positions overlap, return the preferred position
  return preferredPosition;
}
