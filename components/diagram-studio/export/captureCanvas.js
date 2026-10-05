// components/diagram-studio/export/captureCanvas.js
// Capture the LIVE canvas (HTML nodes + SVG connections) for export so exports match what the
// user sees. Works by cloning the canvas content into an off-screen host, stripping UI chrome,
// shifting it so the export bounds start at 0,0, and handing the host to html-to-image.

import { unionRects, rotatedBounds, pickElementsForScope } from './exportUtils';

// Elements that are editor chrome, never part of the diagram.
const CHROME_SELECTORS = [
  '.ds-resize-handle',
  '.ds-rotation-handle',
  '.ds-floating-rotation-handle',
  '.ds-port',
  '.ds-edge-handle',
  '.ds-edge-handle-dot',
  '.ds-marquee',
  '.ds-draw-preview',
  '.ds-connection-temp',
  '.ds-node-edit-overlay',
  '.ds-endpoint-overlay',
  '.ds-waypoint-handle',
  '.ds-segment-handle',
  '.ds-curve-handle',
  '.ds-grid',
  'textarea',
  'input',
].join(',');

const GRID_SIZE = 20;
const CONNECTION_BBOX_PAD = 12; // arrowheads / stroke are not part of getBBox

/** Convert a CSS transform string into a rotation in degrees (0 if none). */
export function parseRotation(transform) {
  const m = /rotate\((-?[\d.]+)deg\)/.exec(transform || '');
  return m ? parseFloat(m[1]) : 0;
}

export function getCanvasInner(doc = document) {
  return doc.querySelector('.ds-canvas-inner');
}

function viewportBounds(doc) {
  const inner = getCanvasInner(doc);
  const area = doc.querySelector('.ds-canvas-area');
  if (!inner || !area) return null;
  const m = /scale\(([-\d.]+)\)\s*translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(inner.style.transform || '');
  if (!m) return null;
  const scale = parseFloat(m[1]);
  const tx = parseFloat(m[2]);
  const ty = parseFloat(m[3]);
  return { x: -tx, y: -ty, width: area.clientWidth / scale, height: area.clientHeight / scale };
}

/** Build the off-screen host holding a sanitized clone of the canvas, positioned at the export bounds. */
export function buildExportHost(options = {}) {
  const {
    scope = 'canvas',
    elements = [],
    connections = [],
    selection = { nodeIds: [], connectionIds: [] },
    frame = null,
    padding = 40,
    background = 'white',
    document: doc = document,
  } = options;

  const inner = getCanvasInner(doc);
  if (!inner) throw new Error('The canvas is not available for export.');

  // 1. Clone the ancestor chain (shallow) so descendant CSS selectors / CSS variables still apply.
  const ancestors = [];
  for (let p = inner.parentElement; p && p !== doc.body && p !== doc.documentElement; p = p.parentElement) ancestors.push(p);
  let outer = null;
  let parentClone = null;
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const c = ancestors[i].cloneNode(false);
    c.removeAttribute('id');
    c.setAttribute('data-export-host', 'ancestor');
    if (parentClone) parentClone.appendChild(c); else outer = c;
    parentClone = c;
  }
  const innerClone = inner.cloneNode(true);
  if (parentClone) parentClone.appendChild(innerClone); else outer = innerClone;
  const host = outer;

  // 2. Strip chrome and state classes.
  innerClone.querySelectorAll(CHROME_SELECTORS).forEach(n => n.remove());
  innerClone.querySelectorAll('.selected').forEach(n => n.classList.remove('selected'));
  innerClone.querySelectorAll('.dragging,.connect-mode,.connect-target').forEach(n => {
    n.classList.remove('dragging', 'connect-mode', 'connect-target');
  });

  // 3. Filter by scope.
  const { nodeIds, connectionIds } = pickElementsForScope(scope, elements, connections, selection);
  const limit = scope === 'selection';
  innerClone.querySelectorAll('[data-node-id]').forEach(n => {
    if (limit && !nodeIds.has(n.getAttribute('data-node-id'))) n.remove();
  });
  innerClone.querySelectorAll('[data-connection-id]').forEach(n => {
    if (limit && !connectionIds.has(n.getAttribute('data-connection-id'))) n.remove();
  });

  // Park the host in the document so layout/getBBox work (behind the app, non-interactive).
  host.style.cssText = 'position:fixed;left:0;top:0;z-index:-1;pointer-events:none;overflow:visible;';
  doc.body.appendChild(host);
  const cleanup = () => { if (host.parentNode) host.parentNode.removeChild(host); };

  try {
    // 4. Bounds
    let box;
    let pad = padding;
    if (scope === 'viewport') {
      box = viewportBounds(doc);
      pad = 0;
    } else if (scope === 'frame' && frame) {
      const fw = frame.size?.width || 400;
      const fh = frame.size?.height || 300;
      box = { x: frame.x || 0, y: frame.y || 0, width: fw, height: fh };
      pad = 0;
    }
    if (!box) {
      const rects = [];
      innerClone.querySelectorAll('[data-node-id]').forEach(n => {
        const r = {
          x: parseFloat(n.style.left) || 0,
          y: parseFloat(n.style.top) || 0,
          width: parseFloat(n.style.width) || n.offsetWidth || 0,
          height: parseFloat(n.style.height) || n.offsetHeight || 0,
        };
        rects.push(rotatedBounds(r, parseRotation(n.style.transform)));
      });
      innerClone.querySelectorAll('[data-connection-id]').forEach(g => {
        try {
          const b = g.getBBox();
          if (b.width || b.height) {
            rects.push({
              x: b.x - CONNECTION_BBOX_PAD,
              y: b.y - CONNECTION_BBOX_PAD,
              width: b.width + CONNECTION_BBOX_PAD * 2,
              height: b.height + CONNECTION_BBOX_PAD * 2,
            });
          }
        } catch (e) { /* not rendered */ }
      });
      box = unionRects(rects, 0);
      if (!box) throw new Error('There is nothing to export.');
    }
    const bounds = {
      x: box.x - pad,
      y: box.y - pad,
      width: Math.max(1, Math.ceil(box.width + pad * 2)),
      height: Math.max(1, Math.ceil(box.height + pad * 2)),
    };

    // 5. Position content: host is exactly the export size, inner shifted.
    const sizeCss = `width:${bounds.width}px;height:${bounds.height}px;`;
    const resets = `${sizeCss}position:relative;left:0;top:0;margin:0;padding:0;border:0;overflow:hidden;transform:none;background:none;box-shadow:none;display:block;min-width:0;min-height:0;max-width:none;max-height:none;`;
    let node = host;
    while (node && node !== innerClone) {
      resets.split(';').filter(Boolean).forEach(decl => {
        const idx = decl.indexOf(':');
        node.style.setProperty(decl.slice(0, idx), decl.slice(idx + 1), 'important');
      });
      node = node.firstElementChild;
    }
    host.style.setProperty('position', 'fixed', 'important');
    host.style.setProperty('z-index', '-1', 'important');
    host.style.setProperty('pointer-events', 'none', 'important');
    innerClone.style.setProperty('position', 'absolute', 'important');
    innerClone.style.setProperty('left', '0', 'important');
    innerClone.style.setProperty('top', '0', 'important');
    innerClone.style.setProperty('transform', `translate(${-bounds.x}px, ${-bounds.y}px)`, 'important');
    innerClone.style.setProperty('transform-origin', '0 0', 'important');
    innerClone.style.setProperty('overflow', 'visible', 'important');
    innerClone.style.setProperty('background', 'none', 'important');

    // 6. Grid background (our own, independent of the editor's grid toggle).
    if (background === 'grid') {
      const grid = doc.createElement('div');
      grid.setAttribute('data-export-grid', '1');
      const gx = Math.floor(bounds.x / GRID_SIZE) * GRID_SIZE; // keep dots on canvas grid multiples
      const gy = Math.floor(bounds.y / GRID_SIZE) * GRID_SIZE;
      grid.style.cssText = [
        'position:absolute',
        `left:${gx}px`,
        `top:${gy}px`,
        `width:${bounds.width + GRID_SIZE * 2}px`,
        `height:${bounds.height + GRID_SIZE * 2}px`,
        'pointer-events:none',
        'background-image:radial-gradient(circle, #c4ccd8 1.2px, transparent 1.4px)',
        `background-size:${GRID_SIZE}px ${GRID_SIZE}px`,
        'background-position:-0.6px -0.6px',
        'z-index:0',
      ].join(';');
      innerClone.insertBefore(grid, innerClone.firstChild);
    }

    return { host, bounds, cleanup };
  } catch (e) {
    cleanup();
    throw e;
  }
}
