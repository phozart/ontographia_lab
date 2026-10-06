// components/diagram-studio/versions/versionUtils.js
// Pure helpers for the History panel: titles, kind labels, relative time and the static version preview.
//
// PREVIEW APPROACH (slice 2 decision): a version is previewed as a *static SVG image* generated from its content
// by the export module's data-driven renderer (ExportManager.exportSVG), shown in an <img> via a data: URL.
// Why not a live read-only canvas: DiagramCanvas (5900 lines) and every hook under it read the one
// DiagramContext, and there is no "render this other content read-only" mode yet (readOnly arrives with the
// sharing slice). Mounting a second canvas would mean a second provider plus un-stubbing pack renderers, drag
// handlers and keyboard listeners: not simple, not robust. The trade-off: shapes are simplified (generic
// rectangles/ellipses/diamonds + labels + straight connections), not pack-accurate. Restoring shows the exact
// diagram; the compare slice (8) may add an on-canvas overlay.
// Safety: an SVG shown through <img> cannot run scripts or load external resources; on top of that every value
// that reaches the SVG markup is coerced / allow-listed below, so hostile content cannot even break the markup.

import { ExportManager } from '../export/ExportManager';

const KIND_LABELS = Object.freeze({
  auto: 'Autosave',
  named: 'Named',
  restore: 'Restore',
  pre_restore: 'Before restore',
});

export function formatKind(kind) {
  return KIND_LABELS[kind] || String(kind || '');
}

/** Display name of a version: its label, else a kind-specific fallback. */
export function versionTitle(v) {
  if (v.label) return v.label;
  if (v.kind === 'restore') return v.restoredFrom ? `Restored from #${v.restoredFrom.number}` : 'Restore';
  if (v.kind === 'pre_restore') return 'Before restore';
  if (v.kind === 'auto') return 'Autosave';
  return `Version ${v.number}`;
}

const UNITS = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]];

/** "5 minutes ago" / "in 2 days"; falls back to the ISO string when the date is invalid. */
export function formatRelative(iso, now = Date.now()) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return String(iso || '');
  const seconds = Math.round((t - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return 'just now';
  const rtf = typeof Intl !== 'undefined' && Intl.RelativeTimeFormat ? new Intl.RelativeTimeFormat('en', { numeric: 'auto' }) : null;
  for (const [unit, size] of UNITS) {
    if (abs >= size) {
      const value = Math.round(seconds / size);
      return rtf ? rtf.format(value, unit) : `${Math.abs(value)} ${unit}s ${value < 0 ? 'ago' : 'from now'}`;
    }
  }
  const value = Math.round(seconds / 60);
  return rtf ? rtf.format(value, 'minute') : `${Math.abs(value)} minutes ago`;
}

const SAFE_COLOR = /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]{3,20}|rgba?\(\s*[\d.\s,%]+\))$/;
const num = (v, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const str = (v, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '');
const MAX_PREVIEW_ELEMENTS = 2000;

/** Allow-listed copy of the parts of a diagram the SVG renderer reads. */
function sanitizeForPreview(content) {
  const src = content && typeof content === 'object' ? content : {};
  const elements = (Array.isArray(src.elements) ? src.elements : [])
    .filter((e) => e && typeof e === 'object')
    .slice(0, MAX_PREVIEW_ELEMENTS)
    .map((e, i) => ({
      id: str(e.id, 80).replace(/[^\w.:-]/g, '_') || `e${i}`,
      type: str(e.type, 60).replace(/[^\w.:-]/g, '_') || 'rectangle',
      label: str(e.label ?? e.text ?? e.name, 120),
      x: num(e.x),
      y: num(e.y),
      size: { width: num(e.size?.width ?? e.width, 100) || 100, height: num(e.size?.height ?? e.height, 50) || 50 },
      color: typeof e.color === 'string' && SAFE_COLOR.test(e.color) ? e.color : undefined,
    }));
  const ids = new Set(elements.map((e) => e.id));
  const connections = (Array.isArray(src.connections) ? src.connections : [])
    .filter((c) => c && typeof c === 'object' && ids.has(str(c.sourceId, 80).replace(/[^\w.:-]/g, '_')) && ids.has(str(c.targetId, 80).replace(/[^\w.:-]/g, '_')))
    .slice(0, MAX_PREVIEW_ELEMENTS * 2)
    .map((c, i) => ({
      id: str(c.id, 80).replace(/[^\w.:-]/g, '_') || `c${i}`,
      sourceId: str(c.sourceId, 80).replace(/[^\w.:-]/g, '_'),
      targetId: str(c.targetId, 80).replace(/[^\w.:-]/g, '_'),
      type: str(c.type, 60).replace(/[^\w.:-]/g, '_') || 'straight',
      label: str(c.label, 120),
      color: typeof c.color === 'string' && SAFE_COLOR.test(c.color) ? c.color : undefined,
    }));
  return { elements, connections, type: 'preview', id: '' };
}

/**
 * Static preview of version content.
 * @returns {{url: string, elementCount: number}} `url` is a data:image/svg+xml URL for an <img>.
 */
export function buildVersionPreview(content) {
  const clean = sanitizeForPreview(content);
  const svg = new ExportManager({ includeDataAttributes: false }).exportSVG(clean, { backgroundColor: '#ffffff' }).content
    // drop the export timestamp: the preview is derived data, keep it deterministic
    .replace(/\sdata-exported-at="[^"]*"/, '');
  return { url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, elementCount: clean.elements.length };
}
