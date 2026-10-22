// lib/present/styleFields.js
// Server-side cleaning of the style fields an element can carry (ADR-0007 P2): colours are a #hex, a plain colour name,
// a short rgb()/hsl() form, the editor's var(--x, fallback) form or a known @token, never free CSS; `borderRadius` is a
// number from 0 to 999 (999 = fully round) and `opacity` a number from 0 to 1. An invalid value is STRIPPED and reported
// (rejecting would make an autosave fail and lose the user's work), the same policy as unsafe URLs. Pure.

import { isToken } from './themes';
import { LAYOUT_NAMES } from './layouts';

const FN = '(?:rgba?|hsla?)\\([0-9a-z.,%\\s/-]{1,60}\\)';
const SIMPLE = `(?:#[0-9a-f]{3,8}|[a-z]{3,24}|${FN})`;
const COLOR_RE = new RegExp(`^(?:${SIMPLE}|var\\(--[\\w-]{1,40}(?:\\s*,\\s*${SIMPLE})?\\))$`, 'i');
const HEX_BAD_LENGTH = /^#(?:[0-9a-f]{5}|[0-9a-f]{7})$/i;

export const STYLE_COLOR_KEYS = Object.freeze(['color', 'backgroundColor', 'borderColor', 'textColor', 'fillColor', 'strokeColor']);
export const MAX_RADIUS = 999;
export const MAX_FONT_SIZE = 2000;
export const MAX_DIMENSION = 100000;
const SLOT_RE = /^[a-z0-9-]{1,20}$/;
const ID_RE = /^[^\u0000-\u001f\u007f]{1,128}$/;

/** origin = {copiedFrom?: {elementId, revision}, slot?: string}: provenance written by the deck tools (closed schema). */
export function isValidOrigin(o) {
  if (!(o !== null && typeof o === 'object' && !Array.isArray(o))) return false;
  for (const k of Object.keys(o)) if (k !== 'copiedFrom' && k !== 'slot') return false;
  if (o.slot !== undefined && !(typeof o.slot === 'string' && SLOT_RE.test(o.slot))) return false;
  if (o.copiedFrom !== undefined) {
    const c = o.copiedFrom;
    if (!(c !== null && typeof c === 'object' && !Array.isArray(c))) return false;
    for (const k of Object.keys(c)) if (k !== 'elementId' && k !== 'revision') return false;
    if (!(typeof c.elementId === 'string' && ID_RE.test(c.elementId))) return false;
    if (!(Number.isInteger(c.revision) && c.revision >= 0)) return false;
  }
  return true;
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** True for a colour value that is safe to emit into CSS or SVG. */
export function isSafeColor(v) {
  if (typeof v !== 'string' || v.length > 80) return false;
  if (v[0] === '@') return isToken(v);
  if (HEX_BAD_LENGTH.test(v)) return false;
  return COLOR_RE.test(v.trim());
}

/**
 * @param {object} content
 * @returns {{content: object, warnings: string[]}} the same content object when nothing needed cleaning
 */
export function cleanElementStyles(content) {
  const list = Array.isArray(content?.elements) ? content.elements : null;
  if (!list) return { content, warnings: [] };
  let colors = 0;
  let radii = 0;
  let opacities = 0;
  let other = 0;
  let sizes = 0;
  let changed = false;
  const elements = list.map((el) => {
    if (!isObj(el)) return el;
    let out = el;
    const own = () => {
      if (out === el) out = { ...el };
    };
    for (const k of STYLE_COLOR_KEYS) {
      if (el[k] === undefined) continue;
      if (!isSafeColor(el[k])) {
        own();
        delete out[k];
        colors += 1;
      }
    }
    if (isObj(el.data) && el.data.backgroundColor !== undefined && !isSafeColor(el.data.backgroundColor)) {
      own();
      out.data = { ...el.data };
      delete out.data.backgroundColor;
      colors += 1;
    }
    if (el.borderRadius !== undefined && !(typeof el.borderRadius === 'number' && Number.isFinite(el.borderRadius) && el.borderRadius >= 0 && el.borderRadius <= MAX_RADIUS)) {
      own();
      delete out.borderRadius;
      radii += 1;
    }
    if (el.fontSize !== undefined) {
      if (typeof el.fontSize !== 'number' || !Number.isFinite(el.fontSize)) { own(); delete out.fontSize; sizes += 1; }
      else if (el.fontSize < 1 || el.fontSize > MAX_FONT_SIZE) { own(); out.fontSize = Math.min(MAX_FONT_SIZE, Math.max(1, el.fontSize)); sizes += 1; }
    }
    if (isObj(el.size)) {
      for (const k of ['width', 'height']) {
        const v = el.size[k];
        if (v === undefined) continue;
        if (typeof v !== 'number' || !Number.isFinite(v)) { own(); out.size = { ...(out.size || el.size) }; delete out.size[k]; sizes += 1; }
        else if (v < 0 || v > MAX_DIMENSION) { own(); out.size = { ...(out.size || el.size), [k]: Math.min(MAX_DIMENSION, Math.max(0, v)) }; sizes += 1; }
      }
    }
    if (el.opacity !== undefined && !(typeof el.opacity === 'number' && Number.isFinite(el.opacity) && el.opacity >= 0 && el.opacity <= 1)) {
      own();
      delete out.opacity;
      opacities += 1;
    }
    if (el.origin !== undefined && !isValidOrigin(el.origin)) {
      own();
      delete out.origin;
      other += 1;
    }
    if (el.showLabel !== undefined && typeof el.showLabel !== 'boolean') {
      own();
      delete out.showLabel;
      other += 1;
    }
    if (isObj(el.data) && el.data.layout !== undefined && !LAYOUT_NAMES.includes(el.data.layout)) {
      own();
      out.data = { ...(out.data || el.data) };
      delete out.data.layout;
      other += 1;
    }
    if (out !== el) changed = true;
    return out;
  });
  const warnings = [];
  if (colors > 0) warnings.push(`${colors} invalid colour${colors === 1 ? '' : 's'} removed (colours are #hex, a colour name, rgb(), or a theme token such as @accent)`);
  if (radii > 0) warnings.push(`${radii} invalid corner radius value${radii === 1 ? '' : 's'} removed (a number from 0 to ${MAX_RADIUS})`);
  if (opacities > 0) warnings.push(`${opacities} invalid opacity value${opacities === 1 ? '' : 's'} removed (a number from 0 to 1)`);
  if (sizes > 0) warnings.push(`${sizes} font size or element size value${sizes === 1 ? '' : 's'} clamped (font size 1 to ${MAX_FONT_SIZE}, sizes 0 to ${MAX_DIMENSION})`);
  if (other > 0) warnings.push(`${other} invalid slide field${other === 1 ? '' : 's'} removed (origin, showLabel or layout)`);
  return { content: changed ? { ...content, elements } : content, warnings };
}
