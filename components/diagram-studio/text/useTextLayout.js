// components/diagram-studio/text/useTextLayout.js
// Hooks and the ready-made label component the pack renderers use (ADR-0008 8): they ask the shared layout module for
// the lines of an element's label inside its STORED box and draw them with <TextBlock>. Nothing here writes data.

import { useMemo } from 'react';
import { policyFor } from '../../../lib/text/policy';
import { layoutForElement, layoutForExternal, layoutForList, layoutForSlot, layoutForTitle, labelOf } from '../../../lib/text/fit';
import { MONO_FAMILY } from '../../../lib/text/tokens';
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

/**
 * A named text slot of a node (compartment, header strip, stereotype, badge text) at an explicit rectangle in node
 * coordinates. Memoized on its parts, so re-rendering with the same element recomputes nothing. See layoutForSlot
 * (lib/text/fit.js) for the fields; `color` is the text color the renderer knows from its fill.
 */
export function SlotText({ element, text, box, role, mode, maxLines, align, valign, own, mono, rotate, size, weight, color, pill, className, hideBadge, testId = 'slot' }) {
  const bx = box.x;
  const by = box.y;
  const bw = box.width;
  const bh = box.height;
  const { layout, box: b } = useMemo(
    () => layoutForSlot(element, { text, box: { x: bx, y: by, width: bw, height: bh }, role, mode, maxLines, align, valign, own, mono, rotate, size, weight }),
    [element, text, bx, by, bw, bh, role, mode, maxLines, align, valign, own, mono, rotate, size, weight],
  );
  if (!layout.lines.length) return null;
  return (
    <TextBlock
      layout={layout}
      box={b}
      rotate={b.rotate}
      color={color}
      fontFamily={mono ? MONO_FAMILY : own ? element.fontFamily : undefined}
      fontStyle={own ? element.fontStyle : undefined}
      textDecoration={own ? element.textDecoration : undefined}
      pill={pill}
      className={className}
      hideBadge={hideBadge}
      testId={testId}
    />
  );
}

/**
 * A member list (UML attributes and operations, enum values): one mono line per item, each cut with an ellipsis, items
 * beyond the box hidden behind the overflow badge (layoutForList in lib/text/fit.js). Memoized on the item text.
 */
export function ListText({ element, items, box, role, mono, align, color, testId = 'list', className }) {
  const list = items || [];
  const key = `${list.length}\u0001${list.join('\u0001')}`;
  const { layout, box: b } = useMemo(
    () => layoutForList(element, { items: list, box: { x: box.x, y: box.y, width: box.width, height: box.height }, role, mono, align }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [element, key, box.x, box.y, box.width, box.height, role, mono, align],
  );
  if (!layout.lines.length) return null;
  return <TextBlock layout={layout} box={b} color={color} fontFamily={mono === false ? undefined : MONO_FAMILY} className={className} testId={testId} />;
}
