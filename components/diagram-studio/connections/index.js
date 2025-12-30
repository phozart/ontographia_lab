// components/diagram-studio/connections/index.js
// Main exports for the connection system

// Main component
export { default as Connection } from './Connection';

// Renderers
export {
  StraightLineRenderer,
  OrthogonalLineRenderer,
  CurvedLineRenderer,
  ArcLineRenderer,
  SmartLineRenderer,
  RENDERER_MAP,
  getRenderer,
} from './renderers';

// Labels
export {
  ConnectionLabel,
  EndpointLabel,
  ENDPOINT_LABEL_PRESETS,
} from './labels';

// Markers
export {
  ArrowMarker,
  CircleMarker,
  DiamondMarker,
  BarMarker,
  ConnectionMarkers,
  MARKER_TYPES,
  getMarkerUrl,
  getMarkerInfo,
  MARKER_OPTIONS,
  ENDPOINT_PRESETS,
} from './markers';

// Geometry functions
export {
  // Path builders
  getPortDirection,
  getPortAxis,
  buildStraightPath,
  buildStraightPathThroughPoints,
  buildCurvedPath,
  buildCurvedPathThroughPoints,
  buildArcPath,
  buildRoundedPath,
  getDashArray,
  // Orthogonal routing
  cleanupWaypoints,
  lineIntersectsRect,
  avoidObstacles,
  calculateOrthogonalWaypoints,
  buildOrthogonalThroughWaypoints,
  calculateSegments,
  buildOrthogonalPath,
  // Label positioning
  calculateMidLabelPosition,
  calculateEndpointLabelPosition,
  calculateLabelAngle,
  findNonOverlappingLabelPosition,
  // Hit testing
  distanceToLineSegment,
  isPointNearPath,
  nearestPointOnPath,
  isPointOnSegment,
  findSegmentAtPoint,
  distanceToQuadraticBezier,
  distanceToCubicBezier,
} from './geometry';

// Interaction handlers
export {
  useEndpointDrag,
  useSegmentDrag,
  useCurveDrag,
  useWaypointDrag,
} from './interaction';
