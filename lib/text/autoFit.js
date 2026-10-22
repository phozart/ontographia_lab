// lib/text/autoFit.js
// The size rules the editor and the fit_to_text op apply (ADR-0008 3.3, 4, 9). Pure.
//
//   fitSize(packId, stencil, element)            -> the size "Fit to text" gives an element, or null when it has no text fit
//   sizeAfterLabelEdit(packId, stencil, el, old) -> the size after the label changed, or null when nothing should change
//   textFitAfterResize(el, stencil, handle)      -> the textFit the Figma-style resize rule leaves behind

import { policyFor, growsWithText } from './policy';
import { labelOf, modeOf, sizeForText } from './fit';

const near = (a, b) => !!a && !!b && Math.abs(a.width - b.width) <= 1 && Math.abs(a.height - b.height) <= 1;

/**
 * "Fit to text": hug the label, anchored top-left, never smaller than the stencil's default size. Elements whose stencil
 * keeps its size (frames, markers, dividers ...) return null. The element's textFit becomes `auto` unless the stencil's
 * own default is auto-height.
 * @returns {{width: number, height: number, textFit: string|null}|null}
 */
export function fitSize(packId, stencil, element) {
  const policy = policyFor(packId, stencil);
  if (!growsWithText(policy)) return null;
  const text = labelOf(element);
  if (!text.trim()) return null;
  const textFit = policy.mode === 'auto-height' ? 'auto-height' : 'auto';
  const { width, height } = sizeForText(packId, stencil, text, { ...element, textFit, size: textFit === 'auto-height' ? element.size : undefined });
  return { width, height, textFit: textFit === policy.mode ? null : textFit };
}

/**
 * After a label edit: an element whose box is the auto fit of its previous label is "auto managed" and re-fits both
 * ways; a hand-sized element only grows (a person's box is never shrunk behind their back).
 * @returns {{width: number, height: number}|null}
 */
export function sizeAfterLabelEdit(packId, stencil, element, oldLabel) {
  const policy = policyFor(packId, stencil);
  const mode = modeOf(element, policy);
  if (!growsWithText(policy) || mode === 'fixed' || mode === 'shrink') return null;
  const cur = element.size;
  if (!cur || !Number.isFinite(cur.width) || !Number.isFinite(cur.height)) return null;
  const text = labelOf(element);
  const hasText = text.trim().length > 0;
  const forLabel = (t) => sizeForText(packId, stencil, t, mode === 'auto-height' ? { ...element, textFit: mode, size: { width: cur.width } } : { ...element, size: undefined });
  const next = hasText ? forLabel(text) : { width: policy.minW, height: policy.minH };
  const prev = forLabel(oldLabel || '');
  const managed = near(cur, prev);
  let width = mode === 'auto-height' ? cur.width : next.width;
  let height = next.height;
  if (!managed) {
    width = Math.max(width, cur.width);
    height = Math.max(height, cur.height);
  }
  return width === cur.width && height === cur.height ? null : { width, height };
}

/**
 * Figma's text-resizing rule: a width-only handle turns auto into auto-height; a height or corner handle turns it into
 * fixed (stencils whose default is shrink stay shrink). Returns the new textFit, or undefined to leave it as it is.
 * @param {'e'|'w'|'n'|'s'|'ne'|'nw'|'se'|'sw'} handle
 */
export function textFitAfterResize(packId, stencil, element, handle) {
  const policy = policyFor(packId, stencil);
  if (!growsWithText(policy)) return undefined;
  const mode = modeOf(element, policy);
  if (policy.mode === 'shrink' || mode === 'shrink') return undefined;
  const widthOnly = handle === 'e' || handle === 'w';
  if (widthOnly) return mode === 'auto' ? 'auto-height' : undefined;
  return mode === 'fixed' ? undefined : 'fixed';
}
