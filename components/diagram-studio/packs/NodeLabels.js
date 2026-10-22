// components/diagram-studio/packs/NodeLabels.js
// Shared helpers for stencils whose shape is a small marker/notation primitive
// (events, gateways, UML pseudo-states): the label must still be visible, so it
// is drawn just below the shape instead of being dropped.

import React from 'react';
import { policyFor, externalPolicy } from '../../../lib/text/policy';
import { ElementText } from '../text/useTextLayout';

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

// HTML label centered under the node box. Stencils whose text policy is `external` (ADR-0008: events, gateway markers,
// data objects, markers) draw it through the shared layout (wrapped to max(2w, 120), at most 3 lines, badge on clamp);
// `forceExternal` does the same for a label that cannot fit inside. Other packs keep the legacy single line until T2.
export function BelowLabel({ element, forceExternal = false }) {
  const label = labelOf(element);
  if (!label) return null;
  const stencilLike = { id: element.type };
  const policy = forceExternal ? externalPolicy(stencilLike) : policyFor(element.packId, stencilLike);
  if (policy.slot === 'external') {
    return (
      <ElementText
        element={element}
        kind="external"
        policy={policy}
        className="ds-node-label-below"
        color={element.textColor || 'var(--text, #1f2937)'}
      />
    );
  }
  return (
    <div
      className="ds-node-label-below"
      style={{
        ...BELOW_STYLE,
        fontSize: element.fontSize || 12,
        fontWeight: element.fontWeight || 500,
        fontStyle: element.fontStyle || 'normal',
        textDecoration: element.textDecoration || 'none',
        color: element.textColor || 'var(--text, #1f2937)',
      }}
    >
      {label}
    </div>
  );
}

// Wrap an already-rendered node so its label shows below it.
export function withBelowLabel(node, element, forceExternal = false) {
  if (!labelOf(element)) return node;
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {node}
      <BelowLabel element={element} forceExternal={forceExternal} />
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
      fontStyle={element.fontStyle || 'normal'}
      textDecoration={element.textDecoration || 'none'}
      fill={element.textColor || 'var(--text, #1f2937)'}
      style={{ userSelect: 'none' }}
    >
      {label}
    </text>
  );
}
