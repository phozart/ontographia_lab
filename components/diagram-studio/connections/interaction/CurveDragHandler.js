// components/diagram-studio/connections/interaction/CurveDragHandler.js
// Hook for handling curve amount dragging on curved/arc connections

import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Hook for managing curve drag state and behavior
 * Allows adjusting the curvature of curved and arc connections
 * by dragging perpendicular to the connection line
 */
export function useCurveDrag({
  connectionId,
  sourcePos,
  targetPos,
  initialCurve = null,
  viewport,
  canvasRef,
  onUpdate,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [currentCurve, setCurrentCurve] = useState(initialCurve);
  const dragDataRef = useRef(null);

  // Calculate perpendicular distance from mouse to the source-target line
  const calculateCurveAmount = useCallback((mouseX, mouseY) => {
    if (!sourcePos || !targetPos) return 0;

    // Vector from source to target
    const dx = targetPos.x - sourcePos.x;
    const dy = targetPos.y - sourcePos.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;

    // Perpendicular vector (normalized)
    const perpX = -dy / len;
    const perpY = dx / len;

    // Midpoint of the line
    const midX = (sourcePos.x + targetPos.x) / 2;
    const midY = (sourcePos.y + targetPos.y) / 2;

    // Vector from midpoint to mouse
    const toMouseX = mouseX - midX;
    const toMouseY = mouseY - midY;

    // Project onto perpendicular to get curve amount
    const curveAmount = toMouseX * perpX + toMouseY * perpY;

    // Clamp to reasonable range
    const maxCurve = len * 0.75;
    return Math.max(-maxCurve, Math.min(maxCurve, curveAmount));
  }, [sourcePos, targetPos]);

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
      initialCurve: initialCurve || 0,
    };

    setIsDragging(true);

    // Calculate initial curve based on start position
    const curveAmount = calculateCurveAmount(startX, startY);
    setCurrentCurve(curveAmount);
  }, [viewport, canvasRef, initialCurve, calculateCurveAmount]);

  // Update curve during drag
  const handleDrag = useCallback((e) => {
    if (!isDragging || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / viewport.scale - viewport.x;
    const y = (e.clientY - rect.top) / viewport.scale - viewport.y;

    const curveAmount = calculateCurveAmount(x, y);
    setCurrentCurve(curveAmount);

    // Update the connection with new curve
    onUpdate?.({ curve: curveAmount });
  }, [isDragging, viewport, canvasRef, calculateCurveAmount, onUpdate]);

  // End dragging
  const handleDragEnd = useCallback(() => {
    if (isDragging && currentCurve !== null) {
      // Final update
      onUpdate?.({ curve: currentCurve });
    }
    setIsDragging(false);
    dragDataRef.current = null;
  }, [isDragging, currentCurve, onUpdate]);

  // Cancel drag
  const handleCancel = useCallback(() => {
    if (dragDataRef.current) {
      // Revert to initial curve
      onUpdate?.({ curve: dragDataRef.current.initialCurve || null });
      setCurrentCurve(dragDataRef.current.initialCurve);
    }
    setIsDragging(false);
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
    currentCurve,
    handleDragStart,
  };
}

export default useCurveDrag;
