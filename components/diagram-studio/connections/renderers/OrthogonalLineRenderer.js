// components/diagram-studio/connections/renderers/OrthogonalLineRenderer.js
// Renderer for orthogonal (step/elbow) connections

import React, { useMemo, useCallback } from 'react';
import { buildOrthogonalPath } from '../geometry/orthogonalRouting';
import { getDashArray } from '../geometry/pathBuilders';
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
 * Renders an orthogonal (step/elbow) connection
 * - Only horizontal and vertical segments
 * - Supports rounded corners (step) or sharp 90° corners (step-sharp)
 * - Supports segment dragging for reshaping
 * - Click anywhere on a segment to drag it (no need to find small handles)
 */
export default function OrthogonalLineRenderer({
  sourcePos,
  targetPos,
  sourcePort = 'right',
  targetPort = 'left',
  sourceBounds = null, // Source stencil bounds to route around
  targetBounds = null, // Target stencil bounds to route around
  waypoints = [],
  obstacles = [],
  sharp = false, // true for 'step-sharp', false for 'step'
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

  // Calculate path and segments
  const { path, segments } = useMemo(() => {
    if (!sourcePos || !targetPos) {
      return { path: '', segments: [] };
    }

    // Always use buildOrthogonalPath which handles routing around source/target stencils
    const result = buildOrthogonalPath(sourcePos, targetPos, sourcePort, targetPort, {
      sharp,
      obstacles,
      waypoints,
      sourceBounds,
      targetBounds,
    });
    return { path: result.path, segments: result.segments };
  }, [sourcePos, targetPos, sourcePort, targetPort, waypoints, obstacles, sharp, sourceBounds, targetBounds]);

  // Handle mousedown - check if clicking on a draggable segment
  const handleMouseDown = useCallback((e) => {
    if (readOnly || !onSegmentDrag || segments.length === 0) {
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
  }, [segments, readOnly, onSegmentDrag, onMouseDown]);

  if (!path) return null;

  const strokeColor = isSelected ? 'var(--accent)' : stroke;
  const finalStrokeWidth = strokeWidth; // Same thickness when selected, just different color

  // Determine cursor based on whether we're over a draggable segment
  // For simplicity, use 'pointer' which will change to resize cursor on actual drag
  const cursor = readOnly ? 'default' : 'pointer';

  return (
    <g className={`connection-orthogonal ${sharp ? 'sharp' : 'rounded'} ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`}>
      {/* Invisible hit area for easier clicking - also handles segment drag initiation */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={Math.max(finalStrokeWidth + 10, 15)}
        style={{ cursor }}
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

      {/* Segment drag handles - shown on hover or selection */}
      {(isSelected || isHovered) && !readOnly && segments.map((seg, i) => (
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

  if (length < 20) return null; // Too short for a handle

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
