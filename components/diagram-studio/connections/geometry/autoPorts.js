// components/diagram-studio/connections/geometry/autoPorts.js
// Pure auto port selection: always pick the sides that face each other.

/**
 * @param {{x:number,y:number,width:number,height:number}} s source bounds
 * @param {{x:number,y:number,width:number,height:number}} t target bounds
 * @param {{ sourcePort?: string }} [hint] previously used ports; on a diagonal the
 *   currently used axis gets a 12% bias so the ports do not flicker when gapX ~ gapY
 * @returns {{ sourcePort: string, targetPort: string }}
 */
export function selectAutoPorts(s, t, hint) {
  if (!s || !t) return { sourcePort: 'right', targetPort: 'left' };

  const gapRight = t.x - (s.x + s.width); // > 0: target entirely right of source
  const gapLeft = s.x - (t.x + t.width); // > 0: target entirely left of source
  const gapDown = t.y - (s.y + s.height);
  const gapUp = s.y - (t.y + t.height);
  const gapX = Math.max(gapRight, gapLeft);
  const gapY = Math.max(gapDown, gapUp);

  let horizontal;
  if (gapX > 0 && gapY > 0) {
    // diagonal: larger gap wins, with hysteresis towards the axis already in use
    const hintH = hint?.sourcePort === 'left' || hint?.sourcePort === 'right';
    const hintV = hint?.sourcePort === 'top' || hint?.sourcePort === 'bottom';
    const bias = 1.12;
    horizontal = hintH ? gapX * bias >= gapY : hintV ? gapX >= gapY * bias : gapX >= gapY;
  }
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
  return selectAutoPorts(sourceBounds, targetBounds, stored);
}

/**
 * Update payload for saving hand-placed waypoints. The effective ports in use
 * are pinned at the same time (and `autoPorts` cleared) because
 * `resolveConnectionPorts` returns the stored ports whenever waypoints exist;
 * without this the route would jump to stale stored ports on the next render.
 * @param {object} connection connection as seen by the canvas (ports already resolved)
 * @param {{x:number,y:number}[]} waypoints
 */
export function manualWaypointUpdate(connection, waypoints) {
  const update = { waypoints, hasManualWaypoints: true };
  if (connection) {
    if (connection.sourcePort) update.sourcePort = connection.sourcePort;
    if (connection.targetPort) update.targetPort = connection.targetPort;
    if (connection.autoPorts) update.autoPorts = false;
  }
  return update;
}
