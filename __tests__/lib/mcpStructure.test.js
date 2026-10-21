/**
 * @jest-environment node
 */
import { compileMapStructure, compileLayoutApply, MAX_NODES, MAX_EDGES, MAX_GROUPS } from '../../lib/mcp/structure';

let seq = 0;
const newId = (p) => `${p}-t${++seq}`;
const counter = (tag) => { let n = 0; return (p) => `${p}-${tag}${++n}`; };
const el = (id, x, y, over = {}) => ({ id, type: 'task', packId: 'process-flow', label: id, x, y, size: { width: 120, height: 80 }, layerId: 'default', properties: {}, ...over });
const FRAME = (id, x, y, w, h, over = {}) => ({ id, type: 'frame', packId: 'core', isFrame: true, membershipExplicit: true, label: id, x, y, size: { width: w, height: h }, layerId: 'default', properties: {}, ...over });
const base = (elements = [], connections = []) => ({ elements, connections, layers: [], viewport: { x: 0, y: 0, zoom: 1 } });
const run = (content, input) => compileMapStructure(content, input, { newId });
const box = (e) => ({ x: e.x, y: e.y, w: e.size?.width ?? 120, h: e.size?.height ?? 80 });
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const msgs = (r) => r.errors.map((e) => e.message).join(' | ');

const hub = (n = 8) => ({
  nodes: [{ key: 'hub', label: 'Topic' }, ...Array.from({ length: n }, (_, i) => ({ key: `c${i}`, label: `Branch ${i}` }))],
  edges: Array.from({ length: n }, (_, i) => ({ from: 'hub', to: `c${i}` })),
});

describe('validation', () => {
  const bad = (structure, layout = 'tree', extra = {}) => run(base(), { structure, layout, ...extra });
  test('duplicate node keys, unknown group, unknown edge ends, self loops, bad keys', () => {
    const r = bad({ nodes: [{ key: 'a' }, { key: 'a' }, { key: 'b', group: 'nope' }, { key: 'bad key!' }], edges: [{ from: 'a', to: 'zzz' }, { from: 'a', to: 'a' }] });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('INVALID_STRUCTURE');
    const m = msgs(r);
    expect(m).toMatch(/duplicate node key "a"/);
    expect(m).toMatch(/unknown group "nope"/);
    expect(m).toMatch(/to "zzz" is not a node key/);
    expect(m).toMatch(/from and to must differ/);
    expect(m).toMatch(/key must be 1-38/);
  });
  test('duplicate group keys, missing group label, unknown fields', () => {
    const r = bad({ nodes: [{ key: 'a', colour: 'red' }], groups: [{ key: 'g' }, { key: 'g', label: 'x' }], extra: 1 });
    const m = msgs(r);
    expect(m).toMatch(/duplicate group key/);
    expect(m).toMatch(/label is required/);
    expect(m).toMatch(/unknown field "colour"/);
    expect(m).toMatch(/Unknown field "extra" in structure/);
  });
  test('caps: nodes, edges, groups', () => {
    const nodes = (n) => Array.from({ length: n }, (_, i) => ({ key: `n${i}` }));
    expect(msgs(bad({ nodes: nodes(MAX_NODES + 1) }))).toMatch(/Too many nodes/);
    expect(msgs(bad({ nodes: nodes(3), edges: Array.from({ length: MAX_EDGES + 1 }, () => ({ from: 'n0', to: 'n1' })) }))).toMatch(/Too many edges/);
    expect(msgs(bad({ nodes: nodes(3), groups: Array.from({ length: MAX_GROUPS + 1 }, (_, i) => ({ key: `g${i}`, label: 'g' })) }))).toMatch(/Too many groups/);
    expect(run(base(), { structure: { nodes: nodes(MAX_NODES) }, layout: 'grid' }).ok).toBe(true);
  });
  test('unknown stencil gets suggestions; unknown layout; empty nodes', () => {
    expect(msgs(bad({ nodes: [{ key: 'a', stencil: 'core/rectangel' }] }))).toMatch(/unknown stencil "core\/rectangel". Closest: .*core\/rectangle/);
    expect(msgs(bad({ nodes: [{ key: 'a' }] }, 'spiral'))).toMatch(/layout must be one of/);
    expect(msgs(bad({ nodes: [] }))).toMatch(/at least one node/);
  });
  test('cycles are allowed in every layout; duplicate edges are dropped with a warning', () => {
    const structure = { nodes: [{ key: 'a' }, { key: 'b' }, { key: 'c' }], edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'a' }, { from: 'a', to: 'b' }] };
    for (const layout of ['tree', 'radial', 'mindmap', 'cluster', 'flow', 'grid']) {
      const r = bad(structure, layout);
      expect(r.ok).toBe(true);
      expect(r.content.connections).toHaveLength(3);
      expect(r.warnings.join(' ')).toMatch(/duplicate edge/);
    }
  });
  test('existingId: must exist, not a frame, not twice, no stencil/data with it', () => {
    const c = base([el('e1', 0, 0), FRAME('f1', 500, 0, 300, 300)]);
    const r = run(c, { layout: 'grid', structure: { nodes: [{ key: 'a', existingId: 'nope' }, { key: 'b', existingId: 'f1' }, { key: 'c', existingId: 'e1' }, { key: 'd', existingId: 'e1', stencil: 'core/rectangle' }] } });
    const m = msgs(r);
    expect(m).toMatch(/existingId "nope" is not an element/);
    expect(m).toMatch(/is a frame; use layout_apply/);
    expect(m).toMatch(/used twice/);
    expect(m).toMatch(/stencil cannot be set together with existingId/);
  });
  test('anchor must name exactly one valid target', () => {
    const c = base([el('e1', 0, 0), FRAME('f1', 500, 0, 600, 400)]);
    const s = { nodes: [{ key: 'a' }] };
    expect(msgs(run(c, { structure: s, layout: 'grid', anchor: { near: 'e1', at: { x: 1, y: 1 } } }))).toMatch(/exactly one/);
    expect(msgs(run(c, { structure: s, layout: 'grid', anchor: { near: 'zz' } }))).toMatch(/does not exist/);
    expect(msgs(run(c, { structure: s, layout: 'grid', anchor: { inFrame: 'e1' } }))).toMatch(/not a frame/);
    expect(msgs(run(c, { structure: s, layout: 'grid', anchor: { at: { x: 'a', y: 1 } } }))).toMatch(/anchor.at/);
  });
});

describe('compile to ops and apply (the M2 applier)', () => {
  test('mind map: 1 hub + 8 nodes, mind-map stencils, curved connectors, created ids by key, nothing else touched', () => {
    const c = base([el('old', 100, 100)]);
    const r = run(c, { structure: hub(8), layout: 'mindmap' });
    expect(r.ok).toBe(true);
    expect(Object.keys(r.created)).toHaveLength(9);
    const byId = new Map(r.content.elements.map((e) => [e.id, e]));
    expect(byId.get(r.created.hub)).toMatchObject({ packId: 'mind-map', type: 'central-topic', label: 'Topic' });
    expect(byId.get(r.created.c0)).toMatchObject({ type: 'main-topic' });
    expect(r.content.connections).toHaveLength(8);
    expect(r.content.connections.every((k) => k.lineStyle === 'curved')).toBe(true);
    expect(byId.get('old')).toEqual(c.elements[0]); // untouched
    expect(r.summary).toMatchObject({ layout: 'mindmap', nodes: 9, edges: 8, frames: 0, placement: 'right-of-content' });
    expect(r.counts.addedElements).toBe(9);
  });

  test('new content is placed right of existing content and overlaps nothing', () => {
    const c = base([el('a', 0, 0), el('b', 400, 300), FRAME('f', 0, 600, 500, 300)]);
    for (const layout of ['tree', 'radial', 'mindmap', 'flow', 'grid']) {
      const r = run(c, { structure: hub(8), layout });
      const fresh = r.content.elements.filter((e) => Object.values(r.created).includes(e.id));
      for (const f of fresh) for (const o of c.elements) expect(overlap(box(f), box(o))).toBe(false);
      for (let i = 0; i < fresh.length; i++) for (let j = i + 1; j < fresh.length; j++) expect(overlap(box(fresh[i]), box(fresh[j]))).toBe(false);
      expect(Math.min(...fresh.map((f) => f.x))).toBeGreaterThanOrEqual(500);
    }
  });

  test('cluster: groups become frames with explicit membership, members inside, nothing overlaps, existing frames kept clear', () => {
    const items = Array.from({ length: 12 }, (_, i) => ({ key: `i${i}`, label: `Note ${i}`, group: `g${i % 3}` }));
    const c = base([el('old', 0, 0)]);
    const r = run(c, { structure: { nodes: items, groups: [{ key: 'g0', label: 'Pain' }, { key: 'g1', label: 'Gain' }, { key: 'g2', label: 'Ideas' }] }, layout: 'cluster' });
    expect(r.ok).toBe(true);
    const byId = new Map(r.content.elements.map((e) => [e.id, e]));
    const frames = ['g0', 'g1', 'g2'].map((g) => byId.get(r.groups[g]));
    frames.forEach((f, i) => expect(f).toMatchObject({ type: 'frame', label: ['Pain', 'Gain', 'Ideas'][i], membershipExplicit: true }));
    for (const it of items) {
      const e = byId.get(r.created[it.key]);
      expect(e).toMatchObject({ packId: 'sticky-notes', type: 'sticky-medium', parentFrameId: r.groups[it.group] });
      const f = byId.get(r.groups[it.group]);
      const [b, fb] = [box(e), box(f)];
      expect(b.x).toBeGreaterThanOrEqual(fb.x);
      expect(b.y).toBeGreaterThanOrEqual(fb.y);
      expect(b.x + b.w).toBeLessThanOrEqual(fb.x + fb.w);
      expect(b.y + b.h).toBeLessThanOrEqual(fb.y + fb.h);
    }
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) expect(overlap(box(frames[i]), box(frames[j]))).toBe(false);
    for (const f of frames) expect(overlap(box(f), box(c.elements[0]))).toBe(false);
  });

  test('flow: 6 steps, process-flow tasks, step connectors, left to right', () => {
    const nodes = Array.from({ length: 6 }, (_, i) => ({ key: `s${i}`, label: `Step ${i + 1}` }));
    const edges = nodes.slice(1).map((n, i) => ({ from: `s${i}`, to: n.key, label: i === 0 ? 'go' : undefined })).map((e) => (e.label ? e : { from: e.from, to: e.to }));
    const r = run(base(), { structure: { nodes, edges }, layout: 'flow' });
    const byId = new Map(r.content.elements.map((e) => [e.id, e]));
    const xs = nodes.map((n) => byId.get(r.created[n.key]).x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
    expect(new Set(xs).size).toBe(6);
    expect(byId.get(r.created.s0)).toMatchObject({ packId: 'process-flow', type: 'task' });
    expect(r.content.connections.every((k) => k.lineStyle === 'step')).toBe(true);
    expect(r.content.connections.find((k) => k.label === 'go')).toBeTruthy();
  });

  test('explicit stencil and data are honored', () => {
    const r = run(base(), { structure: { nodes: [{ key: 'a', label: 'X', stencil: 'core/diamond', data: { owner: 'pm', n: 3 } }] }, layout: 'grid' });
    const e = r.content.elements[0];
    expect(e).toMatchObject({ type: 'diamond', packId: 'core', properties: { owner: 'pm', n: 3 } });
  });

  test('anchor.at places there when free, otherwise at the nearest free spot; near goes beside the element', () => {
    const c = base([el('a', 1000, 1000)]);
    const s = { nodes: [{ key: 'n', label: 'N' }] };
    const free = run(c, { structure: s, layout: 'grid', anchor: { at: { x: 200, y: 300 } } });
    expect(free.summary).toMatchObject({ placement: 'exact', bounds: { x: 200, y: 300 } });
    const taken = run(c, { structure: s, layout: 'grid', anchor: { at: { x: 1000, y: 1000 } } });
    expect(taken.summary.placement).toBe('nearby');
    const n = taken.content.elements.find((e) => e.id === taken.created.n);
    expect(overlap(box(n), box(c.elements[0]))).toBe(false);
    const near = run(c, { structure: s, layout: 'grid', anchor: { near: 'a' } });
    const nn = near.content.elements.find((e) => e.id === near.created.n);
    expect(nn.x).toBeGreaterThan(1120);
    expect(Math.abs(nn.y - 1000)).toBeLessThan(200);
  });

  test('anchor.inFrame: nodes become members of the frame, in its free area; a small frame grows to fit', () => {
    const c = base([FRAME('f', 0, 0, 800, 600), el('m', 60, 120, { parentFrameId: 'f' })]);
    const r = run(c, { structure: { nodes: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }], edges: [{ from: 'a', to: 'b' }] }, layout: 'flow', anchor: { inFrame: 'f' } });
    expect(r.ok).toBe(true);
    const fr = r.content.elements.find((e) => e.id === 'f');
    const a = r.content.elements.find((e) => e.id === r.created.a);
    expect(a.parentFrameId).toBe('f');
    expect(overlap(box(a), box(el('m', 60, 120)))).toBe(false);
    expect(a.x).toBeGreaterThanOrEqual(fr.x);
    expect(a.x + 120).toBeLessThanOrEqual(fr.x + fr.size.width);

    const small = base([FRAME('f', 0, 0, 200, 150)]);
    const g = run(small, { structure: hub(4), layout: 'grid', anchor: { inFrame: 'f' } });
    const f2 = g.content.elements.find((e) => e.id === 'f');
    expect(f2.size.width).toBeGreaterThan(200);
    const kids = g.content.elements.filter((e) => e.parentFrameId === 'f');
    expect(kids).toHaveLength(5);
    for (const k of kids) expect(k.x + (k.size.width) <= f2.x + f2.size.width && k.y + k.size.height <= f2.y + f2.size.height).toBe(true);
  });

  test('a frame that has to grow over neighbours says so (nothing is moved)', () => {
    const c = base([FRAME('f', 0, 0, 200, 150), el('neighbour', 40, 400)]);
    const r = run(c, { structure: hub(8), layout: 'grid', anchor: { inFrame: 'f' } });
    expect(r.ok).toBe(true);
    expect(r.warnings.join(' ')).toMatch(/grew to fit and now overlaps 1 other element; nothing was moved/);
    expect(r.content.elements.find((e) => e.id === 'neighbour')).toEqual(c.elements[1]);
    expect(run(base([FRAME('f', 0, 0, 200, 150)]), { structure: hub(8), layout: 'grid', anchor: { inFrame: 'f' } }).warnings).toEqual([]);
  });

  test('existingId rearranges the owner\'s notes into groups without duplicating them; unnamed elements do not move', () => {
    const notes = Array.from({ length: 6 }, (_, i) => el(`s${i}`, (i % 3) * 30, Math.floor(i / 3) * 30, { type: 'sticky-small', packId: 'sticky-notes', size: { width: 100, height: 100 } }));
    const bystander = el('by', 5000, 5000);
    const c = base([...notes, bystander]);
    const r = run(c, {
      layout: 'cluster',
      structure: { nodes: notes.map((n, i) => ({ key: `k${i}`, existingId: n.id, group: i < 3 ? 'a' : 'b' })), groups: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }] },
    });
    expect(r.ok).toBe(true);
    expect(r.content.elements.filter((e) => e.type === 'sticky-small')).toHaveLength(6);
    expect(r.content.elements.find((e) => e.id === 'by')).toEqual(bystander);
    const s0 = r.content.elements.find((e) => e.id === 's0');
    const s5 = r.content.elements.find((e) => e.id === 's5');
    expect(s0.parentFrameId).toBe(r.groups.a);
    expect(s5.parentFrameId).toBe(r.groups.b);
    expect(r.summary).toMatchObject({ nodes: 0, existingMoved: 6, frames: 2 });
    expect(r.counts.addedElements).toBe(2); // the two frames
  });

  test('the input content is never mutated and the result is deterministic', () => {
    const c = base([el('a', 0, 0)]);
    const snapshot = JSON.stringify(c);
    const a = compileMapStructure(c, { structure: hub(5), layout: 'radial' }, { newId: counter('x') });
    expect(JSON.stringify(c)).toBe(snapshot);
    const strip = (r) => r.content.elements.map(({ x, y, size }) => [x, y, size.width]);
    const b = compileMapStructure(c, { structure: hub(5), layout: 'radial' }, { newId: counter('y') });
    expect(strip(a)).toEqual(strip(b));
  });

  test('a node label that the applier rejects fails the whole call with a readable message and no content', () => {
    const r = run(base(), { structure: { nodes: [{ key: 'a', label: 'x'.repeat(501) }] }, layout: 'grid' });
    expect(r.ok).toBe(false);
    expect(msgs(r)).toMatch(/label is too long/);
    expect(r.content).toBeUndefined();
  });
});

describe('layout_apply', () => {
  const messy = () => {
    const kids = Array.from({ length: 9 }, (_, i) => el(`m${i}`, 40 + ((i * 37) % 90), 80 + ((i * 53) % 120), { parentFrameId: 'f', size: { width: 100, height: 60 } }));
    return base([FRAME('f', 0, 0, 400, 300), ...kids, el('out', 2000, 0)]);
  };
  const apply = (c, input) => compileLayoutApply(c, input, { newId });
  const inputs = (id) => ({ target: { frameId: id }, layout: 'grid' });

  test('grid on a messy frame: positions only, no overlaps, all inside the frame (which grows if needed), others untouched', () => {
    const c = messy();
    const r = apply(c, inputs('f'));
    expect(r.ok).toBe(true);
    expect(r.counts.addedElements).toBe(0);
    expect(r.content.elements).toHaveLength(c.elements.length);
    const kids = r.content.elements.filter((e) => e.parentFrameId === 'f');
    for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) expect(overlap(box(kids[i]), box(kids[j]))).toBe(false);
    const f = r.content.elements.find((e) => e.id === 'f');
    for (const k of kids) {
      expect(k.x).toBeGreaterThanOrEqual(f.x);
      expect(k.x + k.size.width).toBeLessThanOrEqual(f.x + f.size.width);
      expect(k.y + k.size.height).toBeLessThanOrEqual(f.y + f.size.height);
      expect(k.parentFrameId).toBe('f');
      expect(k.size).toEqual({ width: 100, height: 60 });
      expect(k.label).toBe(c.elements.find((o) => o.id === k.id).label);
    }
    expect(r.content.elements.find((e) => e.id === 'out')).toEqual(c.elements.find((e) => e.id === 'out'));
    expect(r.summary).toMatchObject({ layout: 'grid', moved: 9, placement: 'in-frame' });
  });

  test('is idempotent: laying out an already laid out frame reports nothing to change', () => {
    const once = apply(messy(), inputs('f'));
    const twice = apply(once.content, inputs('f'));
    expect(twice.ok).toBe(false);
    expect(msgs(twice)).toMatch(/Nothing to change/);
  });

  test('elementIds: arranged where they are (or beside content when blocked), connections drive tree layouts', () => {
    const c = base(
      [el('a', 0, 0), el('b', 700, 400), el('c', 100, 900), el('x', 150, 20)],
      [{ id: 'k1', sourceId: 'a', targetId: 'b' }, { id: 'k2', sourceId: 'a', targetId: 'c' }]
    );
    const r = apply(c, { target: { elementIds: ['a', 'b', 'c'] }, layout: 'tree' });
    expect(r.ok).toBe(true);
    const g = (id) => r.content.elements.find((e) => e.id === id);
    expect(g('b').y).toBeGreaterThan(g('a').y);
    expect(g('c').y).toBe(g('b').y);
    expect(g('x')).toEqual(c.elements[3]); // not selected: not moved
    for (const id of ['a', 'b', 'c']) expect(overlap(box(g(id)), box(g('x')))).toBe(false);
  });

  test('a frame in the selection moves rigidly with everything inside it', () => {
    const c = base([FRAME('f', 0, 0, 300, 300), el('in', 50, 100, { parentFrameId: 'f' }), el('solo', 900, 900)]);
    const r = apply(c, { target: { elementIds: ['f', 'solo'] }, layout: 'grid' });
    expect(r.ok).toBe(true);
    const g = (id) => r.content.elements.find((e) => e.id === id);
    expect(g('in').x - g('f').x).toBe(50);
    expect(g('in').y - g('f').y).toBe(100);
    expect(g('f').size).toEqual({ width: 300, height: 300 });
  });

  test('validation: exactly one target, known ids, frame must be a frame, anchor rules, layout name', () => {
    const c = messy();
    expect(msgs(apply(c, { target: {}, layout: 'grid' }))).toMatch(/exactly one of frameId or elementIds/);
    expect(msgs(apply(c, { target: { elementIds: ['zz'] }, layout: 'grid' }))).toMatch(/Unknown element ids/);
    expect(msgs(apply(c, { target: { frameId: 'm0' }, layout: 'grid' }))).toMatch(/not a frame/);
    expect(msgs(apply(c, { target: { frameId: 'f' }, layout: 'grid', anchor: { at: { x: 0, y: 0 } } }))).toMatch(/anchor applies to elementIds/);
    expect(msgs(apply(c, { target: { frameId: 'f' }, layout: 'blob' }))).toMatch(/layout must be one of/);
    expect(msgs(apply(c, { target: { frameId: 'out' }, layout: 'grid' }))).toMatch(/not a frame/);
  });

  test('every layout works on a frame and keeps members inside', () => {
    for (const layout of ['tree', 'radial', 'mindmap', 'cluster', 'flow', 'grid']) {
      const r = apply(messy(), { target: { frameId: 'f' }, layout });
      expect(r.ok).toBe(true);
      const f = r.content.elements.find((e) => e.id === 'f');
      for (const k of r.content.elements.filter((e) => e.parentFrameId === 'f')) {
        expect(k.x >= f.x && k.y >= f.y && k.x + 100 <= f.x + f.size.width && k.y + 60 <= f.y + f.size.height).toBe(true);
      }
    }
  });
});

describe('performance (200 nodes into a ~4700-element diagram, near the 5000 content cap; best of 3)', () => {
  const big = () => {
    const els = Array.from({ length: 4700 }, (_, i) => el(`b${i}`, (i % 100) * 150, Math.floor(i / 100) * 120));
    for (let i = 0; i < 20; i++) els.push(FRAME(`bf${i}`, i * 700, -500, 600, 400));
    return base(els);
  };
  // Warm up the JIT once, then take the best of three runs. The budget has
  // ~15x headroom over a quiet laptop (~60 ms) so a busy machine running
  // parallel jest workers doesn't flake, while an accidental O(n^2) still fails.
  const timeOnce = (fn) => { const t = performance.now(); const r = fn(); if (!r.ok) throw new Error(JSON.stringify(r.errors)); return performance.now() - t; };
  const best = (fn) => { timeOnce(fn); return Math.min(timeOnce(fn), timeOnce(fn), timeOnce(fn)); };
  const structure = () => ({
    nodes: Array.from({ length: 200 }, (_, i) => ({ key: `n${i}`, label: `Node ${i}`, group: `g${i % 5}` })),
    edges: Array.from({ length: 199 }, (_, i) => ({ from: `n${Math.floor(i / 2)}`, to: `n${i + 1}` })),
    groups: Array.from({ length: 5 }, (_, i) => ({ key: `g${i}`, label: `G${i}` })),
  });
  const c = big();
  test.each(['cluster', 'tree', 'radial', 'flow'])('map_structure %s', (layout) => {
    const ms = best(() => compileMapStructure(c, { structure: layout === 'cluster' ? structure() : { ...structure(), groups: undefined, nodes: structure().nodes.map(({ group, ...n }) => n) }, layout }));
    expect(ms).toBeLessThan(1000);
  });
  test('map_structure near an existing element (ring search)', () => {
    const ms = best(() => compileMapStructure(c, { structure: structure(), layout: 'cluster', anchor: { near: 'b50' } }));
    expect(ms).toBeLessThan(1000);
  });
});

describe('frame membership of moved notes (F1)', () => {
  const frames = () => [FRAME('F1', 0, 0, 600, 400), FRAME('F2', 2000, 0, 600, 400)];
  test('existingId without group: a note leaving its frame is released with parent null', () => {
    const content = base([...frames(), el('n', 100, 100, { parentFrameId: 'F1' }), el('far', 1000, 1000)]);
    const r = run(content, { structure: { nodes: [{ key: 'a', existingId: 'n' }, { key: 'b', existingId: 'far' }] }, layout: 'grid', anchor: { at: { x: 5000, y: 5000 } } });
    expect(r.ok).toBe(true);
    const n = r.content.elements.find((e) => e.id === 'n');
    expect(n.parentFrameId).toBeUndefined();
  });
  test('layout_apply elementIds releases a non-frame unit moved out of its frame', () => {
    const content = base([...frames(), el('n', 100, 100, { parentFrameId: 'F1' }), el('m', 300, 100, { parentFrameId: 'F1' })]);
    const r = compileLayoutApply(content, { target: { elementIds: ['n', 'm'] }, layout: 'grid', anchor: { at: { x: 5000, y: 5000 } } }, { newId });
    expect(r.ok).toBe(true);
    for (const id of ['n', 'm']) expect(r.content.elements.find((e) => e.id === id).parentFrameId).toBeUndefined();
  });
});

describe('locks (F2)', () => {
  const lockedContent = () => ({ ...base([el('L', 0, 0, { locked: true }), el('M', 300, 0, { layerId: 'lk' }), el('ok', 600, 0), el('ok2', 900, 0)]), layers: [{ id: 'default', locked: false }, { id: 'lk', locked: true }] });
  test('map_structure rejects existingId on locked elements and locked layers, naming the ids', () => {
    const r = run(lockedContent(), { structure: { nodes: [{ key: 'a', existingId: 'L' }, { key: 'b', existingId: 'M' }, { key: 'c', existingId: 'ok' }] }, layout: 'grid' });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('INVALID_OPS');
    expect(msgs(r)).toMatch(/Locked elements.*L, M/);
  });
  test('layout_apply skips locked units with a warning and moves the rest', () => {
    const r = compileLayoutApply(lockedContent(), { target: { elementIds: ['L', 'M', 'ok', 'ok2'] }, layout: 'flow', anchor: { at: { x: 4000, y: 4000 } } }, { newId });
    expect(r.ok).toBe(true);
    expect(r.warnings.join(' ')).toMatch(/"L" is locked/);
    expect(r.warnings.join(' ')).toMatch(/"M" is locked/);
    expect(r.content.elements.find((e) => e.id === 'L').x).toBe(0);
    expect(r.content.elements.find((e) => e.id === 'ok').x).toBeGreaterThanOrEqual(4000);
  });
  test('layout_apply on a locked frame is rejected; a frame holding a locked member is skipped', () => {
    const r = compileLayoutApply(base([FRAME('F', 0, 0, 600, 400, { locked: true }), el('n', 50, 50, { parentFrameId: 'F' })]), { target: { frameId: 'F' }, layout: 'grid' }, { newId });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('INVALID_OPS');
    const r2 = compileLayoutApply(base([FRAME('F', 0, 0, 600, 400), el('n', 50, 50, { parentFrameId: 'F', locked: true }), el('x', 5000, 0)]), { target: { elementIds: ['F', 'x'] }, layout: 'grid', anchor: { at: { x: 9000, y: 0 } } }, { newId });
    expect(r2.ok).toBe(true);
    expect(r2.warnings.join(' ')).toMatch(/"F" is locked/);
  });
});

describe('input hardening (F3, F4, F5)', () => {
  test('non-array nodes/edges/groups are rejected', () => {
    for (const s of [{ nodes: 'x' }, { nodes: [{ key: 'a' }], edges: {} }, { nodes: [{ key: 'a' }], groups: 'g' }]) {
      const r = run(base(), { structure: s, layout: 'tree' });
      expect(r.ok).toBe(false);
      expect(msgs(r)).toMatch(/must be an array/);
    }
  });
  test('reserved keys are rejected and created is prototype-free', () => {
    for (const key of ['__proto__', 'constructor', 'prototype']) {
      const r = run(base(), { structure: { nodes: [{ key }] }, layout: 'tree' });
      expect(r.ok).toBe(false);
      expect(msgs(r)).toMatch(/reserved/);
    }
    const ok = run(base(), { structure: { nodes: [{ key: 'a' }] }, layout: 'tree' });
    expect(Object.getPrototypeOf(ok.created)).toBeNull();
    expect(Object.getPrototypeOf(ok.groups)).toBeNull();
  });
  test('layout_apply on an empty frame says the frame has no members', () => {
    const r = compileLayoutApply(base([FRAME('F', 0, 0, 600, 400)]), { target: { frameId: 'F' }, layout: 'grid' }, { newId });
    expect(r.ok).toBe(false);
    expect(msgs(r)).toMatch(/frame has no members/);
  });
});
