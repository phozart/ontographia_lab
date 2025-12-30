// components/diagram-studio/hooks/interaction/useAlignmentGuides.js
// Alignment snap guides for element dragging

import { useState, useCallback } from 'react';
import { calculateSnapGuides, GUIDE_SNAP_THRESHOLD } from '../../utils';

/**
 * Hook for managing alignment snap guides during element dragging.
 *
 * @param {Object} options - Configuration options
 * @param {Array} options.elements - All diagram elements
 * @param {Object} options.packRegistry - Pack registry for element sizes
 * @param {number} options.threshold - Snap threshold in pixels (default: GUIDE_SNAP_THRESHOLD)
 * @returns {Object} - Alignment guide methods and state
 */
export function useAlignmentGuides({
  elements,
  packRegistry,
  threshold = GUIDE_SNAP_THRESHOLD,
}) {
  const [guides, setGuides] = useState({ horizontal: [], vertical: [] });
  const [snapOffset, setSnapOffset] = useState({ x: null, y: null });

  /**
   * Calculate guides for a dragging element
   * Returns snap offsets that can be applied to the element position
   */
  const calculateGuides = useCallback((draggingElement) => {
    if (!draggingElement || !elements) {
      setGuides({ horizontal: [], vertical: [] });
      setSnapOffset({ x: null, y: null });
      return { snapX: null, snapY: null };
    }

    const result = calculateSnapGuides(
      draggingElement,
      elements,
      packRegistry,
      threshold
    );

    setGuides(result.guides);
    setSnapOffset({ x: result.snapX, y: result.snapY });

    return { snapX: result.snapX, snapY: result.snapY };
  }, [elements, packRegistry, threshold]);

  /**
   * Apply snap offset to coordinates
   */
  const applySnap = useCallback((x, y, currentSnapOffset) => {
    const offset = currentSnapOffset || snapOffset;
    return {
      x: offset.x !== null ? x + offset.x : x,
      y: offset.y !== null ? y + offset.y : y,
    };
  }, [snapOffset]);

  /**
   * Clear all guides
   */
  const clearGuides = useCallback(() => {
    setGuides({ horizontal: [], vertical: [] });
    setSnapOffset({ x: null, y: null });
  }, []);

  /**
   * Check if a position is within snap threshold of a guide
   */
  const isNearGuide = useCallback((position, guidePosition) => {
    return Math.abs(position - guidePosition) < threshold;
  }, [threshold]);

  /**
   * Get the nearest guide for a given position
   */
  const getNearestGuide = useCallback((position, guideList, direction = 'vertical') => {
    if (!guideList || guideList.length === 0) return null;

    let nearest = null;
    let minDistance = threshold;

    guideList.forEach(guide => {
      const guidePos = direction === 'vertical' ? guide.x : guide.y;
      const distance = Math.abs(position - guidePos);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = guide;
      }
    });

    return nearest;
  }, [threshold]);

  /**
   * Render data for guides (for use in SVG rendering)
   */
  const getGuideRenderData = useCallback(() => {
    return {
      horizontal: guides.horizontal.map(g => ({
        key: `h-${g.y}-${g.x1}-${g.x2}`,
        y: g.y,
        x1: g.x1,
        x2: g.x2,
        type: g.type,
      })),
      vertical: guides.vertical.map(g => ({
        key: `v-${g.x}-${g.y1}-${g.y2}`,
        x: g.x,
        y1: g.y1,
        y2: g.y2,
        type: g.type,
      })),
    };
  }, [guides]);

  return {
    // State
    guides,
    snapOffset,
    hasGuides: guides.horizontal.length > 0 || guides.vertical.length > 0,

    // Methods
    calculateGuides,
    setGuides, // Direct setter for manual guide creation (e.g., connection dragging)
    applySnap,
    clearGuides,
    isNearGuide,
    getNearestGuide,
    getGuideRenderData,
  };
}

/**
 * SVG Guide rendering component helper
 * Returns JSX for rendering alignment guides
 */
export function renderAlignmentGuides(guides, viewport) {
  const { horizontal, vertical } = guides;

  return (
    <>
      {/* Horizontal guides */}
      {horizontal.map((guide, idx) => (
        <line
          key={`h-guide-${idx}`}
          x1={guide.x1}
          y1={guide.y}
          x2={guide.x2}
          y2={guide.y}
          stroke={guide.type === 'center' ? '#6366f1' : '#10b981'}
          strokeWidth={1 / (viewport?.scale || 1)}
          strokeDasharray={guide.type === 'center' ? '4,4' : 'none'}
          style={{ pointerEvents: 'none' }}
        />
      ))}

      {/* Vertical guides */}
      {vertical.map((guide, idx) => (
        <line
          key={`v-guide-${idx}`}
          x1={guide.x}
          y1={guide.y1}
          x2={guide.x}
          y2={guide.y2}
          stroke={guide.type === 'center' ? '#6366f1' : '#10b981'}
          strokeWidth={1 / (viewport?.scale || 1)}
          strokeDasharray={guide.type === 'center' ? '4,4' : 'none'}
          style={{ pointerEvents: 'none' }}
        />
      ))}
    </>
  );
}

export default useAlignmentGuides;
