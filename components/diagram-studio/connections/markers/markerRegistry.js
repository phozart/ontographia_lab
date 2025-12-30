// components/diagram-studio/connections/markers/markerRegistry.js
// Registry for marker types and utilities

/**
 * Available marker types
 */
export const MARKER_TYPES = {
  none: {
    id: null,
    label: 'None',
    description: 'No marker',
  },
  arrow: {
    id: 'arrow',
    label: 'Arrow',
    description: 'Triangular arrowhead',
  },
  circle: {
    id: 'circle',
    label: 'Circle',
    description: 'Filled circle',
  },
  'circle-hollow': {
    id: 'circle-hollow',
    label: 'Circle (Hollow)',
    description: 'Hollow circle',
  },
  diamond: {
    id: 'diamond',
    label: 'Diamond',
    description: 'Filled diamond',
  },
  'diamond-hollow': {
    id: 'diamond-hollow',
    label: 'Diamond (Hollow)',
    description: 'Hollow diamond',
  },
  bar: {
    id: 'bar',
    label: 'Bar',
    description: 'Perpendicular bar',
  },
};

/**
 * Get the SVG marker URL for a marker type
 * @param {string} type - Marker type ('none', 'arrow', 'circle', etc.)
 * @param {boolean} isSelected - Whether the connection is selected
 * @returns {string|undefined}
 */
export function getMarkerUrl(type, isSelected = false) {
  if (!type || type === 'none') return undefined;

  const suffix = isSelected ? 'selected' : 'default';
  return `url(#${type}-${suffix})`;
}

/**
 * Get marker type info
 * @param {string} type
 * @returns {{ id: string|null, label: string, description: string } | undefined}
 */
export function getMarkerInfo(type) {
  return MARKER_TYPES[type];
}

/**
 * List of marker types for UI dropdowns
 */
export const MARKER_OPTIONS = Object.entries(MARKER_TYPES).map(([key, value]) => ({
  value: key,
  label: value.label,
  description: value.description,
}));

/**
 * Common endpoint configurations for quick selection
 */
export const ENDPOINT_PRESETS = {
  'directed': { source: 'none', target: 'arrow' },
  'bidirectional': { source: 'arrow', target: 'arrow' },
  'association': { source: 'none', target: 'none' },
  'composition': { source: 'diamond', target: 'arrow' },
  'aggregation': { source: 'diamond-hollow', target: 'arrow' },
  'dependency': { source: 'none', target: 'arrow' }, // Usually dashed line
};
