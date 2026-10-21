// lib/layout/structureLayout.js
// Pure, deterministic layouts for a structure of nodes (with sizes), edges and groups (docs/architecture/investigations/
// ai-canvas-via-mcp.md 4.1 "map_structure"). No I/O, no randomness: the same input gives the same output.
// Every function works in local coordinates (top-left origin at 0,0); the caller translates the block into free space.
// Boxes of different nodes never overlap (verified by tests, including random structures).
//
// Layouts: tree (top-down), mindmap (balanced left/right), radial (rings around a root), flow (left-to-right layers,
// cycles tolerated: back edges are ignored for layering), grid, cluster (groups packed as frames, members gridded).
// With groups, every group is laid out on its own (cluster: grid, others: the chosen layout) and the groups are packed
// as frames; ungrouped nodes form a frameless block of their own.

export const LAYOUTS = Object.freeze(['tree', 'radial', 'mindmap', 'cluster', 'flow', 'grid']);
export const GRID = 20;
export const NODE_GAP = 40;
export const LAYER_GAP = 80;
export const FRAME_PAD = 40;
export const FRAME_TITLE = 60;
export const FRAME_GAP = 80;
const MIN_FRAME = { w: 240, h: 140 };

const snapUp = (v) => Math.ceil(v / GRID) * GRID;
const snapPoint = (p) => ({ x: Math.round(p.x / GRID) * GRID, y: Math.round(p.y / GRID) * GRID });

function gridLayout(items) {
  const n = items.length;
  if (!n) return { pos: new Map(), w: 0, h: 0 };
  const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
  const rows = Math.ceil(n / cols);
  const colW = Array(cols).fill(0);
  const rowH = Array(rows).fill(0);
  items.forEach((it, i) => {
    colW[i % cols] = Math.max(colW[i % cols], it.w);
    rowH[Math.floor(i / cols)] = Math.max(rowH[Math.floor(i / cols)], it.h);
  });
  const colX = [];
  let x = 0;
  colW.forEach((w, c) => {
    colX[c] = x;
    x += w + NODE_GAP;
  });
  const rowY = [];
  let y = 0;
  rowH.forEach((h, r) => {
    rowY[r] = y;
    y += h + NODE_GAP;
  });
  const pos = new Map();
  items.forEach((it, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    pos.set(it.key, { x: colX[c] + (colW[c] - it.w) / 2, y: rowY[r] + (rowH[r] - it.h) / 2 });
  });
  return { pos, w: x - NODE_GAP, h: y - NODE_GAP };
}

/** Directed adjacency among `items` (self loops and duplicates dropped). */
function adjacency(items, edges) {
  const keys = new Set(items.map((i) => i.key));
  const out = new Map(items.map((i) => [i.key, []]));
  const indeg = new Map(items.map((i) => [i.key, 0]));
  const seen = new Set();
  for (const e of edges) {
    if (!keys.has(e.from) || !keys.has(e.to) || e.from === e.to) continue;
    const k = `${e.from}\u0000${e.to}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.get(e.from).push(e.to);
    indeg.set(e.to, indeg.get(e.to) + 1);
  }
  return { out, indeg };
}

/** BFS spanning forest: roots are nodes without incoming edges (input order); leftovers (cycles) become roots. */
function spanningForest(items, edges) {
  const { out, indeg } = adjacency(items, edges);
  const children = new Map(items.map((i) => [i.key, []]));
  const visited = new Set();
  const roots = [];
  const bfs = (start) => {
    roots.push(start);
    visited.add(start);
    const queue = [start];
    for (let q = 0; q < queue.length; q++) {
      for (const next of out.get(queue[q])) {
        if (visited.has(next)) continue;
        visited.add(next);
        children.get(queue[q]).push(next);
        queue.push(next);
      }
    }
  };
  for (const it of items) if (indeg.get(it.key) === 0 && !visited.has(it.key)) bfs(it.key);
  for (const it of items) if (!visited.has(it.key)) bfs(it.key);
  return { roots, children };
}

/** Tidy-ish tree: `horizontal` false = top-down (depth on y), true = left-to-right (depth on x). */
function layoutForest({ roots, children, size, horizontal }) {
  const cross = (k) => (horizontal ? size.get(k).h : size.get(k).w);
  const main = (k) => (horizontal ? size.get(k).w : size.get(k).h);
  const order = []; // pre-order with depth
  const stack = roots.slice().reverse().map((k) => [k, 0]);
  while (stack.length) {
    const [k, d] = stack.pop();
    order.push([k, d]);
    const kids = children.get(k);
    for (let i = kids.length - 1; i >= 0; i--) stack.push([kids[i], d + 1]);
  }
  const childTotal = (k, span) => {
    const kids = children.get(k);
    return kids.reduce((s, c) => s + span.get(c), 0) + Math.max(0, kids.length - 1) * NODE_GAP;
  };
  const span = new Map();
  for (let i = order.length - 1; i >= 0; i--) {
    const k = order[i][0];
    span.set(k, Math.max(cross(k), childTotal(k, span)));
  }
  const levelMain = [];
  for (const [k, d] of order) levelMain[d] = Math.max(levelMain[d] || 0, main(k));
  const levelPos = [];
  let acc = 0;
  levelMain.forEach((m, d) => {
    levelPos[d] = acc;
    acc += m + LAYER_GAP;
  });
  const start = new Map();
  let cursor = 0;
  for (const r of roots) {
    start.set(r, cursor);
    cursor += span.get(r) + NODE_GAP * 2;
  }
  const pos = new Map();
  for (const [k, d] of order) {
    const s = start.get(k);
    const mid = s + span.get(k) / 2;
    const m = levelPos[d] + (levelMain[d] - main(k)) / 2;
    pos.set(k, horizontal ? { x: m, y: mid - cross(k) / 2 } : { x: mid - cross(k) / 2, y: m });
    let c0 = s + (span.get(k) - childTotal(k, span)) / 2;
    for (const c of children.get(k)) {
      start.set(c, c0);
      c0 += span.get(c) + NODE_GAP;
    }
  }
  const extent = Math.max(0, cursor - NODE_GAP * 2);
  const depth = Math.max(0, acc - LAYER_GAP);
  return { pos, w: horizontal ? depth : extent, h: horizontal ? extent : depth };
}

function treeLayout(items, edges) {
  if (!items.length) return { pos: new Map(), w: 0, h: 0 };
  const size = new Map(items.map((i) => [i.key, i]));
  const { roots, children } = spanningForest(items, edges);
  return layoutForest({ roots, children, size, horizontal: false });
}

/** Root = the first node without incoming edges; the other roots hang off it (layout only, no edge is invented). */
function rootedTree(items, edges) {
  const { roots, children } = spanningForest(items, edges);
  const root = roots[0];
  for (const r of roots.slice(1)) children.get(root).push(r);
  return { root, children };
}

function leafCounts(root, children) {
  const pre = [];
  const stack = [root];
  while (stack.length) {
    const k = stack.pop();
    pre.push(k);
    for (const c of children.get(k)) stack.push(c);
  }
  const leaves = new Map();
  for (let i = pre.length - 1; i >= 0; i--) {
    const kids = children.get(pre[i]);
    leaves.set(pre[i], kids.length ? kids.reduce((s, c) => s + leaves.get(c), 0) : 1);
  }
  return leaves;
}

function mindmapLayout(items, edges) {
  if (!items.length) return { pos: new Map(), w: 0, h: 0 };
  const size = new Map(items.map((i) => [i.key, i]));
  const { root, children } = rootedTree(items, edges);
  const leaves = leafCounts(root, children);
  const sides = { right: [], left: [] };
  const weight = { right: 0, left: 0 };
  for (const c of children.get(root)) {
    const side = weight.right <= weight.left ? 'right' : 'left';
    sides[side].push(c);
    weight[side] += leaves.get(c);
  }
  const rs = size.get(root);
  const laid = {};
  for (const side of ['right', 'left']) {
    laid[side] = sides[side].length ? layoutForest({ roots: sides[side], children, size, horizontal: true }) : null;
  }
  const pos = new Map();
  const leftW = laid.left ? laid.left.w + LAYER_GAP : 0;
  const rightW = laid.right ? laid.right.w + LAYER_GAP : 0;
  const maxH = Math.max(rs.h, laid.left?.h || 0, laid.right?.h || 0);
  pos.set(root, { x: leftW, y: (maxH - rs.h) / 2 });
  if (laid.right) {
    const oy = (maxH - laid.right.h) / 2;
    for (const [k, p] of laid.right.pos) pos.set(k, { x: leftW + rs.w + LAYER_GAP + p.x, y: oy + p.y });
  }
  if (laid.left) {
    const oy = (maxH - laid.left.h) / 2;
    for (const [k, p] of laid.left.pos) pos.set(k, { x: laid.left.w - p.x - size.get(k).w, y: oy + p.y });
  }
  return { pos, w: leftW + rs.w + rightW, h: maxH };
}

function radialLayout(items, edges) {
  if (!items.length) return { pos: new Map(), w: 0, h: 0 };
  const size = new Map(items.map((i) => [i.key, i]));
  const { root, children } = rootedTree(items, edges);
  const diag = (k) => Math.hypot(size.get(k).w, size.get(k).h);
  const leaves = leafCounts(root, children);
  const depth = new Map([[root, 0]]);
  const sector = new Map([[root, [-Math.PI / 2, (3 * Math.PI) / 2]]]);
  const pre = [];
  const stack = [root];
  while (stack.length) {
    const k = stack.pop();
    pre.push(k);
    const [a0, a1] = sector.get(k);
    const kids = children.get(k);
    let a = a0;
    for (const c of kids) {
      const sweep = ((a1 - a0) * leaves.get(c)) / leaves.get(k);
      sector.set(c, [a, a + sweep]);
      depth.set(c, depth.get(k) + 1);
      a += sweep;
    }
    for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);
  }
  const maxDepth = Math.max(...depth.values());
  const radius = [0];
  const ringDiag = [diag(root)];
  for (let d = 1; d <= maxDepth; d++) {
    const ring = pre.filter((k) => depth.get(k) === d);
    ringDiag[d] = Math.max(...ring.map(diag));
    // Ring distance, and a radius where every node's angular sector offers enough arc (the pi/2 turns arc into chord).
    let r = radius[d - 1] + (ringDiag[d - 1] + ringDiag[d]) / 2 + NODE_GAP * 2;
    for (const k of ring) {
      const [a0, a1] = sector.get(k);
      r = Math.max(r, ((Math.PI / 2) * (diag(k) + NODE_GAP)) / (a1 - a0));
    }
    radius[d] = r;
  }
  const centers = new Map();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const k of pre) {
    const [a0, a1] = sector.get(k);
    const a = (a0 + a1) / 2;
    const r = radius[depth.get(k)];
    const c = { x: r * Math.cos(a), y: r * Math.sin(a) };
    centers.set(k, c);
    const s = size.get(k);
    minX = Math.min(minX, c.x - s.w / 2);
    minY = Math.min(minY, c.y - s.h / 2);
    maxX = Math.max(maxX, c.x + s.w / 2);
    maxY = Math.max(maxY, c.y + s.h / 2);
  }
  const pos = new Map();
  for (const [k, c] of centers) pos.set(k, { x: c.x - size.get(k).w / 2 - minX, y: c.y - size.get(k).h / 2 - minY });
  return { pos, w: maxX - minX, h: maxY - minY };
}

function flowLayout(items, edges) {
  if (!items.length) return { pos: new Map(), w: 0, h: 0 };
  const { out, indeg } = adjacency(items, edges);
  const index = new Map(items.map((it, i) => [it.key, i]));
  // DFS from the sources (input order); an edge into a node on the stack is a back edge and ignored for layering.
  const state = new Map(); // 1 = on stack, 2 = done
  const forward = new Map(items.map((i) => [i.key, []]));
  const finish = [];
  const dfs = (start) => {
    const stack = [[start, 0]];
    state.set(start, 1);
    while (stack.length) {
      const top = stack[stack.length - 1];
      const k = top[0];
      const next = out.get(k)[top[1]];
      if (next === undefined) {
        state.set(k, 2);
        finish.push(k);
        stack.pop();
        continue;
      }
      top[1] += 1;
      if (state.get(next) === 1) continue;
      forward.get(k).push(next);
      if (state.get(next) === 2) continue;
      state.set(next, 1);
      stack.push([next, 0]);
    }
  };
  for (const it of items) if (indeg.get(it.key) === 0 && !state.has(it.key)) dfs(it.key);
  for (const it of items) if (!state.has(it.key)) dfs(it.key);
  const layer = new Map(items.map((i) => [i.key, 0]));
  for (let i = finish.length - 1; i >= 0; i--) {
    const k = finish[i];
    for (const n of forward.get(k)) layer.set(n, Math.max(layer.get(n), layer.get(k) + 1));
  }
  const preds = new Map(items.map((i) => [i.key, []]));
  for (const [k, list] of forward) for (const n of list) preds.get(n).push(k);
  const maxLayer = Math.max(...layer.values());
  const layers = Array.from({ length: maxLayer + 1 }, () => []);
  for (const it of items) layers[layer.get(it.key)].push(it.key);
  const rank = new Map();
  const reRank = () => layers.forEach((ks) => ks.forEach((k, i) => rank.set(k, i)));
  reRank();
  const reorder = (l, nb) => {
    const bary = (k) => (nb.get(k).length ? nb.get(k).reduce((s, x) => s + rank.get(x), 0) / nb.get(k).length : rank.get(k));
    layers[l] = layers[l].map((k) => [k, bary(k)]).sort((a, b) => a[1] - b[1] || index.get(a[0]) - index.get(b[0])).map((x) => x[0]);
    reRank();
  };
  for (let sweep = 0; sweep < 2; sweep++) {
    for (let l = 1; l <= maxLayer; l++) reorder(l, preds);
    for (let l = maxLayer - 1; l >= 0; l--) reorder(l, forward);
  }
  const size = new Map(items.map((i) => [i.key, i]));
  const colW = layers.map((ks) => Math.max(...ks.map((k) => size.get(k).w), 0));
  const colH = layers.map((ks) => ks.reduce((s, k) => s + size.get(k).h, 0) + Math.max(0, ks.length - 1) * NODE_GAP);
  const totalH = Math.max(...colH);
  const pos = new Map();
  let x = 0;
  layers.forEach((ks, l) => {
    let y = (totalH - colH[l]) / 2;
    for (const k of ks) {
      pos.set(k, { x: x + (colW[l] - size.get(k).w) / 2, y });
      y += size.get(k).h + NODE_GAP;
    }
    x += colW[l] + LAYER_GAP;
  });
  return { pos, w: x - LAYER_GAP, h: totalH };
}

/** Depth of every node below the layout root (the first node without incoming edges); other roots count as depth 1. */
export function structureDepths(items, edges) {
  const depth = new Map();
  if (!items.length) return depth;
  const { root, children } = rootedTree(items, edges);
  depth.set(root, 0);
  const queue = [root];
  for (let q = 0; q < queue.length; q++) {
    for (const c of children.get(queue[q])) {
      depth.set(c, depth.get(queue[q]) + 1);
      queue.push(c);
    }
  }
  return depth;
}

const INNER = { tree: treeLayout, mindmap: mindmapLayout, radial: radialLayout, flow: flowLayout, grid: gridLayout, cluster: gridLayout };

/** Shelf packing of blocks {key,w,h} in input order, wrapping at about a 4:3 target width. */
function pack(blocks) {
  if (!blocks.length) return { pos: new Map(), w: 0, h: 0 };
  const area = blocks.reduce((s, b) => s + (b.w + FRAME_GAP) * (b.h + FRAME_GAP), 0);
  const target = Math.max(Math.max(...blocks.map((b) => b.w)), Math.sqrt(area) * 1.15);
  const pos = new Map();
  let x = 0;
  let y = 0;
  let rowH = 0;
  let maxW = 0;
  for (const b of blocks) {
    if (x > 0 && x + b.w > target) {
      x = 0;
      y += rowH + FRAME_GAP;
      rowH = 0;
    }
    pos.set(b.key, { x, y });
    x += b.w + FRAME_GAP;
    rowH = Math.max(rowH, b.h);
    maxW = Math.max(maxW, x - FRAME_GAP);
  }
  return { pos, w: maxW, h: y + rowH };
}

/**
 * @param {{nodes: {key: string, w: number, h: number, group?: string}[], edges: {from: string, to: string}[],
 *          groups?: {key: string}[], layout: string}} input
 * @returns {{nodes: Map<string,{x:number,y:number}>, frames: Map<string,{x:number,y:number,w:number,h:number}>,
 *            width: number, height: number}} grid-snapped, relative to a (0,0) origin
 */
export function layoutStructure({ nodes, edges, groups = [], layout }) {
  const inner = INNER[layout];
  if (!LAYOUTS.includes(layout) || !inner) throw new Error(`Unknown layout "${layout}"`);
  const outNodes = new Map();
  const frames = new Map();
  if (groups.length === 0) {
    const r = inner(nodes, edges);
    for (const [k, p] of r.pos) outNodes.set(k, snapPoint(p));
    return { nodes: outNodes, frames, width: r.w, height: r.h };
  }
  const members = (g) => nodes.filter((n) => n.group === g);
  const blocks = [];
  const inners = new Map();
  for (const g of groups) {
    const r = inner(members(g.key), edges);
    inners.set(g.key, r);
    blocks.push({
      key: `g:${g.key}`,
      w: Math.max(MIN_FRAME.w, snapUp(r.w + 2 * FRAME_PAD)),
      h: Math.max(MIN_FRAME.h, snapUp(r.h + FRAME_PAD + FRAME_TITLE)),
    });
  }
  const loose = nodes.filter((n) => !n.group);
  if (loose.length) {
    const r = inner(loose, edges);
    inners.set('', r);
    blocks.push({ key: 'loose', w: snapUp(r.w), h: snapUp(r.h) });
  }
  const packed = pack(blocks);
  const place = (list, r, ox, oy) => {
    for (const n of list) {
      const p = r.pos.get(n.key);
      outNodes.set(n.key, snapPoint({ x: ox + p.x, y: oy + p.y }));
    }
  };
  groups.forEach((g, i) => {
    const b = blocks[i];
    const o = snapPoint(packed.pos.get(b.key));
    frames.set(g.key, { x: o.x, y: o.y, w: b.w, h: b.h });
    const r = inners.get(g.key);
    // content block centered in the frame's content area (below the title)
    place(members(g.key), r, o.x + FRAME_PAD + (b.w - 2 * FRAME_PAD - r.w) / 2, o.y + FRAME_TITLE + (b.h - FRAME_TITLE - FRAME_PAD - r.h) / 2);
  });
  if (loose.length) {
    const o = packed.pos.get('loose');
    place(loose, inners.get(''), o.x, o.y);
  }
  return { nodes: outNodes, frames, width: packed.w, height: packed.h };
}
