// components/diagram-studio/connections/geometry/autoPorts.js
// Pure auto port selection: always pick the sides that face each other.

/**
 * @param {{x:number,y:number,width:number,height:number}} s source bounds
 * @param {{x:number,y:number,width:number,height:number}} t target bounds
 * @returns {{ sourcePort: string, targetPort: string }}
 */
export function selectAutoPorts(s, t) {
  if (!s || !t) return { sourcePort: 'right', targetPort: 'left' };

  const gapRight = t.x - (s.x + s.width); // > 0: target entirely right of source
  const gapLeft = s.x - (t.x + t.width); // > 0: target entirely left of source
  const gapDown = t.y - (s.y + s.height);
  const gapUp = s.y - (t.y + t.height);
  const gapX = Math.max(gapRight, gapLeft);
  const gapY = Math.max(gapDown, gapUp);

  let horizontal;
  if (gapX > 0 && gapY > 0) horizontal = gapX >= gapY; // diagonal: larger gap wins
  else if (gapX > 0) horizontal = true;
  else if (gapY > 0) horizontal = false;
  else {
    // Overlapping bounds: whichever axis the centers are further apart on
    const dx = Math.abs(t.x + t.width / 2 - (s.x + s.width / 2)) / (s.width + t.width || 1);
    const dy = Math.abs(t.y + t.height / 2 - (s.y + s.height / 2)) / (s.height + t.height || 1);
    horizontal = dx >= dy;
  }

  if (horizontal) {
    const targetIsRight = gapX > 0 ? gapRight > 0 : t.x + t.width / 2 >= s.x + s.width / 2;
    return targetIsRight
      ? { sourcePort: 'right', targetPort: 'left' }
      : { sourcePort: 'left', targetPort: 'right' };
  }
  const targetIsBelow = gapY > 0 ? gapDown > 0 : t.y + t.height / 2 >= s.y + s.height / 2;
  return targetIsBelow
    ? { sourcePort: 'bottom', targetPort: 'top' }
    : { sourcePort: 'top', targetPort: 'bottom' };
}

/**
 * Effective ports for a connection. Connections flagged `autoPorts` (created
 * without the user pinning a side) always use the facing sides, so they follow
 * the shapes when they are moved or resized. Pinned connections, and ones the
 * user routed by hand (waypoints), keep their stored ports.
 */
export function resolveConnectionPorts(connection, sourceBounds, targetBounds) {
  const stored = {
    sourcePort: connection.sourcePort || 'right',
    targetPort: connection.targetPort || 'left',
  };
  if (!connection.autoPorts || !sourceBounds || !targetBounds) return stored;
  if (Array.isArray(connection.waypoints) && connection.waypoints.length > 0) return stored;
  return selectAutoPorts(sourceBounds, targetBounds);
}
