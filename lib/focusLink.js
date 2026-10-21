// lib/focusLink.js
// The "Copy link for Claude" focus link: a plain deep link to a diagram plus what to look at.
//   <origin>/diagram/<LAB-n | uuid>?focus=<id>[,<id>...]        selection or frame (a frame id means "the frame and its members")
//   <origin>/diagram/<LAB-n | uuid>?region=<x>,<y>,<w>,<h>      a rectangle in canvas coordinates (e.g. the viewport)
// No server state. Pure (shared by the editor and the MCP server); never fetches anything.
// Design: docs/architecture/investigations/ai-canvas-via-mcp.md (section 5, slice AI-1).

export const MAX_FOCUS_IDS = 200;
const MAX_LINK_LENGTH = 8000;
const MAX_COORD = 1e7;
const ID_RE = /^[A-Za-z0-9_.:@+~-]{1,200}$/;
const DIAGRAM_REF_RE = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|LAB-\d{1,9})$/i;

export class FocusLinkError extends Error {}

export const isValidElementId = (id) => typeof id === 'string' && ID_RE.test(id);

const round = (n) => Math.round(n * 10) / 10;

/** @returns {{x:number,y:number,width:number,height:number}} validated bbox, or throws FocusLinkError */
export function validateBbox(b) {
  const { x, y, width, height } = b || {};
  const nums = [x, y, width, height];
  if (!nums.every((n) => typeof n === 'number' && Number.isFinite(n))) throw new FocusLinkError('Region needs numeric x, y, width and height.');
  if (Math.abs(x) > MAX_COORD || Math.abs(y) > MAX_COORD || width <= 0 || height <= 0 || width > MAX_COORD || height > MAX_COORD) {
    throw new FocusLinkError('Region is outside the allowed coordinate range or has no area.');
  }
  return { x, y, width, height };
}

/**
 * Link for a selection (ids) or, when it has too many ids, its bounding box.
 * @param {{origin?: string, diagramRef: string, ids?: string[], bounds?: {x,y,width,height}}} o
 */
export function buildFocusLink({ origin = '', diagramRef, ids, bounds }) {
  if (!DIAGRAM_REF_RE.test(String(diagramRef || ''))) throw new FocusLinkError('Unknown diagram reference.');
  const base = `${String(origin).replace(/\/+$/, '')}/diagram/${diagramRef}`;
  const valid = Array.isArray(ids) ? ids.filter(isValidElementId) : [];
  if (valid.length && valid.length <= MAX_FOCUS_IDS) return `${base}?focus=${valid.map(encodeURIComponent).join(',')}`;
  if (bounds) {
    const b = validateBbox(bounds);
    return `${base}?region=${[b.x, b.y, b.width, b.height].map(round).join(',')}`;
  }
  return base;
}

/**
 * Parse a pasted link (absolute URL, path, or `LAB-12?focus=...`). The host is ignored.
 * @returns {{diagramRef: string, focus: null | {elementIds: string[]} | {bbox: {x,y,width,height}}}}
 */
export function parseFocusLink(input) {
  if (typeof input !== 'string' || !input.trim()) throw new FocusLinkError('Focus link is empty.');
  const raw = input.trim();
  if (raw.length > MAX_LINK_LENGTH) throw new FocusLinkError('Focus link is too long.');
  let url;
  try {
    const prefixed = /^(?:https?:)?\/\//i.test(raw) || raw.startsWith('/') ? raw : `/diagram/${raw}`;
    url = new URL(prefixed, 'http://link.invalid');
  } catch {
    throw new FocusLinkError('Not a valid link.');
  }
  const m = /(?:^|\/)diagram\/([^/?#]+)\/?$/.exec(url.pathname);
  let diagramRef = '';
  try {
    diagramRef = m ? decodeURIComponent(m[1]) : '';
  } catch {
    diagramRef = '';
  }
  if (!DIAGRAM_REF_RE.test(diagramRef)) throw new FocusLinkError('The link does not point to a diagram (expected /diagram/<id or LAB-n>).');
  const focusParam = url.searchParams.get('focus');
  const regionParam = url.searchParams.get('region');
  if (focusParam && regionParam) throw new FocusLinkError('Use either focus or region in a link, not both.');
  if (focusParam) {
    const ids = focusParam.split(',').filter(Boolean);
    if (!ids.length || ids.length > MAX_FOCUS_IDS) throw new FocusLinkError(`focus needs 1 to ${MAX_FOCUS_IDS} element ids.`);
    if (!ids.every(isValidElementId)) throw new FocusLinkError('focus contains an invalid element id.');
    return { diagramRef, focus: { elementIds: [...new Set(ids)] } };
  }
  if (regionParam) {
    const parts = regionParam.split(',');
    if (parts.length !== 4) throw new FocusLinkError('region must be x,y,width,height.');
    const [x, y, width, height] = parts.map((p) => (p.trim() === '' ? NaN : Number(p)));
    return { diagramRef, focus: { bbox: validateBbox({ x, y, width, height }) } };
  }
  return { diagramRef, focus: null };
}
