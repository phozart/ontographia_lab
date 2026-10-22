// components/diagram-studio/text/useTextLayout.js
// Hooks and the ready-made label component the pack renderers use (ADR-0008 8): they ask the shared layout module for
// the lines of an element's label inside its STORED box and draw them with <TextBlock>. Nothing here writes data.

import { useMemo } from 'react';
import { policyFor } from '../../../lib/text/policy';
import { layoutForElement, layoutForExternal, layoutForTitle, labelOf } from '../../../lib/text/fit';
import TextBlock from './TextBlock';

/** The element's stencil policy (packs pass the stencil their registry resolved). */
export function useTextPolicy(element, stencil, override, packIdFallback) {
  const packId = element?.packId || packIdFallback;
  const id = stencil?.id || element?.type;
  return useMemo(() => override || policyFor(packId, stencil || { id }), [packId, stencil, id, override]);
}

/**
 * @param {'inside'|'external'|'title'} kind
 * @returns {{layout: object, box: object, policy: object}}
 */
export function useTextLayout(element, stencil, kind = 'inside', text, policyOverride, packIdFallback) {
  const policy = useTextPolicy(element, stencil, policyOverride, packIdFallback);
  const t = text === undefined ? labelOf(element) : text;
  return useMemo(() => {
    const r = kind === 'external' ? layoutForExternal(element, policy, t) : kind === 'title' ? layoutForTitle(element, policy, t) : layoutForElement(element, policy, t);
    return { ...r, policy };
  }, [policy, kind, t, element]);
}

/**
 * The label of a node: lays it out in the stored box and draws it. `kind` picks the slot (see lib/text/policy.js).
 * Colors and font style come from the caller (each renderer knows its own fill).
 */
export function ElementText({ element, stencil, kind = 'inside', text, color, offsetX, offsetY, pill, className, policy: policyOverride, packId }) {
  const { layout, box } = useTextLayout(element, stencil, kind, text, policyOverride, packId);
  if (!layout.lines.length) return null;
  return (
    <TextBlock
      layout={layout}
      box={box}
      rotate={box.rotate}
      color={color}
      fontFamily={element.fontFamily}
      fontStyle={element.fontStyle}
      textDecoration={element.textDecoration}
      offsetX={offsetX}
      offsetY={offsetY}
      pill={pill}
      className={className}
      testId={kind}
    />
  );
}
