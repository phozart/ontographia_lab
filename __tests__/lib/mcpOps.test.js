import { applyOps, MAX_OPS } from '../../lib/mcp/ops';

const base = () => ({
  elements: [
    { id: 'el-1', type: 'task', packId: 'process-flow', label: 'Existing', x: 100, y: 100, size: { width: 120, height: 80 }, layerId: 'default', properties: { owner: 'Ops', keep: 1 } },
    { id: 'el-2', type: 'task', packId: 'process-flow', label: 'Second', x: 400, y: 100, size: { width: 120, height: 80 }, layerId: 'default', parentFrameId: 'fr-1' },
    { id: 'fr-1', type: 'frame', packId: 'core', label: 'Frame', x: 0, y: 0, size: { width: 900, height: 500 }, layerId: 'default' },
  ],
  connections: [{ id: 'conn-1', sourceId: 'el-1', targetId: 'el-2', lineStyle: 'step' }],
  layers: [{ id: 'default', name: 'Default' }],
  viewport: { x: 5, y: 6, zoom: 1 },
});
const seqIds = () => { let n = 0; return (prefix) => `${prefix}-t${++n}`; };
const run = (ops, content = base(), extra = {}) => applyOps(content, ops, { newId: seqIds(), ...extra });
const err = (r) => r.errors.map((e) => `${e.index}:${e.message}`).join(' | ');

describe('add_element', () => {
  test('creates a well-formed element from the catalog, returns the ref -> id map', () => {
    const r = run([{ op: 'add_element', ref: '@a', type: 'process-flow/task', label: 'Check stock', x: 700, y: 60 }]);
    expect(r.ok).toBe(true);
    expect(r.created).toEqual({ '@a': 'el-t1' });
    const el = r.content.elements.find((e) => e.id === 'el-t1');
    expect(el).toMatchObject({ type: 'task', packId: 'process-flow', label: 'Check stock', x: 700, y: 60, layerId: 'default' });
    expect(el.size.width).toBeGreaterThan(0);
    expect(r.content.viewport).toEqual({ x: 5, y: 6, zoom: 1 });
  });

  test('without coordinates the element is auto-placed clear of existing content', () => {
    const r = run([{ op: 'add_element', ref: '@a', type: 'process-flow/task', label: 'A' }]);
    const el = r.content.elements.find((e) => e.id === 'el-t1');
    expect(Number.isFinite(el.x) && Number.isFinite(el.y)).toBe(true);
    expect(el.x).toBeGreaterThanOrEqual(520); // right of el-2
    expect(r.placed).toEqual([{ id: 'el-t1', x: el.x, y: el.y }]);
  });

  test('unknown stencil: error lists close matches', () => {
    const r = run([{ op: 'add_element', type: 'process-flow/taks' }]);
    expect(r.ok).toBe(false);
    expect(err(r)).toMatch(/Unknown stencil/);
    expect(err(r)).toMatch(/process-flow\/task/);
  });

  test('a bare stencil id (no pack) is rejected with the namespaced suggestion', () => {
    const r = run([{ op: 'add_element', type: 'task' }]);
    expect(r.ok).toBe(false);
    expect(err(r)).toMatch(/pack\/stencil/);
  });

  test('data goes to properties; nested values, forbidden keys and too many keys are rejected', () => {
    const okRes = run([{ op: 'add_element', type: 'process-flow/task', data: { assignee: 'Ops', n: 3, flag: true } }]);
    expect(okRes.content.elements.find((e) => e.id === 'el-t1').properties).toEqual({ assignee: 'Ops', n: 3, flag: true });
    expect(run([{ op: 'add_element', type: 'process-flow/task', data: { a: { b: 1 } } }]).ok).toBe(false);
    expect(run([{ op: 'add_element', type: 'process-flow/task', data: JSON.parse('{"__proto__": {"x": 1}}') }]).ok).toBe(false);
    const many = Object.fromEntries(Array.from({ length: 41 }, (_, i) => [`k${i}`, 'v']));
    expect(run([{ op: 'add_element', type: 'process-flow/task', data: many }]).ok).toBe(false);
  });

  test('rejects bad numbers, oversize labels, bad refs and duplicate refs', () => {
    expect(run([{ op: 'add_element', type: 'process-flow/task', x: 'a', y: 1 }]).ok).toBe(false);
    expect(run([{ op: 'add_element', type: 'process-flow/task', x: 1e9, y: 1 }]).ok).toBe(false);
    expect(run([{ op: 'add_element', type: 'process-flow/task', x: 1, y: 1, w: -5 }]).ok).toBe(false);
    expect(run([{ op: 'add_element', type: 'process-flow/task', label: 'x'.repeat(501) }]).ok).toBe(false);
    expect(run([{ op: 'add_element', type: 'process-flow/task', ref: 'a' }]).ok).toBe(false);
    expect(run([{ op: 'add_element', type: 'process-flow/task', ref: '@a' }, { op: 'add_element', type: 'process-flow/task', ref: '@a' }]).ok).toBe(false);
  });

  test('parent must be an existing frame or container; refs to earlier frames work', () => {
    expect(run([{ op: 'add_element', type: 'process-flow/task', parent: 'el-1' }]).ok).toBe(false);
    expect(run([{ op: 'add_element', type: 'process-flow/task', parent: 'nope' }]).ok).toBe(false);
    const r = run([
      { op: 'add_element', ref: '@f', type: 'core/frame', label: 'New', x: 0, y: 700, w: 400, h: 300 },
      { op: 'add_element', type: 'process-flow/task', parent: '@f' },
    ]);
    expect(r.ok).toBe(true);
    const child = r.content.elements.find((e) => e.id === 'el-t2');
    expect(child.parentFrameId).toBe('el-t1');
    expect(child.y).toBeGreaterThanOrEqual(700);
  });

  test('frame membership is explicit: new frames are flagged, a shape placed inside a frame adopts it, explicit parent wins', () => {
    const r = run([
      { op: 'add_element', type: 'core/frame', x: 0, y: 700, w: 400, h: 300 },
      { op: 'add_element', type: 'process-flow/task', x: 50, y: 150 }, // inside fr-1 (0,0,900x500), no parent
      { op: 'add_element', type: 'process-flow/task', x: 5000, y: 5000 }, // in no frame
      { op: 'add_element', type: 'process-flow/task', x: 50, y: 150, parent: 'fr-1' },
    ]);
    expect(r.ok).toBe(true);
    const byId = Object.fromEntries(r.content.elements.map((e) => [e.id, e]));
    expect(byId['el-t1'].membershipExplicit).toBe(true);
    expect(byId['el-t2'].parentFrameId).toBe('fr-1');
    expect('parentFrameId' in byId['el-t3']).toBe(false);
    expect(byId['el-t4'].parentFrameId).toBe('fr-1');
  });

  test('unknown fields are rejected (strict ops)', () => {
    expect(run([{ op: 'add_element', type: 'process-flow/task', evil: { onclick: 'x' } }]).ok).toBe(false);
  });
});

describe('connect / update / remove', () => {
  test('connect with refs creates a connection with auto ports and a default marker', () => {
    const r = run([
      { op: 'add_element', ref: '@a', type: 'process-flow/task', label: 'A' },
      { op: 'add_element', ref: '@b', type: 'process-flow/task', label: 'B' },
      { op: 'connect', ref: '@c', from: '@a', to: '@b', label: 'yes', style: 'smart' },
      { op: 'connect', from: 'el-1', to: '@a' },
    ]);
    expect(r.ok).toBe(true);
    expect(r.created['@c']).toBe('conn-t3');
    const c = r.content.connections.find((x) => x.id === 'conn-t3');
    expect(c).toMatchObject({ sourceId: 'el-t1', targetId: 'el-t2', label: 'yes', lineStyle: 'smart', autoPorts: true, targetMarker: 'arrow', sourceMarker: 'none' });
    expect(r.content.connections).toHaveLength(3);
  });

  test('connect: unknown endpoint, self-loop, forward ref, bad style are rejected', () => {
    expect(run([{ op: 'connect', from: 'el-1', to: 'ghost' }]).ok).toBe(false);
    expect(run([{ op: 'connect', from: 'el-1', to: 'el-1' }]).ok).toBe(false);
    expect(run([{ op: 'connect', from: 'el-1', to: '@later' }, { op: 'add_element', ref: '@later', type: 'process-flow/task' }]).ok).toBe(false);
    expect(run([{ op: 'connect', from: 'el-1', to: 'el-2', style: 'zigzag' }]).ok).toBe(false);
  });

  test('add_connection is accepted as an alias of connect', () => {
    expect(run([{ op: 'add_connection', from: 'el-1', to: 'el-2' }]).ok).toBe(true);
  });

  test('update_element patches only the given fields, merges data, null deletes a key', () => {
    const r = run([{ op: 'update_element', id: 'el-1', label: 'Renamed', x: 140, data: { owner: null, added: 'y' } }]);
    expect(r.ok).toBe(true);
    const el = r.content.elements.find((e) => e.id === 'el-1');
    expect(el).toMatchObject({ label: 'Renamed', x: 140, y: 100, packId: 'process-flow', type: 'task' });
    expect(el.properties).toEqual({ keep: 1, added: 'y' });
  });

  test('update_element: unknown id, empty patch, parent cycle are rejected; parent null un-parents', () => {
    expect(run([{ op: 'update_element', id: 'ghost', label: 'x' }]).ok).toBe(false);
    expect(run([{ op: 'update_element', id: 'el-1' }]).ok).toBe(false);
    expect(run([{ op: 'update_element', id: 'fr-1', parent: 'fr-1' }]).ok).toBe(false);
    const r = run([{ op: 'update_element', id: 'el-2', parent: null }]);
    expect(r.content.elements.find((e) => e.id === 'el-2').parentFrameId).toBeUndefined();
  });

  test('remove_element removes its connections and un-parents its children', () => {
    const r = run([{ op: 'remove_element', id: 'fr-1' }, { op: 'remove_element', id: 'el-1' }]);
    expect(r.ok).toBe(true);
    expect(r.content.elements.map((e) => e.id)).toEqual(['el-2']);
    expect(r.content.elements[0].parentFrameId).toBeUndefined();
    expect(r.content.connections).toEqual([]);
    expect(r.counts).toMatchObject({ removedElements: 2, removedConnections: 1 });
  });

  test('update_connection and remove_connection', () => {
    const r = run([{ op: 'update_connection', id: 'conn-1', label: 'go', style: 'curved' }, { op: 'remove_connection', id: 'conn-1' }]);
    expect(r.ok).toBe(true);
    expect(r.content.connections).toEqual([]);
    expect(run([{ op: 'remove_connection', id: 'ghost' }]).ok).toBe(false);
    const u = run([{ op: 'update_connection', id: 'conn-1', label: 'go', style: 'curved' }]);
    expect(u.content.connections[0]).toMatchObject({ label: 'go', lineStyle: 'curved' });
  });
});

describe('batch behavior', () => {
  test('atomic: one bad op means no content and the input is untouched', () => {
    const input = base();
    const snapshot = JSON.stringify(input);
    const r = run([{ op: 'update_element', id: 'el-1', label: 'ok' }, { op: 'remove_element', id: 'ghost' }], input);
    expect(r.ok).toBe(false);
    expect(r.content).toBeUndefined();
    expect(JSON.stringify(input)).toBe(snapshot);
    expect(r.errors[0].index).toBe(1);
  });

  test('reports several errors (bounded) with their op index', () => {
    const r = run(Array.from({ length: 30 }, () => ({ op: 'remove_element', id: 'ghost' })));
    expect(r.errors.length).toBeLessThanOrEqual(20);
    expect(r.errors[0]).toMatchObject({ index: 0 });
  });

  test(`rejects empty and more than ${MAX_OPS} ops, non-array input, unknown op names`, () => {
    expect(run([]).ok).toBe(false);
    expect(run(Array.from({ length: MAX_OPS + 1 }, () => ({ op: 'remove_connection', id: 'conn-1' }))).ok).toBe(false);
    expect(run('nope').ok).toBe(false);
    expect(run([{ op: 'delete_diagram' }]).ok).toBe(false);
    expect(run([null]).ok).toBe(false);
  });

  test('the result passes server content validation limits (too many elements fails cleanly)', () => {
    const big = base();
    big.elements = Array.from({ length: 4990 }, (_, i) => ({ id: `x${i}`, type: 'task', packId: 'process-flow', x: i, y: 0, size: { width: 10, height: 10 } }));
    const ops = Array.from({ length: 20 }, () => ({ op: 'add_element', type: 'process-flow/task', x: 1, y: 1 }));
    const r = run(ops, big);
    expect(r.ok).toBe(false);
    expect(err(r)).toMatch(/too many/i);
  });

  test('generated ids default to prefixed uuids', () => {
    const r = applyOps(base(), [{ op: 'add_element', type: 'process-flow/task', x: 1, y: 1 }]);
    expect(r.created).toEqual({});
    expect(r.elements[0].id).toMatch(/^el-[0-9a-f-]{36}$/);
  });

  test('summary reports counts and created ids', () => {
    const r = run([
      { op: 'add_element', ref: '@a', type: 'process-flow/task' },
      { op: 'add_element', ref: '@b', type: 'process-flow/task' },
      { op: 'connect', from: '@a', to: '@b' },
    ]);
    expect(r.counts).toMatchObject({ addedElements: 2, addedConnections: 1, updated: 0 });
    expect(r.elements.map((e) => e.ref)).toEqual(['@a', '@b']);
  });
});
