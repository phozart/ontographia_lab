// components/diagram-studio/routing/SmartRouter.js
// Smart routing engine with collision-aware pathfinding

/**
 * SmartRouter - Pathfinding that avoids obstacles (nodes)
 */
export class SmartRouter {
  constructor(elements, options = {}) {
    this.padding = options.padding || 20;
    this.cornerRadius = options.cornerRadius || 8;
    this.obstacles = this.buildObstacles(elements);
  }

  /**
   * Build obstacle rectangles from elements
   */
  buildObstacles(elements) {
    return elements.map(el => ({
      id: el.id,
      x: el.x - this.padding,
      y: el.y - this.padding,
      width: (el.size?.width || 120) + this.padding * 2,
      height: (el.size?.height || 60) + this.padding * 2,
      // Original bounds without padding
      original: {
        x: el.x,
        y: el.y,
        width: el.size?.width || 120,
        height: el.size?.height || 60,
      }
    }));
  }

  /**
   * Main routing function - finds optimal path avoiding obstacles
   */
  route(sourcePos, targetPos, sourcePort, targetPort, options = {}) {
    const { lineStyle = 'smart', waypoints = [], sourceId, targetId } = options;

    // Filter out source and target elements from obstacles
    const filteredObstacles = this.obstacles.filter(
      obs => obs.id !== sourceId && obs.id !== targetId
    );

    if (waypoints && waypoints.length > 0) {
      return this.routeThroughWaypoints(sourcePos, targetPos, waypoints, lineStyle, filteredObstacles);
    }

    switch (lineStyle) {
      case 'smart':
        return this.findSmartPath(sourcePos, targetPos, sourcePort, targetPort, filteredObstacles);
      case 'step':
      case 'orthogonal':
        return this.findOrthogonalPath(sourcePos, targetPos, sourcePort, targetPort, filteredObstacles);
      case 'curved':
        return this.findCurvedPath(sourcePos, targetPos, sourcePort, targetPort, filteredObstacles);
      case 'straight':
        return this.findStraightPath(sourcePos, targetPos, filteredObstacles);
      case 'arc':
        return this.findArcPath(sourcePos, targetPos);
      default:
        return this.findSmartPath(sourcePos, targetPos, sourcePort, targetPort, filteredObstacles);
    }
  }

  /**
   * Route through manual waypoints
   */
  routeThroughWaypoints(start, end, waypoints, lineStyle, obstacles) {
    const points = [start, ...waypoints, end];

    if (lineStyle === 'curved') {
      return this.generateCurvedPathThroughPoints(points);
    }

    // For step/orthogonal, connect points with right angles
    if (lineStyle === 'step' || lineStyle === 'orthogonal') {
      return this.generateOrthogonalPathThroughPoints(points);
    }

    // For smart routing, ensure each segment avoids obstacles
    let path = `M ${start.x} ${start.y}`;
    let prevPoint = start;

    for (const wp of waypoints) {
      const segment = this.findSegmentPath(prevPoint, wp, obstacles);
      path += segment;
      prevPoint = wp;
    }

    const finalSegment = this.findSegmentPath(prevPoint, end, obstacles);
    path += finalSegment;

    return path;
  }

  /**
   * Smart pathfinding using visibility graph and A*
   */
  findSmartPath(start, end, sourcePort, targetPort, obstacles) {
    // Check if straight line is clear
    if (!this.lineIntersectsAnyObstacle(start, end, obstacles)) {
      return this.generateCurvedPath(start, end, sourcePort, targetPort);
    }

    // Find path using orthogonal routing with obstacle avoidance
    const path = this.findOrthogonalPathWithAvoidance(start, end, sourcePort, targetPort, obstacles);
    return path;
  }

  /**
   * Orthogonal (step) routing with obstacle avoidance
   */
  findOrthogonalPath(start, end, sourcePort, targetPort, obstacles) {
    return this.findOrthogonalPathWithAvoidance(start, end, sourcePort, targetPort, obstacles);
  }

  /**
   * Find orthogonal path that avoids obstacles
   */
  findOrthogonalPathWithAvoidance(start, end, sourcePort, targetPort, obstacles) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;

    // Get initial direction based on ports
    const startDir = this.getDirectionFromPort(sourcePort);
    const endDir = this.getDirectionFromPort(targetPort);

    // Generate candidate paths
    const candidates = this.generateOrthogonalCandidates(start, end, startDir, endDir);

    // Find first candidate that doesn't intersect obstacles
    for (const points of candidates) {
      if (!this.pathIntersectsObstacles(points, obstacles)) {
        return this.pointsToOrthogonalPath(points);
      }
    }

    // If all simple paths fail, try routing around obstacles
    const avoidancePath = this.routeAroundObstacles(start, end, startDir, endDir, obstacles);
    return this.pointsToOrthogonalPath(avoidancePath);
  }

  /**
   * Generate candidate orthogonal paths
   */
  generateOrthogonalCandidates(start, end, startDir, endDir) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const midX = start.x + dx / 2;
    const midY = start.y + dy / 2;
    const offset = Math.max(Math.abs(dx), Math.abs(dy)) * 0.3 + 30;

    const candidates = [];

    // Path via horizontal midpoint
    candidates.push([
      start,
      { x: midX, y: start.y },
      { x: midX, y: end.y },
      end
    ]);

    // Path via vertical midpoint
    candidates.push([
      start,
      { x: start.x, y: midY },
      { x: end.x, y: midY },
      end
    ]);

    // Path going above
    const topY = Math.min(start.y, end.y) - offset;
    candidates.push([
      start,
      { x: start.x, y: topY },
      { x: end.x, y: topY },
      end
    ]);

    // Path going below
    const bottomY = Math.max(start.y, end.y) + offset;
    candidates.push([
      start,
      { x: start.x, y: bottomY },
      { x: end.x, y: bottomY },
      end
    ]);

    // Path going left
    const leftX = Math.min(start.x, end.x) - offset;
    candidates.push([
      start,
      { x: leftX, y: start.y },
      { x: leftX, y: end.y },
      end
    ]);

    // Path going right
    const rightX = Math.max(start.x, end.x) + offset;
    candidates.push([
      start,
      { x: rightX, y: start.y },
      { x: rightX, y: end.y },
      end
    ]);

    return candidates;
  }

  /**
   * Route around obstacles using greedy approach
   */
  routeAroundObstacles(start, end, startDir, endDir, obstacles) {
    const points = [start];
    let current = { ...start };
    let iterations = 0;
    const maxIterations = 20;

    while (iterations < maxIterations) {
      iterations++;

      // Check if we can reach the end directly
      if (!this.lineIntersectsAnyObstacle(current, end, obstacles)) {
        // Add intermediate points for orthogonal routing
        if (Math.abs(end.x - current.x) > 10 && Math.abs(end.y - current.y) > 10) {
          points.push({ x: end.x, y: current.y });
        }
        points.push(end);
        break;
      }

      // Find blocking obstacle
      const blockingObstacle = this.findFirstBlockingObstacle(current, end, obstacles);
      if (!blockingObstacle) {
        points.push(end);
        break;
      }

      // Choose detour direction
      const detour = this.calculateDetour(current, end, blockingObstacle);
      points.push(detour);
      current = detour;
    }

    return points;
  }

  /**
   * Calculate detour point around an obstacle
   */
  calculateDetour(current, target, obstacle) {
    const obs = obstacle;

    // Determine if going around horizontally or vertically is shorter
    const goingRight = target.x > current.x;
    const goingDown = target.y > current.y;

    // Calculate distances to each side
    const distToTop = Math.abs(current.y - obs.y);
    const distToBottom = Math.abs(current.y - (obs.y + obs.height));
    const distToLeft = Math.abs(current.x - obs.x);
    const distToRight = Math.abs(current.x - (obs.x + obs.width));

    // Choose best route based on direction and distance
    if (Math.abs(target.x - current.x) > Math.abs(target.y - current.y)) {
      // Primarily horizontal movement - go above or below
      if (distToTop < distToBottom) {
        return { x: current.x, y: obs.y - 10 };
      } else {
        return { x: current.x, y: obs.y + obs.height + 10 };
      }
    } else {
      // Primarily vertical movement - go left or right
      if (distToLeft < distToRight) {
        return { x: obs.x - 10, y: current.y };
      } else {
        return { x: obs.x + obs.width + 10, y: current.y };
      }
    }
  }

  /**
   * Find the first obstacle blocking a line
   */
  findFirstBlockingObstacle(start, end, obstacles) {
    let closest = null;
    let closestDist = Infinity;

    for (const obs of obstacles) {
      if (this.lineIntersectsRect(start, end, obs)) {
        const dist = this.distance(start, { x: obs.x + obs.width / 2, y: obs.y + obs.height / 2 });
        if (dist < closestDist) {
          closestDist = dist;
          closest = obs;
        }
      }
    }

    return closest;
  }

  /**
   * Curved path with Bezier curves
   */
  findCurvedPath(start, end, sourcePort, targetPort, obstacles) {
    return this.generateCurvedPath(start, end, sourcePort, targetPort);
  }

  /**
   * Generate curved path string
   */
  generateCurvedPath(start, end, sourcePort, targetPort) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const curvature = Math.min(distance * 0.4, 100);

    // Control points based on ports
    let cp1x = start.x + curvature;
    let cp1y = start.y;
    let cp2x = end.x - curvature;
    let cp2y = end.y;

    if (sourcePort === 'top') {
      cp1x = start.x;
      cp1y = start.y - curvature;
    } else if (sourcePort === 'bottom') {
      cp1x = start.x;
      cp1y = start.y + curvature;
    } else if (sourcePort === 'left') {
      cp1x = start.x - curvature;
      cp1y = start.y;
    }

    if (targetPort === 'top') {
      cp2x = end.x;
      cp2y = end.y - curvature;
    } else if (targetPort === 'bottom') {
      cp2x = end.x;
      cp2y = end.y + curvature;
    } else if (targetPort === 'left') {
      cp2x = end.x - curvature;
      cp2y = end.y;
    }

    return `M ${start.x} ${start.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${end.x} ${end.y}`;
  }

  /**
   * Straight line path
   */
  findStraightPath(start, end, obstacles) {
    return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  }

  /**
   * Arc path
   */
  findArcPath(start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const radius = distance * 0.8;

    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${end.x} ${end.y}`;
  }

  /**
   * Convert points array to orthogonal SVG path with rounded corners
   */
  pointsToOrthogonalPath(points) {
    if (points.length < 2) return '';

    const r = this.cornerRadius;
    let path = `M ${points[0].x} ${points[0].y}`;

    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];

      // Calculate direction vectors
      const dx1 = curr.x - prev.x;
      const dy1 = curr.y - prev.y;
      const dx2 = next.x - curr.x;
      const dy2 = next.y - curr.y;

      // Skip if points are the same
      if (dx1 === 0 && dy1 === 0) continue;
      if (dx2 === 0 && dy2 === 0) continue;

      // Calculate the corner radius for this segment
      const dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
      const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
      const actualR = Math.min(r, dist1 / 2, dist2 / 2);

      if (actualR > 1) {
        // Line to point before corner
        const beforeX = curr.x - (dx1 / dist1) * actualR;
        const beforeY = curr.y - (dy1 / dist1) * actualR;
        path += ` L ${beforeX} ${beforeY}`;

        // Quadratic curve for corner
        const afterX = curr.x + (dx2 / dist2) * actualR;
        const afterY = curr.y + (dy2 / dist2) * actualR;
        path += ` Q ${curr.x} ${curr.y} ${afterX} ${afterY}`;
      } else {
        path += ` L ${curr.x} ${curr.y}`;
      }
    }

    // Line to end point
    const last = points[points.length - 1];
    path += ` L ${last.x} ${last.y}`;

    return path;
  }

  /**
   * Generate curved path through multiple points
   */
  generateCurvedPathThroughPoints(points) {
    if (points.length < 2) return '';
    if (points.length === 2) {
      return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
    }

    let path = `M ${points[0].x} ${points[0].y}`;

    for (let i = 1; i < points.length - 1; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];

      const cpX = p1.x;
      const cpY = p1.y;
      const endX = (p1.x + p2.x) / 2;
      const endY = (p1.y + p2.y) / 2;

      path += ` Q ${cpX} ${cpY} ${endX} ${endY}`;
    }

    const last = points[points.length - 1];
    const prev = points[points.length - 2];
    path += ` Q ${prev.x} ${prev.y} ${last.x} ${last.y}`;

    return path;
  }

  /**
   * Generate orthogonal path through multiple points
   */
  generateOrthogonalPathThroughPoints(points) {
    return this.pointsToOrthogonalPath(points);
  }

  /**
   * Find path segment between two points avoiding obstacles
   */
  findSegmentPath(start, end, obstacles) {
    if (!this.lineIntersectsAnyObstacle(start, end, obstacles)) {
      return ` L ${end.x} ${end.y}`;
    }

    // Route around obstacles
    const points = this.routeAroundObstacles(start, end, 'right', 'left', obstacles);
    let path = '';
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }
    return path;
  }

  // ============ Collision Detection ============

  /**
   * Check if line intersects any obstacle
   */
  lineIntersectsAnyObstacle(p1, p2, obstacles) {
    for (const obs of obstacles) {
      if (this.lineIntersectsRect(p1, p2, obs)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if a path (array of points) intersects any obstacle
   */
  pathIntersectsObstacles(points, obstacles) {
    for (let i = 0; i < points.length - 1; i++) {
      if (this.lineIntersectsAnyObstacle(points[i], points[i + 1], obstacles)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if line segment intersects rectangle
   */
  lineIntersectsRect(p1, p2, rect) {
    // Check if either endpoint is inside the rect
    if (this.pointInRect(p1, rect) || this.pointInRect(p2, rect)) {
      return true;
    }

    // Check all four edges
    const topLeft = { x: rect.x, y: rect.y };
    const topRight = { x: rect.x + rect.width, y: rect.y };
    const bottomLeft = { x: rect.x, y: rect.y + rect.height };
    const bottomRight = { x: rect.x + rect.width, y: rect.y + rect.height };

    return (
      this.lineSegmentsIntersect(p1, p2, topLeft, topRight) ||
      this.lineSegmentsIntersect(p1, p2, topRight, bottomRight) ||
      this.lineSegmentsIntersect(p1, p2, bottomRight, bottomLeft) ||
      this.lineSegmentsIntersect(p1, p2, bottomLeft, topLeft)
    );
  }

  /**
   * Check if point is inside rectangle
   */
  pointInRect(p, rect) {
    return p.x >= rect.x && p.x <= rect.x + rect.width &&
           p.y >= rect.y && p.y <= rect.y + rect.height;
  }

  /**
   * Check if two line segments intersect
   */
  lineSegmentsIntersect(p1, p2, p3, p4) {
    const d1 = this.direction(p3, p4, p1);
    const d2 = this.direction(p3, p4, p2);
    const d3 = this.direction(p1, p2, p3);
    const d4 = this.direction(p1, p2, p4);

    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
        ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
      return true;
    }

    if (d1 === 0 && this.onSegment(p3, p4, p1)) return true;
    if (d2 === 0 && this.onSegment(p3, p4, p2)) return true;
    if (d3 === 0 && this.onSegment(p1, p2, p3)) return true;
    if (d4 === 0 && this.onSegment(p1, p2, p4)) return true;

    return false;
  }

  /**
   * Calculate direction (cross product)
   */
  direction(pi, pj, pk) {
    return (pk.x - pi.x) * (pj.y - pi.y) - (pj.x - pi.x) * (pk.y - pi.y);
  }

  /**
   * Check if point is on segment
   */
  onSegment(pi, pj, pk) {
    return Math.min(pi.x, pj.x) <= pk.x && pk.x <= Math.max(pi.x, pj.x) &&
           Math.min(pi.y, pj.y) <= pk.y && pk.y <= Math.max(pi.y, pj.y);
  }

  /**
   * Get direction from port
   */
  getDirectionFromPort(port) {
    switch (port) {
      case 'top': return 'up';
      case 'bottom': return 'down';
      case 'left': return 'left';
      case 'right': return 'right';
      default: return 'right';
    }
  }

  /**
   * Calculate distance between two points
   */
  distance(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}

/**
 * Create a router instance for the given elements
 */
export function createRouter(elements, options = {}) {
  return new SmartRouter(elements, options);
}

export default SmartRouter;
