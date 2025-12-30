// components/diagram-studio/connections/renderers/SmartLineRenderer.js
// Renderer for smart-routed connections (obstacle avoidance)

import React, { useMemo, useCallback } from 'react';
import { lineIntersectsRect, buildOrthogonalPath } from '../geometry/orthogonalRouting';
import { buildCurvedPath, getDashArray } from '../geometry/pathBuilders';
import { getMarkerUrl } from '../markers/markerRegistry';

/**
 * Find which segment contains a point (with tolerance)
 * Returns the segment if found, null otherwise
 */
function findSegmentAtPoint(segments, x, y, tolerance = 15) {
  for (const seg of segments) {
    const { x1, y1, x2, y2, isHorizontal } = seg;

    // Calculate segment length - skip very short segments
    const length = isHorizontal ? Math.abs(x2 - x1) : Math.abs(y2 - y1);
    if (length < 20) continue; // Too short to be draggable

    if (isHorizontal) {
      // For horizontal segments, check if point is within Y tolerance and X bounds
      const minX = Math.min(x1, x2) - tolerance;
      const maxX = Math.max(x1, x2) + tolerance;
      if (x >= minX && x <= maxX && Math.abs(y - y1) <= tolerance) {
        return seg;
      }
    } else {
      // For vertical segments, check if point is within X tolerance and Y bounds
      const minY = Math.min(y1, y2) - tolerance;
      const maxY = Math.max(y1, y2) + tolerance;
      if (y >= minY && y <= maxY && Math.abs(x - x1) <= tolerance) {
        return seg;
      }
    }
  }
  return null;
}

/**
 * Renders a smart-routed connection
 * - Automatically routes around obstacles (other nodes)
 * - Uses curved path when no obstacles, orthogonal when needed
 * - Click anywhere on orthogonal segments to drag them
 */
export default function SmartLineRenderer({
  sourcePos,
  targetPos,
  sourcePort = 'right',
  targetPort = 'left',
  waypoints = [],
  obstacles = [],
  isSelected = false,
  isHovered = false,
  style = {},
  onMouseDown,
  onMouseEnter,
  onMouseLeave,
  onClick,
  onDoubleClick,
  onSegmentDrag,
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

  // Determine path type and calculate path
  const { path, segments, isOrthogonal } = useMemo(() => {
    if (!sourcePos || !targetPos) {
      return { path: '', segments: [], isOrthogonal: false };
    }

    // Check if there are any obstacles in the way
    let hasCollision = false;
    for (const obs of obstacles) {
      if (lineIntersectsRect(sourcePos.x, sourcePos.y, targetPos.x, targetPos.y, obs, 15)) {
        hasCollision = true;
        break;
      }
    }

    // If no collision, use curved path
    if (!hasCollision && waypoints.length === 0) {
      return {
        path: buildCurvedPath(sourcePos, targetPos, sourcePort, targetPort),
        segments: [],
        isOrthogonal: false,
      };
    }

    // Use orthogonal routing with obstacle avoidance
    const result = buildOrthogonalPath(sourcePos, targetPos, sourcePort, targetPort, {
      obstacles,
      waypoints,
      sharp: false, // Smart routing uses rounded corners
    });

    return {
      path: result.path,
      segments: result.segments,
      isOrthogonal: true,
    };
  }, [sourcePos, targetPos, sourcePort, targetPort, waypoints, obstacles]);

  // Handle mousedown - check if clicking on a draggable segment (for orthogonal paths)
  const handleMouseDown = useCallback((e) => {
    if (readOnly || !onSegmentDrag || !isOrthogonal || segments.length === 0) {
      onMouseDown?.(e);
      return;
    }

    // Get click position in SVG coordinates
    const svg = e.currentTarget.closest('svg');
    if (!svg) {
      onMouseDown?.(e);
      return;
    }

    const rect = svg.getBoundingClientRect();
    const viewBox = svg.viewBox?.baseVal;

    // Convert client coordinates to SVG coordinates
    let x, y;
    if (viewBox && viewBox.width > 0) {
      // Account for viewBox transformation
      const scaleX = viewBox.width / rect.width;
      const scaleY = viewBox.height / rect.height;
      x = (e.clientX - rect.left) * scaleX + viewBox.x;
      y = (e.clientY - rect.top) * scaleY + viewBox.y;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    // Find if we clicked on a draggable segment
    const segment = findSegmentAtPoint(segments, x, y);
    if (segment) {
      // Start segment drag instead of normal click behavior
      e.stopPropagation();
      onSegmentDrag(segment.index, segment.isHorizontal, e);
      return;
    }

    // No segment found, use normal handler
    onMouseDown?.(e);
  }, [segments, isOrthogonal, readOnly, onSegmentDrag, onMouseDown]);

  if (!path) return null;

  const strokeColor = isSelected ? 'var(--accent)' : stroke;
  const finalStrokeWidth = strokeWidth; // Same thickness when selected, just different color

  return (
    <g className={`connection-smart ${isOrthogonal ? 'orthogonal' : 'curved'} ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`}>
      {/* Invisible hit area for easier clicking - also handles segment drag initiation */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={Math.max(finalStrokeWidth + 10, 15)}
        style={{ cursor: readOnly ? 'default' : 'pointer' }}
        onMouseDown={handleMouseDown}
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

      {/* Segment drag handles for orthogonal paths */}
      {isOrthogonal && (isSelected || isHovered) && !readOnly && segments.map((seg, i) => (
        <SegmentHandle
          key={`seg-${i}`}
          segment={seg}
          isSelected={isSelected}
          onDragStart={(e) => onSegmentDrag?.(seg.index, seg.isHorizontal, e)}
        />
      ))}
    </g>
  );
}

/**
 * Handle for dragging orthogonal segments
 */
function SegmentHandle({ segment, isSelected, onDragStart }) {
  const { midX, midY, isHorizontal, x1, y1, x2, y2 } = segment;

  // Calculate segment length - only show handle for segments long enough
  const length = isHorizontal
    ? Math.abs(x2 - x1)
    : Math.abs(y2 - y1);

  if (length < 20) return null;

  return (
    <circle
      cx={midX}
      cy={midY}
      r={5}
      fill={isSelected ? 'var(--accent)' : 'var(--bg)'}
      stroke={isSelected ? 'var(--accent)' : 'var(--text-muted)'}
      strokeWidth={1.5}
      style={{
        cursor: isHorizontal ? 'ns-resize' : 'ew-resize',
        opacity: isSelected ? 1 : 0.7,
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        onDragStart?.(e);
      }}
    >
      <title>
        {isHorizontal ? 'Drag up/down to move segment' : 'Drag left/right to move segment'}
      </title>
    </circle>
  );
}
