// components/diagram-studio/connections/renderers/StraightLineRenderer.js
// Renderer for straight line connections

import React, { useMemo } from 'react';
import { buildStraightPath, buildStraightPathThroughPoints, getDashArray } from '../geometry/pathBuilders';
import { getMarkerUrl } from '../markers/markerRegistry';

/**
 * Renders a straight line connection
 * - Direct line from source to target
 * - Supports waypoints (polyline through points)
 */
export default function StraightLineRenderer({
  sourcePos,
  targetPos,
  waypoints = [],
  isSelected = false,
  isHovered = false,
  style = {},
  onMouseDown,
  onMouseEnter,
  onMouseLeave,
  onClick,
  onDoubleClick,
  readOnly = false,
}) {
  const {
    stroke = 'var(--text-muted)',
    strokeWidth = 2,
    dashPattern = 'solid',
    sourceMarker = 'none',
    targetMarker = 'arrow',
    opacity = 1,
  } = style;

  const path = useMemo(() => {
    if (!sourcePos || !targetPos) return '';

    if (waypoints.length > 0) {
      return buildStraightPathThroughPoints([sourcePos, ...waypoints, targetPos]);
    }
    return buildStraightPath(sourcePos, targetPos);
  }, [sourcePos, targetPos, waypoints]);

  if (!path) return null;

  const strokeColor = isSelected ? 'var(--accent)' : stroke;
  const finalStrokeWidth = strokeWidth; // Same thickness when selected, just different color

  return (
    <g className={`connection-straight ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`}>
      {/* Invisible hit area for easier clicking */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={Math.max(finalStrokeWidth + 10, 15)}
        style={{ cursor: readOnly ? 'default' : 'pointer' }}
        onMouseDown={onMouseDown}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
      />

      {/* Visible path */}
      <path
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth={finalStrokeWidth}
        strokeDasharray={getDashArray(dashPattern, strokeWidth)}
        strokeOpacity={opacity}
        markerStart={getMarkerUrl(sourceMarker, isSelected)}
        markerEnd={getMarkerUrl(targetMarker, isSelected)}
        style={{ pointerEvents: 'none' }}
      />
    </g>
  );
}
