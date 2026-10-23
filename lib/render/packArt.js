// lib/render/packArt.js
// SERVER-ONLY (imports react-dom/server and every pack renderer; never import it from browser code).
//
// Stencil-faithful SVG for diagram_show (spike, ADR-0009): "render the pack, keep its drawing, redraw its text".
//   1. The pack's own renderNode() is rendered with react-dom/server inside a TextCaptureContext, so every TextBlock hands
//      over its shared layout (lib/text) and leaves a placeholder instead of HTML text.
//   2. The markup (React's own, well-formed output) is parsed here and converted:
//        - <svg> subtrees (the packs' shapes, icons, folds, markers) are kept, through an allowlist of elements, attributes and
//          values (colours re-emitted as #rrggbb, paths checked against a command alphabet, ids rewritten);
//        - absolutely positioned HTML boxes (UML compartments, ERD headers and rows, ITIL cards) become <rect>/<line>, from their
//          inline style plus the few pack classes of styles/diagram-studio.css (CLASS_STYLES);
//        - text placeholders become SVG <text> from the captured layout (lib/text/svg.js, the T3 drawer: same lines as the
//          canvas, by construction).
//   3. Anything the converter does not understand is reported in `unhandled` (a test keeps that list empty for every stencil)
//      and is left out, never passed through.
// The output is in node-local coordinates (0,0 = the element's top-left corner); the caller translates it.

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TextCaptureContext } from '../../components/diagram-studio/text/textCapture';
import { textLayoutToSvg, escapeXml } from '../text/svg';
import CorePack from '../../components/diagram-studio/packs/CorePack';
import ProcessFlowPack from '../../components/diagram-studio/packs/ProcessFlowPack';
import StickyNotesPack from '../../components/diagram-studio/packs/StickyNotesPack';
import CLDPack from '../../components/diagram-studio/packs/CLDPack';
import UMLClassPack from '../../components/diagram-studio/packs/UMLClassPack';
import MindMapPack from '../../components/diagram-studio/packs/MindMapPack';
import ProductDesignPack from '../../components/diagram-studio/packs/ProductDesignPack';
import ERDPack from '../../components/diagram-studio/packs/ERDPack';
import TOGAFPack from '../../components/diagram-studio/packs/TOGAFPack';
import ITILPack from '../../components/diagram-studio/packs/ITILPack';
import CapabilityMapPack from '../../components/diagram-studio/packs/CapabilityMapPack';

const PACKS = new Map([CorePack, ProcessFlowPack, StickyNotesPack, CLDPack, UMLClassPack, MindMapPack, ProductDesignPack, ERDPack, TOGAFPack, ITILPack, CapabilityMapPack].map((p) => [p.id, p]));

// Core elements the server already draws itself (frames, sections, tables, docs, text presets, dividers): not through the packs.
const SERVER_DRAWN = new Set(['frame', 'section', 'table', 'doc', 'text-block', 'divider']);

// The light-theme values of the app tokens the packs use (styles/globals.css :root). The board keeps its light colours in
// diagram_show (Q-AV5), as on the canvas.
export const TOKENS = Object.freeze({
  '--bg': '#f8fafc', '--panel': '#ffffff', '--canvas-bg': '#ffffff', '--text': '#0f172a', '--text-muted': '#475569',
  '--border': '#e2e8f0', '--accent': '#4FB3CE', '--accent-hover': '#3a9fba', '--selection': '#4FB3CE',
});

const NAMED = Object.freeze({ white: '#ffffff', black: '#000000', red: '#ff0000', gray: '#808080', grey: '#808080', transparent: 'none', none: 'none' });

// The pack classes of styles/diagram-studio.css that carry drawing (position and paint), as inline-style objects.
// Spike: transcribed by hand; the slice generates this table from the stylesheet and a test pins it (ADR-0009, slice F2).
const UML_BOX = { position: 'relative', width: '100%', height: '100%', 'box-sizing': 'border-box', background: 'var(--panel)', border: '2px solid var(--text-muted)', 'border-radius': '4px' };
export const CLASS_STYLES = Object.freeze({
  'ds-text': { position: 'absolute' },
  'uml-class-node': UML_BOX, 'uml-package-node': UML_BOX, 'uml-frame': { ...UML_BOX, background: 'transparent' },
  'uml-action': { ...UML_BOX, background: 'white', 'border-radius': '12px' }, 'uml-state': { ...UML_BOX, background: 'white', 'border-radius': '12px' },
  'uml-class-header': { position: 'absolute', left: '0', top: '0', right: '0', 'border-bottom': '1px solid rgba(0, 0, 0, 0.2)', 'border-radius': '2px 2px 0 0' },
  'uml-class-rule': { position: 'absolute', left: '0', right: '0', 'border-top': '1px solid var(--border)' },
  'uml-state-rule': { position: 'absolute', left: '0', right: '0', 'border-top': '1px solid var(--border)' },
  'uml-package-tab': { position: 'absolute', left: '0', top: '0', height: '28px', 'border-radius': '0 0 8px 0' },
  'uml-note-node': { position: 'relative', width: '100%', height: '100%', 'box-sizing': 'border-box', background: '#fef3c7', border: '1px solid #f59e0b' },
  'uml-note-corner': { position: 'absolute', top: '0', right: '0', width: '16px', height: '16px', background: 'linear-gradient(135deg, transparent 50%, #fcd34d 50%)', 'border-left': '1px solid #f59e0b', 'border-bottom': '1px solid #f59e0b' },
  'uml-marker': { position: 'relative', width: '100%', height: '100%' },
  'uml-fork-join': { width: '100%', height: '100%', background: '#1f2937', 'border-radius': '2px' },
  'uml-lane-header': { position: 'absolute', left: '0', top: '0', right: '0', height: '28px' },
  'uml-fragment-tab': { position: 'absolute', left: '0', top: '0', width: '64px', height: '20px' },
  'uml-activation': { width: '100%', height: '100%', border: '1px solid', 'border-radius': '2px', opacity: '0.9', 'box-sizing': 'border-box' },
  'uml-lifeline': { position: 'relative', width: '100%', height: '100%' },
  'uml-lifeline-head': { position: 'absolute', left: '2px', right: '2px', top: '2px', 'box-sizing': 'border-box', border: '2px solid', background: 'white', 'border-radius': '4px' },
  'uml-lifeline-line': { position: 'absolute', bottom: '0', width: '0', 'border-left': '2px dashed' },
  'erd-entity-node': { position: 'relative', width: '100%', height: '100%', background: 'var(--panel)', border: '2px solid var(--text-muted)', 'border-radius': '4px' },
  'erd-entity-header': { position: 'absolute', top: '0', left: '0', right: '0', 'border-bottom': '1px solid rgba(0, 0, 0, 0.2)' },
  'erd-entity-badge': { position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', 'font-size': '11px', 'line-height': '14px', padding: '0 6px', background: 'rgba(255, 255, 255, 0.2)', 'border-radius': '3px' },
  'erd-field': { position: 'absolute', left: '0', right: '0', height: '20px' },
  pk: { background: 'rgba(59, 130, 246, 0.1)' },
  fk: { background: 'rgba(249, 115, 22, 0.1)' },
  'erd-field-icons': { position: 'absolute', left: '10px', top: '0', width: '20px', 'line-height': '20px', 'text-align': 'center' },
  'erd-pk-icon': { 'font-size': '11px' }, 'erd-fk-icon': { 'font-size': '11px' },
  'erd-entity-indexes': { position: 'absolute', left: '0', right: '0', bottom: '0', 'border-top': '1px solid var(--border)', background: 'var(--bg)' },
  'erd-index': { position: 'absolute', left: '10px', right: '0', height: '20px' },
  'erd-index-icon': { position: 'absolute', left: '0', top: '0', 'line-height': '20px', 'font-size': '11px', color: 'var(--accent)' },
  'erd-attribute-node': { position: 'relative', width: '100%', height: '100%', background: 'var(--panel)', border: '2px solid var(--text-muted)', 'border-radius': '50%' },
  weak: { 'border-style': 'double', 'border-width': '4px' },
  view: { 'border-style': 'dashed' },
  'erd-row-badge': { position: 'absolute', top: '0', width: '18px', height: '100%' },
  'erd-field-spacer': { color: 'var(--text-muted)', 'font-size': '11px' },
  // classes that only name a wrapper (no paint of their own)
  'archimate-node': {}, 'sticky-note-node': {}, 'container-node': {}, empty: {}, more: {}, 'ds-table': {}, 'ds-tbl-empty': {},
  'uml-italic': { 'font-style': 'italic' }, 'uml-action-icon': { position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: '0.6', 'font-size': '12px' },
  'ds-node-label-below': {}, 'ds-text-w400': {}, 'ds-text-w500': {}, 'ds-text-w600': {}, 'ds-text-w700': {}, 'ds-text-lh125': {}, 'ds-text-lh130': {}, 'ds-text-start': {}, 'ds-text-end': {},
});

// ---------------------------------------------------------------- parsing React's static markup

const VOID = new Set(['img', 'br', 'hr', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr']);
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') {
    const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : '';
  }
  return ENT[e.toLowerCase()] ?? m;
});

/** React's renderToStaticMarkup output -> {tag, attrs, children} tree. Not a general HTML parser (it does not need to be). */
export function parseMarkup(html) {
  const root = { tag: '#root', attrs: {}, children: [] };
  const stack = [root];
  const re = /<\/([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)((?:\s+[^\s=>/]+(?:="[^"]*")?)*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(html))) {
    const top = stack[stack.length - 1];
    if (m[1]) {
      const tag = m[1].toLowerCase();
      for (let i = stack.length - 1; i > 0; i -= 1) if (stack[i].tag === tag) { stack.length = i; break; }
    } else if (m[2]) {
      const tag = m[2].toLowerCase();
      const attrs = {};
      const ar = /([^\s=]+)(?:="([^"]*)")?/g;
      let a;
      while ((a = ar.exec(m[3] || ''))) attrs[a[1]] = a[2] === undefined ? '' : decode(a[2]);
      const node = { tag, attrs, children: [] };
      top.children.push(node);
      if (!m[4] && !VOID.has(tag)) stack.push(node);
    } else if (m[5]) {
      top.children.push({ tag: '#text', text: decode(m[5]), attrs: {}, children: [] });
    }
  }
  return root;
}

// ---------------------------------------------------------------- values

const r1 = (n) => {
  const v = Math.round(n * 10) / 10;
  return Object.is(v, -0) ? '0' : String(v);
};

function parseStyle(s) {
  const out = {};
  if (!s) return out;
  let depth = 0;
  let cur = '';
  const parts = [];
  for (const ch of s) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ';' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
  }
  parts.push(cur);
  for (const p of parts) {
    const i = p.indexOf(':');
    if (i > 0) out[p.slice(0, i).trim().toLowerCase()] = p.slice(i + 1).trim();
  }
  return out;
}

/** A CSS/SVG colour -> {hex, alpha} | 'none' | null. var(--token, fallback) resolves through TOKENS. */
export function parsePaint(value, current = null) {
  if (typeof value !== 'string') return null;
  let v = value.trim();
  for (let i = 0; i < 3; i += 1) {
    const vm = /^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/i.exec(v);
    if (!vm) break;
    v = TOKENS[vm[1]] || (vm[2] ? vm[2].trim() : '');
  }
  const low = v.toLowerCase();
  if (!low) return null;
  if (low === 'currentcolor') return current;
  if (NAMED[low]) return NAMED[low] === 'none' ? 'none' : { hex: NAMED[low], alpha: 1 };
  let m = /^#([0-9a-f]{3,4})$/.exec(low);
  if (m) {
    const h = m[1];
    const hex = `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
    return { hex, alpha: h.length === 4 ? parseInt(h[3] + h[3], 16) / 255 : 1 };
  }
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(low);
  if (m) return { hex: `#${m[1]}`, alpha: m[2] ? parseInt(m[2], 16) / 255 : 1 };
  m = /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*(?:[,/]\s*([\d.]+)(%?)\s*)?\)$/.exec(low);
  if (m) {
    const c = [m[1], m[2], m[3]].map((x) => Math.max(0, Math.min(255, Math.round(parseFloat(x)))));
    const a = m[4] === undefined ? 1 : Math.max(0, Math.min(1, parseFloat(m[4]) / (m[5] ? 100 : 1)));
    return { hex: `#${c.map((x) => x.toString(16).padStart(2, '0')).join('')}`, alpha: a };
  }
  return null;
}

const px = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const m = /^(-?[\d.]+)(px)?$/.exec(String(v).trim());
  return m ? parseFloat(m[1]) : null;
};
/** A CSS length against a reference size: px, %, or null (unknown / auto). */
function len(v, ref) {
  if (v === undefined || v === null || v === '' || v === 'auto') return null;
  const s = String(v).trim();
  const p = /^(-?[\d.]+)%$/.exec(s);
  if (p) return (parseFloat(p[1]) / 100) * ref;
  return px(s);
}
const SAFE_NUM = /^-?[\d.]+(e-?\d+)?%?$/i;
const PATH_OK = /^[MLCQAZHVSTmlcqazhvst0-9eE\s,.+-]*$/;
const TRANSFORM_OK = /^(\s*(translate|scale|rotate|matrix|skewX|skewY)\(\s*[-\d.e]+(\s*[,\s]\s*[-\d.e]+)*\s*\)\s*)+$/i;
const compactNums = (s) => s.replace(/-?\d*\.\d+(e-?\d+)?/gi, (n) => r1(parseFloat(n)));

// ---------------------------------------------------------------- the converter

const SVG_ELEMENTS = new Set(['g', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path', 'text', 'tspan']);
const GEOM = new Set(['x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height', 'dx', 'dy', 'font-size', 'stroke-width', 'opacity', 'fill-opacity', 'stroke-opacity', 'offset', 'stop-opacity', 'stroke-miterlimit', 'stroke-dashoffset']);
const ENUM = {
  'stroke-linecap': /^(butt|round|square)$/, 'stroke-linejoin': /^(miter|round|bevel)$/, 'fill-rule': /^(nonzero|evenodd)$/, 'clip-rule': /^(nonzero|evenodd)$/,
  'text-anchor': /^(start|middle|end)$/, 'dominant-baseline': /^(auto|middle|central|hanging|alphabetic|text-before-edge|text-after-edge)$/,
  'font-weight': /^(normal|bold|[1-9]00)$/, 'font-style': /^(normal|italic)$/, 'vector-effect': /^non-scaling-stroke$/, gradientUnits: /^(userSpaceOnUse|objectBoundingBox)$/,
};
const PAINT = new Set(['fill', 'stroke', 'stop-color']);

/**
 * @param {object} el the element (stored content), already sized ({size: {width, height}}) and with theme tokens resolved
 * @param {object} stencil catalog stencil
 * @param {{defs: Map<string,string>}} shared   gradient definitions shared across the whole picture (content -> id)
 * @returns {{art: string, text: string, unhandled: string[], dropped: number} | null}  null: the pack draws nothing itself
 *          (the generic renderer applies), or the element is one the server draws without the packs.
 */
export function packArt(el, stencil, shared, opts = {}) {
  if (el.packId === 'core' && SERVER_DRAWN.has(el.type)) return null;
  const pack = PACKS.get(el.packId);
  if (!pack || typeof pack.renderNode !== 'function') return null;
  let node;
  try { node = pack.renderNode(el, stencil, false, { editing: false }); } catch { return null; }
  if (node === undefined || node === null) return null;
  const caps = [];
  let html;
  try {
    html = renderToStaticMarkup(createElement(TextCaptureContext.Provider, { value: (c) => { caps.push(c); return caps.length - 1; } }, node));
  } catch {
    return null;
  }
  const W = el.size.width;
  const H = el.size.height;
  const st = { art: [], text: [], unhandled: [], dropped: 0, caps, shared, pin: opts.pin !== false, ids: new Map() };
  const rootBox = { x: 0, y: 0, width: W, height: H };
  const inherited = { color: '#1f2937', fontSize: 14, fontWeight: 500, textAlign: 'center', lineHeight: null };
  for (const child of parseMarkup(html).children) walkHtml(child, { cb: rootBox, parent: rootBox, inh: inherited }, st);
  return { art: st.art.join(''), text: st.text.join(''), unhandled: st.unhandled, dropped: st.dropped };
}

function classStyle(attrs) {
  const out = {};
  for (const c of String(attrs.class || '').split(/\s+/).filter(Boolean)) {
    if (CLASS_STYLES[c]) Object.assign(out, CLASS_STYLES[c]);
  }
  return out;
}

function unknownClasses(attrs) {
  return String(attrs.class || '').split(/\s+/).filter((c) => c && !CLASS_STYLES[c]);
}

function borderOf(style, side) {
  // a border shorthand ("2px solid #abc", "1px dashed", "none") -> {w, style, color}
  const parse = (v) => {
    const out = {};
    if (!v) return out;
    for (const tok of v.split(/\s+(?![^(]*\))/)) {
      if (/^(none|hidden)$/.test(tok)) out.style = 'none';
      else if (/^(solid|dashed|dotted|double)$/.test(tok)) out.style = tok;
      else if (px(tok) !== null) out.w = px(tok);
      else out.color = tok;
    }
    return out;
  };
  const all = parse(style.border);
  const one = side ? parse(style[`border-${side}`]) : {};
  const w = one.w ?? px(style[`border-${side}-width`]) ?? px(style['border-width']) ?? all.w;
  const sty = one.style ?? style[`border-${side}-style`] ?? style['border-style'] ?? all.style;
  const color = one.color ?? style[`border-${side}-color`] ?? style['border-color'] ?? all.color;
  if (!sty || sty === 'none') return null;
  return { w: w ?? 3, style: sty, color };
}

function attr(name, value) {
  return ` ${name}="${escapeXml(value)}"`;
}

function paintAttrs(name, paint, extraAlpha = 1) {
  if (!paint || paint === 'none') return attr(name, 'none');
  if (paint.ref) return attr(name, `url(#${paint.ref})`);
  const a = paint.alpha * extraAlpha;
  return `${attr(name, paint.hex)}${a < 0.999 ? attr(`${name}-opacity`, r1(a * 100) / 100 === 0 ? '0' : String(Math.round(a * 1000) / 1000)) : ''}`;
}

function walkHtml(n, ctx, st) {
  if (n.tag === '#text') {
    const t = n.text.replace(/\s+/g, ' ').trim();
    if (t) drawStaticText(t, ctx, st);
    return;
  }
  if (n.tag === 'i' && n.attrs['data-cap'] !== undefined) return drawCaptured(n, ctx, st);
  if (n.tag === 'svg') return drawSvgRoot(n, ctx, st);
  if (n.tag === 'img' || n.tag === 'input' || n.tag === 'button' || n.tag === 'textarea' || n.tag === 'foreignobject' || n.tag === 'iframe') {
    st.unhandled.push(`<${n.tag}>`);
    return;
  }
  for (const c of unknownClasses(n.attrs)) st.unhandled.push(`.${c}`);
  const style = { ...classStyle(n.attrs), ...parseStyle(n.attrs.style) };
  const { parent, cb } = ctx;
  const pos = style.position || 'static';
  const abs = pos === 'absolute';
  const ref = abs ? cb : parent;
  const bt = borderOf(style, 'top');
  const bb = borderOf(style, 'bottom');
  const bl = borderOf(style, 'left');
  const br = borderOf(style, 'right');
  const bw = { t: bt ? bt.w : 0, b: bb ? bb.w : 0, l: bl ? bl.w : 0, r: br ? br.w : 0 };
  const pad = parsePadding(style);
  const borderBox = style['box-sizing'] === 'border-box';
  const left = len(style.left, ref.width);
  const right = len(style.right, ref.width);
  const top = len(style.top, ref.height);
  const bottom = len(style.bottom, ref.height);
  let w = len(style.width, ref.width);
  let h = len(style.height, ref.height);
  const extraW = borderBox ? 0 : bw.l + bw.r + pad.l + pad.r;
  const extraH = borderBox ? 0 : bw.t + bw.b + pad.t + pad.b;
  if (w !== null) w += extraW;
  if (h !== null) h += extraH;
  if (w === null) w = abs && left !== null && right !== null ? ref.width - left - right : abs ? extraW : ref.width;
  if (h === null) h = abs && top !== null && bottom !== null ? ref.height - top - bottom : abs ? extraH + (px(style['line-height']) || 0) : ref.height;
  let x = ref.x;
  let y = ref.y;
  if (abs) {
    x = left !== null ? ref.x + left : right !== null ? ref.x + ref.width - right - w : ref.x;
    y = top !== null ? ref.y + top : bottom !== null ? ref.y + ref.height - bottom - h : ref.y;
  } else if (pos === 'relative') {
    x += left ?? 0;
    y += top ?? 0;
  }
  const tm = /translate(X|Y)?\(\s*(-?[\d.]+)(%|px)?(?:\s*,\s*(-?[\d.]+)(%|px)?)?\s*\)/.exec(style.transform || '');
  if (tm) {
    const val = (num, unit, size) => (unit === '%' ? (parseFloat(num) / 100) * size : parseFloat(num));
    if (tm[1] === 'X') x += val(tm[2], tm[3], w);
    else if (tm[1] === 'Y') y += val(tm[2], tm[3], h);
    else { x += val(tm[2], tm[3], w); if (tm[4] !== undefined) y += val(tm[4], tm[5], h); }
  } else if (style.transform && style.transform !== 'none') st.unhandled.push(`transform:${style.transform}`);
  const box = { x, y, width: Math.max(0, w), height: Math.max(0, h) };
  const inh = {
    ...ctx.inh,
    color: style.color ? (parsePaint(style.color, ctx.inh.colorPaint) ? style.color : ctx.inh.color) : ctx.inh.color,
    fontSize: px(style['font-size']) ?? ctx.inh.fontSize,
    fontWeight: style['font-weight'] ? parseInt(style['font-weight'], 10) || ctx.inh.fontWeight : ctx.inh.fontWeight,
    textAlign: style['text-align'] || ctx.inh.textAlign,
    lineHeight: px(style['line-height']) ?? ctx.inh.lineHeight,
  };
  const opacity = style.opacity !== undefined ? parseFloat(style.opacity) : 1;
  const before = st.art.length;
  paintBox(box, style, { bt, bb, bl, br }, inh, st);
  if (style['box-shadow'] && style['box-shadow'] !== 'none') st.dropped += 1; // shadows are left out (bytes and paint time)
  const padBox = { x: box.x + bw.l, y: box.y + bw.t, width: Math.max(0, box.width - bw.l - bw.r), height: Math.max(0, box.height - bw.t - bw.b) };
  const contentBox = { x: padBox.x + pad.l, y: padBox.y + pad.t, width: Math.max(0, padBox.width - pad.l - pad.r), height: Math.max(0, padBox.height - pad.t - pad.b) };
  const positioned = pos !== 'static';
  const childCtx = { cb: positioned ? padBox : cb, parent: contentBox, inh };
  for (const c of n.children) walkHtml(c, childCtx, st);
  if (opacity < 0.999 && st.art.length > before) {
    const inner = st.art.splice(before).join('');
    st.art.push(`<g${attr('opacity', r1(opacity * 100) / 100)}>${inner}</g>`);
  }
}

function parsePadding(style) {
  const out = { t: 0, r: 0, b: 0, l: 0 };
  if (style.padding) {
    const v = style.padding.split(/\s+/).map((x) => px(x) ?? 0);
    const [t, r = t, b = t, l = r] = v;
    Object.assign(out, { t, r, b, l });
  }
  for (const [k, s] of [['t', 'top'], ['r', 'right'], ['b', 'bottom'], ['l', 'left']]) {
    const v = px(style[`padding-${s}`]);
    if (v !== null) out[k] = v;
  }
  return out;
}

function radiusOf(style, box) {
  const v = style['border-radius'];
  if (!v) return { rx: 0, round: false, partial: false };
  const parts = v.split(/\s+/);
  if (parts.length === 1 && /%$/.test(parts[0])) return { rx: (parseFloat(parts[0]) / 100) * Math.min(box.width, box.height), round: parseFloat(parts[0]) >= 50, partial: false };
  const vals = parts.map((p) => px(p) ?? 0);
  const max = Math.max(...vals);
  return { rx: Math.min(max, Math.min(box.width, box.height) / 2), round: false, partial: vals.some((x) => x !== max) };
}

function paintBox(box, style, borders, inh, st) {
  const cur = parsePaint(inh.color);
  const bg = style.background ?? style['background-color'];
  let fill = null;
  if (bg) {
    const grad = /linear-gradient\(\s*135deg\s*,\s*transparent\s+50%\s*,\s*([^)]+?)\s+50%\s*\)/.exec(bg);
    if (grad) {
      // the folded-corner idiom (UML note): the lower-right half of the box
      const p = parsePaint(grad[1], cur);
      if (p && p !== 'none') st.art.push(`<path d="M${r1(box.x + box.width)} ${r1(box.y)}V${r1(box.y + box.height)}H${r1(box.x)}z"${paintAttrs('fill', p)}/>`);
    } else if (/^linear-gradient\(/i.test(bg.trim())) {
      const id = cssLinearGradient(bg.trim(), st, cur);
      if (id) fill = { ref: id };
      else st.unhandled.push(`background:${bg.slice(0, 40)}`);
    } else if (/gradient|url\(/i.test(bg)) {
      st.unhandled.push(`background:${bg.slice(0, 40)}`);
    } else {
      const tok = bg.split(/\s+(?![^(]*\))/).find((t) => parsePaint(t, cur));
      fill = tok ? parsePaint(tok, cur) : null;
    }
  }
  const { bt, bb, bl, br } = borders;
  const uniform = bt && bb && bl && br && bt.w === bb.w && bt.w === bl.w && bt.w === br.w && bt.color === bb.color && bt.color === bl.color && bt.color === br.color && bt.style === bb.style;
  const { rx, round } = radiusOf(style, box);
  if (box.width <= 0 && box.height <= 0) return;
  const shape = (inset, extra) => {
    const x = box.x + inset;
    const y = box.y + inset;
    const w = Math.max(0, box.width - inset * 2);
    const h = Math.max(0, box.height - inset * 2);
    if (round) return `<ellipse cx="${r1(x + w / 2)}" cy="${r1(y + h / 2)}" rx="${r1(w / 2)}" ry="${r1(h / 2)}"${extra}/>`;
    const r = Math.max(0, rx - inset);
    return `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}"${r > 0 ? ` rx="${r1(r)}"` : ''}${extra}/>`;
  };
  const fillA = fill && fill !== 'none' ? paintAttrs('fill', fill) : '';
  if (uniform) {
    const stroke = parsePaint(bt.color || inh.color, cur) || cur;
    const dash = bt.style === 'dashed' ? attr('stroke-dasharray', `${r1(bt.w * 3)} ${r1(bt.w * 2)}`) : bt.style === 'dotted' ? attr('stroke-dasharray', `${r1(bt.w)} ${r1(bt.w)}`) : '';
    if (bt.style === 'double') {
      const t = bt.w / 3;
      st.art.push(shape(t / 2, `${fillA || ' fill="none"'}${paintAttrs('stroke', stroke)}${attr('stroke-width', r1(t))}`));
      st.art.push(shape(bt.w - t / 2, ` fill="none"${paintAttrs('stroke', stroke)}${attr('stroke-width', r1(t))}`));
    } else {
      st.art.push(shape(bt.w / 2, `${fillA || ' fill="none"'}${paintAttrs('stroke', stroke)}${attr('stroke-width', r1(bt.w))}${dash}`));
    }
    return;
  }
  if (fillA) st.art.push(shape(0, fillA));
  // single sides (rules, header underlines, lifelines)
  const side = (b, x1, y1, x2, y2) => {
    if (!b) return;
    const p = parsePaint(b.color || inh.color, cur) || cur;
    const dash = b.style === 'dashed' ? attr('stroke-dasharray', `${r1(b.w * 3)} ${r1(b.w * 2)}`) : b.style === 'dotted' ? attr('stroke-dasharray', `${r1(b.w)} ${r1(b.w)}`) : '';
    st.art.push(`<line x1="${r1(x1)}" y1="${r1(y1)}" x2="${r1(x2)}" y2="${r1(y2)}"${paintAttrs('stroke', p)}${attr('stroke-width', r1(b.w))}${dash}/>`);
  };
  const { x, y, width: w, height: h } = box;
  side(bt, x, y + (bt?.w || 0) / 2, x + w, y + (bt?.w || 0) / 2);
  side(bb, x, y + h - (bb?.w || 0) / 2, x + w, y + h - (bb?.w || 0) / 2);
  side(bl, x + (bl?.w || 0) / 2, y, x + (bl?.w || 0) / 2, y + h);
  side(br, x + w - (br?.w || 0) / 2, y, x + w - (br?.w || 0) / 2, y + h);
}

// A text block of the shared layout (TextBlock placeholder): drawn by the T3 drawer at the same place the canvas puts the div.
function drawCaptured(n, ctx, st) {
  const c = st.caps[Number(n.attrs['data-cap'])];
  if (!c) return;
  const origin = { x: ctx.cb.x + c.box.x + (c.offsetX || 0), y: ctx.cb.y + c.box.y + (c.offsetY || 0) };
  const cur = parsePaint(ctx.inh.color);
  const p = parsePaint(c.color || ctx.inh.color, cur);
  const fill = p && p !== 'none' ? p.hex : '#1f2937';
  const rotate = c.rotate ? { deg: c.rotate, cx: origin.x + c.box.width / 2, cy: origin.y + c.box.height / 2 } : undefined;
  st.text.push(textLayoutToSvg(c.layout, origin, { fill, family: c.fontFamily || undefined, fontStyle: c.fontStyle, decoration: c.textDecoration, box: c.box, badge: !c.hideBadge, rotate, pin: st.pin }));
}

// Static glyphs written straight into the HTML (ERD key icons, index markers): one <text> line in the box, approximately placed.
function drawStaticText(t, ctx, st) {
  const { parent, inh } = ctx;
  const size = inh.fontSize || 14;
  const lh = inh.lineHeight || size * 1.25;
  const anchor = inh.textAlign === 'center' ? 'middle' : inh.textAlign === 'right' || inh.textAlign === 'end' ? 'end' : 'start';
  const x = anchor === 'middle' ? parent.x + parent.width / 2 : anchor === 'end' ? parent.x + parent.width : parent.x;
  const y = parent.y + lh / 2 + size * 0.35;
  const p = parsePaint(inh.color);
  st.text.push(`<text x="${r1(x)}" y="${r1(y)}" font-size="${r1(size)}"${anchor !== 'start' ? ` text-anchor="${anchor}"` : ''}${p && p !== 'none' ? ` fill="${p.hex}"` : ''}>${escapeXml(t)}</text>`);
}

function drawSvgRoot(n, ctx, st) {
  const style = parseStyle(n.attrs.style);
  const abs = style.position === 'absolute';
  const ref = abs ? ctx.cb : ctx.parent;
  const w = px(n.attrs.width) ?? len(n.attrs.width, ref.width) ?? ref.width;
  const h = px(n.attrs.height) ?? len(n.attrs.height, ref.height) ?? ref.height;
  const x = ref.x + (abs ? len(style.left, ref.width) ?? 0 : 0);
  const y = ref.y + (abs ? len(style.top, ref.height) ?? 0 : 0);
  let transform = x || y ? `translate(${r1(x)} ${r1(y)})` : '';
  const vb = /^\s*(-?[\d.]+)[\s,]+(-?[\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*$/.exec(n.attrs.viewBox || n.attrs.viewbox || '');
  if (vb) {
    const sx = w / parseFloat(vb[3]);
    const sy = h / parseFloat(vb[4]);
    if (Number.isFinite(sx) && Number.isFinite(sy) && (Math.abs(sx - 1) > 1e-3 || Math.abs(sy - 1) > 1e-3)) transform += `${transform ? ' ' : ''}scale(${Math.round(sx * 1000) / 1000}${Math.abs(sx - sy) > 1e-3 ? ` ${Math.round(sy * 1000) / 1000}` : ''})`;
    if (parseFloat(vb[1]) || parseFloat(vb[2])) transform += ` translate(${r1(-parseFloat(vb[1]))} ${r1(-parseFloat(vb[2]))})`;
  }
  const cur = parsePaint(ctx.inh.color);
  const pres = svgAttrs(n.attrs, st, cur);
  const body = n.children.map((c) => svgNode(c, st, cur)).join('');
  if (!body) return;
  st.art.push(transform || pres ? `<g${transform ? ` transform="${transform}"` : ''}${pres}>${body}</g>` : body);
}

/** The allowlisted presentation and geometry attributes of one SVG element (values validated). */
function svgAttrs(attrs, st, cur, tag) {
  let out = '';
  const style = parseStyle(attrs.style);
  const all = { ...attrs };
  for (const k of ['fill', 'stroke', 'stroke-width', 'opacity', 'fill-opacity', 'stroke-opacity', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin']) if (style[k] !== undefined) all[k] = style[k];
  for (const [k, v0] of Object.entries(all)) {
    const v = String(v0).trim();
    if (k === 'style' || k === 'class' || k === 'id' || k === 'xmlns' || k === 'viewBox' || k === 'viewbox' || (tag === undefined && (k === 'width' || k === 'height'))) continue;
    if (k === 'filter' || k === 'mask' || k === 'clip-path') { st.dropped += 1; continue; }
    if (k === 'marker-start' || k === 'marker-mid' || k === 'marker-end') {
      const ref = /^url\(\s*#([\w-]+)\s*\)$/.exec(v);
      const id = ref && st.ids.get(ref[1]);
      if (id) out += attr(k, `url(#${id})`);
      continue;
    }
    if (PAINT.has(k)) {
      const ref = /^url\(\s*#([\w-]+)\s*\)$/.exec(v);
      if (ref) {
        const id = st.ids.get(ref[1]);
        out += attr(k, id ? `url(#${id})` : 'none');
        continue;
      }
      const p = parsePaint(v, cur);
      if (p === 'none') out += attr(k, 'none');
      else if (p) {
        out += attr(k, p.hex);
        if (p.alpha < 0.999) out += attr(k === 'stop-color' ? 'stop-opacity' : `${k}-opacity`, String(Math.round(p.alpha * 1000) / 1000));
      } else st.unhandled.push(`${k}=${v.slice(0, 30)}`);
      continue;
    }
    if (GEOM.has(k)) { if (SAFE_NUM.test(v)) out += attr(k, /%$/.test(v) ? v : r1(parseFloat(v))); else st.unhandled.push(`${k}=${v.slice(0, 20)}`); continue; }
    if (ENUM[k]) { if (ENUM[k].test(v)) out += attr(k, v); continue; }
    if (k === 'd') { if (PATH_OK.test(v)) out += attr('d', compactNums(v.replace(/\s+/g, ' '))); else st.unhandled.push('d'); continue; }
    if (k === 'points') { if (/^[\d\s,.eE+-]*$/.test(v)) out += attr('points', compactNums(v)); else st.unhandled.push('points'); continue; }
    if (k === 'transform') { if (TRANSFORM_OK.test(v)) out += attr('transform', compactNums(v)); else st.unhandled.push('transform'); continue; }
    if (k === 'stroke-dasharray') { if (/^[\d.\s,]+$|^none$/.test(v)) out += attr(k, v); continue; }
    if (k === 'x1' || k === 'y1' || k === 'x2' || k === 'y2') continue;
    if (k.startsWith('data-') || k === 'aria-hidden' || k === 'role' || k === 'focusable' || k === 'overflow' || k === 'pointer-events' || k === 'preserveAspectRatio' || k === 'shape-rendering') continue;
    st.unhandled.push(`@${k}`);
  }
  return out;
}

function svgNode(n, st, cur) {
  if (n.tag === '#text') return escapeXml(n.text);
  if (n.tag === 'defs') { for (const c of n.children) defineShared(c, st, cur); return ''; }
  if (n.tag === 'title' || n.tag === 'desc') return '';
  if (n.tag === 'filter' || n.tag === 'mask' || n.tag === 'clippath') { st.dropped += 1; return ''; }
  if (n.tag === 'lineargradient' || n.tag === 'radialgradient' || n.tag === 'marker') { defineShared(n, st, cur); return ''; }
  if (n.tag === 'svg') {
    // a nested icon <svg x y width height viewBox>: a translated, scaled group
    const x = px(n.attrs.x) ?? 0;
    const y = px(n.attrs.y) ?? 0;
    const w = px(n.attrs.width);
    const h = px(n.attrs.height);
    const vb = /^\s*(-?[\d.]+)[\s,]+(-?[\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*$/.exec(n.attrs.viewBox || '');
    let t = x || y ? `translate(${r1(x)} ${r1(y)})` : '';
    if (vb && w && h) t += `${t ? ' ' : ''}scale(${Math.round((w / parseFloat(vb[3])) * 1000) / 1000} ${Math.round((h / parseFloat(vb[4])) * 1000) / 1000})`;
    return `<g${t ? ` transform="${t}"` : ''}${svgAttrs(n.attrs, st, cur)}>${n.children.map((c) => svgNode(c, st, cur)).join('')}</g>`;
  }
  if (!SVG_ELEMENTS.has(n.tag)) { st.unhandled.push(`<${n.tag}>`); return ''; }
  const inner = n.children.map((c) => svgNode(c, st, cur)).join('');
  const a = svgAttrs(n.attrs, st, cur, n.tag);
  return inner || n.tag === 'text' || n.tag === 'tspan' || n.tag === 'g' ? `<${n.tag}${a}>${inner}</${n.tag}>` : `<${n.tag}${a}/>`;
}

/** Gradients and markers: deduplicated by content across the whole picture; the pack's own id maps to the shared one. */
function shareDef(tag, body, st, ownId) {
  const key = `${tag}|${body}`;
  let id = st.shared.defs.get(key);
  if (!id) {
    id = `${tag === 'marker' ? 'k' : 'g'}${st.shared.defs.size}`;
    st.shared.defs.set(key, id);
  }
  if (ownId) st.ids.set(ownId, id);
  return id;
}

const MARKER_NUM = ['markerWidth', 'markerHeight', 'refX', 'refY'];
function defineShared(n, st, cur) {
  if (n.tag === 'marker') {
    const a = n.attrs;
    let head = MARKER_NUM.filter((k) => a[k] !== undefined && SAFE_NUM.test(a[k])).map((k) => attr(k, a[k])).join('');
    if (a.orient && /^(auto|auto-start-reverse|-?[\d.]+)$/.test(a.orient)) head += attr('orient', a.orient);
    if (a.markerUnits && /^(strokeWidth|userSpaceOnUse)$/.test(a.markerUnits)) head += attr('markerUnits', a.markerUnits);
    const vb = a.viewBox || a.viewbox;
    if (vb && /^[-\d.\s,]+$/.test(vb)) head += attr('viewBox', vb);
    shareDef('marker', `${head}>${n.children.map((c) => svgNode(c, st, cur)).join('')}</marker>`, st, a.id);
    return;
  }
  if (n.tag !== 'lineargradient' && n.tag !== 'radialgradient') {
    if (n.tag === 'filter' || n.tag === 'clippath' || n.tag === 'mask') st.dropped += 1;
    else if (n.tag !== '#text') st.unhandled.push(`defs<${n.tag}>`);
    return;
  }
  const tag = n.tag === 'lineargradient' ? 'linearGradient' : 'radialGradient';
  const geo = ['x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'fx', 'fy'].filter((k) => n.attrs[k] !== undefined && SAFE_NUM.test(n.attrs[k])).map((k) => attr(k, n.attrs[k])).join('');
  const units = n.attrs.gradientUnits && ENUM.gradientUnits.test(n.attrs.gradientUnits) ? attr('gradientUnits', n.attrs.gradientUnits) : '';
  const stops = n.children.filter((c) => c.tag === 'stop').map((c) => `<stop${svgAttrs(c.attrs, st, cur, 'stop')}/>`).join('');
  shareDef(tag, `${geo}${units}>${stops}</${tag}>`, st, n.attrs.id);
}

const CSS_TO = { 'to top': 0, 'to right': 90, 'to bottom': 180, 'to left': 270, 'to bottom right': 135, 'to right bottom': 135, 'to top right': 45, 'to right top': 45, 'to bottom left': 225, 'to left bottom': 225, 'to top left': 315, 'to left top': 315 };

/** A CSS linear-gradient(angle | to side, colour [pos], ...) as a shared SVG linearGradient (objectBoundingBox); its id, or null. */
function cssLinearGradient(bg, st, cur) {
  const inner = bg.slice(bg.indexOf('(') + 1, bg.lastIndexOf(')'));
  const parts = inner.split(/,(?![^(]*\))/).map((t) => t.trim()).filter(Boolean);
  let deg = 180;
  const first = parts[0] || '';
  const am = /^(-?[\d.]+)deg$/.exec(first);
  if (am) { deg = parseFloat(am[1]); parts.shift(); } else if (CSS_TO[first] !== undefined) { deg = CSS_TO[first]; parts.shift(); }
  if (parts.length < 2) return null;
  const stops = [];
  for (let i = 0; i < parts.length; i += 1) {
    const m = /^(.*?)(?:\s+(-?[\d.]+)%)?$/.exec(parts[i]);
    const p = parsePaint(m[1], cur);
    if (!p) return null;
    const off = m[2] !== undefined ? parseFloat(m[2]) : (i / (parts.length - 1)) * 100;
    stops.push(p === 'none' ? `<stop offset="${r1(off)}%" stop-color="#ffffff" stop-opacity="0"/>` : `<stop offset="${r1(off)}%" stop-color="${p.hex}"${p.alpha < 0.999 ? ` stop-opacity="${Math.round(p.alpha * 1000) / 1000}"` : ''}/>`);
  }
  const rad = (deg * Math.PI) / 180;
  const dx = Math.sin(rad) / 2;
  const dy = -Math.cos(rad) / 2;
  const f = (v) => String(Math.round(v * 1000) / 1000);
  return shareDef('linearGradient', `${attr('x1', f(0.5 - dx))}${attr('y1', f(0.5 - dy))}${attr('x2', f(0.5 + dx))}${attr('y2', f(0.5 + dy))}>${stops.join('')}</linearGradient>`, st, null);
}

/** The shared definitions (gradients, markers) collected while drawing: one <defs> block for the whole picture. */
export function sharedDefsSvg(shared) {
  let out = '';
  for (const [key, id] of shared.defs) {
    const bar = key.indexOf('|');
    out += `<${key.slice(0, bar)} id="${id}"${key.slice(bar + 1)}`;
  }
  return out;
}

export const newShared = () => ({ defs: new Map() });

/** The `art` source renderShowSvg takes (lib/render/showSvg.js). */
export const PACK_ART = Object.freeze({ draw: packArt, newShared, defsSvg: sharedDefsSvg });
