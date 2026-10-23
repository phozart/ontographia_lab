// lib/present/pptx/mapping.js
// The pure mapping layer of the PPTX export (ADR-0007 section 8.3, slice P3): units, colours, fonts, hyperlinks, notes
// and the file name. No React, no DOM, no I/O, no pptxgenjs: everything here is unit-tested in Node.

import { parseColor } from '../../../components/diagram-studio/packs/colorUtils';
import { docHref } from '../../doc/docHref';
import { FONT_IDS, FONT_LABELS } from '../themes';
import { sanitizeFilename } from '../../../components/diagram-studio/export/diagramJson';

const MAX_SLIDE_W = 13.333;
const MAX_SLIDE_H = 7.5;
const r3 = (n) => Math.round(n * 1000) / 1000;
const r4 = (n) => Math.round(n * 10000) / 10000;

/**
 * The slide size in inches for a frame: LAYOUT_WIDE 13.333 x 7.5 for 16:9, 10 x 7.5 for 4:3, 7.5 x 7.5 for 1:1; any other
 * ratio keeps its shape and fits inside 13.333 x 7.5.
 */
export function slideInches(frameWidth, frameHeight) {
  const w = Number.isFinite(frameWidth) && frameWidth > 0 ? frameWidth : 1920;
  const h = Number.isFinite(frameHeight) && frameHeight > 0 ? frameHeight : 1080;
  const ratio = w / h;
  if (Math.abs(ratio - 16 / 9) < 0.01) return { width: MAX_SLIDE_W, height: MAX_SLIDE_H };
  if (Math.abs(ratio - 4 / 3) < 0.01) return { width: 10, height: MAX_SLIDE_H };
  if (Math.abs(ratio - 1) < 0.01) return { width: MAX_SLIDE_H, height: MAX_SLIDE_H };
  const width = Math.min(MAX_SLIDE_W, MAX_SLIDE_H * ratio);
  return { width: r3(width), height: r3(width / ratio) };
}

/** Inches per board unit for a frame width: inch = unit x slide.width / frame.width (ADR 8.3). */
export const unitScale = (frameWidth, slide) => slide.width / (Number.isFinite(frameWidth) && frameWidth > 0 ? frameWidth : 1920);
export const toInch = (units, k) => r4(units * k);
/** Points: 72 per inch, so `units` board units are units x k x 72 pt (the ADR's px x 0.75 x ... formula, simplified). */
export const toPt = (units, k) => Math.round(units * k * 72 * 100) / 100;
/** PowerPoint's single line spacing is about 1.2 x the font size; the canvas line height is a multiple of the font size. */
export const lineSpacing = (lineHeight) => Math.round((lineHeight / 1.2) * 1000) / 1000;

/** '#4FB3CE' | '#abc' | 'rgb(...)' -> 'RRGGBB' (no hash, as pptxgenjs wants it); null for anything else. */
export function hex6(value) {
  const rgb = parseColor(value);
  if (!rgb) return null;
  return rgb.map((c) => c.toString(16).padStart(2, '0')).join('').toUpperCase();
}

// Office-safe fonts (Q-P7, on by default): sans families map to Arial (every platform, Keynote and Google Slides have
// it, and it is the closest in width to the Inter-class faces), the serif to Georgia, the mono to Courier New.
export const OFFICE_FONTS = Object.freeze({
  inter: 'Arial', 'ibm-plex-sans': 'Arial', 'work-sans': 'Arial', montserrat: 'Arial', 'source-serif-4': 'Georgia', 'ibm-plex-mono': 'Courier New',
});

/** The PPTX `fontFace` for a theme font id. Never free text: unknown ids give Arial. */
export function fontFaceFor(fontId, { officeSafe = true } = {}) {
  if (typeof fontId !== 'string' || !FONT_IDS.includes(fontId)) return 'Arial';
  return officeSafe ? OFFICE_FONTS[fontId] || 'Arial' : FONT_LABELS[fontId] || 'Arial';
}

function labOrigin(boardUrl) {
  if (typeof boardUrl !== 'string') return null;
  try {
    const u = new URL(boardUrl);
    if ((u.protocol !== 'https:' && u.protocol !== 'http:') || u.username || u.password || !u.hostname) return null;
    return { origin: u.origin, base: `${u.origin}${u.pathname}` };
  } catch {
    return null;
  }
}

/**
 * The hyperlink a PPTX run may carry, or null. Allowed: http(s) and mailto (the doc allow-list), and the lab's own links
 * made absolute against the board URL (a PPTX has no "relative to the lab"). Everything else (javascript:, data:, file:,
 * protocol-relative, relative paths) is dropped: the text stays, the link goes.
 * @param {unknown} href
 * @param {{boardUrl?: string}} [ctx] the absolute URL of the board, e.g. https://lab.example.com/diagram/LAB-12
 */
export function safeLink(href, ctx = {}) {
  const h = docHref(href);
  if (!h) return null;
  if (h.kind === 'external' || h.kind === 'mailto') return h.href;
  const lab = labOrigin(ctx.boardUrl);
  if (!lab) return null;
  if (h.kind === 'diagram') return `${lab.origin}${h.href}`;
  if (h.kind === 'element') return `${lab.base}#el=${h.elementId}`;
  return null;
}

/** Strip characters that are invalid in XML 1.0 (the writer escapes the rest; text is never HTML). */
export const xmlSafe = (s) => String(s ?? '').replace(new RegExp('[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\ufffe\\uffff]', 'g'), '');

const NOTES_MAX = 10 * 1024;
const NOTES_STRIP = new RegExp('[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f-\\u009f\\u202a-\\u202e\\u2066-\\u2069\\ufeff]', 'g');
/** Speaker notes as plain text: control and bidi characters removed, line breaks normalized, at most 10 KB. */
export function safeNotes(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/\r\n?/g, '\n').replace(NOTES_STRIP, '').trim().slice(0, NOTES_MAX);
}

/** The download name: sanitized (no path parts, no reserved characters), never empty, always .pptx. */
export function pptxFilename(title) {
  const base = sanitizeFilename(typeof title === 'string' ? title.replace(/\.pptx$/i, '') : '', 'presentation');
  return `${base}.pptx`;
}
