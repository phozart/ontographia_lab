// components/diagram-studio/packs/NodeLabels.js
// Shared helpers for stencils whose shape is a small marker/notation primitive
// (events, gateways, UML pseudo-states): the label must still be visible, so it
// is drawn just below the shape instead of being dropped.

import React from 'react';

export function labelOf(element) {
  return element?.label || element?.name || '';
}

const BELOW_STYLE = {
  position: 'absolute',
  top: '100%',
  left: '50%',
  transform: 'translateX(-50%)',
  marginTop: 4,
  whiteSpace: 'nowrap',
  lineHeight: 1.2,
  textAlign: 'center',
  pointerEvents: 'none',
  userSelect: 'none',
};

// HTML label centered under the node box.
export function BelowLabel({ element }) {
  const label = labelOf(element);
  if (!label) return null;
  return (
    <div
      className="ds-node-label-below"
      style={{
        ...BELOW_STYLE,
        fontSize: element.fontSize || 12,
        fontWeight: element.fontWeight || 500,
        color: element.textColor || 'var(--text, #1f2937)',
      }}
    >
      {label}
    </div>
  );
}

// Wrap an already-rendered node so its label shows below it.
export function withBelowLabel(node, element) {
  if (!labelOf(element)) return node;
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {node}
      <BelowLabel element={element} />
    </div>
  );
}

// SVG variant for packs that render inside an <svg> frame.
export function SvgBelowLabel({ element, width, height }) {
  const label = labelOf(element);
  if (!label) return null;
  return (
    <text
      x={width / 2}
      y={height + 16}
      textAnchor="middle"
      fontSize={element.fontSize || 12}
      fontWeight={element.fontWeight || 500}
      fill={element.textColor || 'var(--text, #1f2937)'}
      style={{ userSelect: 'none' }}
    >
      {label}
    </text>
  );
}
