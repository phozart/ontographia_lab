// components/diagram-studio/connections/interaction/WaypointDragHandler.js
// Hook for handling waypoint dragging

import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Hook for managing waypoint drag state and behavior
 * Allows moving individual waypoints on a connection
 */
export function useWaypointDrag({
  connectionId,
  waypoints = [],
  viewport,
  canvasRef,
  gridSize = 20,
  onUpdate,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const dragDataRef = useRef(null);

  // Start dragging a waypoint
  const handleDragStart = useCallback((waypointIndex, e) => {
    e.stopPropagation();
    e.preventDefault();

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const startX = (e.clientX - rect.left) / viewport.scale - viewport.x;
    const startY = (e.clientY - rect.top) / viewport.scale - viewport.y;

    dragDataRef.current = {
      waypointIndex,
      startX,
      startY,
      originalWaypoint: waypoints[waypointIndex],
      originalWaypoints: [...waypoints],
    };

    setIsDragging(true);
    setDraggedIndex(waypointIndex);
  }, [waypoints, viewport, canvasRef]);

  // Update waypoint position during drag
  const handleDrag = useCallback((e) => {
    if (!isDragging || dragDataRef.current === null || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / viewport.scale - viewport.x;
    const y = (e.clientY - rect.top) / viewport.scale - viewport.y;

    // Snap to grid
    const snappedX = Math.round(x / gridSize) * gridSize;
    const snappedY = Math.round(y / gridSize) * gridSize;

    const { waypointIndex, originalWaypoints } = dragDataRef.current;

    // Create new waypoints array with updated position
    const newWaypoints = originalWaypoints.map((wp, idx) =>
      idx === waypointIndex ? { x: snappedX, y: snappedY } : wp
    );

    onUpdate?.({ waypoints: newWaypoints });
  }, [isDragging, viewport, canvasRef, gridSize, onUpdate]);

  // End dragging
  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    setDraggedIndex(null);
    dragDataRef.current = null;
  }, []);

  // Cancel drag
  const handleCancel = useCallback(() => {
    if (dragDataRef.current) {
      // Revert to original waypoints
      onUpdate?.({ waypoints: dragDataRef.current.originalWaypoints });
    }
    setIsDragging(false);
    setDraggedIndex(null);
    dragDataRef.current = null;
  }, [onUpdate]);

  // Delete a waypoint
  const handleDelete = useCallback((waypointIndex) => {
    const newWaypoints = waypoints.filter((_, idx) => idx !== waypointIndex);
    onUpdate?.({ waypoints: newWaypoints });
  }, [waypoints, onUpdate]);

  // Add a waypoint
  const handleAdd = useCallback((position, insertIndex = -1) => {
    let newWaypoints;
    if (insertIndex >= 0 && insertIndex <= waypoints.length) {
      newWaypoints = [
        ...waypoints.slice(0, insertIndex),
        position,
        ...waypoints.slice(insertIndex),
      ];
    } else {
      newWaypoints = [...waypoints, position];
    }
    onUpdate?.({ waypoints: newWaypoints });
  }, [waypoints, onUpdate]);

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
    draggedIndex,
    handleDragStart,
    handleDelete,
    handleAdd,
  };
}

export default useWaypointDrag;
