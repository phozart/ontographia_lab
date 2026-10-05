// components/diagram-studio/export/exportUtils.js
// Pure geometry / naming helpers for export. No DOM access.

import { sanitizeFilename } from './diagramJson';

const PX_TO_PT = 72 / 96;
export const PAGE_SIZES_PT = {
  a4: { width: 595.28, height: 841.89 },
  letter: { width: 612, height: 792 },
};
export const MAX_CANVAS_SIDE = 16384;
export const MAX_CANVAS_AREA = 120 * 1000 * 1000;

export function unionRects(rects, padding = 0) {
  if (!rects || rects.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  }
  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  };
}

/** Axis-aligned bounds of a rect rotated (degrees) around its own center. */
export function rotatedBounds(rect, degrees = 0) {
  if (!degrees || degrees % 360 === 0) return { ...rect };
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const width = rect.width * cos + rect.height * sin;
  const height = rect.width * sin + rect.height * cos;
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  return { x: cx - width / 2, y: cy - height / 2, width, height };
}

/**
 * Compute PDF page size (pt) and image placement.
 * pageSize 'auto': page equals content (96dpi px -> pt). Otherwise a4/letter, fit within margin and centered.
 */
export function fitPdfPage({ contentWidth, contentHeight, pageSize = 'auto', orientation = 'auto', margin = 24 }) {
  if (pageSize === 'auto' || !PAGE_SIZES_PT[pageSize]) {
    const w = contentWidth * PX_TO_PT;
    const h = contentHeight * PX_TO_PT;
    return { pageWidth: w, pageHeight: h, x: 0, y: 0, width: w, height: h, orientation: w >= h ? 'landscape' : 'portrait' };
  }
  const base = PAGE_SIZES_PT[pageSize];
  const landscape = orientation === 'auto' ? contentWidth >= contentHeight : orientation === 'landscape';
  const pageWidth = landscape ? base.height : base.width;
  const pageHeight = landscape ? base.width : base.height;
  const availW = Math.max(1, pageWidth - margin * 2);
  const availH = Math.max(1, pageHeight - margin * 2);
  const scale = Math.min(availW / contentWidth, availH / contentHeight);
  const width = contentWidth * scale;
  const height = contentHeight * scale;
  return {
    pageWidth,
    pageHeight,
    x: (pageWidth - width) / 2,
    y: (pageHeight - height) / 2,
    width,
    height,
    orientation: landscape ? 'landscape' : 'portrait',
  };
}

/** Center of the visible canvas area in canvas coordinates (inner transform: scale(s) translate(x, y)). */
export function viewportCenter(viewport = {}, area = {}) {
  const scale = viewport.scale || 1;
  const w = area.width || 1200;
  const h = area.height || 800;
  return { x: w / 2 / scale - (viewport.x || 0), y: h / 2 / scale - (viewport.y || 0) };
}

export function exportFilename(name, format) {
  const ext = format === 'jpeg' ? 'jpg' : format;
  return `${sanitizeFilename(name)}.${ext}`;
}

/** Reduce the pixel ratio so the output canvas stays within browser limits. */
export function clampPixelRatio(width, height, ratio) {
  let r = ratio;
  const maxSide = Math.max(width, height);
  if (maxSide * r > MAX_CANVAS_SIDE) r = MAX_CANVAS_SIDE / maxSide;
  if (width * height * r * r > MAX_CANVAS_AREA) r = Math.sqrt(MAX_CANVAS_AREA / (width * height));
  return Math.min(ratio, r);
}

/**
 * Decide which nodes/connections to include. scope 'selection' uses the current selection;
 * everything else includes all.
 */
export function pickElementsForScope(scope, elements, connections, selection = {}) {
  if (scope !== 'selection') {
    return {
      nodeIds: new Set(elements.map(e => e.id)),
      connectionIds: new Set(connections.map(c => c.id)),
    };
  }
  const nodeIds = new Set(selection.nodeIds || []);
  const connectionIds = new Set();
  const explicit = new Set(selection.connectionIds || []);
  for (const c of connections) {
    if (explicit.has(c.id)) {
      connectionIds.add(c.id);
      if (c.sourceId) nodeIds.add(c.sourceId);
      if (c.targetId) nodeIds.add(c.targetId);
    }
  }
  for (const c of connections) {
    if (c.sourceId && c.targetId && nodeIds.has(c.sourceId) && nodeIds.has(c.targetId)) connectionIds.add(c.id);
  }
  return { nodeIds, connectionIds };
}
