// lib/mcp/ops.js
// Pure, atomic applier for agent edit operations (docs/architecture/investigations/mcp-and-embedding.md 4.1 "Op").
// No I/O, no React. Input content is never mutated: touched objects are replaced, so a failure leaves nothing behind.
//
// Trust: ops come from an LLM that may be steered by text inside diagrams. Everything is validated against closed
// schemas (unknown fields rejected), the stencil catalog, numeric bounds and the shared content limits
// (validateDiagramContent). Ids are generated here, never accepted for new objects.

import { findStencilMeta, PACK_CATALOG } from '../../components/diagram-studio/packs/catalog';
import { generateId } from '../../components/diagram-studio/utils/ids';
import { validateDiagramContent } from '../diagramContent';
import { FORBIDDEN_KEYS } from '../diagramLimits';
import { placeNewElements } from './placement';
import { assignFrameOnCreate, isFrame } from '../../components/diagram-studio/utils/frameMembership';
import { buildTableFromSpec, applyTablePatch, PATCH_KEYS, sizeForTable } from '../table/tablePatch';
import { isTableElement } from '../table/tableModel';
import { applyDocPatch, isDocElement, docOf } from '../doc/docElement';
import { applyPresentationPatch, PATCH_KEYS as PRESENTATION_PATCH_KEYS } from '../present/presentationPatch';
import { FRAME_ASPECTS } from '../present/presentationSchema';
import { cleanTextData, plainLabelOf, materializedFontSize, estimateTextHeight, isPresetText, TEXT_STENCIL, TEXT_PACK } from '../present/textPreset';
import { isSafeColor, MAX_RADIUS } from '../present/styleFields';
import { applyThemePatch } from '../present/themes';

export const MAX_OPS = 200;
export const MAX_STRUCTURE_OPS = 800; // internal ceiling for the batches that map_structure / layout_apply compile to
export const MAX_ERRORS = 20;
export const MAX_LABEL = 500;
const MAX_DATA_KEYS = 40;
const MAX_DATA_KEY = 64;
const MAX_DATA_STRING = 2000;
const COORD_LIMIT = 99000;
const MIN_SIZE = 10;
const MAX_SIZE = 5000;
const LINE_STYLES = ['straight', 'step', 'curved', 'arc', 'smart'];
const REF_RE = /^@[A-Za-z0-9_-]{1,40}$/;
const PORT_RE = /^[A-Za-z0-9_-]{1,40}$/;
const FORBIDDEN = new Set(FORBIDDEN_KEYS);
const DEFAULT_SIZE = { width: 120, height: 80 };

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const clip = (s, n = 80) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, n) : '');

class OpError extends Error {}
const fail = (message) => {
  throw new OpError(message);
};

const FIELDS = {
  add_element: ['op', 'ref', 'type', 'label', 'x', 'y', 'w', 'h', 'parent', 'data', 'table', 'doc', 'text', 'style', 'aspect', 'zIndex', 'origin'],
  update_element: ['op', 'id', 'label', 'x', 'y', 'w', 'h', 'parent', 'data', 'doc', 'aspect', 'text', 'style', 'zIndex'],
  remove_element: ['op', 'id'],
  connect: ['op', 'ref', 'from', 'to', 'label', 'style', 'connType', 'fromPort', 'toPort'],
  update_connection: ['op', 'id', 'label', 'style', 'connType'],
  remove_connection: ['op', 'id'],
  table_patch: ['op', 'id', ...PATCH_KEYS],
  // ADR-0007: create / edit a presentation (ordered slide-frame references plus notes)
  presentation_patch: ['op', ...PRESENTATION_PATCH_KEYS],
  // ADR-0007 P2: the board theme
  theme_set: ['op', 'preset', 'palette', 'fonts'],
  // internal only (deck compiler): prebuilt scaled copies of board content; never reachable from a tool call
  paste_clones: ['op', 'elements', 'connections'],
};
const INTERNAL_OPS = new Set(['paste_clones']);
const STYLE_FIELDS = { fill: 'backgroundColor', stroke: 'borderColor', textColor: 'textColor', radius: 'borderRadius', opacity: 'opacity' };
const MAX_ZINDEX = 10000;
const ALIASES = { add_connection: 'connect' };

function levenshtein(a, b) {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** Closest `pack/stencil` ids to a mistyped type (substring and edit distance on the stencil id and name). */
export function suggestStencils(type, limit = 5) {
  const q = String(type || '').toLowerCase();
  const tail = q.includes('/') ? q.slice(q.indexOf('/') + 1) : q;
  const scored = [];
  for (const pack of PACK_CATALOG) {
    for (const s of pack.stencils) {
      const id = s.id.toLowerCase();
      const name = String(s.name || '').toLowerCase();
      let score = Math.min(levenshtein(tail, id), levenshtein(tail, name));
      if (tail && (id.includes(tail) || tail.includes(id) || name.includes(tail))) score = Math.min(score, 1);
      if (q.includes('/') && q.startsWith(`${pack.id}/`)) score -= 0.5;
      scored.push([score, `${pack.id}/${s.id}`]);
    }
  }
  return scored.sort((a, b) => a[0] - b[0]).slice(0, limit).map((x) => x[1]);
}

function checkFields(op, name) {
  const allowed = FIELDS[name];
  for (const key of Object.keys(op)) {
    if (!allowed.includes(key)) fail(`Unknown field "${clip(key, 40)}" for ${name}; allowed: ${allowed.join(', ')}`);
  }
}

function checkLabel(v) {
  if (typeof v !== 'string') fail('label must be a string');
  if (v.length > MAX_LABEL) fail(`label is too long (${v.length}); the limit is ${MAX_LABEL} characters`);
  return v;
}

function checkCoord(name, v) {
  if (!finite(v) || Math.abs(v) > COORD_LIMIT) fail(`${name} must be a number between -${COORD_LIMIT} and ${COORD_LIMIT}`);
  return v;
}

function checkSize(name, v) {
  if (!finite(v) || v < MIN_SIZE || v > MAX_SIZE) fail(`${name} must be a number between ${MIN_SIZE} and ${MAX_SIZE}`);
  return v;
}

/** Primitive-valued object. `allowNull` (updates) lets null mean "delete this key". */
function checkData(data, allowNull) {
  if (!isObj(data)) fail('data must be an object');
  const keys = Object.keys(data);
  if (keys.length > MAX_DATA_KEYS) fail(`data has too many keys (${keys.length}); the limit is ${MAX_DATA_KEYS}`);
  for (const k of keys) {
    if (FORBIDDEN.has(k) || k.length === 0 || k.length > MAX_DATA_KEY) fail(`data key "${clip(k, 40)}" is not allowed`);
    const v = data[k];
    if (v === null && allowNull) continue;
    if (typeof v === 'string') {
      if (v.length > MAX_DATA_STRING) fail(`data value "${clip(k, 40)}" is too long; the limit is ${MAX_DATA_STRING} characters`);
    } else if (!(typeof v === 'boolean' || finite(v))) {
      fail(`data value "${clip(k, 40)}" must be a string, number or boolean`);
    }
  }
  return data;
}

function checkStyle(v) {
  if (!LINE_STYLES.includes(v)) fail(`style must be one of ${LINE_STYLES.join(', ')}`);
  return v;
}

/** op.style {fill?, stroke?, textColor?, radius?, opacity?} -> element fields (validated). */
function styleToFields(style) {
  if (!isObj(style)) fail('style must be an object {fill?, stroke?, textColor?, radius?, opacity?}');
  const out = {};
  for (const [k, v] of Object.entries(style)) {
    if (!has(STYLE_FIELDS, k)) fail(`Unknown style field "${clip(k, 40)}"; allowed: ${Object.keys(STYLE_FIELDS).join(', ')}`);
    if (k === 'radius') {
      if (!finite(v) || v < 0 || v > MAX_RADIUS) fail(`style.radius must be a number from 0 to ${MAX_RADIUS}`);
    } else if (k === 'opacity') {
      if (!finite(v) || v < 0 || v > 1) fail('style.opacity must be a number from 0 to 1');
    } else if (typeof v !== 'string' || !isSafeColor(v) || /^(var|rgb|hsl)/i.test(v)) {
      fail(`style.${k} must be a #hex colour, a colour name or a theme token such as @accent`);
    }
    out[STYLE_FIELDS[k]] = v;
  }
  return out;
}

function checkZIndex(v) {
  if (!Number.isInteger(v) || Math.abs(v) > MAX_ZINDEX) fail(`zIndex must be a whole number between -${MAX_ZINDEX} and ${MAX_ZINDEX}`);
  return v;
}

const stencilOf = (el) => findStencilMeta(el.type, el.packId)?.stencil || null;
const isContainerEl = (el) => el.type === 'frame' || el.isFrame === true || Boolean(stencilOf(el)?.isContainer);

/**
 * Locks are user intent (the editor refuses to move or edit them), so agents must not override them: an element is
 * locked when it says so or sits on a locked layer.
 */
export function isLockedElement(el, layers) {
  if (!isObj(el)) return false;
  if (el.locked === true) return true;
  const layer = Array.isArray(layers) && el.layerId !== undefined ? layers.find((l) => isObj(l) && l.id === el.layerId) : null;
  return Boolean(layer && layer.locked === true);
}

/**
 * @param {object} content stored diagram content (not mutated)
 * @param {unknown} ops
 * @param {{newId?: (prefix: string) => string, direction?: 'LR'|'TB'}} [opts]
 * @returns {{ok: true, content: object, created: Record<string,string>, elements: object[], connections: object[],
 *            counts: object, placed: object[], warnings: string[]}
 *         | {ok: false, code: 'INVALID_OPS', errors: {index: number, message: string}[]}}
 */
export function applyOps(content, ops, opts = {}) {
  const newId = opts.newId || generateId;
  const maxOps = opts.maxOps || MAX_OPS;
  const failure = (errors) => ({ ok: false, code: 'INVALID_OPS', errors });
  if (!Array.isArray(ops) || ops.length === 0) return failure([{ index: -1, message: 'ops must be a non-empty array' }]);
  if (ops.length > maxOps) return failure([{ index: -1, message: `Too many ops (${ops.length}); the limit is ${maxOps} per call` }]);

  const src = isObj(content) ? content : {};
  let elements = Array.isArray(src.elements) ? src.elements.slice() : [];
  let connections = Array.isArray(src.connections) ? src.connections.slice() : [];
  const refs = new Map(); // '@a' -> generated id (elements and connections share the namespace)
  const newElementIds = new Set();
  const createdElements = [];
  const createdConnections = [];
  const createdTables = [];
  const patchResults = [];
  let presentations = Array.isArray(src.presentations) ? src.presentations : undefined;
  const presentationResults = [];
  let theme = src.theme;
  let themeChanged = false;
  const opWarnings = [];
  const counts = { addedElements: 0, addedConnections: 0, updated: 0, removedElements: 0, removedConnections: 0 };
  const errors = [];

  const idx = new Map(); // element id -> index in `elements` (kept in sync; removals rebuild it)
  const reindex = () => {
    idx.clear();
    elements.forEach((e, i) => {
      if (isObj(e) && typeof e.id === 'string') idx.set(e.id, i);
    });
  };
  reindex();
  const getEl = (id) => (idx.has(id) ? elements[idx.get(id)] : null);
  const resolve = (value, what) => {
    if (typeof value !== 'string' || !value) fail(`${what} must be an id or an @ref`);
    if (value.startsWith('@')) {
      if (!refs.has(value)) fail(`Unknown reference ${clip(value, 42)} in ${what} (refs must be defined by an earlier op)`);
      return refs.get(value);
    }
    return value;
  };
  const defineRef = (op, id) => {
    if (op.ref === undefined) return;
    if (typeof op.ref !== 'string' || !REF_RE.test(op.ref)) fail('ref must look like @name (letters, digits, - or _, up to 40)');
    if (refs.has(op.ref)) fail(`Duplicate ref ${op.ref}`);
    refs.set(op.ref, id);
  };
  const checkParent = (parentValue, selfId) => {
    const pid = resolve(parentValue, 'parent');
    const parent = getEl(pid);
    if (!parent) fail(`parent "${clip(pid)}" does not exist`);
    if (!isContainerEl(parent)) fail(`parent "${clip(pid)}" is not a frame or container`);
    for (let cur = parent, hops = 0; cur && hops < 100; hops++) {
      if (cur.id === selfId) fail('parent would create a cycle');
      cur = cur.parentFrameId ? getEl(cur.parentFrameId) : null;
    }
    return pid;
  };
  // A row's link to a board element: an id or an @ref to an element made earlier in the batch; it must exist.
  const resolveElementId = (value, what) => {
    const id = resolve(value, what);
    if (!getEl(id)) fail(`${what}: "${clip(id)}" is not an element of this diagram`);
    return id;
  };
  const connIndex = (id) => connections.findIndex((c) => isObj(c) && c.id === id);

  const handlers = {
    add_element(op) {
      if (typeof op.type !== 'string' || !op.type) fail('type is required (pack/stencil, see stencil_catalog)');
      const found = op.type.includes('/') ? findStencilMeta(op.type) : null;
      if (!found) {
        const hint = suggestStencils(op.type).join(', ');
        fail(
          op.type.includes('/')
            ? `Unknown stencil "${clip(op.type)}". Closest: ${hint}`
            : `type must be "pack/stencil" (for example process-flow/task); "${clip(op.type)}" has no pack. Closest: ${hint}`
        );
      }
      const { packId, stencil } = found;
      const el = {
        id: newId('el'),
        type: stencil.id,
        packId,
        name: stencil.name,
        label: op.label !== undefined ? checkLabel(op.label) : stencil.defaultLabel ?? stencil.name,
        layerId: 'default',
        properties: op.data !== undefined ? { ...checkData(op.data, false) } : {},
      };
      if (stencil.color) el.color = stencil.color;
      // Doc cards (AI-5): `doc` carries {title, markdown}; the final validateDiagramContent pass sanitizes the markdown.
      if (op.doc !== undefined && !(packId === 'core' && stencil.id === 'doc')) fail('doc is only for core/doc elements');
      if (packId === 'core' && stencil.id === 'doc') {
        if (op.doc !== undefined && !isObj(op.doc)) fail('doc must be an object');
        const r = applyDocPatch({}, op.doc !== undefined ? { title: op.label, ...op.doc } : { title: op.label });
        if (!r.ok) fail(r.error);
        el.data = { doc: r.doc };
        el.label = r.doc.title;
      }
      const hasX = op.x !== undefined;
      const hasY = op.y !== undefined;
      if (hasX !== hasY) fail('give both x and y, or neither (the server places the element)');
      if (hasX) {
        el.x = checkCoord('x', op.x);
        el.y = checkCoord('y', op.y);
      }
      const def = stencil.defaultSize || DEFAULT_SIZE;
      el.size = {
        width: op.w !== undefined ? checkSize('w', op.w) : def.width,
        height: op.h !== undefined ? checkSize('h', op.h) : def.height,
      };
      const isTable = packId === 'core' && stencil.id === 'table';
      if (isTable) {
        if (op.table === undefined) fail('core/table needs a `table`: {columns: [...], rows: [...]}');
        const built = buildTableFromSpec(op.table, { newId, resolveElementId });
        if (!built.ok) fail(built.errors.join('; '));
        el.data = { table: built.table };
        el.size = sizeForTable(built.table); // width and height follow the content
        if (op.label === undefined) el.label = '';
        createdTables.push({ id: el.id, ...(op.ref ? { ref: op.ref } : {}), columnIds: built.columnIds, rowIds: built.rowIds });
      } else if (op.table !== undefined) fail('`table` is only for type core/table');
      if (op.parent !== undefined) el.parentFrameId = checkParent(op.parent, el.id);
      // Text presets (ADR-0007 D5): data.text, materialized font size, label mirrors the plain text.
      if (op.text !== undefined) {
        if (!(packId === TEXT_PACK && stencil.id === TEXT_STENCIL)) fail('text is only for core/text-block elements');
        const t = cleanTextData(op.text, 'text');
        if (!t.ok) fail(t.error);
        const parentEl = el.parentFrameId ? getEl(el.parentFrameId) : null;
        const frameH = finite(parentEl?.size?.height) ? parentEl.size.height : 1080;
        el.data = { text: t.text };
        el.fontSize = materializedFontSize(t.text.preset, frameH);
        el.label = plainLabelOf(t.text.markdown);
        el.size = {
          width: op.w !== undefined ? el.size.width : 800,
          height: op.h !== undefined ? el.size.height : estimateTextHeight(t.text.markdown, t.text.preset, op.w !== undefined ? el.size.width : 800, el.fontSize),
        };
      }
      if (op.aspect !== undefined) {
        if (!(packId === 'core' && stencil.id === 'frame')) fail('aspect only applies to frames');
        if (!FRAME_ASPECTS.includes(op.aspect)) fail(`aspect must be one of ${FRAME_ASPECTS.join(', ')}`);
        el.data = { ...(isObj(el.data) ? el.data : {}), aspect: op.aspect };
      }
      if (op.style !== undefined) {
        const f = styleToFields(op.style);
        if (packId === 'core' && stencil.id === 'frame' && f.backgroundColor !== undefined) {
          el.data = { ...(isObj(el.data) ? el.data : {}), backgroundColor: f.backgroundColor };
          delete f.backgroundColor;
        }
        Object.assign(el, f);
      }
      if (op.zIndex !== undefined) el.zIndex = checkZIndex(op.zIndex);
      if (op.origin !== undefined) {
        if (!opts.internal) fail('Unknown field "origin" for add_element');
        el.origin = op.origin;
      }
      // Membership is explicit (components/diagram-studio/utils/frameMembership.js): a frame is flagged so legacy
      // derivation never adopts shapes into it later, and a shape given x/y inside an existing frame without `parent`
      // joins that frame, like a shape created there in the editor (assignFrameOnCreate). An explicit `parent` wins.
      const created = isFrame(el) ? { ...el, membershipExplicit: true } : op.parent === undefined ? assignFrameOnCreate(el, elements) : el;
      Object.assign(el, created);
      defineRef(op, el.id);
      elements.push(el);
      idx.set(el.id, elements.length - 1);
      newElementIds.add(el.id);
      createdElements.push({ id: el.id, ...(op.ref ? { ref: op.ref } : {}), type: `${packId}/${stencil.id}` });
      counts.addedElements += 1;
    },

    update_element(op) {
      const id = resolve(op.id, 'id');
      const current = getEl(id);
      if (!current) fail(`Element "${clip(id)}" does not exist`);
      if (isLockedElement(current, src.layers)) fail(`Element "${clip(id)}" is locked (or on a locked layer); the owner must unlock it before an agent can change it`);
      const keys = Object.keys(op).filter((k) => k !== 'op' && k !== 'id');
      if (keys.length === 0) fail('update_element needs at least one field to change');
      const next = { ...current };
      if (op.label !== undefined) next.label = checkLabel(op.label);
      if (op.x !== undefined) next.x = checkCoord('x', op.x);
      if (op.y !== undefined) next.y = checkCoord('y', op.y);
      if (op.w !== undefined || op.h !== undefined) {
        const s = current.size || DEFAULT_SIZE;
        next.size = {
          ...s,
          width: op.w !== undefined ? checkSize('w', op.w) : s.width ?? DEFAULT_SIZE.width,
          height: op.h !== undefined ? checkSize('h', op.h) : s.height ?? DEFAULT_SIZE.height,
        };
      }
      if (op.aspect !== undefined) {
        // ADR-0007: a frame's slide shape (data.aspect). Only frames have one.
        if (!isFrame(current)) fail(`Element "${clip(id)}" is not a frame; aspect only applies to frames`);
        if (!FRAME_ASPECTS.includes(op.aspect)) fail(`aspect must be one of ${FRAME_ASPECTS.join(', ')}`);
        next.data = { ...(isObj(current.data) ? current.data : {}), aspect: op.aspect };
      }
      if (op.text !== undefined) {
        if (!isPresetText(current)) fail(`Element "${clip(id)}" is not a preset text; text only applies to core/text-block elements made with a text preset`);
        if (!isObj(op.text)) fail('text must be an object');
        const merged = { ...current.data.text, ...op.text };
        const t = cleanTextData(merged, 'text');
        if (!t.ok) fail(t.error);
        const parentEl = current.parentFrameId ? getEl(current.parentFrameId) : null;
        const frameH = finite(parentEl?.size?.height) ? parentEl.size.height : 1080;
        next.data = { ...current.data, text: t.text };
        next.label = plainLabelOf(t.text.markdown);
        if (op.text.preset !== undefined && op.text.preset !== current.data.text.preset) next.fontSize = materializedFontSize(t.text.preset, frameH);
      }
      if (op.style !== undefined) {
        const f = styleToFields(op.style);
        if (isFrame(current) && f.backgroundColor !== undefined) {
          next.data = { ...(isObj(next.data) ? next.data : {}), backgroundColor: f.backgroundColor };
          delete f.backgroundColor;
        }
        Object.assign(next, f);
      }
      if (op.zIndex !== undefined) next.zIndex = checkZIndex(op.zIndex);
      if (op.parent !== undefined) {
        if (op.parent === null) delete next.parentFrameId;
        else next.parentFrameId = checkParent(op.parent, id);
      }
      if (op.doc !== undefined) {
        if (!isDocElement(current)) fail(`Element "${clip(id)}" is not a doc; doc only applies to core/doc elements`);
        const r = applyDocPatch(docOf(current) || {}, op.doc);
        if (!r.ok) fail(r.error);
        next.data = { ...(isObj(current.data) ? current.data : {}), doc: r.doc };
        next.label = r.doc.title;
      }
      if (op.doc === undefined && op.label !== undefined && isDocElement(current) && docOf(current)) {
        next.data = { ...(isObj(current.data) ? current.data : {}), doc: { ...docOf(current), title: next.label } };
      }
      if (op.data !== undefined) {
        const merged = { ...(isObj(current.properties) ? current.properties : {}) };
        for (const [k, v] of Object.entries(checkData(op.data, true))) {
          if (v === null) delete merged[k];
          else merged[k] = v;
        }
        next.properties = merged;
      }
      elements[idx.get(id)] = next;
      counts.updated += 1;
    },

    table_patch(op) {
      const id = resolve(op.id, 'id');
      const current = getEl(id);
      if (!current) fail(`Element "${clip(id)}" does not exist`);
      if (!isTableElement(current) || !current.data?.table) fail(`Element "${clip(id)}" is not a table`);
      if (isLockedElement(current, src.layers)) fail(`Element "${clip(id)}" is locked (or on a locked layer); the owner must unlock it before an agent can change it`);
      const { op: _op, id: _id, ...patch } = op;
      const res = applyTablePatch(current.data.table, patch, { newId, resolveElementId });
      if (!res.ok) fail(res.errors.join('; '));
      elements[idx.get(id)] = { ...current, data: { ...current.data, table: res.table }, size: { ...(current.size || {}), ...sizeForTable(res.table) } };
      patchResults.push({ id, inserted: res.inserted, updated: res.updated, removed: res.removed, columnIds: res.columnIds, rowIds: res.rowIds });
      for (const w of res.warnings) opWarnings.push(w);
      counts.updated += 1;
    },

    presentation_patch(op) {
      const { op: _op, ...patch } = op;
      const res = applyPresentationPatch(presentations, elements, patch, { newId });
      if (!res.ok) fail(res.errors.join('; '));
      presentations = res.presentations;
      presentationResults.push({ presentationId: res.presentationId, slideIds: res.slideIds, removed: res.removed });
      counts.updated += 1;
    },

    theme_set(op) {
      const { op: _op, ...patch } = op;
      const res = applyThemePatch(theme, patch);
      if (!res.ok) fail(res.error);
      theme = res.theme;
      themeChanged = true;
      for (const w of res.warnings) opWarnings.push(w);
      counts.updated += 1;
    },

    paste_clones(op) {
      if (!Array.isArray(op.elements) || !op.elements.every(isObj)) fail('paste_clones needs elements');
      for (const e of op.elements) {
        if (typeof e.id !== 'string' || getEl(e.id)) fail(`paste_clones: id "${clip(e.id)}" is missing or already used`);
        elements.push(e);
        idx.set(e.id, elements.length - 1);
        newElementIds.add(e.id);
        createdElements.push({ id: e.id, type: `${e.packId || 'core'}/${e.type}` });
        counts.addedElements += 1;
      }
      for (const c of Array.isArray(op.connections) ? op.connections : []) {
        if (isObj(c)) { connections.push(c); counts.addedConnections += 1; }
      }
    },

    remove_element(op) {
      const id = resolve(op.id, 'id');
      if (!getEl(id)) fail(`Element "${clip(id)}" does not exist`);
      if (isLockedElement(getEl(id), src.layers)) fail(`Element "${clip(id)}" is locked (or on a locked layer); the owner must unlock it before an agent can remove it`);
      elements = elements.filter((e) => !(isObj(e) && e.id === id));
      elements = elements.map((e) => {
        if (isObj(e) && e.parentFrameId === id) {
          const { parentFrameId, ...rest } = e;  
          return rest;
        }
        return e;
      });
      const before = connections.length;
      connections = connections.filter((c) => !(isObj(c) && (c.sourceId === id || c.targetId === id)));
      counts.removedConnections += before - connections.length;
      counts.removedElements += 1;
      newElementIds.delete(id);
      reindex();
    },

    connect(op) {
      const from = resolve(op.from, 'from');
      const to = resolve(op.to, 'to');
      if (!getEl(from)) fail(`from "${clip(from)}" is not an element of this diagram`);
      if (!getEl(to)) fail(`to "${clip(to)}" is not an element of this diagram`);
      if (from === to) fail('from and to must be different elements');
      const conn = { id: newId('conn'), sourceId: from, targetId: to };
      if (op.label !== undefined) conn.label = checkLabel(op.label);
      conn.lineStyle = op.style !== undefined ? checkStyle(op.style) : 'step';
      if (op.connType !== undefined) {
        if (typeof op.connType !== 'string' || !PORT_RE.test(op.connType)) fail('connType must be a connection type id from stencil_catalog');
        conn.connectionType = op.connType;
      }
      for (const [field, key] of [['fromPort', 'sourcePort'], ['toPort', 'targetPort']]) {
        if (op[field] === undefined) continue;
        if (typeof op[field] !== 'string' || !PORT_RE.test(op[field])) fail(`${field} must be a port id`);
        conn[key] = op[field];
      }
      if (op.fromPort === undefined && op.toPort === undefined) conn.autoPorts = true;
      conn.targetMarker = 'arrow';
      conn.sourceMarker = 'none';
      conn.createdAt = new Date().toISOString();
      defineRef(op, conn.id);
      connections.push(conn);
      createdConnections.push({ id: conn.id, ...(op.ref ? { ref: op.ref } : {}) });
      counts.addedConnections += 1;
    },

    update_connection(op) {
      const id = resolve(op.id, 'id');
      const i = connIndex(id);
      if (i < 0) fail(`Connection "${clip(id)}" does not exist`);
      const keys = Object.keys(op).filter((k) => k !== 'op' && k !== 'id');
      if (keys.length === 0) fail('update_connection needs at least one field to change');
      const next = { ...connections[i] };
      if (op.label !== undefined) next.label = checkLabel(op.label);
      if (op.style !== undefined) next.lineStyle = checkStyle(op.style);
      if (op.connType !== undefined) {
        if (typeof op.connType !== 'string' || !PORT_RE.test(op.connType)) fail('connType must be a connection type id from stencil_catalog');
        next.connectionType = op.connType;
      }
      connections[i] = next;
      counts.updated += 1;
    },

    remove_connection(op) {
      const id = resolve(op.id, 'id');
      const i = connIndex(id);
      if (i < 0) fail(`Connection "${clip(id)}" does not exist`);
      connections.splice(i, 1);
      counts.removedConnections += 1;
    },
  };

  ops.forEach((raw, index) => {
    if (errors.length >= MAX_ERRORS) return;
    try {
      if (!isObj(raw) || typeof raw.op !== 'string') fail('Each op must be an object with an "op" name');
      const name = has(ALIASES, raw.op) ? ALIASES[raw.op] : raw.op;
      if (!has(handlers, name) || (INTERNAL_OPS.has(name) && !opts.internal)) fail(`Unknown op "${clip(raw.op, 40)}"; use ${Object.keys(handlers).filter((h) => !INTERNAL_OPS.has(h)).join(', ')}`);
      checkFields(raw, name);
      handlers[name](raw);
    } catch (e) {
      if (!(e instanceof OpError)) throw e;
      errors.push({ index, message: e.message });
    }
  });
  if (errors.length) return failure(errors);

  const placedBefore = new Map(elements.map((e) => [e.id, e]));
  let finalElements = elements;
  if (newElementIds.size) {
    finalElements = placeNewElements({
      elements,
      connections,
      newIds: [...newElementIds],
      direction: opts.direction === 'TB' ? 'TB' : 'LR',
    });
  }
  const placed = [];
  for (const e of finalElements) {
    if (newElementIds.has(e.id) && !(finite(placedBefore.get(e.id)?.x) && finite(placedBefore.get(e.id)?.y))) {
      placed.push({ id: e.id, x: e.x, y: e.y });
    }
  }

  const check = validateDiagramContent({ ...src, elements: finalElements, connections, ...(presentationResults.length ? { presentations } : {}), ...(themeChanged ? { theme } : {}) });
  if (!check.ok) return failure([{ index: -1, message: check.error }]);

  return {
    ok: true,
    content: check.content,
    created: Object.fromEntries(refs),
    elements: createdElements,
    connections: createdConnections,
    counts,
    placed,
    tables: createdTables,
    tablePatches: patchResults,
    presentationPatches: presentationResults,
    theme: check.content.theme,
    warnings: [...check.warnings, ...opWarnings],
  };
}
