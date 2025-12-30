// components/diagram-studio/Minimap.js
// Minimap navigator for large diagrams - shows overview and allows quick navigation

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useDiagram, useDiagramViewport } from './DiagramContext';

const MINIMAP_WIDTH = 180;
const MINIMAP_HEIGHT = 120;
const MINIMAP_PADDING = 10;

// Canvas boundary constants (must match DiagramCanvas.js)
const INFINITE_CANVAS_SIZE = 100000;
const CANVAS_CENTER = INFINITE_CANVAS_SIZE / 2; // Elements are centered around 50000

export default function Minimap({ packRegistry, containerSize = { width: 1200, height: 800 } }) {
  const { elements, connections } = useDiagram();
  const { viewport, setViewport } = useDiagramViewport();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const minimapRef = useRef(null);

  // Calculate bounds of all elements (including current viewport area)
  const bounds = useMemo(() => {
    // Start with the current viewport area (what's visible on screen)
    const viewportWidth = containerSize.width / viewport.scale;
    const viewportHeight = containerSize.height / viewport.scale;
    const viewportLeft = -viewport.x;
    const viewportTop = -viewport.y;
    const viewportRight = viewportLeft + viewportWidth;
    const viewportBottom = viewportTop + viewportHeight;

    // Default to viewport bounds if no elements
    let minX = viewportLeft;
    let minY = viewportTop;
    let maxX = viewportRight;
    let maxY = viewportBottom;

    // Expand bounds to include all elements
    elements.forEach(el => {
      const pack = packRegistry?.get?.(el.packId);
      const stencil = pack?.stencils?.find(s => s.id === el.type);
      const size = el.size || stencil?.defaultSize || { width: 120, height: 60 };

      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + size.width);
      maxY = Math.max(maxY, el.y + size.height);
    });

    // Add padding
    minX -= MINIMAP_PADDING * 10;
    minY -= MINIMAP_PADDING * 10;
    maxX += MINIMAP_PADDING * 10;
    maxY += MINIMAP_PADDING * 10;

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }, [elements, packRegistry, viewport, containerSize]);

  // Calculate scale to fit all elements in minimap
  const scale = useMemo(() => {
    const scaleX = (MINIMAP_WIDTH - MINIMAP_PADDING * 2) / bounds.width;
    const scaleY = (MINIMAP_HEIGHT - MINIMAP_PADDING * 2) / bounds.height;
    return Math.min(scaleX, scaleY, 0.1); // Cap at 0.1 for very small diagrams
  }, [bounds]);

  // Convert diagram coordinates to minimap coordinates
  const toMinimapCoords = useCallback((x, y) => {
    return {
      x: MINIMAP_PADDING + (x - bounds.minX) * scale,
      y: MINIMAP_PADDING + (y - bounds.minY) * scale,
    };
  }, [bounds, scale]);

  // Convert minimap coordinates to diagram coordinates
  const toDiagramCoords = useCallback((minimapX, minimapY) => {
    return {
      x: bounds.minX + (minimapX - MINIMAP_PADDING) / scale,
      y: bounds.minY + (minimapY - MINIMAP_PADDING) / scale,
    };
  }, [bounds, scale]);

  // Calculate viewport rectangle in minimap
  const viewportRect = useMemo(() => {
    const viewportWidth = containerSize.width / viewport.scale;
    const viewportHeight = containerSize.height / viewport.scale;

    const topLeft = toMinimapCoords(-viewport.x, -viewport.y);

    return {
      x: topLeft.x,
      y: topLeft.y,
      width: viewportWidth * scale,
      height: viewportHeight * scale,
    };
  }, [viewport, containerSize, scale, toMinimapCoords]);

  // Handle click on minimap to jump to location
  const handleMinimapClick = useCallback((e) => {
    if (isDragging) return;

    const rect = minimapRef.current?.getBoundingClientRect();
    if (!rect) return;

    const minimapX = e.clientX - rect.left;
    const minimapY = e.clientY - rect.top;

    const diagramCoords = toDiagramCoords(minimapX, minimapY);

    // Center viewport on clicked location
    const viewportWidth = containerSize.width / viewport.scale;
    const viewportHeight = containerSize.height / viewport.scale;

    setViewport(prev => ({
      ...prev,
      x: -(diagramCoords.x - viewportWidth / 2),
      y: -(diagramCoords.y - viewportHeight / 2),
    }));
  }, [isDragging, toDiagramCoords, containerSize, viewport.scale, setViewport]);

  // Handle double-click on element to zoom to it
  const handleElementDoubleClick = useCallback((e, element) => {
    e.stopPropagation();

    const pack = packRegistry?.get?.(element.packId);
    const stencil = pack?.stencils?.find(s => s.id === element.type);
    const size = element.size || stencil?.defaultSize || { width: 120, height: 60 };

    // Calculate center of element
    const centerX = element.x + size.width / 2;
    const centerY = element.y + size.height / 2;

    // Zoom to fit element with some padding (target 50% of viewport)
    const targetScale = Math.min(
      (containerSize.width * 0.5) / size.width,
      (containerSize.height * 0.5) / size.height,
      2 // Max zoom
    );

    // Center viewport on element
    const viewportWidth = containerSize.width / targetScale;
    const viewportHeight = containerSize.height / targetScale;

    setViewport({
      x: -(centerX - viewportWidth / 2),
      y: -(centerY - viewportHeight / 2),
      scale: targetScale,
    });
  }, [packRegistry, containerSize, setViewport]);

  // Handle viewport rectangle drag
  const handleViewportDragStart = useCallback((e) => {
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  // Handle mouse move for viewport dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      const rect = minimapRef.current?.getBoundingClientRect();
      if (!rect) return;

      const minimapX = e.clientX - rect.left;
      const minimapY = e.clientY - rect.top;

      const diagramCoords = toDiagramCoords(minimapX, minimapY);

      // Center viewport on drag position
      const viewportWidth = containerSize.width / viewport.scale;
      const viewportHeight = containerSize.height / viewport.scale;

      setViewport(prev => ({
        ...prev,
        x: -(diagramCoords.x - viewportWidth / 2),
        y: -(diagramCoords.y - viewportHeight / 2),
      }));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, toDiagramCoords, containerSize, viewport.scale, setViewport]);

  if (isCollapsed) {
    return (
      <div className="ds-minimap ds-minimap-collapsed" onClick={() => setIsCollapsed(false)}>
        <span className="ds-minimap-expand-icon">&#x25C0;</span>
      </div>
    );
  }

  return (
    <div className="ds-minimap">
      <div className="ds-minimap-header">
        <span className="ds-minimap-title">Overview</span>
        <button
          className="ds-minimap-collapse-btn"
          onClick={() => setIsCollapsed(true)}
          title="Collapse minimap"
        >
          &#x2715;
        </button>
      </div>

      <div
        ref={minimapRef}
        className="ds-minimap-canvas"
        style={{ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT }}
        onClick={handleMinimapClick}
      >
        {/* Render scaled elements */}
        <svg width={MINIMAP_WIDTH} height={MINIMAP_HEIGHT}>
          {/* Connections */}
          {connections.map(conn => {
            const sourceEl = elements.find(el => el.id === conn.sourceId);
            const targetEl = elements.find(el => el.id === conn.targetId);
            if (!sourceEl || !targetEl) return null;

            const sourcePack = packRegistry?.get?.(sourceEl.packId);
            const sourceStencil = sourcePack?.stencils?.find(s => s.id === sourceEl.type);
            const sourceSize = sourceEl.size || sourceStencil?.defaultSize || { width: 120, height: 60 };

            const targetPack = packRegistry?.get?.(targetEl.packId);
            const targetStencil = targetPack?.stencils?.find(s => s.id === targetEl.type);
            const targetSize = targetEl.size || targetStencil?.defaultSize || { width: 120, height: 60 };

            const sourceCenter = toMinimapCoords(
              sourceEl.x + sourceSize.width / 2,
              sourceEl.y + sourceSize.height / 2
            );
            const targetCenter = toMinimapCoords(
              targetEl.x + targetSize.width / 2,
              targetEl.y + targetSize.height / 2
            );

            return (
              <line
                key={conn.id}
                x1={sourceCenter.x}
                y1={sourceCenter.y}
                x2={targetCenter.x}
                y2={targetCenter.y}
                stroke="var(--text-muted)"
                strokeWidth="1"
                opacity="0.5"
              />
            );
          })}

          {/* Elements */}
          {elements.map(el => {
            const pack = packRegistry?.get?.(el.packId);
            const stencil = pack?.stencils?.find(s => s.id === el.type);
            const size = el.size || stencil?.defaultSize || { width: 120, height: 60 };
            const color = el.color || stencil?.color || '#0e74a3';

            const pos = toMinimapCoords(el.x, el.y);
            const scaledWidth = size.width * scale;
            const scaledHeight = size.height * scale;

            // Minimum size for visibility
            const minSize = 3;
            const displayWidth = Math.max(scaledWidth, minSize);
            const displayHeight = Math.max(scaledHeight, minSize);

            return (
              <rect
                key={el.id}
                x={pos.x}
                y={pos.y}
                width={displayWidth}
                height={displayHeight}
                fill={color}
                stroke="none"
                rx="1"
                opacity="0.8"
                style={{ cursor: 'pointer' }}
                onDoubleClick={(e) => handleElementDoubleClick(e, el)}
              />
            );
          })}

          {/* Viewport rectangle */}
          <rect
            x={viewportRect.x}
            y={viewportRect.y}
            width={Math.max(viewportRect.width, 10)}
            height={Math.max(viewportRect.height, 10)}
            fill="rgba(14, 116, 163, 0.2)"
            stroke="var(--accent)"
            strokeWidth="2"
            style={{ cursor: 'move' }}
            onMouseDown={handleViewportDragStart}
          />
        </svg>
      </div>

      <div className="ds-minimap-info">
        <span>{elements.length} elements</span>
        <span>{Math.round(viewport.scale * 100)}%</span>
      </div>
    </div>
  );
}
