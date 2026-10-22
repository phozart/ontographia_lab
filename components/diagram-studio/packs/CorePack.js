// components/diagram-studio/packs/CorePack.js
// Core pack with Frame/Canvas stencils for organizing content

import React from 'react';
import { stencils, connectionTypes } from './catalog/core';
import TableNode from '../elements/table/TableNode';
import DocCard from '../elements/doc/DocCard';
import TextBlock from '../text/TextBlock';
import { ElementText, useTextLayout } from '../text/useTextLayout';
import TextPresetNode from '../elements/text/TextPresetNode';
import { isPresetText } from '../../../lib/present/textPreset';

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
  // ADR-0007: a frame with a slide shape reads as a slide: square corners, a solid hairline instead of the dashed outline
  const isSlide = !!element.data?.aspect && element.data.aspect !== 'free';
  const { layout: titleLayout, box: titleBox } = useTextLayout(element, stencil, 'title', label);

  return (
    <div style={{
      width: '100%',
      height: '100%',
      position: 'relative',
      pointerEvents: 'none',
    }}>
      {/* External title above frame: one line, ellipsis + badge when it does not fit (ADR-0008) */}
      {showTitle && titleLayout.lines.length > 0 && (
        <>
          <div
            style={{
              position: 'absolute',
              top: titleBox.y - 2,
              left: 0,
              height: titleBox.height + 4,
              width: Math.min(width, Math.ceil(titleLayout.width) + 16),
              background: 'white',
              borderRadius: 4,
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              pointerEvents: 'auto',
            }}
          />
          <TextBlock layout={titleLayout} box={titleBox} color={frameColor} fontFamily={element.fontFamily} testId="title" />
        </>
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
            rx={isSlide ? 0 : 8}
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
          strokeDasharray={isSlide ? undefined : '8 4'}
          rx={isSlide ? 0 : 8}
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
  const { layout: titleLayout, box: titleBox } = useTextLayout(element, stencil, 'title', label);

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

      {label && titleLayout.lines.length > 0 && (
        <>
          <div style={{ position: 'absolute', top: -9, left: 12, height: 18, width: Math.min(width - 24, Math.ceil(titleLayout.width) + 16), background: 'var(--panel)' }} />
          <TextBlock layout={titleLayout} box={titleBox} color="var(--text-muted)" fontFamily={element.fontFamily} testId="title" />
        </>
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

function DiamondNode({ element, stencil, isSelected, outlined = false, packId }) {
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
      <ElementText
        element={element}
        stencil={stencil}
        packId={packId}
        text={label}
        color={element.textColor || (useOutline ? 'var(--text, #1f2937)' : pickTextColor(fill))}
      />
    </div>
  );
}

// Main render function
// Returns undefined for basic shapes (rectangle, circle, diamond, etc.) to use default rendering
function renderNode(element, stencil, isSelected, edit) {
  const type = element.type;

  switch (type) {
    case 'frame':
      return <FrameNode element={element} stencil={stencil} isSelected={isSelected} />;
    case 'section':
      return <SectionNode element={element} stencil={stencil} />;
    case 'table':
      return <TableNode element={element} stencil={stencil} isSelected={isSelected} />;
    case 'diamond':
      return <DiamondNode element={element} stencil={stencil} isSelected={isSelected} />;
    case 'doc':
      return <DocCard element={element} />;
    case 'text-block':
      // ADR-0007 P2: a text preset; a legacy text-block (no data.text) keeps the default renderer
      return isPresetText(element) ? <TextPresetNode element={element} edit={edit} /> : undefined;
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
