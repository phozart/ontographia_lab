// components/diagram-studio/packs/NodeLabels.js
// Shared helpers for stencils whose shape is a small marker/notation primitive
// (events, gateways, UML pseudo-states): the label must still be visible, so it
// is drawn just below the shape instead of being dropped.
//
// ADR-0008 T2: every such label goes through the shared layout (wrapped to max(2w, 120), at most 3 lines, widened for one
// long word, overflow badge with the full text). There is no separate legacy single-line `nowrap` path any more.

import React from 'react';
import { policyFor, externalPolicy } from '../../../lib/text/policy';
import { ElementText } from '../text/useTextLayout';

export function labelOf(element) {
  return element?.label || element?.name || '';
}

// HTML label centered under the node box. Stencils whose text policy is `external` use their own policy; for any other
// stencil (a label that cannot fit inside a small stored size, `forceExternal`) the generic external policy applies.
export function BelowLabel({ element, forceExternal = false }) {
  const label = labelOf(element);
  if (!label) return null;
  const stencilLike = { id: element.type };
  const own = forceExternal ? null : policyFor(element.packId, stencilLike);
  const policy = own && own.slot === 'external' ? own : externalPolicy(stencilLike);
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
