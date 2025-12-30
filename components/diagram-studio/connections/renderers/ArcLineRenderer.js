// components/diagram-studio/connections/renderers/ArcLineRenderer.js
// Renderer for arc connections (single arc path)

import React, { useMemo } from 'react';
import { buildArcPath, getDashArray, getPortDirection } from '../geometry/pathBuilders';
import { getMarkerUrl } from '../markers/markerRegistry';

/**
 * Check if a point is inside a rectangle (with padding)
 */
function pointInRect(x, y, rect, padding = 0) {
  return x >= rect.x - padding &&
         x <= rect.x + rect.width + padding &&
         y >= rect.y - padding &&
         y <= rect.y + rect.height + padding;
}

/**
 * Sample points along an arc (cubic bezier) and check for obstacle intersection
 */
function arcIntersectsObstacles(sourcePos, targetPos, sourcePort, targetPort, curveAmount, obstacles, padding = 8) {
  if (!obstacles || obstacles.length === 0) return false;

  const dx = targetPos.x - sourcePos.x;
  const dy = targetPos.y - sourcePos.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;

  // Calculate control points (same logic as buildArcPath)
  const sourceDir = getPortDirection(sourcePort);
  const targetDir = getPortDirection(targetPort);
  const offset = curveAmount !== null ? Math.abs(curveAmount) : dist * 0.4;

  const cp1x = sourcePos.x + sourceDir.x * offset;
  const cp1y = sourcePos.y + sourceDir.y * offset;
  const cp2x = targetPos.x + targetDir.x * offset;
  const cp2y = targetPos.y + targetDir.y * offset;

  // Sample 20 points along the curve
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const mt = 1 - t;

    // Cubic bezier formula
    const x = mt * mt * mt * sourcePos.x +
              3 * mt * mt * t * cp1x +
              3 * mt * t * t * cp2x +
              t * t * t * targetPos.x;
    const y = mt * mt * mt * sourcePos.y +
              3 * mt * mt * t * cp1y +
              3 * mt * t * t * cp2y +
              t * t * t * targetPos.y;

    // Check if this point is inside any obstacle
    for (const obs of obstacles) {
      if (pointInRect(x, y, obs, padding)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Renders an arc connection
 * - Single curved arc between source and target
 * - Commonly used in causal loop diagrams (CLDs)
 * - Supports dragging to adjust arc curvature
 * - Automatically adjusts arc to avoid obstacles
 */
export default function ArcLineRenderer({
  sourcePos,
  targetPos,
  sourcePort = 'right',
  targetPort = 'left',
  obstacles = [], // Other elements to avoid
  curveAmount = null, // User-defined arc offset (null = auto)
  isSelected = false,
  isHovered = false,
  style = {},
  onMouseDown,
  onMouseEnter,
  onMouseLeave,
  onClick,
  onDoubleClick,
  onCurveDrag,
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

  // Calculate path and control point for arc handle
  // If the arc intersects obstacles, try alternative arc directions
  const { path, controlPoint, effectiveCurveAmount } = useMemo(() => {
    if (!sourcePos || !targetPos) {
      return { path: '', controlPoint: null, effectiveCurveAmount: curveAmount };
    }

    const dx = targetPos.x - sourcePos.x;
    const dy = targetPos.y - sourcePos.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const perpX = -dy / len;
    const perpY = dx / len;
    const midX = (sourcePos.x + targetPos.x) / 2;
    const midY = (sourcePos.y + targetPos.y) / 2;

    // Determine effective curve amount - try to avoid obstacles if no user-defined curve
    let effectiveCurve = curveAmount;
    const defaultOffset = len * 0.25;

    if (curveAmount === null && obstacles.length > 0) {
      // No user-defined curve - try to find one that avoids obstacles
      // For arcs, try increasingly larger arcs in both directions
      const arcsToTry = [
        null, // Default
        defaultOffset, // Standard positive
        -defaultOffset, // Standard negative
        defaultOffset * 1.5, // Larger positive
        -defaultOffset * 1.5, // Larger negative
        defaultOffset * 2, // Much larger positive
        -defaultOffset * 2, // Much larger negative
        defaultOffset * 2.5, // Extra large positive
        -defaultOffset * 2.5, // Extra large negative
      ];

      for (const testCurve of arcsToTry) {
        if (!arcIntersectsObstacles(sourcePos, targetPos, sourcePort, targetPort, testCurve, obstacles, 8)) {
          effectiveCurve = testCurve;
          break;
        }
      }
    }

    // Pass port directions for proper initial/final tangents
    const pathString = buildArcPath(sourcePos, targetPos, sourcePort, targetPort, effectiveCurve);

    // Calculate control point for the arc handle (midpoint with offset)
    let ctrlPoint = null;
    const displayOffset = effectiveCurve !== null ? effectiveCurve : defaultOffset;
    ctrlPoint = {
      x: midX + perpX * displayOffset,
      y: midY + perpY * displayOffset,
    };

    return { path: pathString, controlPoint: ctrlPoint, effectiveCurveAmount: effectiveCurve };
  }, [sourcePos, targetPos, sourcePort, targetPort, curveAmount, obstacles]);

  if (!path) return null;

  const strokeColor = isSelected ? 'var(--accent)' : stroke;
  const finalStrokeWidth = strokeWidth; // Same thickness when selected, just different color

  return (
    <g className={`connection-arc ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`}>
      {/* Invisible hit area for easier clicking and arc dragging */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={Math.max(finalStrokeWidth + 10, 15)}
        style={{ cursor: readOnly ? 'default' : 'grab' }}
        onMouseDown={(e) => {
          if (!readOnly && onCurveDrag) {
            e.stopPropagation();
            e.preventDefault();
            onCurveDrag(e);
          } else {
            onMouseDown?.(e);
          }
        }}
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

      {/* Arc control handle - shown when selected */}
      {isSelected && !readOnly && controlPoint && (
        <ArcHandle
          position={controlPoint}
          onDragStart={onCurveDrag}
        />
      )}
    </g>
  );
}

/**
 * Handle for adjusting arc curvature
 */
function ArcHandle({ position, onDragStart }) {
  return (
    <circle
      cx={position.x}
      cy={position.y}
      r={6}
      fill="var(--bg)"
      stroke="var(--accent)"
      strokeWidth={2}
      style={{ cursor: 'move' }}
      onMouseDown={(e) => {
        e.stopPropagation();
        onDragStart?.(e);
      }}
    >
      <title>Drag to adjust arc</title>
    </circle>
  );
}
