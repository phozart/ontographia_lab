// lib/present/textPreset.js
// Text presets on the existing core/text-block (ADR-0007 decision D5, slice P2). Pure: no React, no I/O.
//
//   element = { type: 'text-block', packId: 'core', fontSize (materialized), label (mirrors the plain text),
//               data: { text: { preset, markdown, color?, align?, verticalAlign?, fontWeight? } } }
//
// The markdown is the AI-5 doc dialect through the SAME sanitizer (lib/doc/sanitize.js) and parser, so there is no HTML,
// no images and every link goes through docHref. Colour and font are NOT stored on the element (only an optional
// explicit `color`): they resolve through the board theme at render time, so a theme switch restyles every preset text.
// The font size IS materialized at insert time (size x frame height / 1080), so a scaled slide keeps its proportions.
// Legacy text-blocks without data.text keep rendering from `label` and the old properties.

import { MAX_TEXT_BYTES } from '../diagramLimits';
import { utf8Length, parseMarkdown, inlineText } from '../doc/markdown';
import { sanitizeDocMarkdown } from '../doc/sanitize';
import { layoutText } from './textLayout';
import { FONT_STACKS, resolveColorValue, resolveTheme, isToken } from './themes';

export { MAX_TEXT_BYTES };
export const TEXT_PRESETS = Object.freeze(['title', 'subtitle', 'heading', 'body', 'caption', 'quote', 'number']);
export const TEXT_STENCIL = 'text-block';
export const TEXT_PACK = 'core';

/** Preset specs at the canonical 1080-unit slide height (ADR 5.2). role = which theme font; color = token. */
export const PRESET_SPECS = Object.freeze({
  title: { size: 72, weight: 700, role: 'heading', color: '@text', lineHeight: 1.1, label: 'Title' },
  subtitle: { size: 40, weight: 400, role: 'body', color: '@muted', lineHeight: 1.25, label: 'Subtitle' },
  heading: { size: 48, weight: 600, role: 'heading', color: '@text', lineHeight: 1.15, label: 'Heading' },
  body: { size: 32, weight: 400, role: 'body', color: '@text', lineHeight: 1.4, label: 'Body' },
  caption: { size: 22, weight: 400, role: 'body', color: '@muted', lineHeight: 1.35, label: 'Caption' },
  quote: { size: 40, weight: 400, italic: true, role: 'body', color: '@text', lineHeight: 1.3, label: 'Quote' },
  number: { size: 120, weight: 600, role: 'heading', color: '@accentText', lineHeight: 1.0, label: 'Number' },
});

const TEXT_KEYS = new Set(['preset', 'markdown', 'color', 'align', 'verticalAlign', 'fontWeight']);
const ALIGNS = ['left', 'center', 'right'];
const V_ALIGNS = ['top', 'middle', 'bottom'];
const WEIGHTS = [300, 400, 500, 600, 700, 800];
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const MIN_FONT = 6;
const MAX_LABEL = 500;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const err = (error, status = 400, code = 'VALIDATION_FAILED') => ({ ok: false, status, code, error });
const clip = (s) => String(s).replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').slice(0, 40);

export const isTextBlock = (el) => isObj(el) && el.type === TEXT_STENCIL && (el.packId === TEXT_PACK || el.packId === undefined);
export const textOf = (el) => (isObj(el) && isObj(el.data) && isObj(el.data.text) && typeof el.data.text.preset === 'string' ? el.data.text : null);
export const isPresetText = (el) => isTextBlock(el) && textOf(el) !== null;

/** size x (frame height / 1080), whole units, never below MIN_FONT. */
export function materializedFontSize(preset, frameHeight = 1080) {
  const spec = PRESET_SPECS[preset] || PRESET_SPECS.body;
  const h = typeof frameHeight === 'number' && Number.isFinite(frameHeight) && frameHeight > 0 ? frameHeight : 1080;
  return Math.max(MIN_FONT, Math.round((spec.size * h) / 1080));
}

/** Plain text of a markdown string for `label` (outlines, search, regions, diff): flattened, at most MAX_LABEL characters. */
export function plainLabelOf(markdown) {
  const parts = [];
  const walk = (blocks) => {
    for (const b of blocks) {
      if (b.c && b.t !== 'quote') parts.push(inlineText(b.c));
      if (b.t === 'quote') walk(b.c);
      if (b.items) for (const it of b.items) walk(it.c);
      if (b.t === 'code') parts.push(b.v);
      if (b.t === 'table') parts.push(b.head.map(inlineText).join(' '), ...b.rows.map((r) => r.map(inlineText).join(' ')));
    }
  };
  walk(parseMarkdown(markdown));
  return parts.join(' ').replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL);
}

/** The CSS-ish style of a preset text, resolved through the theme. Pure; used by the editor, exports and the SVG renderer. */
export function presetStyle(el, themeInput) {
  const theme = resolveTheme(themeInput);
  const t = textOf(el) || {};
  const spec = PRESET_SPECS[t.preset] || PRESET_SPECS.body;
  const size = typeof el?.fontSize === 'number' && Number.isFinite(el.fontSize) && el.fontSize > 0 ? el.fontSize : spec.size;
  const colorValue = t.color !== undefined ? t.color : spec.color;
  return {
    fontSize: size,
    fontWeight: t.fontWeight ?? spec.weight,
    fontStyle: spec.italic ? 'italic' : 'normal',
    fontFamily: FONT_STACKS[theme.fonts[spec.role]] || FONT_STACKS.inter,
    color: resolveColorValue(colorValue, theme, theme.palette.text),
    textAlign: t.align || 'left',
    verticalAlign: t.verticalAlign || 'top',
    lineHeight: spec.lineHeight,
  };
}

/**
 * Validate and clean one data.text payload.
 * @returns {{ok: true, text: object, stats: {links, html, images}} | {ok: false, status: number, code: string, error: string}}
 */
export function cleanTextData(text, path = 'text') {
  if (!isObj(text)) return err(`${path} must be an object`);
  for (const k of Object.keys(text)) if (!TEXT_KEYS.has(k)) return err(`${path} has an unsupported key "${clip(k)}"; allowed: ${[...TEXT_KEYS].join(', ')}`);
  if (!TEXT_PRESETS.includes(text.preset)) return err(`${path}.preset must be one of ${TEXT_PRESETS.join(', ')}`);
  if (typeof text.markdown !== 'string') return err(`${path}.markdown must be a string`);
  const bytes = utf8Length(text.markdown);
  if (bytes > MAX_TEXT_BYTES) return err(`${path}.markdown is too large (${bytes} bytes); the limit is ${MAX_TEXT_BYTES} bytes`, 413, 'PAYLOAD_TOO_LARGE');
  const s = sanitizeDocMarkdown(text.markdown);
  const after = utf8Length(s.markdown);
  if (after > MAX_TEXT_BYTES) return err(`${path}.markdown is too large after escaping (${after} bytes); the limit is ${MAX_TEXT_BYTES} bytes`, 413, 'PAYLOAD_TOO_LARGE');
  const out = { preset: text.preset, markdown: s.markdown };
  if (text.color !== undefined) {
    if (typeof text.color !== 'string' || !(HEX.test(text.color) || isToken(text.color))) return err(`${path}.color must be a #hex colour or a theme token such as @accent`);
    out.color = text.color;
  }
  if (text.align !== undefined) {
    if (!ALIGNS.includes(text.align)) return err(`${path}.align must be one of ${ALIGNS.join(', ')}`);
    out.align = text.align;
  }
  if (text.verticalAlign !== undefined) {
    if (!V_ALIGNS.includes(text.verticalAlign)) return err(`${path}.verticalAlign must be one of ${V_ALIGNS.join(', ')}`);
    out.verticalAlign = text.verticalAlign;
  }
  if (text.fontWeight !== undefined) {
    if (!WEIGHTS.includes(text.fontWeight)) return err(`${path}.fontWeight must be one of ${WEIGHTS.join(', ')}`);
    out.fontWeight = text.fontWeight;
  }
  return { ok: true, text: out, stats: { links: s.links, html: s.html, images: s.images } };
}

/**
 * Validate every preset text of a content object (called by validateDiagramContent). Rewrites the markdown through the
 * sanitizer and keeps `label` equal to the plain text. A legacy text-block (no data.text) is left alone.
 * @returns {{ok: true, content: object, warnings: string[]} | {ok: false, status: number, code: string, error: string}}
 */
export function validateTextElements(content) {
  const list = Array.isArray(content?.elements) ? content.elements : [];
  let changed = false;
  const totals = { links: 0, html: 0, images: 0 };
  let failure = null;
  const elements = list.map((el, idx) => {
    if (failure || !isObj(el) || !isObj(el.data) || el.data.text === undefined) return el;
    const where = `content.elements[${idx}]`;
    if (!isTextBlock(el)) {
      failure = err(`${where}.data.text is only for core/text-block elements`);
      return el;
    }
    const r = cleanTextData(el.data.text, `${where}.data.text`);
    if (!r.ok) {
      failure = r;
      return el;
    }
    for (const k of Object.keys(totals)) totals[k] += r.stats[k] || 0;
    changed = true;
    const label = plainLabelOf(r.text.markdown);
    return { ...el, label, data: { ...el.data, text: r.text } };
  });
  if (failure) return failure;
  const warnings = [];
  if (totals.links > 0) warnings.push(`${totals.links} unsafe link${totals.links === 1 ? '' : 's'} removed from slide text (http, https, mailto, #el= and /diagram/ links are allowed)`);
  if (totals.html > 0) warnings.push(`${totals.html} HTML tag${totals.html === 1 ? '' : 's'} in slide text escaped (text is Markdown; raw HTML is shown as text)`);
  if (totals.images > 0) warnings.push(`${totals.images} image${totals.images === 1 ? '' : 's'} in slide text turned into links`);
  return { ok: true, content: changed ? { ...content, elements } : content, warnings };
}

/**
 * Height (board units) a markdown text needs at `width`: delegates to the single layout boundary (textLayout.js).
 * Never below one line.
 */
export function estimateTextHeight(markdown, preset, width, fontSize) {
  return layoutText({ text: markdown, preset, box: { width }, fontSize }).height;
}

/** A new preset text element (client insert, MCP text_add, layout blocks). Height is estimated unless given. */
export function newPresetTextElement({ id, x, y, preset = 'body', markdown = '', width = 800, height, frameHeight = 1080, extra }) {
  const text = { preset, markdown, ...(extra || {}) };
  const fontSize = materializedFontSize(preset, frameHeight);
  return {
    id,
    type: TEXT_STENCIL,
    packId: TEXT_PACK,
    name: 'Text',
    label: plainLabelOf(markdown),
    layerId: 'default',
    x,
    y,
    size: { width, height: height ?? estimateTextHeight(markdown, preset, width, fontSize) },
    fontSize,
    properties: {},
    data: { text },
  };
}
