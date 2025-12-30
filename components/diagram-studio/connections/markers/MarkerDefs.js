// components/diagram-studio/connections/markers/MarkerDefs.js
// SVG marker definitions for connection endpoints

import React from 'react';

/**
 * Arrow marker (triangle pointing in direction of line)
 */
export function ArrowMarker({ id, color = 'var(--text-muted)' }) {
  return (
    <marker
      id={id}
      markerWidth="10"
      markerHeight="7"
      refX="9"
      refY="3.5"
      orient="auto"
    >
      <polygon points="0 0, 10 3.5, 0 7" fill={color} />
    </marker>
  );
}

/**
 * Circle marker (dot at endpoint)
 */
export function CircleMarker({ id, color = 'var(--text-muted)', filled = true }) {
  return (
    <marker
      id={id}
      markerWidth="10"
      markerHeight="10"
      refX="5"
      refY="5"
      orient="auto"
    >
      <circle
        cx="5"
        cy="5"
        r="4"
        fill={filled ? color : 'var(--bg)'}
        stroke={color}
        strokeWidth="1.5"
      />
    </marker>
  );
}

/**
 * Diamond marker (rhombus at endpoint)
 */
export function DiamondMarker({ id, color = 'var(--text-muted)', filled = true }) {
  return (
    <marker
      id={id}
      markerWidth="12"
      markerHeight="12"
      refX="6"
      refY="6"
      orient="auto"
    >
      <polygon
        points="6 0, 12 6, 6 12, 0 6"
        fill={filled ? color : 'var(--bg)'}
        stroke={color}
        strokeWidth="1.5"
      />
    </marker>
  );
}

/**
 * Bar marker (perpendicular line at endpoint)
 */
export function BarMarker({ id, color = 'var(--text-muted)' }) {
  return (
    <marker
      id={id}
      markerWidth="6"
      markerHeight="14"
      refX="3"
      refY="7"
      orient="auto"
    >
      <line x1="3" y1="0" x2="3" y2="14" stroke={color} strokeWidth="2" />
    </marker>
  );
}

/**
 * Complete set of connection markers for SVG defs
 * Includes default and selected variants for each marker type
 */
export function ConnectionMarkers({
  defaultColor = 'var(--text-muted)',
  selectedColor = 'var(--accent)',
}) {
  return (
    <>
      {/* Arrow markers */}
      <ArrowMarker id="arrow-default" color={defaultColor} />
      <ArrowMarker id="arrow-selected" color={selectedColor} />

      {/* Circle markers */}
      <CircleMarker id="circle-default" color={defaultColor} filled />
      <CircleMarker id="circle-selected" color={selectedColor} filled />
      <CircleMarker id="circle-hollow-default" color={defaultColor} filled={false} />
      <CircleMarker id="circle-hollow-selected" color={selectedColor} filled={false} />

      {/* Diamond markers */}
      <DiamondMarker id="diamond-default" color={defaultColor} filled />
      <DiamondMarker id="diamond-selected" color={selectedColor} filled />
      <DiamondMarker id="diamond-hollow-default" color={defaultColor} filled={false} />
      <DiamondMarker id="diamond-hollow-selected" color={selectedColor} filled={false} />

      {/* Bar markers */}
      <BarMarker id="bar-default" color={defaultColor} />
      <BarMarker id="bar-selected" color={selectedColor} />
    </>
  );
}

export default ConnectionMarkers;
