// components/diagram-studio/connections/renderers/CurvedLineRenderer.js
// Renderer for curved (bezier) connections

import React, { useMemo } from 'react';
import { buildCurvedPath, buildCurvedPathThroughPoints, getDashArray, getPortDirection } from '../geometry/pathBuilders';
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
 * Sample points along a cubic bezier curve and check for obstacle intersection
 * Returns true if the curve passes through any obstacle
 */
function curveIntersectsObstacles(sourcePos, targetPos, sourcePort, targetPort, curveAmount, obstacles, padding = 8) {
  if (!obstacles || obstacles.length === 0) return false;

  const dx = targetPos.x - sourcePos.x;
  const dy = targetPos.y - sourcePos.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;

  // Calculate control points (same logic as buildCurvedPath)
  const sourceDir = getPortDirection(sourcePort);
  const targetDir = getPortDirection(targetPort);
  const offset = curveAmount !== null ? Math.abs(curveAmount) : Math.min(80, Math.abs(dx) / 2, Math.abs(dy) / 2) || 40;

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
 * Renders a curved (bezier) connection
 * - Smooth bezier curve based on port directions
 * - Supports dragging to adjust curve amount
 * - Supports waypoints for multi-segment curves
 * - Automatically adjusts curve to avoid obstacles
 */
export default function CurvedLineRenderer({
  sourcePos,
  targetPos,
  sourcePort = 'right',
  targetPort = 'left',
  waypoints = [],
  obstacles = [], // Other elements to avoid
  curveAmount = null, // User-defined curve offset (null = auto)
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

  // Calculate path and control point for curve handle
  // If the curve intersects obstacles, try alternative curve directions
  const { path, controlPoint, effectiveCurveAmount } = useMemo(() => {
    if (!sourcePos || !targetPos) {
      return { path: '', controlPoint: null, effectiveCurveAmount: curveAmount };
    }

    if (waypoints.length > 0) {
      return {
        path: buildCurvedPathThroughPoints([sourcePos, ...waypoints, targetPos]),
        controlPoint: null, // No single control point for waypoint paths
        effectiveCurveAmount: curveAmount,
      };
    }

    const dx = targetPos.x - sourcePos.x;
    const dy = targetPos.y - sourcePos.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    // Determine effective curve amount - try to avoid obstacles if no user-defined curve
    let effectiveCurve = curveAmount;

    if (curveAmount === null && obstacles.length > 0) {
      // No user-defined curve - try to find one that avoids obstacles
      // Try increasingly larger curves in both directions
      const defaultOffset = Math.min(80, Math.abs(dx) / 2, Math.abs(dy) / 2) || 40;
      const curvesToTry = [
        null, // Default (uses port directions)
        defaultOffset * 0.5, // Smaller positive
        -defaultOffset * 0.5, // Smaller negative
        defaultOffset, // Standard positive
        -defaultOffset, // Standard negative
        defaultOffset * 1.5, // Larger positive
        -defaultOffset * 1.5, // Larger negative
        defaultOffset * 2, // Much larger positive
        -defaultOffset * 2, // Much larger negative
      ];

      for (const testCurve of curvesToTry) {
        if (!curveIntersectsObstacles(sourcePos, targetPos, sourcePort, targetPort, testCurve, obstacles, 8)) {
          effectiveCurve = testCurve;
          break;
        }
      }
    }

    const pathString = buildCurvedPath(sourcePos, targetPos, sourcePort, targetPort, effectiveCurve);

    // Calculate control point for the curve handle
    let ctrlPoint = null;
    if (effectiveCurve !== null) {
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const perpX = -dy / len;
      const perpY = dx / len;
      const midX = (sourcePos.x + targetPos.x) / 2;
      const midY = (sourcePos.y + targetPos.y) / 2;
      ctrlPoint = {
        x: midX + perpX * effectiveCurve,
        y: midY + perpY * effectiveCurve,
      };
    }

    return { path: pathString, controlPoint: ctrlPoint, effectiveCurveAmount: effectiveCurve };
  }, [sourcePos, targetPos, sourcePort, targetPort, waypoints, curveAmount, obstacles]);

  if (!path) return null;

  const strokeColor = isSelected ? 'var(--accent)' : stroke;
  const finalStrokeWidth = strokeWidth; // Same thickness when selected, just different color

  return (
    <g className={`connection-curved ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`}>
      {/* Invisible hit area for easier clicking and curve dragging */}
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

      {/* Curve control handle - shown when selected and has custom curve */}
      {isSelected && !readOnly && controlPoint && (
        <CurveHandle
          position={controlPoint}
          onDragStart={onCurveDrag}
        />
      )}
    </g>
  );
}

/**
 * Handle for adjusting curve amount
 */
function CurveHandle({ position, onDragStart }) {
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
      <title>Drag to adjust curve</title>
    </circle>
  );
}
