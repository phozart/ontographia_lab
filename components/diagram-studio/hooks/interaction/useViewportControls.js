// components/diagram-studio/hooks/interaction/useViewportControls.js
// Viewport pan, zoom, and navigation controls

import { useRef, useCallback } from 'react';
import { MIN_ZOOM, MAX_ZOOM, clampViewport } from '../../utils';

/**
 * Hook for viewport controls (pan, zoom, fit-to-screen).
 *
 * @param {Object} options - Configuration options
 * @param {Object} options.viewport - Current viewport { x, y, scale }
 * @param {Function} options.setViewport - Function to update viewport
 * @param {Object} options.containerRef - Ref to the container element
 * @param {number} options.minZoom - Minimum zoom level (default: MIN_ZOOM)
 * @param {number} options.maxZoom - Maximum zoom level (default: MAX_ZOOM)
 * @returns {Object} - Viewport control methods and state
 */
export function useViewportControls({
  viewport,
  setViewport,
  containerRef,
  minZoom = MIN_ZOOM,
  maxZoom = MAX_ZOOM,
}) {
  const panStartRef = useRef(null);
  const isPanningRef = useRef(false);

  /**
   * Clamp zoom level to valid range
   */
  const clampZoom = useCallback((scale) => {
    return Math.max(minZoom, Math.min(maxZoom, scale));
  }, [minZoom, maxZoom]);

  /**
   * Zoom to a specific scale, optionally centered on a point
   */
  const zoomTo = useCallback((newScale, centerX, centerY) => {
    const clampedScale = clampZoom(newScale);

    if (centerX !== undefined && centerY !== undefined) {
      // Zoom centered on a specific point
      setViewport((prev) => {
        const scaleFactor = clampedScale / prev.scale;
        return {
          x: centerX - (centerX - prev.x) * scaleFactor,
          y: centerY - (centerY - prev.y) * scaleFactor,
          scale: clampedScale,
        };
      });
    } else {
      // Zoom centered on viewport center
      const container = containerRef?.current;
      const containerWidth = container?.clientWidth || 1200;
      const containerHeight = container?.clientHeight || 800;
      const centerXDefault = containerWidth / 2;
      const centerYDefault = containerHeight / 2;

      setViewport((prev) => {
        const scaleFactor = clampedScale / prev.scale;
        return {
          x: centerXDefault - (centerXDefault - prev.x) * scaleFactor,
          y: centerYDefault - (centerYDefault - prev.y) * scaleFactor,
          scale: clampedScale,
        };
      });
    }
  }, [clampZoom, setViewport, containerRef]);

  /**
   * Zoom in by a step amount
   */
  const zoomIn = useCallback((step = 0.1, centerX, centerY) => {
    zoomTo(viewport.scale + step, centerX, centerY);
  }, [viewport.scale, zoomTo]);

  /**
   * Zoom out by a step amount
   */
  const zoomOut = useCallback((step = 0.1, centerX, centerY) => {
    zoomTo(viewport.scale - step, centerX, centerY);
  }, [viewport.scale, zoomTo]);

  /**
   * Reset zoom to 100%
   */
  const resetZoom = useCallback(() => {
    setViewport({ x: 0, y: 0, scale: 1 });
  }, [setViewport]);

  /**
   * Fit all elements in view
   */
  const zoomToFitAll = useCallback((elements, containerWidth, containerHeight, padding = 50) => {
    if (!elements || elements.length === 0) {
      resetZoom();
      return;
    }

    // Calculate bounding box of all elements
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    elements.forEach(el => {
      const size = el.size || { width: 120, height: 60 };
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + size.width);
      maxY = Math.max(maxY, el.y + size.height);
    });

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    if (contentWidth <= 0 || contentHeight <= 0) {
      resetZoom();
      return;
    }

    // Calculate scale to fit content with padding
    const availableWidth = containerWidth - padding * 2;
    const availableHeight = containerHeight - padding * 2;
    const scaleX = availableWidth / contentWidth;
    const scaleY = availableHeight / contentHeight;
    const scale = clampZoom(Math.min(scaleX, scaleY, 1)); // Don't zoom in past 100%

    // Calculate offset to center content
    const scaledContentWidth = contentWidth * scale;
    const scaledContentHeight = contentHeight * scale;
    const x = (containerWidth - scaledContentWidth) / 2 - minX * scale;
    const y = (containerHeight - scaledContentHeight) / 2 - minY * scale;

    setViewport({ x, y, scale });
  }, [resetZoom, clampZoom, setViewport]);

  /**
   * Fit selected elements in view
   */
  const zoomToSelection = useCallback((selectedElements, containerWidth, containerHeight, padding = 80) => {
    zoomToFitAll(selectedElements, containerWidth, containerHeight, padding);
  }, [zoomToFitAll]);

  /**
   * Pan viewport by delta
   */
  const panBy = useCallback((dx, dy) => {
    setViewport((prev) => ({
      ...prev,
      x: prev.x + dx,
      y: prev.y + dy,
    }));
  }, [setViewport]);

  /**
   * Pan viewport to center on a point
   */
  const panTo = useCallback((x, y) => {
    const container = containerRef?.current;
    const containerWidth = container?.clientWidth || 1200;
    const containerHeight = container?.clientHeight || 800;

    setViewport((prev) => ({
      ...prev,
      x: containerWidth / 2 - x * prev.scale,
      y: containerHeight / 2 - y * prev.scale,
    }));
  }, [setViewport, containerRef]);

  /**
   * Start panning from a point (for drag-to-pan)
   */
  const startPan = useCallback((clientX, clientY) => {
    panStartRef.current = { x: clientX, y: clientY, viewportX: viewport.x, viewportY: viewport.y };
    isPanningRef.current = true;
  }, [viewport.x, viewport.y]);

  /**
   * Continue panning (called during drag)
   */
  const continuePan = useCallback((clientX, clientY) => {
    if (!panStartRef.current || !isPanningRef.current) return;

    const dx = clientX - panStartRef.current.x;
    const dy = clientY - panStartRef.current.y;

    setViewport((prev) => ({
      ...prev,
      x: panStartRef.current.viewportX + dx,
      y: panStartRef.current.viewportY + dy,
    }));
  }, [setViewport]);

  /**
   * End panning
   */
  const endPan = useCallback(() => {
    panStartRef.current = null;
    isPanningRef.current = false;
  }, []);

  /**
   * Handle mouse wheel for zooming
   */
  const handleWheel = useCallback((e) => {
    e.preventDefault();

    const rect = containerRef?.current?.getBoundingClientRect();
    if (!rect) return;

    // Get mouse position relative to container
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Zoom step based on wheel delta
    const zoomStep = e.deltaY > 0 ? -0.1 : 0.1;
    const newScale = clampZoom(viewport.scale + zoomStep);

    // Zoom centered on mouse position
    const scaleFactor = newScale / viewport.scale;
    const newX = mouseX - (mouseX - viewport.x) * scaleFactor;
    const newY = mouseY - (mouseY - viewport.y) * scaleFactor;

    setViewport({ x: newX, y: newY, scale: newScale });
  }, [viewport, clampZoom, setViewport, containerRef]);

  /**
   * Convert screen coordinates to canvas coordinates
   */
  const screenToCanvas = useCallback((screenX, screenY) => {
    return {
      x: (screenX - viewport.x) / viewport.scale,
      y: (screenY - viewport.y) / viewport.scale,
    };
  }, [viewport]);

  /**
   * Convert canvas coordinates to screen coordinates
   */
  const canvasToScreen = useCallback((canvasX, canvasY) => {
    return {
      x: canvasX * viewport.scale + viewport.x,
      y: canvasY * viewport.scale + viewport.y,
    };
  }, [viewport]);

  return {
    // Zoom controls
    zoomIn,
    zoomOut,
    zoomTo,
    resetZoom,
    zoomToFitAll,
    zoomToSelection,

    // Pan controls
    panBy,
    panTo,
    startPan,
    continuePan,
    endPan,

    // Event handlers
    handleWheel,

    // Coordinate conversion
    screenToCanvas,
    canvasToScreen,

    // State
    isPanning: () => isPanningRef.current,
    scale: viewport.scale,
    position: { x: viewport.x, y: viewport.y },
  };
}

export default useViewportControls;
