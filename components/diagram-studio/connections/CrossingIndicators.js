// components/diagram-studio/connections/CrossingIndicators.js
// Renders bridge/hop indicators where connection lines cross

import React, { useMemo } from 'react';
import { buildOrthogonalPath } from './geometry/orthogonalRouting';
import { getLineIntersection } from './geometry/pathBuilders';

/**
 * Get port position for a connection endpoint
 */
function getPortPosition(element, port, packRegistry, ratio = 0.5) {
  if (!element) return null;

  const pack = packRegistry?.get?.(element.packId);
  const stencil = pack?.stencils?.find(s => s.id === element.type);
  const size = element.size || stencil?.defaultSize || { width: 120, height: 60 };

  const clampedRatio = Math.max(0, Math.min(1, ratio));

  switch (port) {
    case 'top':
      return { x: element.x + size.width * clampedRatio, y: element.y };
    case 'bottom':
      return { x: element.x + size.width * clampedRatio, y: element.y + size.height };
    case 'left':
      return { x: element.x, y: element.y + size.height * clampedRatio };
    case 'right':
      return { x: element.x + size.width, y: element.y + size.height * clampedRatio };
    default:
      return { x: element.x + size.width / 2, y: element.y + size.height / 2 };
  }
}

/**
 * Get stencil bounds for routing
 */
function getStencilBounds(element, packRegistry) {
  if (!element) return null;
  const pack = packRegistry?.get?.(element.packId);
  const stencil = pack?.stencils?.find(s => s.id === element.type);
  const size = element.size || stencil?.defaultSize || { width: 120, height: 60 };
  return { x: element.x, y: element.y, width: size.width, height: size.height };
}

/**
 * Renders crossing indicators (bridges/hops) where lines cross
 */
export default function CrossingIndicators({
  connections,
  elements,
  packRegistry,
  bridgeSize = 6,
  strokeColor = 'var(--canvas-bg, #ffffff)',
  strokeWidth = 4,
}) {
  // Calculate all path points for orthogonal connections
  const connectionPaths = useMemo(() => {
    return connections.map(conn => {
      const lineStyle = conn.lineStyle || 'curved';

      // Only process orthogonal (step) connections
      if (lineStyle !== 'step' && lineStyle !== 'step-sharp') {
        return { id: conn.id, points: [] };
      }

      const source = elements.find(e => e.id === conn.sourceId);
      const target = elements.find(e => e.id === conn.targetId);

      const sourcePort = conn.sourcePort || 'right';
      const targetPort = conn.targetPort || 'left';

      const sourcePos = source
        ? getPortPosition(source, sourcePort, packRegistry, conn.sourceRatio ?? 0.5)
        : conn.sourcePos;
      const targetPos = target
        ? getPortPosition(target, targetPort, packRegistry, conn.targetRatio ?? 0.5)
        : conn.targetPos;

      if (!sourcePos || !targetPos) {
        return { id: conn.id, points: [] };
      }

      const sourceBounds = getStencilBounds(source, packRegistry);
      const targetBounds = getStencilBounds(target, packRegistry);

      const pathResult = buildOrthogonalPath(sourcePos, targetPos, sourcePort, targetPort, {
        sharp: lineStyle === 'step-sharp',
        waypoints: conn.waypoints || [],
        sourceBounds,
        targetBounds,
      });

      return { id: conn.id, points: pathResult.points || [] };
    });
  }, [connections, elements, packRegistry]);

  // Find all crossings between connections
  const crossings = useMemo(() => {
    const allCrossings = [];

    for (let i = 0; i < connectionPaths.length; i++) {
      const path1 = connectionPaths[i];
      if (path1.points.length < 2) continue;

      for (let j = i + 1; j < connectionPaths.length; j++) {
        const path2 = connectionPaths[j];
        if (path2.points.length < 2) continue;

        // Check each segment of path1 against each segment of path2
        for (let s1 = 0; s1 < path1.points.length - 1; s1++) {
          const p1 = path1.points[s1];
          const p2 = path1.points[s1 + 1];

          // Determine if this segment is horizontal
          const isHorizontal = Math.abs(p2.y - p1.y) < Math.abs(p2.x - p1.x);

          for (let s2 = 0; s2 < path2.points.length - 1; s2++) {
            const p3 = path2.points[s2];
            const p4 = path2.points[s2 + 1];

            const intersection = getLineIntersection(p1, p2, p3, p4);
            if (intersection) {
              allCrossings.push({
                x: intersection.x,
                y: intersection.y,
                isHorizontal,
                conn1: path1.id,
                conn2: path2.id,
              });
            }
          }
        }
      }
    }

    return allCrossings;
  }, [connectionPaths]);

  if (crossings.length === 0) return null;

  // Gap style - small break in the "under" line
  // Size should be slightly larger than typical connection stroke width (2px)
  const gapSize = 10;

  return (
    <g className="crossing-indicators">
      {crossings.map((crossing, idx) => {
        const { x, y, isHorizontal } = crossing;

        // Render a small gap - the horizontal line goes "over" the vertical
        // So we put the gap in the vertical line (or vice versa based on which appears on top)
        if (isHorizontal) {
          // Horizontal line is on top, create gap in vertical line
          return (
            <line
              key={`crossing-${idx}`}
              x1={x}
              y1={y - gapSize}
              x2={x}
              y2={y + gapSize}
              stroke={strokeColor}
              strokeWidth={strokeWidth + 2}
              strokeLinecap="round"
            />
          );
        } else {
          // Vertical line is on top, create gap in horizontal line
          return (
            <line
              key={`crossing-${idx}`}
              x1={x - gapSize}
              y1={y}
              x2={x + gapSize}
              y2={y}
              stroke={strokeColor}
              strokeWidth={strokeWidth + 2}
              strokeLinecap="round"
            />
          );
        }
      })}
    </g>
  );
}
