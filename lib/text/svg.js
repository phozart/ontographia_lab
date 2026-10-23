// lib/text/svg.js
// textLayoutToSvg (ADR-0008 3.1, 8): draws the lines of a TextLayout as one SVG <text> with a <tspan x y> per line. Renderers
// never re-wrap: every line is pre-broken and positioned by lib/text/layout.js, exactly as TextBlock does on the canvas.
// Pure and isomorphic (diagram_show, thumbnails, the legacy SVG exporter, and any server-side consumer).
//
// Fonts. An SVG shown through <img src="data:..."> cannot load web fonts, so the lines are drawn in the system font that
// follows Inter in FONT_STACK. The layout measured Inter, so each line made only of glyphs from the Inter table is pinned to its
// measured width with textLength / lengthAdjust="spacing": the system font spreads or tightens its letter spacing by the few
// percent it differs, the line keeps its extent, and nothing leaves its box. Lines with glyphs outside the table (CJK, Arabic,
// emoji: drawn by the system fallback and measured with calibrated class widths) and right-to-left lines are not pinned.
// `pin: false` turns this off (an SVG that embeds the real font).

import { resolveFace } from './fonts';

export const FONT_STACK = "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/** XML-escape text and attribute values (also strips control characters that are invalid in XML 1.0). */
export function escapeXml(value) {
  return String(value ?? '')
     
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
  if (o.fill) attrs.push(`fill="${o.fill}"`);
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
    const extra = rtl ? ' direction="rtl" unicode-bidi="plaintext"' : pin && l.width > 0 && inTable(l.text, face) ? ` textLength="${r1(l.width)}" lengthAdjust="spacing"` : '';
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
