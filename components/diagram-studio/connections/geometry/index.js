// components/diagram-studio/connections/geometry/index.js
// Export all geometry functions

export {
  getPortDirection,
  getPortAxis,
  buildStraightPath,
  buildStraightPathThroughPoints,
  buildCurvedPath,
  buildCurvedPathThroughPoints,
  buildArcPath,
  buildRoundedPath,
  getDashArray,
  getLineIntersection,
  findLineCrossings,
  buildBridgePath,
} from './pathBuilders';

export {
  cleanupWaypoints,
  lineIntersectsRect,
  avoidObstacles,
  calculateOrthogonalWaypoints,
  buildOrthogonalThroughWaypoints,
  calculateSegments,
  buildOrthogonalPath,
} from './orthogonalRouting';

export {
  calculateMidLabelPosition,
  calculateEndpointLabelPosition,
  calculateLabelAngle,
  findNonOverlappingLabelPosition,
} from './labelPositioning';

export {
  distanceToLineSegment,
  isPointNearPath,
  nearestPointOnPath,
  isPointOnSegment,
  findSegmentAtPoint,
  distanceToQuadraticBezier,
  distanceToCubicBezier,
} from './hitTesting';
