// components/diagram-studio/connections/Connection.js
// Main Connection component - orchestrates renderers, labels, and interactions
//
// Architecture Note:
// This component is declarative - it receives interaction callbacks (onSegmentDrag,
// onEndpointDrag, etc.) and bubbles events up to DiagramCanvas which manages drag state.
// This pattern is chosen because DiagramCanvas has access to viewport transformation
// and canvas ref needed for coordinate conversion. The hooks in ./interaction/ provide
// reference implementations that could be used in alternative components or for testing.

import React, { useMemo, useCallback } from 'react';

// Renderers
import StraightLineRenderer from './renderers/StraightLineRenderer';
import OrthogonalLineRenderer from './renderers/OrthogonalLineRenderer';
import CurvedLineRenderer from './renderers/CurvedLineRenderer';
import ArcLineRenderer from './renderers/ArcLineRenderer';
import SmartLineRenderer from './renderers/SmartLineRenderer';

// Labels
import ConnectionLabel from './labels/ConnectionLabel';
import EndpointLabel from './labels/EndpointLabel';

// Geometry
import { calculateMidLabelPosition } from './geometry/labelPositioning';
import { buildOrthogonalPath } from './geometry/orthogonalRouting';

/**
 * Map of line styles to renderer components
 */
const RENDERERS = {
  straight: StraightLineRenderer,
  step: OrthogonalLineRenderer,
  'step-sharp': OrthogonalLineRenderer,
  curved: CurvedLineRenderer,
  arc: ArcLineRenderer,
  smart: SmartLineRenderer,
};

/**
 * Calculate port position for an element
 * (Simplified - full implementation needs packRegistry)
 */
function getPortPosition(element, port, packRegistry, ratio = 0.5) {
  if (!element) return null;

  // Validate element has required position properties
  if (typeof element.x !== 'number' || typeof element.y !== 'number') {
    return null;
  }

  const pack = packRegistry?.get?.(element.packId);
  const stencil = pack?.stencils?.find(s => s.id === element.type);
  const size = element.size || stencil?.defaultSize || { width: 120, height: 60 };

  const x = element.x;
  const y = element.y;
  const w = size?.width || 120;
  const h = size?.height || 60;

  switch (port) {
    case 'top':
      return { x: x + w * ratio, y };
    case 'bottom':
      return { x: x + w * ratio, y: y + h };
    case 'left':
      return { x, y: y + h * ratio };
    case 'right':
      return { x: x + w, y: y + h * ratio };
    default:
      return { x: x + w / 2, y: y + h / 2 };
  }
}

/**
 * Check if a horizontal path between source and target is blocked by obstacles
 */
function isHorizontalPathBlocked(sourceEl, targetEl, sourceSize, targetSize, obstacles, padding = 20) {
  // Guard against null/undefined inputs
  if (!sourceEl || !targetEl || !sourceSize || !targetSize) {
    return false;
  }
  if (!Array.isArray(obstacles) || obstacles.length === 0) {
    return false;
  }

  const sourceRight = sourceEl.x + sourceSize.width;
  const sourceLeft = sourceEl.x;
  const targetLeft = targetEl.x;
  const targetRight = targetEl.x + targetSize.width;

  // Determine the horizontal corridor between source and target
  const corridorLeft = Math.min(sourceRight, targetRight);
  const corridorRight = Math.max(sourceLeft, targetLeft);
  const corridorTop = Math.min(sourceEl.y, targetEl.y) - padding;
  const corridorBottom = Math.max(sourceEl.y + sourceSize.height, targetEl.y + targetSize.height) + padding;

  // Check if any obstacle blocks this corridor
  for (const obs of obstacles) {
    const obsRight = obs.x + obs.width;
    const obsBottom = obs.y + obs.height;

    // Check if obstacle is in the horizontal path between source and target
    if (obs.x < corridorRight && obsRight > corridorLeft) {
      // Obstacle is horizontally between source and target
      // Check if it blocks the vertical range we need to pass through
      if (obs.y < corridorBottom && obsBottom > corridorTop) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Check if a vertical path between source and target is blocked by obstacles
 */
function isVerticalPathBlocked(sourceEl, targetEl, sourceSize, targetSize, obstacles, padding = 20) {
  // Guard against null/undefined inputs
  if (!sourceEl || !targetEl || !sourceSize || !targetSize) {
    return false;
  }
  if (!Array.isArray(obstacles) || obstacles.length === 0) {
    return false;
  }

  const sourceBottom = sourceEl.y + sourceSize.height;
  const sourceTop = sourceEl.y;
  const targetTop = targetEl.y;
  const targetBottom = targetEl.y + targetSize.height;

  // Determine the vertical corridor between source and target
  const corridorTop = Math.min(sourceBottom, targetBottom);
  const corridorBottom = Math.max(sourceTop, targetTop);
  const corridorLeft = Math.min(sourceEl.x, targetEl.x) - padding;
  const corridorRight = Math.max(sourceEl.x + sourceSize.width, targetEl.x + targetSize.width) + padding;

  // Check if any obstacle blocks this corridor
  for (const obs of obstacles) {
    const obsRight = obs.x + obs.width;
    const obsBottom = obs.y + obs.height;

    // Check if obstacle is in the vertical path between source and target
    if (obs.y < corridorBottom && obsBottom > corridorTop) {
      // Obstacle is vertically between source and target
      // Check if it blocks the horizontal range we need to pass through
      if (obs.x < corridorRight && obsRight > corridorLeft) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Get optimal ports based on element positions
 * Uses element bounds to find cleanest routing path
 * Smart routing: considers available space, obstacles, and chooses alternate ports when needed
 */
function getOptimalPorts(sourceEl, targetEl, packRegistry, allElements = []) {
  if (!sourceEl || !targetEl) {
    return { sourcePort: 'right', targetPort: 'left' };
  }

  // Validate source and target have required position properties
  if (typeof sourceEl.x !== 'number' || typeof sourceEl.y !== 'number' ||
      typeof targetEl.x !== 'number' || typeof targetEl.y !== 'number') {
    return { sourcePort: 'right', targetPort: 'left' };
  }

  // Build obstacles list from other elements (excluding source and target)
  const obstacles = (allElements || [])
    .filter(el => el && el.id !== sourceEl.id && el.id !== targetEl.id)
    .map(el => {
      if (typeof el.x !== 'number' || typeof el.y !== 'number') {
        return null;
      }
      const pack = packRegistry?.get?.(el.packId);
      const stencil = pack?.stencils?.find(s => s.id === el.type);
      const size = el.size || stencil?.defaultSize || { width: 120, height: 60 };
      return {
        id: el.id,
        x: el.x,
        y: el.y,
        width: size.width,
        height: size.height,
      };
    })
    .filter(Boolean);

  const sourcePack = packRegistry?.get?.(sourceEl.packId);
  const targetPack = packRegistry?.get?.(targetEl.packId);
  const sourceStencil = sourcePack?.stencils?.find(s => s.id === sourceEl.type);
  const targetStencil = targetPack?.stencils?.find(s => s.id === targetEl.type);

  const sourceSize = sourceEl.size || sourceStencil?.defaultSize || { width: 120, height: 60 };
  const targetSize = targetEl.size || targetStencil?.defaultSize || { width: 120, height: 60 };

  // Calculate element bounds
  const sourceLeft = sourceEl.x;
  const sourceRight = sourceEl.x + sourceSize.width;
  const sourceTop = sourceEl.y;
  const sourceBottom = sourceEl.y + sourceSize.height;

  const targetLeft = targetEl.x;
  const targetRight = targetEl.x + targetSize.width;
  const targetTop = targetEl.y;
  const targetBottom = targetEl.y + targetSize.height;

  // Minimum clearance needed for a connection to route (perpendicular segment + padding)
  const MIN_CLEARANCE = 50; // Enough space for exit/entry segments

  // Calculate gaps between source and target elements
  const horizontalGap = targetLeft > sourceRight ? targetLeft - sourceRight :
                        sourceLeft > targetRight ? sourceLeft - targetRight : 0;
  const verticalGap = targetTop > sourceBottom ? targetTop - sourceBottom :
                      sourceTop > targetBottom ? sourceTop - targetBottom : 0;

  // Check if elements overlap on each axis
  const overlapHorizontal = !(targetLeft >= sourceRight || targetRight <= sourceLeft);
  const overlapVertical = !(targetTop >= sourceBottom || targetBottom <= sourceTop);

  // Calculate center positions
  const sourceCenterX = sourceEl.x + sourceSize.width / 2;
  const sourceCenterY = sourceEl.y + sourceSize.height / 2;
  const targetCenterX = targetEl.x + targetSize.width / 2;
  const targetCenterY = targetEl.y + targetSize.height / 2;

  const dx = targetCenterX - sourceCenterX;
  const dy = targetCenterY - sourceCenterY;

  let sourcePort, targetPort;

  // Determine if horizontal routing has enough clearance
  const hasHorizontalClearance = horizontalGap >= MIN_CLEARANCE;
  // Determine if vertical routing has enough clearance
  const hasVerticalClearance = verticalGap >= MIN_CLEARANCE;

  // Check if paths are blocked by obstacles
  const horizontalBlocked = obstacles.length > 0 &&
    isHorizontalPathBlocked(sourceEl, targetEl, sourceSize, targetSize, obstacles);
  const verticalBlocked = obstacles.length > 0 &&
    isVerticalPathBlocked(sourceEl, targetEl, sourceSize, targetSize, obstacles);

  // Case 1: Elements have horizontal separation
  if (horizontalGap > 0 && !overlapHorizontal) {
    // Check if horizontal path is viable (enough clearance AND not blocked by obstacles)
    if (hasHorizontalClearance && !horizontalBlocked) {
      // Enough space for horizontal routing
      if (targetLeft > sourceRight) {
        sourcePort = 'right';
        targetPort = 'left';
      } else {
        sourcePort = 'left';
        targetPort = 'right';
      }
    } else {
      // Not enough horizontal space OR blocked by obstacle - use vertical ports
      // Determine best vertical routing direction based on obstacle positions

      const minElementTop = Math.min(sourceTop, targetTop);
      const maxElementBottom = Math.max(sourceBottom, targetBottom);
      const elementsCenterY = (minElementTop + maxElementBottom) / 2;

      // Find if obstacles block more from above or below
      let obstacleBlocksAbove = false;
      let obstacleBlocksBelow = false;

      for (const obs of obstacles) {
        const obsRight = obs.x + obs.width;
        // Check if obstacle is horizontally between source and target
        if (obs.x < Math.max(sourceRight, targetRight) && obsRight > Math.min(sourceLeft, targetLeft)) {
          const obsBottom = obs.y + obs.height;
          const obsCenterY = (obs.y + obsBottom) / 2;

          // If obstacle overlaps with elements vertically
          if (obs.y < maxElementBottom && obsBottom > minElementTop) {
            // Obstacle extends above elements - blocks routing above
            if (obs.y < minElementTop) {
              obstacleBlocksAbove = true;
            }
            // Obstacle extends below elements - blocks routing below
            if (obsBottom > maxElementBottom) {
              obstacleBlocksBelow = true;
            }
          }
        }
      }

      // Choose routing direction based on which way is blocked
      if (obstacleBlocksAbove && !obstacleBlocksBelow) {
        // Obstacle blocks above - route below
        sourcePort = 'bottom';
        targetPort = 'bottom';
      } else if (obstacleBlocksBelow && !obstacleBlocksAbove) {
        // Obstacle blocks below - route above
        sourcePort = 'top';
        targetPort = 'top';
      } else if (obstacleBlocksAbove && obstacleBlocksBelow) {
        // Obstacle blocks both - choose direction with SHORTER path around obstacle
        // Calculate clearance in each direction
        let minClearAbove = Infinity;
        let minClearBelow = Infinity;

        for (const obs of obstacles) {
          const obsRight = obs.x + obs.width;
          if (obs.x < Math.max(sourceRight, targetRight) && obsRight > Math.min(sourceLeft, targetLeft)) {
            const obsBottom = obs.y + obs.height;
            if (obs.y < maxElementBottom && obsBottom > minElementTop) {
              // Distance from element tops to obstacle top (how far to go up to clear)
              const clearUp = minElementTop - obs.y;
              // Distance from element bottoms to obstacle bottom (how far to go down to clear)
              const clearDown = obsBottom - maxElementBottom;
              minClearAbove = Math.min(minClearAbove, clearUp);
              minClearBelow = Math.min(minClearBelow, clearDown);
            }
          }
        }

        // Use ports that match the direction the routing will actually take
        if (minClearAbove <= minClearBelow) {
          // Shorter to go above - use top ports
          sourcePort = 'top';
          targetPort = 'top';
        } else {
          // Shorter to go below - use bottom ports
          sourcePort = 'bottom';
          targetPort = 'bottom';
        }
      } else {
        // No specific blocking - use element positions
        if (targetCenterY < sourceCenterY) {
          sourcePort = 'top';
          targetPort = 'top';
        } else {
          sourcePort = 'bottom';
          targetPort = 'bottom';
        }
      }
    }
  }
  // Case 2: Elements have vertical separation
  else if (verticalGap > 0 && !overlapVertical) {
    if (hasVerticalClearance && !verticalBlocked) {
      // Enough space for vertical routing
      if (targetTop > sourceBottom) {
        sourcePort = 'bottom';
        targetPort = 'top';
      } else {
        sourcePort = 'top';
        targetPort = 'bottom';
      }
    } else {
      // Not enough vertical space OR blocked - use horizontal ports
      if (targetCenterX > sourceCenterX) {
        sourcePort = 'right';
        targetPort = 'right';
      } else {
        sourcePort = 'left';
        targetPort = 'left';
      }
    }
  }
  // Case 3: Elements overlap or are diagonal
  else {
    // Check which direction has more available space for routing
    const horizontalRoutingSpace = Math.abs(dx) - (sourceSize.width + targetSize.width) / 2;
    const verticalRoutingSpace = Math.abs(dy) - (sourceSize.height + targetSize.height) / 2;

    // Prefer direction with more space AND not blocked
    const preferHorizontal = !horizontalBlocked &&
                             (horizontalRoutingSpace > verticalRoutingSpace ||
                              (Math.abs(dx) > Math.abs(dy) && horizontalRoutingSpace > 0));
    const preferVertical = !verticalBlocked && !preferHorizontal;

    if (preferHorizontal && (horizontalRoutingSpace >= MIN_CLEARANCE / 2 || verticalRoutingSpace < 0)) {
      // Use horizontal ports
      if (dx >= 0) {
        sourcePort = 'right';
        targetPort = 'left';
      } else {
        sourcePort = 'left';
        targetPort = 'right';
      }
    } else {
      // Use vertical ports
      if (dy >= 0) {
        sourcePort = 'bottom';
        targetPort = 'top';
      } else {
        sourcePort = 'top';
        targetPort = 'bottom';
      }
    }
  }

  return { sourcePort, targetPort };
}

/**
 * Main Connection component
 * Renders a connection between two elements (or freehand endpoints)
 * Following the CLAUDE.md spec for text interaction model
 */
export default function Connection({
  connection,
  elements = [],
  packRegistry,
  isSelected = false,
  isHovered = false,
  isEditingLabel = false,
  onSelect,
  onDoubleClick,
  onUpdate,
  onDelete,
  onLabelChange,
  onEditingDone,
  onWaypointDrag,
  onSegmentDrag,
  onEndpointDrag,
  onCurveDrag,
  onMouseEnter,
  onMouseLeave,
  dragState, // For real-time updates during element dragging
  readOnly = false,
}) {
  // Find source and target elements
  const sourceRaw = elements.find(e => e.id === connection.sourceId);
  const targetRaw = elements.find(e => e.id === connection.targetId);

  // Apply drag offset if elements are being dragged
  const source = sourceRaw && dragState?.ids?.has(sourceRaw.id)
    ? { ...sourceRaw, x: sourceRaw.x + dragState.offset.x, y: sourceRaw.y + dragState.offset.y }
    : sourceRaw;
  const target = targetRaw && dragState?.ids?.has(targetRaw.id)
    ? { ...targetRaw, x: targetRaw.x + dragState.offset.x, y: targetRaw.y + dragState.offset.y }
    : targetRaw;

  // Ports are always sticky - they only change when user explicitly changes them
  // This matches professional tools like Visio and draw.io where connections stay put
  const effectivePorts = useMemo(() => {
    return {
      sourcePort: connection.sourcePort || 'right',
      targetPort: connection.targetPort || 'left',
    };
  }, [connection.sourcePort, connection.targetPort]);

  // Calculate positions
  const sourcePos = source
    ? getPortPosition(source, effectivePorts.sourcePort, packRegistry, connection.sourceRatio ?? 0.5)
    : connection.sourcePos;
  const targetPos = target
    ? getPortPosition(target, effectivePorts.targetPort, packRegistry, connection.targetRatio ?? 0.5)
    : connection.targetPos;

  // Get line style and renderer
  const lineStyle = connection.lineStyle || 'curved';
  const Renderer = RENDERERS[lineStyle] || RENDERERS.curved;
  const isSharp = lineStyle === 'step-sharp';

  // Build style object
  const style = useMemo(() => ({
    stroke: connection.stroke || connection.color || 'var(--text-muted)',
    strokeWidth: connection.strokeWidth || 2,
    dashPattern: connection.dashPattern || (connection.dashed ? 'dashed' : 'solid'),
    sourceMarker: connection.sourceMarker || 'none',
    targetMarker: connection.targetMarker || 'arrow',
    opacity: connection.strokeOpacity ?? 1,
  }), [connection]);

  // Calculate source and target stencil bounds
  // These are used to ensure the connection routes around its own endpoints
  const sourceBounds = useMemo(() => {
    if (!source) return null;
    const pack = packRegistry?.get?.(source.packId);
    const stencil = pack?.stencils?.find(s => s.id === source.type);
    const size = source.size || stencil?.defaultSize || { width: 120, height: 60 };
    return {
      x: source.x,
      y: source.y,
      width: size.width,
      height: size.height,
    };
  }, [source, packRegistry]);

  const targetBounds = useMemo(() => {
    if (!target) return null;
    const pack = packRegistry?.get?.(target.packId);
    const stencil = pack?.stencils?.find(s => s.id === target.type);
    const size = target.size || stencil?.defaultSize || { width: 120, height: 60 };
    return {
      x: target.x,
      y: target.y,
      width: size.width,
      height: size.height,
    };
  }, [target, packRegistry]);

  // Build obstacles list from all OTHER elements (excluding source and target)
  // Per CLAUDE.md: Nodes are hard obstacles, connectors MUST route around them
  const obstacles = useMemo(() => {
    if (!source || !target) return [];

    return elements
      .filter(el => el && el.id !== source.id && el.id !== target.id)
      .map(el => {
        if (typeof el.x !== 'number' || typeof el.y !== 'number') {
          return null;
        }
        // Apply drag offset if this element is being dragged
        const adjustedEl = dragState?.ids?.has(el.id)
          ? { ...el, x: el.x + dragState.offset.x, y: el.y + dragState.offset.y }
          : el;

        const pack = packRegistry?.get?.(adjustedEl.packId);
        const stencil = pack?.stencils?.find(s => s.id === adjustedEl.type);
        const size = adjustedEl.size || stencil?.defaultSize || { width: 120, height: 60 };
        return {
          id: adjustedEl.id,
          x: adjustedEl.x,
          y: adjustedEl.y,
          width: size.width,
          height: size.height,
        };
      })
      .filter(Boolean);
  }, [elements, source, target, packRegistry, dragState]);

  // Calculate label position based on actual path points
  const labelPos = useMemo(() => {
    // For orthogonal connections, calculate position using actual path points
    if ((lineStyle === 'step' || lineStyle === 'step-sharp') && sourcePos && targetPos) {
      const pathResult = buildOrthogonalPath(sourcePos, targetPos, effectivePorts.sourcePort, effectivePorts.targetPort, {
        sharp: isSharp,
        waypoints: connection.waypoints || [],
        sourceBounds,
        targetBounds,
      });

      if (pathResult.points && pathResult.points.length >= 2) {
        // Find midpoint along the actual path by total distance
        let totalLength = 0;
        const segmentLengths = [];

        for (let i = 0; i < pathResult.points.length - 1; i++) {
          const p1 = pathResult.points[i];
          const p2 = pathResult.points[i + 1];
          const len = Math.abs(p2.x - p1.x) + Math.abs(p2.y - p1.y); // Manhattan distance for orthogonal
          segmentLengths.push(len);
          totalLength += len;
        }

        // Find the point at half the total length
        let targetDist = totalLength / 2;
        let accum = 0;

        for (let i = 0; i < segmentLengths.length; i++) {
          if (accum + segmentLengths[i] >= targetDist) {
            // Midpoint is on this segment
            const p1 = pathResult.points[i];
            const p2 = pathResult.points[i + 1];
            const ratio = (targetDist - accum) / segmentLengths[i];
            return {
              x: p1.x + (p2.x - p1.x) * ratio,
              y: p1.y + (p2.y - p1.y) * ratio - 15, // Offset above the line
            };
          }
          accum += segmentLengths[i];
        }
      }
    }

    // Fallback to simple calculation for other line types
    return calculateMidLabelPosition(sourcePos, targetPos, connection.waypoints || []);
  }, [sourcePos, targetPos, connection.waypoints, lineStyle, isSharp, effectivePorts.sourcePort, effectivePorts.targetPort, sourceBounds, targetBounds]);

  // Event handlers
  const handleClick = useCallback((e) => {
    e.stopPropagation();
    onSelect?.(connection.id);
  }, [connection.id, onSelect]);

  const handleDoubleClick = useCallback((e) => {
    e.stopPropagation();
    onDoubleClick?.(connection, e);
  }, [connection, onDoubleClick]);

  const handleLabelDoubleClick = useCallback(() => {
    if (!readOnly) {
      onEditingDone?.(connection.id, true);
    }
  }, [connection.id, readOnly, onEditingDone]);

  const handleLabelChange = useCallback((value) => {
    onLabelChange?.(connection.id, value);
  }, [connection.id, onLabelChange]);

  const handleLabelEditComplete = useCallback((value) => {
    onLabelChange?.(connection.id, value);
    onEditingDone?.(connection.id, false);
  }, [connection.id, onLabelChange, onEditingDone]);

  const handleSegmentDrag = useCallback((index, isHorizontal, e) => {
    onSegmentDrag?.(connection.id, index, isHorizontal, e);
  }, [connection.id, onSegmentDrag]);

  const handleCurveDrag = useCallback((e) => {
    onCurveDrag?.(connection.id, sourcePos, targetPos, e);
  }, [connection.id, sourcePos, targetPos, onCurveDrag]);

  // Don't render if we don't have valid positions
  if (!sourcePos || !targetPos) return null;

  return (
    <g className={`ds-connection-group ${isSelected ? 'selected' : ''}`} data-connection-id={connection.id}>
      {/* Render the line using the appropriate renderer */}
      <Renderer
        sourcePos={sourcePos}
        targetPos={targetPos}
        sourcePort={effectivePorts.sourcePort}
        targetPort={effectivePorts.targetPort}
        sourceBounds={sourceBounds}
        targetBounds={targetBounds}
        waypoints={connection.waypoints || []}
        obstacles={obstacles}
        curveAmount={connection.curve ?? null}
        sharp={isSharp}
        isSelected={isSelected}
        isHovered={isHovered}
        style={style}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onSegmentDrag={handleSegmentDrag}
        onCurveDrag={handleCurveDrag}
        readOnly={readOnly}
      />

      {/* Mid-section label - inline editable per CLAUDE.md spec */}
      <ConnectionLabel
        value={connection.label || ''}
        position={labelPos}
        isSelected={isSelected}
        isEditing={isEditingLabel}
        onDoubleClick={handleLabelDoubleClick}
        onChange={handleLabelChange}
        onEditComplete={handleLabelEditComplete}
        readOnly={readOnly}
      />

      {/* Source endpoint label - toolbar only per CLAUDE.md spec */}
      <EndpointLabel
        value={connection.sourceLabel || ''}
        position={sourcePos}
        port={effectivePorts.sourcePort}
        type="source"
        isSelected={isSelected}
        isHovered={isHovered}
      />

      {/* Target endpoint label - toolbar only per CLAUDE.md spec */}
      <EndpointLabel
        value={connection.targetLabel || ''}
        position={targetPos}
        port={effectivePorts.targetPort}
        type="target"
        isSelected={isSelected}
        isHovered={isHovered}
      />

      {/* Waypoint handles - shown when selected */}
      {isSelected && !readOnly && (connection.waypoints || []).map((wp, idx) => (
        <WaypointHandle
          key={`wp-${idx}`}
          position={wp}
          index={idx}
          onDragStart={(e) => onWaypointDrag?.(connection.id, idx, e)}
          onDelete={() => {
            const newWaypoints = (connection.waypoints || []).filter((_, i) => i !== idx);
            onUpdate?.({ waypoints: newWaypoints });
          }}
        />
      ))}

      {/*
        Note: Endpoint handles are rendered in DiagramCanvas overlay (ds-endpoint-overlay)
        for selected connections. This overlay has higher z-index and proper pointer events.
        We don't render endpoint handles here to avoid flicker when hovering.
      */}
    </g>
  );
}

/**
 * Handle for connection endpoints (source/target)
 */
function EndpointHandle({ position, endpoint, isSelected, onDragStart }) {
  return (
    <circle
      cx={position.x}
      cy={position.y}
      r={6}
      fill={isSelected ? 'var(--selection, #4FB3CE)' : 'var(--bg)'}
      stroke={isSelected ? 'var(--selection, #4FB3CE)' : 'var(--text-muted)'}
      strokeWidth={2}
      style={{ cursor: 'move' }}
      onMouseDown={(e) => {
        e.stopPropagation();
        onDragStart?.(e);
      }}
    >
      <title>Drag to reposition {endpoint} endpoint</title>
    </circle>
  );
}

/**
 * Handle for waypoints
 */
function WaypointHandle({ position, index, onDragStart, onDelete }) {
  return (
    <circle
      cx={position.x}
      cy={position.y}
      r={5}
      fill="var(--selection, #4FB3CE)"
      stroke="var(--bg)"
      strokeWidth={2}
      style={{ cursor: 'move' }}
      onMouseDown={(e) => {
        e.stopPropagation();
        onDragStart?.(e);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDelete?.();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDelete?.();
      }}
    >
      <title>Drag to move, double-click or right-click to delete</title>
    </circle>
  );
}
