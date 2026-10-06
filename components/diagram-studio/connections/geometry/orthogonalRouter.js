// components/diagram-studio/connections/geometry/orthogonalRouter.js
// Correct-by-construction orthogonal router for connections between two shapes.
//
// Guarantees (for non-overlapping source/target bounds):
//  (a) the path never passes through the interior of the source or target bounds
//  (b) the first segment leaves the source port outward and the last segment
//      enters the target port inward
//  (c) no zero-length segments, no 180-degree reversals
//
// Approach: a small Dijkstra search over a sparse grid whose lines come from the
// stub end points and the (padded) bounds of the shapes to avoid. Bends are
// penalised so the result has as few corners as possible.

const EPS = 1e-6;
const SEG_EPS = 0.5; // distance below which two points are "the same"
export const DEFAULT_STUB = 30;
const BEND_COST = 50;
const MID_BIAS = 1e-4; // tie-break: prefer the middle line between stubs

const DIRS = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

// Direction index: 0 = up, 1 = right, 2 = down, 3 = left
const DIR_VECS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

function dirIndex(v) {
  if (v.y < 0) return 0;
  if (v.x > 0) return 1;
  if (v.y > 0) return 2;
  return 3;
}

export function portDir(port) {
  return DIRS[port] || null;
}

/**
 * Remove duplicate points, collinear middle points and backtracking spikes.
 * First and last points are always kept. Idempotent.
 * @param {{x:number,y:number}[]} points
 * @returns {{x:number,y:number}[]}
 */
export function normalizePoints(points) {
  if (!Array.isArray(points) || points.length < 2) return points || [];
  let pts = points.filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.y));
  if (pts.length < 2) return pts;

  let changed = true;
  while (changed) {
    changed = false;

    // Drop consecutive duplicates (keep the last point exact)
    const deduped = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const prev = deduped[deduped.length - 1];
      const cur = pts[i];
      if (Math.abs(prev.x - cur.x) < SEG_EPS && Math.abs(prev.y - cur.y) < SEG_EPS) {
        if (i === pts.length - 1 && deduped.length > 1) deduped[deduped.length - 1] = cur;
        changed = changed || deduped.length !== i;
        continue;
      }
      deduped.push(cur);
    }
    if (deduped.length !== pts.length) changed = true;
    pts = deduped;
    if (pts.length < 3) break;

    // Remove collinear middle points and backtracking spikes
    const out = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
      const a = out[out.length - 1];
      const b = pts[i];
      const c = pts[i + 1];
      const abVertical = Math.abs(a.x - b.x) < SEG_EPS;
      const bcVertical = Math.abs(b.x - c.x) < SEG_EPS;
      const abHorizontal = Math.abs(a.y - b.y) < SEG_EPS;
      const bcHorizontal = Math.abs(b.y - c.y) < SEG_EPS;
      if (abVertical && bcVertical) {
        // collinear (same direction) or spike (reversal): either way b is redundant
        changed = true;
        continue;
      }
      if (abHorizontal && bcHorizontal) {
        changed = true;
        continue;
      }
      out.push(b);
    }
    out.push(pts[pts.length - 1]);
    pts = out;
  }
  return pts;
}

function strictInside(px, py, r) {
  return px > r.x + EPS && px < r.x + r.width - EPS && py > r.y + EPS && py < r.y + r.height - EPS;
}

/**
 * Does the axis-aligned segment pass through the strict interior of rect?
 * (running along the border or touching it is fine)
 */
export function segmentHitsInterior(p1, p2, rect, tolerance = SEG_EPS) {
  if (!rect) return false;
  const left = rect.x + tolerance;
  const right = rect.x + rect.width - tolerance;
  const top = rect.y + tolerance;
  const bottom = rect.y + rect.height - tolerance;
  if (right <= left || bottom <= top) return false;
  const minX = Math.min(p1.x, p2.x);
  const maxX = Math.max(p1.x, p2.x);
  const minY = Math.min(p1.y, p2.y);
  const maxY = Math.max(p1.y, p2.y);
  // Rectangle overlap test on the (possibly degenerate) segment box vs interior
  return maxX > left && minX < right && maxY > top && minY < bottom;
}

/**
 * Validate a route against the routing invariants.
 * @returns {{ valid: boolean, reason?: string }}
 */
export function validateRoute(points, sourceBounds, targetBounds, sourcePort, targetPort) {
  if (!Array.isArray(points) || points.length < 2) return { valid: false, reason: 'too-short' };
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    if (dx < SEG_EPS && dy < SEG_EPS) return { valid: false, reason: 'zero-length' };
    if (dx >= SEG_EPS && dy >= SEG_EPS) return { valid: false, reason: 'diagonal' };
    if (i < points.length - 2) {
      const c = points[i + 2];
      const abV = dx < SEG_EPS;
      const bcV = Math.abs(b.x - c.x) < SEG_EPS;
      if (abV === bcV) {
        // collinear: reversal is not allowed (same direction would be redundant but harmless)
        const d1 = abV ? b.y - a.y : b.x - a.x;
        const d2 = bcV ? c.y - b.y : c.x - b.x;
        if (d1 * d2 < 0) return { valid: false, reason: 'reversal' };
      }
    }
    if (segmentHitsInterior(a, b, sourceBounds)) return { valid: false, reason: 'crosses-source' };
    if (segmentHitsInterior(a, b, targetBounds)) return { valid: false, reason: 'crosses-target' };
  }
  const sd = portDir(sourcePort);
  const td = portDir(targetPort);
  if (sd) {
    const a = points[0];
    const b = points[1];
    if ((b.x - a.x) * sd.x + (b.y - a.y) * sd.y <= 0) return { valid: false, reason: 'bad-exit' };
  }
  if (td) {
    const a = points[points.length - 2];
    const b = points[points.length - 1];
    // Travelling towards the target must be opposite to the port's outward direction
    if ((b.x - a.x) * -td.x + (b.y - a.y) * -td.y <= 0) return { valid: false, reason: 'bad-entry' };
  }
  return { valid: true };
}

/**
 * Distance along a ray from `pos` in direction `dir` to the first boundary of
 * `rect` the ray passes through (Infinity if it misses).
 */
function rayHitDistance(pos, dir, rect) {
  if (!rect) return Infinity;
  if (dir.x !== 0) {
    if (pos.y <= rect.y + EPS || pos.y >= rect.y + rect.height - EPS) return Infinity;
    const edge = dir.x > 0 ? rect.x : rect.x + rect.width;
    const d = (edge - pos.x) * dir.x;
    return d >= -EPS ? Math.max(d, 0) : Infinity;
  }
  if (pos.x <= rect.x + EPS || pos.x >= rect.x + rect.width - EPS) return Infinity;
  const edge = dir.y > 0 ? rect.y : rect.y + rect.height;
  const d = (edge - pos.y) * dir.y;
  return d >= -EPS ? Math.max(d, 0) : Infinity;
}

function stubLength(pos, dir, otherBounds, stub) {
  const h = rayHitDistance(pos, dir, otherBounds);
  if (h === Infinity) return stub;
  return Math.max(Math.min(stub, h / 2), 0);
}

function uniqueSorted(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const out = [];
  for (const v of sorted) {
    if (out.length === 0 || v - out[out.length - 1] > 1e-6) out.push(v);
  }
  return out;
}

function expand(r, pad) {
  return { x: r.x - pad, y: r.y - pad, width: r.width + pad * 2, height: r.height + pad * 2 };
}

class MinHeap {
  constructor() { this.a = []; }
  push(item) {
    const a = this.a;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
  get size() { return this.a.length; }
}

function search(exit, entry, sd, td, blockers, extraXs, extraYs) {
  const midX = (exit.x + entry.x) / 2;
  const midY = (exit.y + entry.y) / 2;
  const xs = [exit.x, entry.x, midX, ...extraXs];
  const ys = [exit.y, entry.y, midY, ...extraYs];
  for (const r of blockers) {
    xs.push(r.x, r.x + r.width);
    ys.push(r.y, r.y + r.height);
  }
  const X = uniqueSorted(xs);
  const Y = uniqueSorted(ys);
  const nx = X.length;
  const ny = Y.length;
  const find = (arr, v) => {
    for (let i = 0; i < arr.length; i++) if (Math.abs(arr[i] - v) < 1e-6) return i;
    return -1;
  };
  const sx = find(X, exit.x);
  const sy = find(Y, exit.y);
  const ex = find(X, entry.x);
  const ey = find(Y, entry.y);

  // Blocked-edge tests (open interior overlap)
  const hBlocked = (y, x1, x2) => {
    const lo = Math.min(x1, x2);
    const hi = Math.max(x1, x2);
    for (const r of blockers) {
      if (y > r.y + EPS && y < r.y + r.height - EPS && hi > r.x + EPS && lo < r.x + r.width - EPS) return true;
    }
    return false;
  };
  const vBlocked = (x, y1, y2) => {
    const lo = Math.min(y1, y2);
    const hi = Math.max(y1, y2);
    for (const r of blockers) {
      if (x > r.x + EPS && x < r.x + r.width - EPS && hi > r.y + EPS && lo < r.y + r.height - EPS) return true;
    }
    return false;
  };
  for (const r of blockers) {
    if (strictInside(exit.x, exit.y, r) || strictInside(entry.x, entry.y, r)) return null;
  }

  const sdI = dirIndex(sd);
  const tdI = dirIndex(td);
  const key = (ix, iy, d) => (iy * nx + ix) * 5 + d; // d === 4: finished at the entry point
  const finalDir = (tdI + 2) % 4; // direction of the last segment (entry -> target)
  const dist = new Map();
  const prev = new Map();
  const heap = new MinHeap();
  const startKey = key(sx, sy, sdI);
  dist.set(startKey, 0);
  heap.push([0, sx, sy, sdI]);
  let endKey = null;

  while (heap.size) {
    const [cost, ix, iy, d] = heap.pop();
    const k = key(ix, iy, d);
    if (cost > (dist.get(k) ?? Infinity) + 1e-9) continue;
    if (d === 4) {
      endKey = k;
      break;
    }
    if (ix === ex && iy === ey && d !== tdI) {
      // Turning into the final entry -> target segment counts as a bend
      const c = cost + (d !== finalDir ? BEND_COST : 0);
      const fk = key(ix, iy, 4);
      if (c < (dist.get(fk) ?? Infinity) - 1e-9) {
        dist.set(fk, c);
        prev.set(fk, k);
        heap.push([c, ix, iy, 4]);
      }
    }
    for (let nd = 0; nd < 4; nd++) {
      if (nd === ((d + 2) % 4)) continue; // no reversals
      const v = DIR_VECS[nd];
      const jx = ix + v.x;
      const jy = iy + v.y;
      if (jx < 0 || jx >= nx || jy < 0 || jy >= ny) continue;
      const x1 = X[ix];
      const y1 = Y[iy];
      const x2 = X[jx];
      const y2 = Y[jy];
      const horizontal = v.y === 0;
      if (horizontal ? hBlocked(y1, x1, x2) : vBlocked(x1, y1, y2)) continue;
      const len = Math.abs(x2 - x1) + Math.abs(y2 - y1);
      const dev = horizontal ? Math.abs(y1 - midY) : Math.abs(x1 - midX);
      const c = cost + len * (1 + MID_BIAS * dev) + (nd !== d ? BEND_COST : 0);
      const nk = key(jx, jy, nd);
      if (c < (dist.get(nk) ?? Infinity) - 1e-9) {
        dist.set(nk, c);
        prev.set(nk, k);
        heap.push([c, jx, jy, nd]);
      }
    }
  }
  if (endKey === null) return null;

  const pts = [];
  let k = endKey;
  while (k !== undefined) {
    const cell = Math.floor(k / 5);
    const ix = cell % nx;
    const iy = Math.floor(cell / nx);
    if (k % 5 !== 4) pts.push({ x: X[ix], y: Y[iy] });
    k = prev.get(k);
  }
  pts.reverse();
  return pts;
}

/**
 * Route between two ports orthogonally.
 * @param {{x:number,y:number}} sourcePos port position on the source
 * @param {{x:number,y:number}} targetPos port position on the target
 * @param {string} sourcePort 'top'|'right'|'bottom'|'left'
 * @param {string} targetPort
 * @param {{x,y,width,height}|null} sourceBounds
 * @param {{x,y,width,height}|null} targetBounds
 * @param {{ obstacles?: Array, stub?: number }} [options]
 * @returns {{x:number,y:number}[]|null} points including source and target, or null
 */
export function routeOrthogonal(sourcePos, targetPos, sourcePort, targetPort, sourceBounds, targetBounds, options = {}) {
  const sd = portDir(sourcePort);
  const td = portDir(targetPort);
  if (!sd || !td) return null;
  const stub = options.stub ?? DEFAULT_STUB;
  const obstacles = options.obstacles || [];

  let sLen = stubLength(sourcePos, sd, targetBounds, stub);
  let tLen = stubLength(targetPos, td, sourceBounds, stub);
  // Facing ports with the target ahead: split the available gap so the stubs
  // meet on a single middle line instead of overshooting each other.
  if (sd.x === -td.x && sd.y === -td.y) {
    const axial = (targetPos.x - sourcePos.x) * sd.x + (targetPos.y - sourcePos.y) * sd.y;
    if (axial > 0 && axial < 2 * stub) {
      sLen = Math.min(sLen, axial / 2);
      tLen = Math.min(tLen, axial / 2);
    }
  }
  const exit = { x: sourcePos.x + sd.x * sLen, y: sourcePos.y + sd.y * sLen };
  const entry = { x: targetPos.x + td.x * tLen, y: targetPos.y + td.y * tLen };

  // Only consider obstacles near the corridor to keep the grid small
  const minX = Math.min(sourcePos.x, targetPos.x) - 150;
  const maxX = Math.max(sourcePos.x, targetPos.x) + 150;
  const minY = Math.min(sourcePos.y, targetPos.y) - 150;
  const maxY = Math.max(sourcePos.y, targetPos.y) + 150;
  const nearby = obstacles.filter(o =>
    o && o.x < maxX && o.x + o.width > minX && o.y < maxY && o.y + o.height > minY);

  const attempts = [];
  if (nearby.length) {
    attempts.push({ pad: 15, obs: nearby, obsPad: 8 });
  }
  attempts.push({ pad: 15, obs: [], obsPad: 0 });
  attempts.push({ pad: 5, obs: [], obsPad: 0 });
  attempts.push({ pad: 0, obs: [], obsPad: 0 });

  for (const att of attempts) {
    const blockers = [];
    if (sourceBounds) blockers.push(expand(sourceBounds, att.pad));
    if (targetBounds) blockers.push(expand(targetBounds, att.pad));
    for (const o of att.obs) blockers.push(expand(o, att.obsPad));
    const grid = search(exit, entry, sd, td, blockers, [sourcePos.x, targetPos.x], [sourcePos.y, targetPos.y]);
    if (!grid) continue;
    const pts = normalizePoints([sourcePos, ...grid, targetPos]);
    const check = validateRoute(pts, sourceBounds, targetBounds, sourcePort, targetPort);
    if (check.valid) return pts;
  }
  return null;
}
