// components/diagram-studio/text/fitActions.js
// "Fit to text" (ADR-0008 9): the explicit action that resizes boxes to hug their labels. Old boards are never resized
// automatically; this runs only when a person asks (toolbar button, command palette). One undo step for the whole batch.

import { fitSize } from '../../../lib/text/autoFit';
import { isPresetText } from '../../../lib/present/textPreset';
import { postDocNotice } from '../elements/doc/docStore';

/** The size change "Fit to text" would make for one element, or null (no text fit, locked, or already fitting). */
export function fitChangeFor(el, packRegistry) {
  if (!el || el.locked || isPresetText(el)) return null;
  const stencil = packRegistry?.get?.(el.packId)?.stencils?.find((s) => s.id === el.type);
  if (!stencil) return null;
  const fit = fitSize(el.packId, stencil, el);
  if (!fit) return null;
  const cur = el.size || {};
  if (cur.width === fit.width && cur.height === fit.height && (fit.textFit === null || el.textFit === fit.textFit)) return null;
  return { id: el.id, size: { ...cur, width: fit.width, height: fit.height }, ...(fit.textFit ? { textFit: fit.textFit } : {}) };
}

/**
 * @param {object[]} elements the elements to fit (a selection, or the whole board)
 * @returns {number} how many boxes changed
 */
export function fitElementsToText(elements, packRegistry, updateElement) {
  const key = `fit-to-text:${Date.now()}`; // one coalesced undo entry for the whole batch
  let n = 0;
  for (const el of elements || []) {
    const c = fitChangeFor(el, packRegistry);
    if (!c) continue;
    updateElement(c.id, { size: c.size, ...(c.textFit ? { textFit: c.textFit } : {}) }, { coalesceKey: key });
    n += 1;
  }
  postDocNotice(n > 0 ? `Fitted ${n} element${n === 1 ? '' : 's'} to their text.` : 'Everything already fits its text.', n > 0 ? 'success' : 'info');
  return n;
}
