// lib/mcp/projections.js
// Pure read-only projections of stored diagram content for LLM consumption (no I/O, no React).
//   toCompact  token-efficient JSON with stable ids (docs/architecture/investigations/mcp-and-embedding.md 4.3)
//   toMermaid  lossy `flowchart` text projection
//   toOutline  lossy indented list for very large diagrams
//
// All user-authored strings (labels, names, data values) are DATA. They are bounded here, and in the text
// projections flattened so that a label cannot fake structure (an extra node, directive or outline line).

import { findStencilMeta } from '../../components/diagram-studio/packs/catalog';

export const MAX_LABEL_LENGTH = 200;
export const DEFAULT_MAX_ELEMENTS = 1000;
const MAX_DATA_STRING = 500;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const list = (v) => (Array.isArray(v) ? v : []);
const CONTROL_RE = new RegExp("[\\u0000-\\u001f\\u007f-\\u009f\\u2028\\u2029]", "g");
/** Coerce anything to a bounded single-purpose string (strings and numbers only). */
export function sanitizeText(value, max = 2000) {
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).slice(0, max);
  if (typeof value !== 'string') return '';
  return value.length > max ? value.slice(0, max) : value;
}

/** Flatten to one line: control characters and line separators become single spaces. */
function oneLine(value, max = MAX_LABEL_LENGTH) {
  const s = sanitizeText(value, max * 4).replace(CONTROL_RE, ' ').replace(/ {2,}/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

const MERMAID_ENTITIES = {
  '#': '#35;',
  '"': '#34;',
  '&': '#38;',
  '<': '#60;',
  '>': '#62;',
  '`': '#96;',
  '|': '#124;',
  '\\': '#92;',
  '%': '#37;', // `%%{...}%%` directives are recognized anywhere in the text
  '{': '#123;',
  '}': '#125;',
};

/** Make a user string safe inside a double-quoted Mermaid label. */
export function escapeMermaidLabel(value) {
  return oneLine(value).replace(/[#"&<>`|\\%{}]/g, (ch) => MERMAID_ENTITIES[ch]);
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function boundedData(data) {
  if (!isObj(data)) return undefined;
  const out = {};
  let n = 0;
  for (const [k, v] of Object.entries(data)) {
    if (n >= 40) break;
    if (typeof v === 'string') out[k] = v.length > MAX_DATA_STRING ? `${v.slice(0, MAX_DATA_STRING)}…` : v;
    else if (typeof v === 'number' || typeof v === 'boolean') out[k] = v;
    else if (v === null || v === undefined) continue;
    else out[k] = JSON.stringify(v).slice(0, MAX_DATA_STRING); // nested values: bounded JSON text
    n += 1;
  }
  return Object.keys(out).length ? out : undefined;
}

function typeOf(el) {
  const type = sanitizeText(el.type, 100);
  const packId = sanitizeText(el.packId, 100);
  if (!type) return '';
  return packId && !type.includes('/') ? `${packId}/${type}` : type;
}

/** Normalize raw elements: plain objects with a string id. */
function cleanElements(content) {
  const raw = isObj(content) ? list(content.elements) : [];
  return raw.filter((e) => isObj(e) && typeof e.id === 'string' && e.id);
}

function cleanConnections(content, ids) {
  const raw = isObj(content) ? list(content.connections) : [];
  return raw.filter(
    (c) => isObj(c) && typeof c.id === 'string' && ids.has(c.sourceId) && ids.has(c.targetId)
  );
}

function labelOf(el) {
  return sanitizeText(el.label ?? el.text ?? '', MAX_LABEL_LENGTH * 2);
}

function selectSubset(elements, { elementIds, frameId }) {
  if (Array.isArray(elementIds) && elementIds.length) {
    const wanted = new Set(elementIds);
    return elements.filter((e) => wanted.has(e.id));
  }
  if (typeof frameId === 'string' && frameId) {
    const inFrame = new Set([frameId]);
    // transitive membership (nested frames), cycle-safe because each id is added once
    let grew = true;
    while (grew) {
      grew = false;
      for (const e of elements) {
        if (!inFrame.has(e.id) && inFrame.has(e.parentFrameId)) {
          inFrame.add(e.id);
          grew = true;
        }
      }
    }
    return elements.filter((e) => inFrame.has(e.id));
  }
  return elements;
}

/**
 * @param {{id: string, name: string, type: string, revision: string|number}} meta
 * @param {unknown} content stored diagram content
 * @param {{detail?: 'full'|'structure', elementIds?: string[], frameId?: string, maxElements?: number}} [opts]
 */
export function toCompact(meta, content, opts = {}) {
  const { detail = 'full', maxElements = DEFAULT_MAX_ELEMENTS } = opts;
  const all = selectSubset(cleanElements(content), opts);
  const kept = all.slice(0, Math.max(0, maxElements));
  const ids = new Set(kept.map((e) => e.id));
  const packs = new Set();

  const elements = kept.map((el) => {
    const out = { id: el.id, t: typeOf(el), label: oneLine(labelOf(el), MAX_LABEL_LENGTH * 2) };
    const found = findStencilMeta(out.t, el.packId);
    if (found) packs.add(found.packId);
    else if (typeof el.packId === 'string' && el.packId) packs.add(el.packId);
    if (detail !== 'structure') {
      const x = num(el.x);
      const y = num(el.y);
      if (x !== null) out.x = Math.round(x);
      if (y !== null) out.y = Math.round(y);
      const w = num(el.size?.width ?? el.width);
      const h = num(el.size?.height ?? el.height);
      const def = found?.stencil?.defaultSize;
      if (w !== null && h !== null && !(def && def.width === w && def.height === h)) {
        out.w = Math.round(w);
        out.h = Math.round(h);
      }
    }
    if (typeof el.parentFrameId === 'string' && el.parentFrameId) out.frame = el.parentFrameId;
    const data = boundedData(el.data);
    if (data) out.data = data;
    return out;
  });

  const connections = cleanConnections(content, ids).map((c) => {
    const out = { id: c.id, from: c.sourceId, to: c.targetId };
    const label = oneLine(c.label ?? '', MAX_LABEL_LENGTH * 2);
    if (label) out.label = label;
    if (typeof c.lineStyle === 'string') out.style = sanitizeText(c.lineStyle, 40);
    const connType = c.connectionType ?? c.type;
    if (typeof connType === 'string') out.connType = sanitizeText(connType, 80);
    return out;
  });

  const result = {
    id: meta.id,
    name: oneLine(meta.name, 255),
    type: sanitizeText(meta.type, 100),
    revision: Number(meta.revision) || 0,
    packs: [...packs].sort(),
    elements,
    connections,
  };
  if (all.length > kept.length) result.truncated = { elements: all.length - kept.length };
  return result;
}

// ---------- shared structure for the text projections ----------

function buildTree(elements) {
  const byId = new Map(elements.map((e) => [e.id, e]));
  const children = new Map(); // parentId|null -> [element]
  for (const e of elements) {
    let parent = typeof e.parentFrameId === 'string' && byId.has(e.parentFrameId) ? e.parentFrameId : null;
    if (parent === e.id) parent = null;
    // break cycles: walk up; if we meet ourselves, hang this element at the root
    const seen = new Set([e.id]);
    let cur = parent;
    while (cur) {
      if (seen.has(cur)) {
        parent = null;
        break;
      }
      seen.add(cur);
      const p = byId.get(cur);
      cur = p && typeof p.parentFrameId === 'string' && byId.has(p.parentFrameId) ? p.parentFrameId : null;
    }
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(e);
  }
  return children;
}

function isFrameLike(el) {
  const found = findStencilMeta(typeOf(el), el.packId);
  return Boolean(found?.stencil?.isFrame) || (found?.stencil?.shape === 'frame');
}

function mermaidNode(alias, label, shape) {
  const l = `"${label}"`;
  switch (shape) {
    case 'circle':
      return `${alias}((${l}))`;
    case 'ellipse':
      return `${alias}([${l}])`;
    case 'diamond':
      return `${alias}{${l}}`;
    default:
      return `${alias}[${l}]`;
  }
}

/** Lossy Mermaid `flowchart` projection. Aliases are generated (n1, s1…); user ids and text never become syntax. */
export function toMermaid(meta, content, opts = {}) {
  const { maxElements = DEFAULT_MAX_ELEMENTS } = opts;
  const elements = cleanElements(content).slice(0, maxElements);
  const ids = new Set(elements.map((e) => e.id));
  const alias = new Map();
  elements.forEach((e, i) => alias.set(e.id, isFrameLike(e) ? `s${i + 1}` : `n${i + 1}`));
  const children = buildTree(elements);
  const lines = ['flowchart LR'];

  const emit = (parent, depth) => {
    const pad = '  '.repeat(depth + 1);
    for (const el of children.get(parent) || []) {
      const label = escapeMermaidLabel(labelOf(el));
      if (isFrameLike(el)) {
        lines.push(`${pad}subgraph ${alias.get(el.id)} ["${label}"]`);
        emit(el.id, depth + 1);
        lines.push(`${pad}end`);
      } else {
        const shape = findStencilMeta(typeOf(el), el.packId)?.stencil?.shape;
        lines.push(`${pad}${mermaidNode(alias.get(el.id), label, shape)}`);
      }
    }
  };
  emit(null, 0);

  for (const c of cleanConnections(content, ids)) {
    const from = alias.get(c.sourceId);
    const to = alias.get(c.targetId);
    if (from.startsWith('s') || to.startsWith('s')) continue; // subgraph endpoints are not portable across renderers
    const label = escapeMermaidLabel(c.label ?? '');
    lines.push(`  ${from} -->${label ? `|"${label}"|` : ''} ${to}`);
  }
  return lines.join('\n');
}

/** Lossy indented outline: one line per element, `→` lines for outgoing connections. */
export function toOutline(meta, content, opts = {}) {
  const { maxElements = DEFAULT_MAX_ELEMENTS } = opts;
  const elements = cleanElements(content).slice(0, maxElements);
  const ids = new Set(elements.map((e) => e.id));
  const byId = new Map(elements.map((e) => [e.id, e]));
  const children = buildTree(elements);
  const out = [`${oneLine(meta.name, 255)} (${sanitizeText(meta.type, 100)}, revision ${Number(meta.revision) || 0})`];
  const conns = cleanConnections(content, ids);
  const outgoing = new Map();
  for (const c of conns) {
    if (!outgoing.has(c.sourceId)) outgoing.set(c.sourceId, []);
    outgoing.get(c.sourceId).push(c);
  }

  const emit = (parent, depth) => {
    for (const el of children.get(parent) || []) {
      const pad = '  '.repeat(depth);
      const kind = typeOf(el);
      const edges = (outgoing.get(el.id) || [])
        .map((c) => {
          const label = oneLine(c.label ?? '');
          return `→ ${oneLine(labelOf(byId.get(c.targetId))) || kind} ${label ? `(${label})` : ''}`.trimEnd();
        })
        .join(', ');
      out.push(`${pad}- ${oneLine(labelOf(el)) || '(no label)'} [${kind}]${edges ? ` ${edges}` : ''}`);
      emit(el.id, depth + 1);
    }
  };
  emit(null, 0);
  return out.join('\n');
}
