// components/diagram-studio/connections/interaction/SegmentDragHandler.js
// Hook for handling segment dragging on orthogonal connections

import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Hook for managing segment drag state and behavior
 * Allows reshaping orthogonal connections by dragging segments
 * - Horizontal segments: constrained to vertical movement (changes Y)
 * - Vertical segments: constrained to horizontal movement (changes X)
 */
export function useSegmentDrag({
  connectionId,
  waypoints = [],
  viewport,
  canvasRef,
  gridSize = 20,
  onUpdate,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [draggedSegment, setDraggedSegment] = useState(null);
  const dragDataRef = useRef(null);

  // Start dragging a segment
  const handleDragStart = useCallback((segmentIndex, isHorizontal, e) => {
    e.stopPropagation();
    e.preventDefault();

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const startX = (e.clientX - rect.left) / viewport.scale - viewport.x;
    const startY = (e.clientY - rect.top) / viewport.scale - viewport.y;

    dragDataRef.current = {
      segmentIndex,
      isHorizontal,
      startX,
      startY,
      originalWaypoints: [...waypoints],
    };

    setIsDragging(true);
    setDraggedSegment({ index: segmentIndex, isHorizontal });
  }, [waypoints, viewport, canvasRef]);

  // Update waypoints during drag
  const handleDrag = useCallback((e) => {
    if (!isDragging || !dragDataRef.current || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / viewport.scale - viewport.x;
    const y = (e.clientY - rect.top) / viewport.scale - viewport.y;

    const { segmentIndex, isHorizontal, startX, startY, originalWaypoints } = dragDataRef.current;

    // Calculate delta
    const deltaX = x - startX;
    const deltaY = y - startY;

    // For orthogonal lines, we need to update the waypoints that define this segment
    // This is simplified - in a real implementation, we'd need the actual segment points
    const newWaypoints = originalWaypoints.map((wp, idx) => {
      // Determine which waypoints to move based on segment index
      // This is a simplified approach - for full implementation, we'd need
      // to track which waypoints belong to which segment
      if (isHorizontal) {
        // Horizontal segment: move Y coordinate
        const snappedDelta = Math.round(deltaY / gridSize) * gridSize;
        return { ...wp, y: wp.y + snappedDelta };
      } else {
        // Vertical segment: move X coordinate
        const snappedDelta = Math.round(deltaX / gridSize) * gridSize;
        return { ...wp, x: wp.x + snappedDelta };
      }
    });

    // Only update if waypoints have changed
    if (JSON.stringify(newWaypoints) !== JSON.stringify(waypoints)) {
      onUpdate?.({ waypoints: newWaypoints });
    }
  }, [isDragging, viewport, canvasRef, gridSize, waypoints, onUpdate]);

  // End dragging
  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    setDraggedSegment(null);
    dragDataRef.current = null;
  }, []);

  // Cancel drag
  const handleCancel = useCallback(() => {
    if (dragDataRef.current) {
      // Revert to original waypoints
      onUpdate?.({ waypoints: dragDataRef.current.originalWaypoints });
    }
    setIsDragging(false);
    setDraggedSegment(null);
    dragDataRef.current = null;
  }, [onUpdate]);

  // Attach document-level listeners when dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => handleDrag(e);
    const handleMouseUp = () => handleDragEnd();
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
    draggedSegment,
    handleDragStart,
  };
}

export default useSegmentDrag;
