// components/diagram-studio/present/slideClone.js
// Helpers for the slide clone (a copy of the live canvas clipped to a slide frame) that present mode and the exports use.

const num = (v, d = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };

/** The rotation in degrees from a CSS transform; 0 when absent, unparsable or rotate(0deg). */
export function rotationOf(transform) {
  const m = /rotate\((-?[\d.]+)(deg|rad|turn)?\)/.exec(transform || '');
  if (!m) return 0;
  const v = parseFloat(m[1]);
  return Number.isFinite(v) ? v : 0;
}

/**
 * Remove every cloned element node whose box does not touch the frame, and the frame's own dashed outline. What is
 * clipped by the host is invisible anyway; removing it keeps off-slide text out of the accessibility tree and makes the
 * clone cheaper. Elements that intersect the frame stay and are clipped by the host (the rule of ADR-0007 5.3).
 * Pure DOM work on a detached or attached subtree; no layout reads.
 * @param {Element} host the clone (buildExportHost's host)
 * @param {{id: string, x?: number, y?: number, size?: {width?: number, height?: number}}} frame
 * @returns {number} how many nodes were removed
 */
export function pruneToFrame(host, frame) {
  const fx = frame.x || 0;
  const fy = frame.y || 0;
  const fw = frame.size?.width || 400;
  const fh = frame.size?.height || 300;
  let removed = 0;
  host.querySelectorAll('[data-node-id]').forEach((n) => {
    const id = n.getAttribute('data-node-id');
    if (id === frame.id) {
      n.querySelectorAll('rect[stroke-dasharray]').forEach((r) => r.setAttribute('stroke', 'none'));
      return;
    }
    const x = num(n.style.left);
    const y = num(n.style.top);
    const w = num(n.style.width, 0);
    const h = num(n.style.height, 0);
    // a rotated element can reach further than its box: keep it unless it is clearly away from the frame
    const slack = rotationOf(n.style.transform) !== 0 ? Math.max(w, h) : 0;
    const outside = x + w + slack < fx || x - slack > fx + fw || y + h + slack < fy || y - slack > fy + fh;
    if (outside && n.parentNode) { n.parentNode.removeChild(n); removed += 1; }
  });
  return removed;
}
