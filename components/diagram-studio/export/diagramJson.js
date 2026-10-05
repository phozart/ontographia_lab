// components/diagram-studio/export/diagramJson.js
// Pure helpers for the JSON export envelope and JSON import (validation, sanitizing, re-id/offset).
// No DOM or React dependencies so everything here is unit-testable.

export const FORMAT_ID = 'ontographia-diagram';
export const FORMAT_VERSION = 1;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_ELEMENTS = 5000;
export const MAX_CONNECTIONS = 10000;
export const MAX_COLLECTION = 1000; // layers / groups
const MAX_DEPTH = 24;
const MAX_STRING = 200000;
const DEFAULT_SIZE = { width: 120, height: 60 };

// Must match diagramRepository.createDiagram's valid types
export const VALID_DIAGRAM_TYPES = [
  'bpmn', 'mindmap', 'uml-class', 'erd', 'cld', 'togaf',
  'itil', 'capability-map', 'process-flow', 'product-design', 'sticky-notes',
  'infinite-canvas',
];
export const FALLBACK_DIAGRAM_TYPE = 'infinite-canvas';

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const CONTENT_KEYS = ['elements', 'connections', 'layers', 'groups', 'viewport'];

// ============ EXPORT ============

/**
 * Build the versioned JSON envelope for a diagram.
 */
export function buildExportEnvelope(diagram = {}, now = new Date()) {
  const content = {
    elements: diagram.elements || [],
    connections: diagram.connections || [],
    layers: diagram.layers || [],
    groups: diagram.groups || [],
  };
  if (diagram.viewport) content.viewport = diagram.viewport;
  return {
    format: FORMAT_ID,
    version: FORMAT_VERSION,
    exportedAt: now.toISOString(),
    diagram: {
      name: diagram.name || 'Untitled Diagram',
      type: diagram.type || FALLBACK_DIAGRAM_TYPE,
      content,
    },
  };
}

/**
 * Make a string safe to use as a download file name (without extension).
 */
export function sanitizeFilename(name, fallback = 'diagram') {
  if (typeof name !== 'string') return fallback;
  let out = name.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-');
  out = out.replace(/-{2,}/g, '-').replace(/^[\s.-]+|[\s.-]+$/g, '');
  if (out.length > 120) out = out.slice(0, 120).replace(/[\s.-]+$/g, '');
  return out || fallback;
}

// ============ IMPORT: validation ============

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isFiniteNumber = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * Deep-copy JSON data dropping prototype-pollution keys, overlong strings and runaway nesting.
 */
export function deepSanitize(value, depth = 0) {
  if (depth > MAX_DEPTH) return undefined;
  if (typeof value === 'string') return value.length > MAX_STRING ? value.slice(0, MAX_STRING) : value;
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ELEMENTS * 2).map(v => deepSanitize(v, depth + 1));
  }
  if (isPlainObject(value)) {
    const out = {};
    for (const key of Object.keys(value)) {
      if (FORBIDDEN_KEYS.has(key)) continue;
      const v = deepSanitize(value[key], depth + 1);
      if (v !== undefined) out[key] = v;
    }
    return out;
  }
  return undefined;
}

function byteLength(text) {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length;
  return text.length;
}

function fail(error) {
  return { ok: false, error };
}

function sanitizeElements(rawElements, warnings) {
  const seen = new Set();
  const out = [];
  let dropped = 0;
  for (const raw of rawElements) {
    if (!isPlainObject(raw)) { dropped++; continue; }
    const idOk = typeof raw.id === 'string' && raw.id.length > 0 && raw.id.length <= 200;
    if (!idOk || seen.has(raw.id) || !isFiniteNumber(raw.x) || !isFiniteNumber(raw.y)) { dropped++; continue; }
    if (raw.size !== undefined) {
      const s = raw.size;
      if (!isPlainObject(s) || !isFiniteNumber(s.width) || !isFiniteNumber(s.height) || s.width <= 0 || s.height <= 0) {
        dropped++;
        continue;
      }
    }
    seen.add(raw.id);
    out.push(deepSanitize(raw));
  }
  if (dropped > 0) warnings.push(`${dropped} invalid element${dropped === 1 ? '' : 's'} skipped.`);
  return out;
}

function sanitizeConnections(rawConnections, elementIds, warnings) {
  const seen = new Set();
  const out = [];
  let dropped = 0;
  for (const raw of rawConnections) {
    if (!isPlainObject(raw)) { dropped++; continue; }
    const hasSource = raw.sourceId !== undefined && raw.sourceId !== null;
    const hasTarget = raw.targetId !== undefined && raw.targetId !== null;
    const sourceOk = hasSource ? elementIds.has(raw.sourceId) : isPlainObject(raw.sourcePos);
    const targetOk = hasTarget ? elementIds.has(raw.targetId) : isPlainObject(raw.targetPos);
    if (!sourceOk || !targetOk) { dropped++; continue; }
    if (typeof raw.id === 'string' && seen.has(raw.id)) { dropped++; continue; }
    if (typeof raw.id === 'string') seen.add(raw.id);
    out.push(deepSanitize(raw));
  }
  if (dropped > 0) warnings.push(`${dropped} invalid connection${dropped === 1 ? '' : 's'} skipped.`);
  return out;
}

function sanitizeViewport(v) {
  if (!isPlainObject(v)) return undefined;
  const out = {};
  for (const k of ['x', 'y', 'scale', 'zoom']) {
    if (isFiniteNumber(v[k])) out[k] = v[k];
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Validate + sanitize a saved-content-shaped object. Returns { ok, content, warnings } or { ok:false, error }.
 */
export function sanitizeContent(rawContent) {
  if (!isPlainObject(rawContent)) return fail('The file does not contain a diagram.');
  if (!Array.isArray(rawContent.elements)) return fail('The file does not contain an "elements" list.');
  if (rawContent.elements.length > MAX_ELEMENTS) {
    return fail(`Too many elements (${rawContent.elements.length}). The limit is ${MAX_ELEMENTS}.`);
  }
  const rawConnections = rawContent.connections === undefined ? [] : rawContent.connections;
  if (!Array.isArray(rawConnections)) return fail('"connections" must be a list.');
  if (rawConnections.length > MAX_CONNECTIONS) {
    return fail(`Too many connections (${rawConnections.length}). The limit is ${MAX_CONNECTIONS}.`);
  }
  const warnings = [];
  const elements = sanitizeElements(rawContent.elements, warnings);
  const elementIds = new Set(elements.map(e => e.id));
  const connections = sanitizeConnections(rawConnections, elementIds, warnings);

  const asList = (v) => (Array.isArray(v) ? v.filter(isPlainObject).slice(0, MAX_COLLECTION).map(x => deepSanitize(x)) : []);
  const content = {
    elements,
    connections,
    layers: asList(rawContent.layers),
    groups: asList(rawContent.groups),
  };
  const viewport = sanitizeViewport(rawContent.viewport);
  if (viewport) content.viewport = viewport;
  // Everything else at the top level is intentionally dropped.
  for (const key of Object.keys(content)) if (!CONTENT_KEYS.includes(key)) delete content[key];
  return { ok: true, content, warnings };
}

/**
 * Parse and validate import file text. Accepts:
 *  - the versioned envelope ({ format: 'ontographia-diagram', version, diagram: { name, type, content } })
 *  - the legacy ExportManager 1.0 shape ({ version: '1.0', diagram: { elements, connections, ... } })
 *  - the raw saved content shape ({ elements, connections, ... })
 */
export function parseImportText(text) {
  if (typeof text !== 'string') return fail('The file could not be read.');
  if (byteLength(text) > MAX_IMPORT_BYTES) {
    return fail(`The file is too large. The limit is ${Math.round(MAX_IMPORT_BYTES / 1024 / 1024)} MB.`);
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return fail('The file is not valid JSON.');
  }
  if (!isPlainObject(data)) return fail('The file does not contain a diagram.');

  let name;
  let type;
  let rawContent;

  if (data.format === FORMAT_ID) {
    if (!isFiniteNumber(data.version) || data.version > FORMAT_VERSION || data.version < 1) {
      return fail(`Unsupported file version (${String(data.version)}). This app reads version ${FORMAT_VERSION}.`);
    }
    if (!isPlainObject(data.diagram)) return fail('The file does not contain a diagram.');
    name = data.diagram.name;
    type = data.diagram.type;
    rawContent = data.diagram.content;
  } else if (isPlainObject(data.diagram) && (Array.isArray(data.diagram.elements) || isPlainObject(data.diagram.content))) {
    // Legacy export or an API diagram record
    name = data.diagram.name;
    type = data.diagram.type;
    rawContent = isPlainObject(data.diagram.content) ? data.diagram.content : data.diagram;
  } else if (Array.isArray(data.elements)) {
    rawContent = data;
    name = typeof data.name === 'string' ? data.name : undefined;
    type = typeof data.type === 'string' ? data.type : undefined;
  } else if (isPlainObject(data.content) && Array.isArray(data.content.elements)) {
    // Diagram record as returned by /api/diagrams/:id
    name = data.name;
    type = data.type;
    rawContent = data.content;
  } else {
    return fail('This does not look like an Ontographia diagram file.');
  }

  const res = sanitizeContent(rawContent);
  if (!res.ok) return res;

  const cleanName = typeof name === 'string' && name.trim() ? name.trim().slice(0, 255) : 'Imported diagram';
  const cleanType = VALID_DIAGRAM_TYPES.includes(type) ? type : FALLBACK_DIAGRAM_TYPE;
  return { ok: true, name: cleanName, type: cleanType, content: res.content, warnings: res.warnings };
}

// ============ IMPORT: merge into current diagram ============

const defaultIdGen = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
const ELEMENT_REF_KEYS = ['parentFrameId', 'parentId', 'frameId'];
const shiftPoint = (p, dx, dy) =>
  isPlainObject(p) && isFiniteNumber(p.x) && isFiniteNumber(p.y) ? { ...p, x: p.x + dx, y: p.y + dy } : p;

/**
 * Re-id every element/connection, remap references and translate so the imported
 * bounding box is centered on `center`. Group and layer membership are dropped
 * (the imported groups/layers are not merged). Pure; does not mutate input.
 */
export function remapForMerge(content, { center = { x: 0, y: 0 }, idGen } = {}) {
  const gen = idGen || (() => defaultIdGen('el'));
  const genConn = idGen || (() => defaultIdGen('conn'));
  const elements = content.elements || [];
  const connections = content.connections || [];

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const e of elements) {
    const w = e.size?.width ?? DEFAULT_SIZE.width;
    const h = e.size?.height ?? DEFAULT_SIZE.height;
    minX = Math.min(minX, e.x); minY = Math.min(minY, e.y);
    maxX = Math.max(maxX, e.x + w); maxY = Math.max(maxY, e.y + h);
  }
  const hasBox = elements.length > 0;
  const dx = hasBox ? center.x - (minX + maxX) / 2 : 0;
  const dy = hasBox ? center.y - (minY + maxY) / 2 : 0;

  const idMap = new Map();
  for (const e of elements) idMap.set(e.id, gen());

  const newElements = elements.map(e => {
    const copy = JSON.parse(JSON.stringify(e));
    copy.id = idMap.get(e.id);
    copy.x = e.x + dx;
    copy.y = e.y + dy;
    delete copy.groupId;
    delete copy.layerId;
    for (const key of ELEMENT_REF_KEYS) {
      if (key in copy) {
        if (idMap.has(copy[key])) copy[key] = idMap.get(copy[key]);
        else delete copy[key];
      }
    }
    return copy;
  });

  const newConnections = connections.map(c => {
    const copy = JSON.parse(JSON.stringify(c));
    copy.id = genConn();
    if (copy.sourceId != null) copy.sourceId = idMap.get(c.sourceId);
    if (copy.targetId != null) copy.targetId = idMap.get(c.targetId);
    if (copy.parentFrameId) {
      if (idMap.has(copy.parentFrameId)) copy.parentFrameId = idMap.get(copy.parentFrameId);
      else delete copy.parentFrameId;
    }
    if (Array.isArray(copy.waypoints)) copy.waypoints = copy.waypoints.map(p => shiftPoint(p, dx, dy));
    if (copy.sourcePos) copy.sourcePos = shiftPoint(copy.sourcePos, dx, dy);
    if (copy.targetPos) copy.targetPos = shiftPoint(copy.targetPos, dx, dy);
    return copy;
  });

  return { elements: newElements, connections: newConnections };
}
