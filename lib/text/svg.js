// lib/text/svg.js
// textLayoutToSvg (ADR-0008 3.1, 8): draws the lines of a TextLayout as one SVG <text> with a <tspan x y> per line. Renderers
// never re-wrap: every line is pre-broken and positioned by lib/text/layout.js, exactly as TextBlock does on the canvas.
// Pure and isomorphic (diagram_show, thumbnails, the legacy SVG exporter, and any server-side consumer).
//
// Fonts. An SVG shown through <img src="data:..."> cannot load web fonts, so the lines are drawn in the system font that
// follows Inter in FONT_STACK. The layout measured Inter, so each line made only of glyphs from the Inter table is pinned to its
// measured width with textLength / lengthAdjust="spacing": the system font spreads or tightens its letter spacing by the few
// percent it differs, the line keeps its extent, and nothing leaves its box. Lines with glyphs outside the table (CJK, Arabic,
// emoji: drawn by the system fallback and measured with calibrated class widths), right-to-left lines and lines that a wide fallback
// font (DejaVu, Verdana) would have to squeeze by more than 12% are not pinned (glyphs would touch): they keep their natural width.
// `pin: false` turns this off (an SVG that embeds the real font).

import { resolveFace, graphemeAdvance } from './fonts';
import { parseColor } from '../../components/diagram-studio/packs/colorUtils';

export const FONT_STACK = "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/**
 * XML-escape text and attribute values: strips control characters invalid in XML 1.0 and replaces lone surrogates with U+FFFD
 * (they make encodeURIComponent(svg) throw when the SVG becomes a data: URL).
 */
export function escapeXml(value) {
  return String(value ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '�')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Any stored colour -> '#rrggbb' (only #hex and rgb()/rgba() parse), else the fallback: nothing else reaches an attribute. */
export function safeFill(value, fallback = '#334155') {
  const rgb = parseColor(value);
  return rgb ? `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}` : fallback;
}

// Pinning is only safe when the squeeze stays small. A fallback font (DejaVu, Verdana: wide) can be up to ~15% wider than Inter on
// capitals and digits and ~10% on the rest; textLength then compresses the spacing, and past ~12% glyphs touch. So a line is pinned
// only when even the widest plausible natural width needs at most 12% squeeze.
const WIDE = /[A-Z0-9MWmw@%&]/;
export const MAX_SQUEEZE = 0.12;
export function pinnable(text, face, size, width) {
  if (!(width > 0) || !inTable(text, face)) return false;
  let u = 0;
  for (const ch of text) u += graphemeAdvance(ch, face) * (WIDE.test(ch) ? 1.15 : 1.1);
  const widest = (u * size) / 1000;
  return widest <= 0 || 1 - width / widest <= MAX_SQUEEZE;
}

const r1 = (n) => Math.round(n * 10) / 10;

/** Does every glyph of `text` come from the Inter table (so its measured width can be trusted)? */
function inTable(text, face) {
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp === 0x20 || cp === 0xa0 || cp === 0x2026) continue;
    if (!face.table.adv.has(cp)) return false;
  }
  return true;
}

/**
 * @param {object} layout result of layoutText (or layoutForList)
 * @param {{x: number, y: number}} origin top-left corner of the layout's box (node coordinates + node position)
 * @param {{fill?: string, family?: string, fontStyle?: string, decoration?: string, opacity?: number, kind?: string,
 *          pin?: boolean, rotate?: {deg: number, cx: number, cy: number}, safeFill?: (v: string) => string, badge?: boolean,
 *          box?: {x: number, y: number, width: number, height: number}}} [o]
 *   `badge` draws the overflow chip at the bottom-right of `box` (default true when the layout is clamped and a box is given).
 * @returns {string} '' for an empty layout
 */
export function textLayoutToSvg(layout, origin, o = {}) {
  if (!layout || !layout.lines || !layout.lines.length) return '';
  const { lines, fontSize, weight, overflow } = layout;
  const family = o.family || '';
  const face = resolveFace(family || null, weight);
  const pin = o.pin !== false && face.cls === 'inter';
  const attrs = [];
  if (o.kind) attrs.push(`data-text-block="${escapeXml(o.kind)}"`);
  attrs.push(`font-size="${r1(fontSize)}"`, `font-weight="${weight}"`);
  if (o.fill) attrs.push(`fill="${safeFill(o.fill)}"`);
  if (family) attrs.push(`font-family="${escapeXml(family.includes(',') ? family : `${family}, ${FONT_STACK}`)}"`);
  if (o.fontStyle && o.fontStyle !== 'normal') attrs.push(`font-style="${escapeXml(o.fontStyle)}"`);
  if (o.decoration && o.decoration !== 'none') attrs.push(`text-decoration="${escapeXml(o.decoration)}"`);
  if (o.opacity !== undefined && o.opacity < 1) attrs.push(`opacity="${o.opacity}"`);
  if (o.rotate) attrs.push(`transform="rotate(${r1(o.rotate.deg)} ${r1(o.rotate.cx)} ${r1(o.rotate.cy)})"`);
  const spans = lines.map((l) => {
    const rtl = l.dir === 'rtl';
    // text-anchor start is the RIGHT edge of a right-to-left run: pin it at the right end of the measured line
    const x = origin.x + (rtl ? l.x + l.width : l.x);
    const y = origin.y + l.y;
    const extra = rtl ? ' direction="rtl" unicode-bidi="plaintext"' : pin && pinnable(l.text, face, fontSize, l.width) ? ` textLength="${r1(l.width)}" lengthAdjust="spacing"` : '';
    return `<tspan x="${r1(x)}" y="${r1(y)}"${extra}>${escapeXml(l.text)}</tspan>`;
  }).join('');
  const title = overflow ? `<title>${escapeXml(layout.text)}</title>` : '';
  let out = `<text ${attrs.join(' ')}>${title}${spans}</text>`;
  if (overflow && o.badge !== false && o.box && !o.rotate) {
    // the overflow chip (TextBlock's badge): bottom-right of the text box, accent blue, three dots
    const w = 19;
    const h = 13;
    const bx = origin.x + o.box.width - w; // .ds-text-badge: right 0, bottom -8px, 13 px tall
    const by = origin.y + o.box.height + 8 - h;
    const dot = (cx) => `<circle cx="${r1(cx)}" cy="${r1(by + h / 2)}" r="1.2" fill="#ffffff"/>`;
    out += `<g data-text-badge="true"><title>${escapeXml(layout.text)}</title><rect x="${r1(bx)}" y="${r1(by)}" width="${w}" height="${h}" rx="6.5" fill="#1f6f89"/>${dot(bx + 5)}${dot(bx + 9.5)}${dot(bx + 14)}</g>`;
  }
  return out;
}
