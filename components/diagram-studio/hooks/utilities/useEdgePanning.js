// components/diagram-studio/hooks/utilities/useEdgePanning.js
// Edge-pan detection and handling for canvas drag operations

import { useRef, useCallback, useEffect } from 'react';
import { EDGE_PAN_ZONE, EDGE_PAN_SPEED } from '../../utils';

/**
 * Hook for edge panning during drag operations.
 * When cursor is near the edge of the canvas container,
 * automatically pans the viewport in that direction.
 *
 * @param {Object} options - Configuration options
 * @param {Function} options.onPan - Called with { dx, dy } to pan the viewport
 * @param {Object} options.containerRef - Ref to the container element
 * @param {boolean} options.active - Whether edge panning is enabled
 * @param {number} options.edgeZone - Pixels from edge to trigger panning (default: EDGE_PAN_ZONE)
 * @param {number} options.panSpeed - Pixels to pan per frame (default: EDGE_PAN_SPEED)
 * @returns {Object} - { updatePosition, stop }
 */
export function useEdgePanning({
  onPan,
  containerRef,
  active = false,
  edgeZone = EDGE_PAN_ZONE,
  panSpeed = EDGE_PAN_SPEED,
}) {
  const rafRef = useRef(null);
  const lastPositionRef = useRef({ clientX: 0, clientY: 0 });
  const panDirectionRef = useRef({ dx: 0, dy: 0 });
  const onPanRef = useRef(onPan);

  // Update onPan ref
  useEffect(() => {
    onPanRef.current = onPan;
  }, [onPan]);

  /**
   * Calculate pan direction based on cursor position relative to container
   */
  const calculatePanDirection = useCallback((clientX, clientY) => {
    const container = containerRef?.current;
    if (!container) return { dx: 0, dy: 0 };

    const rect = container.getBoundingClientRect();
    let dx = 0;
    let dy = 0;

    // Check left edge
    if (clientX - rect.left < edgeZone) {
      dx = panSpeed;
    }
    // Check right edge
    else if (rect.right - clientX < edgeZone) {
      dx = -panSpeed;
    }

    // Check top edge
    if (clientY - rect.top < edgeZone) {
      dy = panSpeed;
    }
    // Check bottom edge
    else if (rect.bottom - clientY < edgeZone) {
      dy = -panSpeed;
    }

    return { dx, dy };
  }, [containerRef, edgeZone, panSpeed]);

  /**
   * Animation loop for continuous edge panning
   */
  const panLoop = useCallback(() => {
    const { dx, dy } = panDirectionRef.current;

    if (dx !== 0 || dy !== 0) {
      onPanRef.current?.({ dx, dy });
    }

    if (rafRef.current !== null) {
      rafRef.current = requestAnimationFrame(panLoop);
    }
  }, []);

  /**
   * Start edge panning based on current cursor position
   */
  const startPanning = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(panLoop);
  }, [panLoop]);

  /**
   * Stop edge panning
   */
  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    panDirectionRef.current = { dx: 0, dy: 0 };
  }, []);

  /**
   * Update cursor position and check for edge panning
   * Call this on each mouse move during drag
   *
   * @param {number} clientX - Mouse clientX
   * @param {number} clientY - Mouse clientY
   * @returns {Object} - Current pan direction { dx, dy }
   */
  const updatePosition = useCallback((clientX, clientY) => {
    lastPositionRef.current = { clientX, clientY };

    if (!active) {
      stop();
      return { dx: 0, dy: 0 };
    }

    const direction = calculatePanDirection(clientX, clientY);
    panDirectionRef.current = direction;

    // Start or stop panning based on direction
    if (direction.dx !== 0 || direction.dy !== 0) {
      startPanning();
    } else {
      stop();
    }

    return direction;
  }, [active, calculatePanDirection, startPanning, stop]);

  // Cleanup on unmount or when becoming inactive
  useEffect(() => {
    if (!active) {
      stop();
    }
    return () => {
      stop();
    };
  }, [active, stop]);

  return {
    updatePosition,
    stop,
    isPanning: () => rafRef.current !== null,
  };
}

/**
 * Simpler hook that just detects if cursor is in edge zone
 * without starting a panning loop (for manual control)
 *
 * @param {Object} containerRef - Ref to container element
 * @param {number} edgeZone - Pixels from edge to trigger
 * @returns {Function} - getEdgeDirection(clientX, clientY) => { dx, dy }
 */
export function useEdgeDetection(containerRef, edgeZone = EDGE_PAN_ZONE) {
  const getEdgeDirection = useCallback((clientX, clientY) => {
    const container = containerRef?.current;
    if (!container) return { dx: 0, dy: 0, edge: null };

    const rect = container.getBoundingClientRect();
    let dx = 0;
    let dy = 0;
    let edge = null;

    // Check horizontal edges
    if (clientX - rect.left < edgeZone) {
      dx = 1;
      edge = 'left';
    } else if (rect.right - clientX < edgeZone) {
      dx = -1;
      edge = 'right';
    }

    // Check vertical edges
    if (clientY - rect.top < edgeZone) {
      dy = 1;
      edge = edge ? 'corner' : 'top';
    } else if (rect.bottom - clientY < edgeZone) {
      dy = -1;
      edge = edge ? 'corner' : 'bottom';
    }

    return { dx, dy, edge };
  }, [containerRef, edgeZone]);

  return getEdgeDirection;
}

export default useEdgePanning;
