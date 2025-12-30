// components/diagram-studio/utils/index.js
// Barrel export for all utility functions

// Geometry utilities
export {
  GRID_SIZE,
  SNAP_THRESHOLD,
  MIN_ZOOM,
  MAX_ZOOM,
  INFINITE_CANVAS_SIZE,
  INFINITE_CANVAS_OFFSET,
  CANVAS_MIN,
  CANVAS_MAX,
  EDGE_PAN_ZONE,
  EDGE_PAN_SPEED,
  SNAP_TO_STRAIGHT_THRESHOLD,
  snapToGrid,
  clampToCanvas,
  clampViewport,
  getPortDirection,
  detectBorderClick,
  lineIntersectsRect,
} from './geometry';

// Port calculation utilities
export {
  getPortPosition,
  getOptimalPorts,
  shouldAutoUpdatePorts,
  getEffectivePorts,
} from './portCalculation';

// Path generation utilities
export {
  getConnectionPath,
  getSmartPath,
  getCurvedPath,
  getOrthogonalPath,
  cleanupWaypoints,
  avoidObstacles,
  insertWaypointSorted,
  getDashArray,
} from './pathGeneration';

// Snapping utilities
export {
  GUIDE_SNAP_THRESHOLD,
  calculateSnapGuides,
} from './snapping';
