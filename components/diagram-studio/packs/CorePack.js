// components/diagram-studio/packs/CorePack.js
// Core pack with Frame/Canvas stencils for organizing content

import React from 'react';
import { stencils, connectionTypes } from './catalog/core';

// ============ STENCILS ============


// ============ CONNECTION TYPES ============


// ============ VISUAL RENDERERS ============

// Frame renderer - dashed border with external title
function FrameNode({ element, stencil, isSelected }) {
  const label = element.label || element.name || 'Frame';
  const { width, height } = element.size || stencil?.defaultSize || { width: 600, height: 400 };
  const showTitle = element.data?.showTitle !== false;
  const bgColor = element.data?.backgroundColor || '#ffffff'; // White background by default
  const frameColor = element.color || '#64748b';

  return (
    <div style={{
      width: '100%',
      height: '100%',
      position: 'relative',
      pointerEvents: 'none',
    }}>
      {/* External title above frame */}
      {showTitle && (
        <div style={{
          position: 'absolute',
          top: -28,
          left: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          pointerEvents: 'auto',
        }}>
          <span style={{
            fontSize: 13,
            fontWeight: 600,
            color: frameColor,
            background: 'white',
            padding: '4px 8px',
            borderRadius: 4,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}>
            {label}
          </span>
        </div>
      )}

      <svg
        width={width}
        height={height}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
        }}
      >
        {/* Frame background */}
        {bgColor !== 'transparent' && (
          <rect
            x="1"
            y="1"
            width={width - 2}
            height={height - 2}
            fill={bgColor}
            rx="8"
          />
        )}

        {/* Dashed border - Miro style */}
        <rect
          x="1"
          y="1"
          width={width - 2}
          height={height - 2}
          fill="none"
          stroke={frameColor}
          strokeWidth="2"
          strokeDasharray="8 4"
          rx="8"
          opacity={isSelected ? 1 : 0.6}
        />

        {/* Corner resize handles shown when selected */}
        {isSelected && (
          <>
            <circle cx="0" cy="0" r="5" fill="white" stroke={frameColor} strokeWidth="2" />
            <circle cx={width} cy="0" r="5" fill="white" stroke={frameColor} strokeWidth="2" />
            <circle cx="0" cy={height} r="5" fill="white" stroke={frameColor} strokeWidth="2" />
            <circle cx={width} cy={height} r="5" fill={frameColor} stroke={frameColor} strokeWidth="2" />
          </>
        )}
      </svg>
    </div>
  );
}

// Section renderer
function SectionNode({ element, stencil }) {
  const label = element.label || element.name || '';
  const { width, height } = element.size || stencil?.defaultSize || { width: 400, height: 300 };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
        <rect
          x="1"
          y="1"
          width={width - 2}
          height={height - 2}
          fill="none"
          stroke="var(--border)"
          strokeWidth="1"
          strokeDasharray="6 3"
          rx="6"
        />
      </svg>

      {label && (
        <div style={{
          position: 'absolute',
          top: -10,
          left: 12,
          background: 'var(--panel)',
          padding: '0 8px',
          fontSize: 11,
          fontWeight: 500,
          color: 'var(--text-muted)',
        }}>
          {label}
        </div>
      )}
    </div>
  );
}

// Diamond renderer - SVG polygon through the midpoints of the bounding box,
// so it scales correctly at any width/height (a CSS-rotated box skews).
function pickTextColor(bg) {
  const m = /^#([0-9a-f]{6})$/i.exec(bg || '');
  if (!m) return '#1f2937';
  const n = parseInt(m[1], 16);
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? '#1f2937' : '#ffffff';
}

function DiamondNode({ element, stencil, isSelected, outlined = false }) {
  const { width, height } = element.size || stencil?.defaultSize || { width: 80, height: 80 };
  const color = element.color || stencil?.color || '#f59e0b';
  // Outlined (ERD Chen) style: panel fill, accent stroke, dark label unless the user sets colors
  const useOutline = outlined && !element.backgroundColor && !element.color;
  const fill = useOutline ? 'var(--panel, #ffffff)' : (element.backgroundColor || color);
  const strokeWidth = element.borderWidth ?? 2;
  const inset = strokeWidth / 2;
  const label = element.label || element.name || '';
  const points = `${width / 2},${inset} ${width - inset},${height / 2} ${width / 2},${height - inset} ${inset},${height / 2}`;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        overflow="visible"
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
      >
        <polygon
          points={points}
          fill={fill}
          fillOpacity={element.opacity ?? 1}
          stroke={isSelected ? 'var(--accent, #4FB3CE)' : (element.borderColor || color)}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />
      </svg>
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '15%',
        width: '70%',
        height: '60%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        fontSize: element.fontSize || 13,
        fontWeight: element.fontWeight || 500,
        fontStyle: element.fontStyle || 'normal',
        textDecoration: element.textDecoration || 'none',
        color: element.textColor || (useOutline ? 'var(--text, #1f2937)' : pickTextColor(fill)),
        overflowWrap: 'break-word',
        pointerEvents: 'none',
        userSelect: 'none',
      }}>
        {label}
      </div>
    </div>
  );
}

// Main render function
// Returns undefined for basic shapes (rectangle, circle, diamond, etc.) to use default rendering
function renderNode(element, stencil, isSelected) {
  const type = element.type;

  switch (type) {
    case 'frame':
      return <FrameNode element={element} stencil={stencil} isSelected={isSelected} />;
    case 'section':
      return <SectionNode element={element} stencil={stencil} />;
    case 'diamond':
      return <DiamondNode element={element} stencil={stencil} isSelected={isSelected} />;
    default:
      // Return undefined (not null) to allow default rendering for basic shapes
      // like rectangle, circle, text-block, divider
      return undefined;
  }
}

// ============ PACK EXPORT ============

const CorePack = {
  id: 'core',
  name: 'Core',
  description: 'Basic shapes and organizational elements',
  icon: '⬜',
  stencils,
  connectionTypes,
  validators: [],
  templates: [],
  nodeProperties: [],
  renderNode,
  defaultLineStyle: 'step', // Elbow rounded (orthogonal) lines for core shapes
};

export default CorePack;
export { stencils, connectionTypes, renderNode, DiamondNode };
