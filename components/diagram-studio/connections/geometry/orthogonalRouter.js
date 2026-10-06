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
  // Parallel arrays (cost, packed state) avoid allocating a tuple per push
  constructor() { this.c = []; this.v = []; }
  push(cost, val) {
    const c = this.c;
    const v = this.v;
    let i = c.length;
    c.push(cost);
    v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (c[p] <= cost) break;
      c[i] = c[p];
      v[i] = v[p];
      i = p;
    }
    c[i] = cost;
    v[i] = val;
  }
  // Removes the minimum; read it from `topCost` / `topVal` afterwards
  pop() {
    const c = this.c;
    const v = this.v;
    this.topCost = c[0];
    this.topVal = v[0];
    const lc = c.pop();
    const lv = v.pop();
    const n = c.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        if (l >= n) break;
        const r = l + 1;
        const m = r < n && c[r] < c[l] ? r : l;
        if (c[m] >= lc) break;
        c[i] = c[m];
        v[i] = v[m];
        i = m;
      }
      c[i] = lc;
      v[i] = lv;
    }
  }
  get size() { return this.c.length; }
}

// First index in sorted `arr` whose value is >= v
function lowerIndex(arr, v) {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < v) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// First index in sorted `arr` whose value is > v
function upperIndex(arr, v) {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] <= v) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Precompute which grid edges pass through a blocker's open interior, so the
 * search does O(1) lookups instead of scanning every blocker per edge.
 * hBlk[iy * (nx - 1) + ix]: edge (ix,iy)-(ix+1,iy); vBlk[ix * (ny - 1) + iy]: edge (ix,iy)-(ix,iy+1)
 */
function blockedEdges(X, Y, blockers) {
  const nx = X.length;
  const ny = Y.length;
  const hBlk = new Uint8Array(Math.max(nx - 1, 0) * ny);
  const vBlk = new Uint8Array(Math.max(ny - 1, 0) * nx);
  for (const r of blockers) {
    const x0 = r.x + EPS;
    const x1 = r.x + r.width - EPS;
    const y0 = r.y + EPS;
    const y1 = r.y + r.height - EPS;
    if (x1 <= x0 || y1 <= y0) continue;
    // Horizontal edges: row strictly inside (y0, y1), edge overlapping (x0, x1)
    const eLo = Math.max(upperIndex(X, x0) - 1, 0);
    for (let iy = upperIndex(Y, y0); iy < ny && Y[iy] < y1; iy++) {
      for (let ix = eLo; ix < nx - 1 && X[ix] < x1; ix++) hBlk[iy * (nx - 1) + ix] = 1;
    }
    // Vertical edges: column strictly inside (x0, x1), edge overlapping (y0, y1)
    const fLo = Math.max(upperIndex(Y, y0) - 1, 0);
    for (let ix = upperIndex(X, x0); ix < nx && X[ix] < x1; ix++) {
      for (let iy = fLo; iy < ny - 1 && Y[iy] < y1; iy++) vBlk[ix * (ny - 1) + iy] = 1;
    }
  }
  return { hBlk, vBlk };
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
    const i = lowerIndex(arr, v - 1e-6);
    return i < arr.length && Math.abs(arr[i] - v) < 1e-6 ? i : -1;
  };
  const sx = find(X, exit.x);
  const sy = find(Y, exit.y);
  const ex = find(X, entry.x);
  const ey = find(Y, entry.y);

  for (const r of blockers) {
    if (strictInside(exit.x, exit.y, r) || strictInside(entry.x, entry.y, r)) return null;
  }
  const { hBlk, vBlk } = blockedEdges(X, Y, blockers);

  const sdI = dirIndex(sd);
  const tdI = dirIndex(td);
  const total = nx * ny * 5;
  const key = (ix, iy, d) => (iy * nx + ix) * 5 + d; // d === 4: finished at the entry point
  const finalDir = (tdI + 2) % 4; // direction of the last segment (entry -> target)
  const dist = new Float64Array(total).fill(Infinity);
  const prev = new Int32Array(total).fill(-1);
  const heap = new MinHeap();
  const startKey = key(sx, sy, sdI);
  dist[startKey] = 0;
  heap.push(0, startKey);
  let endKey = -1;

  while (heap.size) {
    heap.pop();
    const cost = heap.topCost;
    const k = heap.topVal;
    if (cost > dist[k] + 1e-9) continue;
    const d = k % 5;
    const cell = (k - d) / 5;
    const ix = cell % nx;
    const iy = (cell - ix) / nx;
    if (d === 4) {
      endKey = k;
      break;
    }
    if (ix === ex && iy === ey && d !== tdI) {
      // Turning into the final entry -> target segment counts as a bend
      const c = cost + (d !== finalDir ? BEND_COST : 0);
      const fk = key(ix, iy, 4);
      if (c < dist[fk] - 1e-9) {
        dist[fk] = c;
        prev[fk] = k;
        heap.push(c, fk);
      }
    }
    for (let nd = 0; nd < 4; nd++) {
      if (nd === ((d + 2) % 4)) continue; // no reversals
      const v = DIR_VECS[nd];
      const jx = ix + v.x;
      const jy = iy + v.y;
      if (jx < 0 || jx >= nx || jy < 0 || jy >= ny) continue;
      const horizontal = v.y === 0;
      if (horizontal) {
        if (hBlk[iy * (nx - 1) + Math.min(ix, jx)]) continue;
      } else if (vBlk[ix * (ny - 1) + Math.min(iy, jy)]) continue;
      const len = Math.abs(X[jx] - X[ix]) + Math.abs(Y[jy] - Y[iy]);
      const dev = horizontal ? Math.abs(Y[iy] - midY) : Math.abs(X[ix] - midX);
      const c = cost + len * (1 + MID_BIAS * dev) + (nd !== d ? BEND_COST : 0);
      const nk = key(jx, jy, nd);
      if (c < dist[nk] - 1e-9) {
        dist[nk] = c;
        prev[nk] = k;
        heap.push(c, nk);
      }
    }
  }
  if (endKey < 0) return null;

  const pts = [];
  let k = endKey;
  while (k >= 0) {
    const cell = Math.floor(k / 5);
    const ix = cell % nx;
    const iy = Math.floor(cell / nx);
    if (k % 5 !== 4) pts.push({ x: X[ix], y: Y[iy] });
    k = prev[k];
  }
  pts.reverse();
  return pts;
}

function rectsHitBox(list, box) {
  return list.filter(o => o && o.x < box.maxX && o.x + o.width > box.minX && o.y < box.maxY && o.y + o.height > box.minY);
}

function pathClearOf(points, rects, pad) {
  for (const r of rects) {
    const e = expand(r, pad);
    for (let i = 0; i < points.length - 1; i++) {
      if (segmentHitsInterior(points[i], points[i + 1], e, EPS)) return false;
    }
  }
  return true;
}

/**
 * Cheap candidates before the grid search: straight, single-elbow and
 * two-elbow (Z / U) routes between the stub end points. Costs mirror the
 * search's, so the cheapest valid candidate is what the search would return.
 * Returns the full point list (source ... target) or null when all are blocked.
 */
function trivialRoute(sourcePos, targetPos, exit, entry, sd, td, sourcePort, targetPort, sourceBounds, targetBounds, blockers) {
  const sdI = dirIndex(sd);
  const tdI = dirIndex(td);
  const finalDir = (tdI + 2) % 4;
  const midX = (exit.x + entry.x) / 2;
  const midY = (exit.y + entry.y) / 2;
  const mids = [
    [],
    [{ x: exit.x, y: entry.y }],
    [{ x: entry.x, y: exit.y }],
    [{ x: midX, y: exit.y }, { x: midX, y: entry.y }],
    [{ x: exit.x, y: midY }, { x: entry.x, y: midY }],
  ];
  let best = null;
  let bestCost = Infinity;
  for (const mid of mids) {
    const raw = [exit, ...mid, entry];
    let cost = 0;
    let d = sdI;
    let ok = true;
    for (let i = 0; i < raw.length - 1 && ok; i++) {
      const a = raw[i];
      const b = raw[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) { ok = false; break; } // degenerate: leave to the search
      if (Math.abs(dx) > 1e-6 && Math.abs(dy) > 1e-6) { ok = false; break; } // not axis-aligned
      const nd = dirIndex({ x: Math.sign(dx), y: Math.sign(dy) });
      if (nd === ((d + 2) % 4)) { ok = false; break; } // reversal
      const horizontal = dy === 0 || Math.abs(dy) < 1e-6;
      const dev = horizontal ? Math.abs(a.y - midY) : Math.abs(a.x - midX);
      cost += (Math.abs(dx) + Math.abs(dy)) * (1 + MID_BIAS * dev) + (nd !== d ? BEND_COST : 0);
      for (const r of blockers) {
        if (segmentHitsInterior(a, b, r, EPS)) { ok = false; break; }
      }
      d = nd;
    }
    if (!ok || d === tdI) continue;
    if (d !== finalDir) cost += BEND_COST;
    if (cost >= bestCost - 1e-9) continue;
    const pts = normalizePoints([sourcePos, ...raw, targetPos]);
    // More than two bends: a detour along an obstacle edge may be cheaper, so let the search decide
    if (pts.length - 2 > MAX_TRIVIAL_BENDS) continue;
    if (!validateRoute(pts, sourceBounds, targetBounds, sourcePort, targetPort).valid) continue;
    best = pts;
    bestCost = cost;
  }
  return best;
}

const MAX_TRIVIAL_BENDS = 2;
const ROUTE_CACHE_MAX = 4000;
const routeCache = new Map();

const rectKey = r => (r ? `${+r.x.toFixed(2)},${+r.y.toFixed(2)},${+r.width.toFixed(2)},${+r.height.toFixed(2)}` : '-');

/** Drop all cached routes (tests / memory pressure). */
export function clearRouteCache() {
  routeCache.clear();
}

/**
 * Route between two ports orthogonally.
 * @param {{x:number,y:number}} sourcePos port position on the source
 * @param {{x:number,y:number}} targetPos port position on the target
 * @param {string} sourcePort 'top'|'right'|'bottom'|'left'
 * @param {string} targetPort
 * @param {{x,y,width,height}|null} sourceBounds
 * @param {{x,y,width,height}|null} targetBounds
 * @param {{ obstacles?: Array, stub?: number, skipTrivial?: boolean, noCache?: boolean }} [options]
 * @returns {{x:number,y:number}[]|null} points including source and target, or null
 */
export function routeOrthogonal(sourcePos, targetPos, sourcePort, targetPort, sourceBounds, targetBounds, options = {}) {
  const sd = portDir(sourcePort);
  const td = portDir(targetPort);
  if (!sd || !td) return null;
  const stub = options.stub ?? DEFAULT_STUB;
  const obstacles = options.obstacles || [];

  // Only consider obstacles near the corridor to keep the grid small
  const nearby = rectsHitBox(obstacles, {
    minX: Math.min(sourcePos.x, targetPos.x) - 150,
    maxX: Math.max(sourcePos.x, targetPos.x) + 150,
    minY: Math.min(sourcePos.y, targetPos.y) - 150,
    maxY: Math.max(sourcePos.y, targetPos.y) + 150,
  });

  // Routes depend only on these inputs, so identical re-renders are free
  let cacheKey = null;
  if (!options.noCache) {
    cacheKey = [
      +sourcePos.x.toFixed(2), +sourcePos.y.toFixed(2), +targetPos.x.toFixed(2), +targetPos.y.toFixed(2),
      sourcePort, targetPort, stub, options.skipTrivial ? 1 : 0, rectKey(sourceBounds), rectKey(targetBounds),
      nearby.map(rectKey).join(';'),
    ].join('|');
    const hit = routeCache.get(cacheKey);
    if (hit !== undefined) {
      routeCache.delete(cacheKey); // refresh LRU position
      routeCache.set(cacheKey, hit);
      return hit && hit.map(pt => ({ x: pt.x, y: pt.y }));
    }
  }
  const result = computeRoute(sourcePos, targetPos, sourcePort, targetPort, sd, td, sourceBounds, targetBounds, nearby, stub, options);
  if (cacheKey !== null) {
    routeCache.set(cacheKey, result);
    if (routeCache.size > ROUTE_CACHE_MAX) routeCache.delete(routeCache.keys().next().value);
  }
  return result && result.map(pt => ({ x: pt.x, y: pt.y }));
}

function computeRoute(sourcePos, targetPos, sourcePort, targetPort, sd, td, sourceBounds, targetBounds, nearby, stub, options) {
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

  const attempts = [];
  if (nearby.length) {
    attempts.push({ pad: 15, obs: nearby, obsPad: 8 });
  }
  attempts.push({ pad: 15, obs: [], obsPad: 0 });
  attempts.push({ pad: 5, obs: [], obsPad: 0 });
  attempts.push({ pad: 0, obs: [], obsPad: 0 });

  const buildBlockers = (att, obs) => {
    const blockers = [];
    if (sourceBounds) blockers.push(expand(sourceBounds, att.pad));
    if (targetBounds) blockers.push(expand(targetBounds, att.pad));
    for (const o of obs) blockers.push(expand(o, att.obsPad));
    return blockers;
  };
  const inOwn = (blockers) => blockers.some(r => strictInside(exit.x, exit.y, r) || strictInside(entry.x, entry.y, r));

  // Corridor between the stub end points: any trivial route stays inside it, so
  // only obstacles touching the corridor can block one.
  const corridor = {
    minX: Math.min(exit.x, entry.x), maxX: Math.max(exit.x, entry.x),
    minY: Math.min(exit.y, entry.y), maxY: Math.max(exit.y, entry.y),
  };
  // Search area: everything the route could reasonably wrap around
  const area = { ...corridor };
  for (const b of [sourceBounds, targetBounds]) {
    if (!b) continue;
    area.minX = Math.min(area.minX, b.x); area.maxX = Math.max(area.maxX, b.x + b.width);
    area.minY = Math.min(area.minY, b.y); area.maxY = Math.max(area.maxY, b.y + b.height);
  }
  const AREA_MARGIN = 60;
  const areaBox = { minX: area.minX - AREA_MARGIN, maxX: area.maxX + AREA_MARGIN, minY: area.minY - AREA_MARGIN, maxY: area.maxY + AREA_MARGIN };

  for (const att of attempts) {
    const allBlockers = buildBlockers(att, att.obs);
    if (!options.skipTrivial && !inOwn(allBlockers)) {
      const local = buildBlockers(att, rectsHitBox(att.obs, corridor));
      const triv = trivialRoute(sourcePos, targetPos, exit, entry, sd, td, sourcePort, targetPort, sourceBounds, targetBounds, local);
      if (triv) return triv;
    }
    const attempt = (obs, verifyAgainst) => {
      const blockers = buildBlockers(att, obs);
      const grid = search(exit, entry, sd, td, blockers, [sourcePos.x, targetPos.x], [sourcePos.y, targetPos.y]);
      if (!grid) return null;
      const pts = normalizePoints([sourcePos, ...grid, targetPos]);
      if (!validateRoute(pts, sourceBounds, targetBounds, sourcePort, targetPort).valid) return null;
      // A route found among pruned obstacles must still clear the ones left out
      if (verifyAgainst && !pathClearOf(pts.slice(1, -1), verifyAgainst, att.obsPad)) return null;
      return pts;
    };
    if (att.obs.length > 4) {
      const pruned = rectsHitBox(att.obs, areaBox);
      if (pruned.length < att.obs.length) {
        const rest = att.obs.filter(o => !pruned.includes(o));
        const pts = attempt(pruned, rest);
        if (pts) return pts;
      }
    }
    const pts = attempt(att.obs, null);
    if (pts) return pts;
  }
  return null;
}
