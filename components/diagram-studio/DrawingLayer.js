// components/diagram-studio/DrawingLayer.js
// Freehand drawing layer for pen, highlighter, and eraser tools

import { useState, useRef, useCallback, useEffect } from 'react';
import { useDiagram, useDiagramViewport } from './DiagramContext';

// Drawing tool configurations
const TOOL_CONFIG = {
  pen: {
    strokeWidth: 2,
    opacity: 1,
    lineCap: 'round',
    lineJoin: 'round',
  },
  highlighter: {
    strokeWidth: 20,
    opacity: 0.4,
    lineCap: 'round',
    lineJoin: 'round',
  },
  eraser: {
    strokeWidth: 20,
    opacity: 1,
    lineCap: 'round',
    lineJoin: 'round',
    isEraser: true,
  },
};

// Default colors for drawing tools
const DEFAULT_COLORS = {
  pen: '#1f2937',
  highlighter: '#fef08a',
  eraser: '#ffffff',
};

// Simplify path by removing points that are too close together
function simplifyPath(points, tolerance = 2) {
  if (points.length < 3) return points;

  const result = [points[0]];
  let lastAdded = points[0];

  for (let i = 1; i < points.length - 1; i++) {
    const dx = points[i].x - lastAdded.x;
    const dy = points[i].y - lastAdded.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist >= tolerance) {
      result.push(points[i]);
      lastAdded = points[i];
    }
  }

  // Always include the last point
  result.push(points[points.length - 1]);

  return result;
}

// Convert points to SVG path
function pointsToPath(points) {
  if (points.length === 0) return '';
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y} L ${points[0].x} ${points[0].y}`;
  }

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length; i++) {
    path += ` L ${points[i].x} ${points[i].y}`;
  }

  return path;
}

// Smooth path using quadratic curves
function smoothPath(points) {
  if (points.length < 3) return pointsToPath(points);

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length - 1; i++) {
    const xc = (points[i].x + points[i + 1].x) / 2;
    const yc = (points[i].y + points[i + 1].y) / 2;
    path += ` Q ${points[i].x} ${points[i].y} ${xc} ${yc}`;
  }

  // Add last point
  const last = points[points.length - 1];
  path += ` L ${last.x} ${last.y}`;

  return path;
}

export default function DrawingLayer({
  drawingTool = null, // 'pen' | 'highlighter' | 'eraser' | null
  drawingColor = null,
  drawingStrokeWidth = null, // Custom stroke width from toolbar
  onDrawingComplete,
  className = '',
}) {
  const {
    elements,
    addElement,
    updateElement,
    removeElement,
    recordHistory,
  } = useDiagram();

  const { viewport } = useDiagramViewport();

  const svgRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState([]);
  const [currentTool, setCurrentTool] = useState(null);

  // Get canvas coordinates from mouse event
  const getCanvasPoint = useCallback((e) => {
    const svg = svgRef.current;
    if (!svg) return null;

    const rect = svg.getBoundingClientRect();
    const x = (e.clientX - rect.left) / viewport.scale - viewport.x;
    const y = (e.clientY - rect.top) / viewport.scale - viewport.y;

    return { x, y };
  }, [viewport]);

  // Start drawing
  const handleMouseDown = useCallback((e) => {
    if (!drawingTool || e.button !== 0) return;

    const point = getCanvasPoint(e);
    if (!point) return;

    // Check if eraser should erase existing drawings
    if (drawingTool === 'eraser') {
      // Find drawings under the cursor and remove them
      const drawingsToErase = elements.filter(el => {
        if (!el.type?.startsWith('drawing-')) return false;
        if (!el.data?.points) return false;

        // Simple bounding box check
        const bounds = el.data.bounds;
        if (!bounds) return false;

        return point.x >= bounds.minX - 20 && point.x <= bounds.maxX + 20 &&
               point.y >= bounds.minY - 20 && point.y <= bounds.maxY + 20;
      });

      drawingsToErase.forEach(drawing => {
        removeElement(drawing.id);
      });

      if (drawingsToErase.length > 0) {
        recordHistory();
      }
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    setIsDrawing(true);
    setCurrentPoints([point]);
    setCurrentTool(drawingTool);
  }, [drawingTool, getCanvasPoint, elements, removeElement, recordHistory]);

  // Continue drawing
  const handleMouseMove = useCallback((e) => {
    if (!isDrawing) return;

    const point = getCanvasPoint(e);
    if (!point) return;

    setCurrentPoints(prev => [...prev, point]);
  }, [isDrawing, getCanvasPoint]);

  // End drawing
  const handleMouseUp = useCallback((e) => {
    if (!isDrawing || currentPoints.length === 0) {
      setIsDrawing(false);
      setCurrentPoints([]);
      return;
    }

    // Simplify and save the drawing
    const simplified = simplifyPath(currentPoints, 3);

    if (simplified.length >= 2) {
      // Calculate bounds
      const bounds = {
        minX: Math.min(...simplified.map(p => p.x)),
        minY: Math.min(...simplified.map(p => p.y)),
        maxX: Math.max(...simplified.map(p => p.x)),
        maxY: Math.max(...simplified.map(p => p.y)),
      };

      const toolConfig = TOOL_CONFIG[currentTool] || TOOL_CONFIG.pen;
      const color = drawingColor || DEFAULT_COLORS[currentTool] || '#1f2937';
      // Use custom stroke width if provided, otherwise use tool default
      const strokeWidth = drawingStrokeWidth || toolConfig.strokeWidth;

      // Create drawing element
      const drawingElement = {
        id: `drawing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: `drawing-${currentTool}`,
        x: bounds.minX,
        y: bounds.minY,
        size: {
          width: bounds.maxX - bounds.minX,
          height: bounds.maxY - bounds.minY,
        },
        data: {
          points: simplified,
          bounds,
          tool: currentTool,
          color,
          strokeWidth,
          opacity: toolConfig.opacity,
          path: smoothPath(simplified),
        },
        isAnnotation: true,
      };

      recordHistory();
      addElement(drawingElement);

      if (onDrawingComplete) {
        onDrawingComplete(drawingElement);
      }
    }

    setIsDrawing(false);
    setCurrentPoints([]);
    setCurrentTool(null);
  }, [isDrawing, currentPoints, currentTool, drawingColor, drawingStrokeWidth, addElement, recordHistory, onDrawingComplete]);

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    if (isDrawing) {
      handleMouseUp({ clientX: 0, clientY: 0 });
    }
  }, [isDrawing, handleMouseUp]);

  // Get current drawing config
  const toolConfig = currentTool ? TOOL_CONFIG[currentTool] : TOOL_CONFIG.pen;
  const strokeColor = drawingColor || DEFAULT_COLORS[currentTool] || '#1f2937';
  const currentStrokeWidth = drawingStrokeWidth || toolConfig.strokeWidth;

  // Filter drawing elements
  const drawingElements = elements.filter(el => el.type?.startsWith('drawing-'));

  // Don't render if not in drawing mode
  if (!drawingTool) {
    // Still render existing drawings
    if (drawingElements.length === 0) return null;

    return (
      <svg
        className={`drawing-layer-readonly ${className}`}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          overflow: 'visible',
        }}
      >
        <g transform={`translate(${viewport.x * viewport.scale}, ${viewport.y * viewport.scale}) scale(${viewport.scale})`}>
          {drawingElements.map(drawing => (
            <path
              key={drawing.id}
              d={drawing.data?.path || ''}
              stroke={drawing.data?.color || '#1f2937'}
              strokeWidth={drawing.data?.strokeWidth || 2}
              strokeOpacity={drawing.data?.opacity || 1}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
        </g>
      </svg>
    );
  }

  return (
    <svg
      ref={svgRef}
      className={`drawing-layer ${className}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        cursor: drawingTool === 'eraser' ? 'crosshair' : 'crosshair',
        zIndex: 100,
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      <g transform={`translate(${viewport.x * viewport.scale}, ${viewport.y * viewport.scale}) scale(${viewport.scale})`}>
        {/* Existing drawings */}
        {drawingElements.map(drawing => (
          <path
            key={drawing.id}
            d={drawing.data?.path || ''}
            stroke={drawing.data?.color || '#1f2937'}
            strokeWidth={drawing.data?.strokeWidth || 2}
            strokeOpacity={drawing.data?.opacity || 1}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ))}

        {/* Current drawing in progress */}
        {isDrawing && currentPoints.length > 0 && (
          <path
            d={smoothPath(currentPoints)}
            stroke={strokeColor}
            strokeWidth={currentStrokeWidth}
            strokeOpacity={toolConfig.opacity}
            strokeLinecap={toolConfig.lineCap}
            strokeLinejoin={toolConfig.lineJoin}
            fill="none"
          />
        )}
      </g>
    </svg>
  );
}
