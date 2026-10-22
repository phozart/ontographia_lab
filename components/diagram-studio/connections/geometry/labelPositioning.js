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

  // The smallest clear offset wins (L4): candidates on a fine grid of vertical, horizontal and diagonal moves, capped so a
  // label never drifts far from its line; the nearest one that clears every node is taken. Vertical moves come first on
  // a tie (a label belongs above or below its line).
  const capY = labelSize.height * 1.5 + 40;
  const capX = labelSize.width * 0.75 + 40;
  const stepsY = [];
  for (let d = 6; d <= capY; d += 6) stepsY.push(d);
  const stepsX = [];
  for (let d = 6; d <= capX; d += 6) stepsX.push(d);
  const cands = [];
  for (const d of stepsY) cands.push({ x: 0, y: -d, k: d }, { x: 0, y: d, k: d + 0.1 });
  for (const d of stepsX) cands.push({ x: d, y: 0, k: d + 0.2 }, { x: -d, y: 0, k: d + 0.3 });
  for (const dy of stepsY.filter((_, i) => i % 2 === 0)) for (const dx of stepsX.filter((_, i) => i % 2 === 0)) {
    const k = Math.hypot(dx, dy) + 0.4;
    cands.push({ x: dx, y: -dy, k }, { x: -dx, y: -dy, k }, { x: dx, y: dy, k }, { x: -dx, y: dy, k });
  }
  cands.sort((p, q) => p.k - q.k);
  for (const offset of cands) {
    const testPos = { x: preferredPosition.x + offset.x, y: preferredPosition.y + offset.y };
    if (!overlaps(testPos)) return testPos;
  }

  // If all positions overlap, return the preferred position
  return preferredPosition;
}

/**
 * The mid label with its leader: the label moves clear of nodes (smallest offset); when it ends up more than 36 px from
 * where it belongs, `leader` is the point on the line it speaks for, so the renderer can draw a small tick to it.
 * @returns {{position: {x: number, y: number}, leader: {x: number, y: number} | null}}
 */
export function placeMidLabel(preferred, linePoint, obstacles, labelSize) {
  const position = findNonOverlappingLabelPosition(preferred, obstacles, labelSize);
  const moved = Math.hypot(position.x - preferred.x, position.y - preferred.y);
  return { position, leader: moved > 36 ? { x: linePoint.x, y: linePoint.y } : null };
}

/**
 * Position of an endpoint (cardinality) label: beside the line, never over a node. The label sits at the side of the line
 * (normal offset) and starts right outside the endpoint's node, sliding along the line toward the other end (then to the
 * other side, then farther out) until its rectangle clears every node.
 * @param {{x: number, y: number}} end the endpoint
 * @param {{x: number, y: number}} other the other end of the connection (gives the line direction and the room)
 * @param {{width: number, height: number}} size measured label size
 * @param {{x: number, y: number, width: number, height: number}[]} nodes every node rectangle (the two endpoints included)
 */
export function placeEndpointLabel(end, other, size, nodes) {
  const dx = other.x - end.x;
  const dy = other.y - end.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  let nx = -uy;
  let ny = ux;
  if (ny > 0 || (ny === 0 && nx < 0)) { nx = -nx; ny = -ny; } // prefer above, or to the right of a vertical line
  const hw = size.width / 2;
  const hh = size.height / 2;
  const clear = (c) => !nodes.some((n) => c.x - hw < n.x + n.width && c.x + hw > n.x && c.y - hh < n.y + n.height && c.y + hh > n.y);
  const alongExt = Math.abs(ux) * hw + Math.abs(uy) * hh;
  const normExt = Math.abs(nx) * hw + Math.abs(ny) * hh;
  const reach = Math.max(len / 2, alongExt * 2 + 8);
  let first = null;
  for (const out of [4, 18, 34]) {
    for (const side of [1, -1]) {
      for (let a = 4 + alongExt; a <= reach + alongExt; a += 4) {
        const c = { x: end.x + ux * a + nx * side * (normExt + out), y: end.y + uy * a + ny * side * (normExt + out) };
        if (!first) first = c;
        if (clear(c)) return c;
      }
    }
  }
  return first;
}
