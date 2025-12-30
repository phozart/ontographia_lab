// components/diagram-studio/hooks/interaction/useDragSystem.js
// Element drag handling with multi-select, snap guides, and edge panning

import { useState, useRef, useCallback, useEffect } from 'react';
import { clampToCanvas, snapToGrid, calculateSnapGuides, GUIDE_SNAP_THRESHOLD } from '../../utils';

/**
 * Hook for element drag operations.
 * Handles single and multi-select dragging with alignment snapping.
 *
 * @param {Object} options - Configuration options
 * @param {Array} options.elements - All diagram elements
 * @param {Object} options.selection - Current selection { nodeIds: string[] }
 * @param {Object} options.viewport - Current viewport { x, y, scale }
 * @param {Function} options.updateElement - Function to update an element
 * @param {Function} options.selectElement - Function to select an element
 * @param {Function} options.recordHistory - Function to record undo history
 * @param {Object} options.containerRef - Ref to the container element
 * @param {Object} options.packRegistry - Pack registry for element sizes
 * @param {boolean} options.readOnly - Whether in read-only mode
 * @param {boolean} options.canMove - Whether elements can be moved
 * @returns {Object} - Drag system methods and state
 */
export function useDragSystem({
  elements,
  selection,
  viewport,
  updateElement,
  selectElement,
  recordHistory,
  containerRef,
  packRegistry,
  readOnly = false,
  canMove = true,
}) {
  // Drag state
  const [draggingElement, setDraggingElement] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [snapGuides, setSnapGuides] = useState({ horizontal: [], vertical: [] });
  const [marquee, setMarquee] = useState(null);

  // Refs for synchronous access in event handlers
  const draggingElementRef = useRef(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const dragStartElementPosRef = useRef({ x: 0, y: 0 });
  const dragStartPositionsRef = useRef({}); // For multi-select
  const dragStartedRef = useRef(false);
  const currentPosRef = useRef({ x: 0, y: 0 });
  const viewportRef = useRef(viewport);
  const alignmentSnappedRef = useRef({ x: false, y: false });

  // Keep viewport ref in sync
  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  /**
   * Get element size from pack registry
   */
  const getElementSize = useCallback((element) => {
    const pack = packRegistry?.get?.(element.packId);
    const stencil = pack?.stencils?.find(s => s.id === element.type);
    return element.size || stencil?.defaultSize || { width: 120, height: 60 };
  }, [packRegistry]);

  /**
   * Convert screen coordinates to canvas coordinates
   */
  const screenToCanvas = useCallback((clientX, clientY) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };

    const vp = viewportRef.current;
    return {
      x: (clientX - rect.left) / vp.scale - vp.x,
      y: (clientY - rect.top) / vp.scale - vp.y,
    };
  }, [containerRef]);

  /**
   * Start dragging an element
   */
  const startDrag = useCallback((e, element, options = {}) => {
    if (readOnly || !canMove) return false;

    const { addToSelection = false } = options;

    // Prevent re-initialization if already dragging this element
    if (draggingElementRef.current === element.id) return false;

    const canvasPos = screenToCanvas(e.clientX, e.clientY);

    // Calculate drag offset (mouse position relative to element)
    const offset = {
      x: canvasPos.x - element.x,
      y: canvasPos.y - element.y,
    };

    // Set refs for synchronous access
    draggingElementRef.current = element.id;
    dragOffsetRef.current = offset;
    dragStartPosRef.current = canvasPos;
    dragStartElementPosRef.current = { x: element.x, y: element.y };
    dragStartedRef.current = false;
    currentPosRef.current = { x: element.x, y: element.y };

    // Store start positions for all selected elements (multi-select drag)
    const startPositions = {};
    if (selection?.nodeIds?.length > 1 && selection.nodeIds.includes(element.id)) {
      selection.nodeIds.forEach(id => {
        const el = elements.find(e => e.id === id);
        if (el) {
          startPositions[id] = { x: el.x, y: el.y };
        }
      });
    } else {
      startPositions[element.id] = { x: element.x, y: element.y };
    }
    dragStartPositionsRef.current = startPositions;

    // Update state
    setDraggingElement(element.id);
    setDragOffset(offset);

    // Select the element if not already selected
    if (!selection?.nodeIds?.includes(element.id)) {
      selectElement(element.id, addToSelection);
    }

    return true;
  }, [readOnly, canMove, screenToCanvas, selection, elements, selectElement]);

  /**
   * Continue dragging (called on mouse move)
   */
  const continueDrag = useCallback((e) => {
    if (!draggingElementRef.current) return null;

    const canvasPos = screenToCanvas(e.clientX, e.clientY);
    const offset = dragOffsetRef.current;

    // Calculate new position
    let newX = clampToCanvas(canvasPos.x - offset.x);
    let newY = clampToCanvas(canvasPos.y - offset.y);

    // Get the dragging element
    const element = elements.find(el => el.id === draggingElementRef.current);
    if (!element) return null;

    // Apply alignment snap guides (unless it's a frame)
    const isFrame = element.type === 'frame' || element.isFrame;
    if (!isFrame) {
      const tempElement = { ...element, x: newX, y: newY };
      const { guides, snapX, snapY } = calculateSnapGuides(tempElement, elements, packRegistry);
      setSnapGuides(guides);
      alignmentSnappedRef.current = { x: snapX !== null, y: snapY !== null };

      if (snapX !== null) newX += snapX;
      if (snapY !== null) newY += snapY;
    } else {
      setSnapGuides({ horizontal: [], vertical: [] });
      alignmentSnappedRef.current = { x: false, y: false };
    }

    // Update current position
    currentPosRef.current = { x: newX, y: newY };
    dragStartedRef.current = true;

    // Calculate delta from start position
    const startPos = dragStartElementPosRef.current;
    const deltaX = newX - startPos.x;
    const deltaY = newY - startPos.y;

    return {
      elementId: draggingElementRef.current,
      position: { x: newX, y: newY },
      delta: { x: deltaX, y: deltaY },
      canvasPos,
      snapped: alignmentSnappedRef.current,
    };
  }, [screenToCanvas, elements, packRegistry]);

  /**
   * End dragging and commit the position
   */
  const endDrag = useCallback(() => {
    if (!draggingElementRef.current) return null;

    const elementId = draggingElementRef.current;
    const hasMoved = dragStartedRef.current;
    const finalPos = currentPosRef.current;
    const startPositions = dragStartPositionsRef.current;

    // Clear snap guides
    setSnapGuides({ horizontal: [], vertical: [] });

    // Apply final positions if drag actually occurred
    if (hasMoved) {
      const deltaX = finalPos.x - dragStartElementPosRef.current.x;
      const deltaY = finalPos.y - dragStartElementPosRef.current.y;

      // Update all elements being dragged (for multi-select)
      Object.keys(startPositions).forEach(id => {
        const startPos = startPositions[id];
        updateElement(id, {
          x: snapToGrid(startPos.x + deltaX),
          y: snapToGrid(startPos.y + deltaY),
        });
      });

      recordHistory?.();
    }

    // Reset state
    draggingElementRef.current = null;
    dragOffsetRef.current = { x: 0, y: 0 };
    dragStartPositionsRef.current = {};
    dragStartedRef.current = false;
    setDraggingElement(null);

    return {
      elementId,
      hasMoved,
      finalPos,
    };
  }, [updateElement, recordHistory]);

  /**
   * Cancel drag without committing
   */
  const cancelDrag = useCallback(() => {
    draggingElementRef.current = null;
    dragOffsetRef.current = { x: 0, y: 0 };
    dragStartPositionsRef.current = {};
    dragStartedRef.current = false;
    setDraggingElement(null);
    setSnapGuides({ horizontal: [], vertical: [] });
  }, []);

  /**
   * Start marquee selection
   */
  const startMarquee = useCallback((e) => {
    const canvasPos = screenToCanvas(e.clientX, e.clientY);
    setMarquee({
      startX: canvasPos.x,
      startY: canvasPos.y,
      currentX: canvasPos.x,
      currentY: canvasPos.y,
    });
  }, [screenToCanvas]);

  /**
   * Continue marquee selection
   */
  const continueMarquee = useCallback((e) => {
    if (!marquee) return null;

    const canvasPos = screenToCanvas(e.clientX, e.clientY);
    const newMarquee = {
      ...marquee,
      currentX: canvasPos.x,
      currentY: canvasPos.y,
    };
    setMarquee(newMarquee);

    // Calculate marquee bounds
    const left = Math.min(marquee.startX, canvasPos.x);
    const right = Math.max(marquee.startX, canvasPos.x);
    const top = Math.min(marquee.startY, canvasPos.y);
    const bottom = Math.max(marquee.startY, canvasPos.y);

    // Find elements within marquee
    const selectedIds = elements
      .filter(el => {
        const size = getElementSize(el);
        const elRight = el.x + size.width;
        const elBottom = el.y + size.height;

        // Check if element intersects with marquee
        return el.x < right && elRight > left && el.y < bottom && elBottom > top;
      })
      .map(el => el.id);

    return { bounds: { left, right, top, bottom }, selectedIds };
  }, [marquee, screenToCanvas, elements, getElementSize]);

  /**
   * End marquee selection
   */
  const endMarquee = useCallback((selectCallback) => {
    if (!marquee) return;

    // Calculate final bounds
    const left = Math.min(marquee.startX, marquee.currentX);
    const right = Math.max(marquee.startX, marquee.currentX);
    const top = Math.min(marquee.startY, marquee.currentY);
    const bottom = Math.max(marquee.startY, marquee.currentY);

    // Find elements within marquee
    const selectedIds = elements
      .filter(el => {
        const size = getElementSize(el);
        const elRight = el.x + size.width;
        const elBottom = el.y + size.height;
        return el.x < right && elRight > left && el.y < bottom && elBottom > top;
      })
      .map(el => el.id);

    // Call callback to select elements
    selectCallback?.(selectedIds);

    setMarquee(null);
  }, [marquee, elements, getElementSize]);

  /**
   * Cancel marquee selection
   */
  const cancelMarquee = useCallback(() => {
    setMarquee(null);
  }, []);

  /**
   * Get drag transform for CSS
   */
  const getDragTransform = useCallback((elementId) => {
    if (draggingElementRef.current !== elementId && !dragStartPositionsRef.current[elementId]) {
      return null;
    }

    const startPos = dragStartPositionsRef.current[elementId];
    if (!startPos) return null;

    const currentPos = currentPosRef.current;
    const primaryStart = dragStartElementPosRef.current;

    // Calculate delta from primary element and apply to this element
    const deltaX = currentPos.x - primaryStart.x;
    const deltaY = currentPos.y - primaryStart.y;

    return {
      x: deltaX,
      y: deltaY,
      transform: `translate(${deltaX}px, ${deltaY}px)`,
    };
  }, []);

  return {
    // State
    draggingElement,
    isDragging: draggingElement !== null,
    dragOffset,
    snapGuides,
    marquee,
    hasDragStarted: () => dragStartedRef.current,

    // Drag methods
    startDrag,
    continueDrag,
    endDrag,
    cancelDrag,
    getDragTransform,

    // Marquee methods
    startMarquee,
    continueMarquee,
    endMarquee,
    cancelMarquee,

    // Utilities
    screenToCanvas,
    getElementSize,
  };
}

export default useDragSystem;
