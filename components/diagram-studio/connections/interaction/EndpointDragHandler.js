// components/diagram-studio/connections/interaction/EndpointDragHandler.js
// Hook for handling endpoint dragging (repositioning connection endpoints)

import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Hook for managing endpoint drag state and behavior
 * Allows repositioning connection endpoints to different points on stencils
 * or detaching to free-floating positions
 */
export function useEndpointDrag({
  connectionId,
  endpoint, // 'source' or 'target'
  elements,
  packRegistry,
  viewport,
  canvasRef,
  gridSize = 20,
  onUpdate,
  findNearbyNode, // Function to find node at position
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [previewPos, setPreviewPos] = useState(null);
  const dragDataRef = useRef(null);

  // Start dragging
  const handleDragStart = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const startX = (e.clientX - rect.left) / viewport.scale - viewport.x;
    const startY = (e.clientY - rect.top) / viewport.scale - viewport.y;

    dragDataRef.current = {
      startX,
      startY,
      connectionId,
      endpoint,
    };

    setIsDragging(true);
    setPreviewPos({ x: startX, y: startY });
  }, [connectionId, endpoint, viewport, canvasRef]);

  // Update position during drag
  const handleDrag = useCallback((e) => {
    if (!isDragging || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / viewport.scale - viewport.x;
    const y = (e.clientY - rect.top) / viewport.scale - viewport.y;

    // Snap to grid
    const snappedX = Math.round(x / gridSize) * gridSize;
    const snappedY = Math.round(y / gridSize) * gridSize;

    setPreviewPos({ x: snappedX, y: snappedY });
  }, [isDragging, viewport, canvasRef, gridSize]);

  // End dragging and commit
  const handleDragEnd = useCallback((e) => {
    if (!isDragging || !previewPos) {
      setIsDragging(false);
      setPreviewPos(null);
      return;
    }

    const { x, y } = previewPos;

    // Check if we're dropping on a node
    const nearbyNode = findNearbyNode?.(x, y, elements, packRegistry, 25);

    if (nearbyNode) {
      // Attach to the nearby node
      const { element, port, ratio } = nearbyNode;
      const idKey = endpoint === 'source' ? 'sourceId' : 'targetId';
      const portKey = endpoint === 'source' ? 'sourcePort' : 'targetPort';
      const ratioKey = endpoint === 'source' ? 'sourceRatio' : 'targetRatio';
      const posKey = endpoint === 'source' ? 'sourcePos' : 'targetPos';

      onUpdate?.({
        [idKey]: element.id,
        [portKey]: port,
        [ratioKey]: ratio,
        [posKey]: null, // Clear freehand position
      });
    } else {
      // Keep as freehand endpoint
      const posKey = endpoint === 'source' ? 'sourcePos' : 'targetPos';
      const idKey = endpoint === 'source' ? 'sourceId' : 'targetId';

      onUpdate?.({
        [idKey]: null,
        [posKey]: { x, y },
      });
    }

    setIsDragging(false);
    setPreviewPos(null);
    dragDataRef.current = null;
  }, [isDragging, previewPos, endpoint, elements, packRegistry, findNearbyNode, onUpdate]);

  // Cancel drag
  const handleCancel = useCallback(() => {
    setIsDragging(false);
    setPreviewPos(null);
    dragDataRef.current = null;
  }, []);

  // Attach document-level listeners when dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => handleDrag(e);
    const handleMouseUp = (e) => handleDragEnd(e);
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleCancel();
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDragging, handleDrag, handleDragEnd, handleCancel]);

  return {
    isDragging,
    previewPos,
    handleDragStart,
  };
}

export default useEndpointDrag;
