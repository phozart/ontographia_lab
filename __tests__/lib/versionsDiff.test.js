// Pure structural diff between two diagram contents (ADR-0001 decision D, slice 8).
import { diffContent, POSITION_TOLERANCE } from '../../lib/versions/diff';

const el = (id, extra = {}) => ({ id, type: 'rectangle', x: 0, y: 0, size: { width: 100, height: 60 }, text: id, ...extra });
const cn = (id, s, t, extra = {}) => ({ id, sourceId: s, targetId: t, type: 'straight', ...extra });
const ids = (d) => d.changes.map((c) => `${c.kind}:${c.id}:${c.change}`);

describe('diffContent', () => {
  test('identical content -> no changes', () => {
    const c = { elements: [el('a')], connections: [cn('c1', 'a', 'a')], layers: [{ id: 'l', name: 'L' }], groups: [{ id: 'g', name: 'G' }] };
    expect(diffContent(c, JSON.parse(JSON.stringify(c)))).toEqual({ changes: [], summary: { added: 0, removed: 0, changed: 0 } });
  });

  test('added / removed elements, connections, layers and groups', () => {
    const from = { elements: [el('a'), el('old')], connections: [cn('c-old', 'a', 'old')], layers: [{ id: 'l1', name: 'One' }], groups: [{ id: 'g-old', name: 'G' }] };
    const to = { elements: [el('a'), el('new')], connections: [cn('c-new', 'a', 'new')], layers: [{ id: 'l1', name: 'One' }, { id: 'l2', name: 'Two' }], groups: [{ id: 'g-new', name: 'H' }] };
    const d = diffContent(from, to);
    expect(ids(d)).toEqual([
      'element:new:added', 'element:old:removed',
      'connection:c-new:added', 'connection:c-old:removed',
      'layer:l2:added',
      'group:g-new:added', 'group:g-old:removed',
    ]);
    expect(d.summary).toEqual({ added: 4, removed: 3, changed: 0 });
  });

  test('changed fields are named, sorted and grouped (position, size, label, style)', () => {
    const from = { elements: [el('a', { color: '#fff', data: { k: 1 }, parentFrameId: null })] };
    const to = { elements: [el('a', { x: 40, y: 5, size: { width: 120, height: 60 }, text: 'renamed', color: '#000', data: { k: 2 }, parentFrameId: 'f1' })] };
    const [c] = diffContent(from, to).changes;
    expect(c).toMatchObject({ id: 'a', kind: 'element', change: 'changed' });
    expect(c.fields).toEqual(['data', 'label', 'parentFrameId', 'position', 'size', 'style']);
  });

  test('connection fields: ports, waypoints, endpoints', () => {
    const from = { connections: [cn('c', 'a', 'b', { sourcePort: 'e', waypoints: [{ x: 1, y: 1 }] })] };
    const to = { connections: [cn('c', 'a', 'z', { sourcePort: 'w', waypoints: [{ x: 1, y: 90 }] })] };
    expect(diffContent(from, to).changes[0].fields).toEqual(['sourcePort', 'targetId', 'waypoints']);
  });

  test('layers and groups report changed fields', () => {
    const d = diffContent(
      { layers: [{ id: 'l', name: 'A', visible: true }], groups: [{ id: 'g', name: 'A', elementIds: ['a'] }] },
      { layers: [{ id: 'l', name: 'B', visible: false }], groups: [{ id: 'g', name: 'A', elementIds: ['a', 'b'] }] }
    );
    expect(d.changes).toMatchObject([
      { kind: 'layer', id: 'l', change: 'changed', fields: ['name', 'visible'] },
      { kind: 'group', id: 'g', change: 'changed', fields: ['elementIds'] },
    ]);
  });

  test('position/size jitter below the tolerance is ignored; at or above it is a change', () => {
    expect(POSITION_TOLERANCE).toBe(0.5);
    const base = { elements: [el('a', { x: 100, y: 100, size: { width: 100, height: 60 } })], connections: [cn('c', 'a', 'a', { waypoints: [{ x: 10, y: 10 }] })] };
    const jitter = { elements: [el('a', { x: 100.49, y: 99.6, size: { width: 100.3, height: 60 } })], connections: [cn('c', 'a', 'a', { waypoints: [{ x: 10.2, y: 10 }] })] };
    expect(diffContent(base, jitter).changes).toEqual([]);
    const moved = { elements: [el('a', { x: 100.5, y: 100, size: { width: 100, height: 60 } })], connections: base.connections };
    expect(diffContent(base, moved).changes[0].fields).toEqual(['position']);
  });

  test('non-geometric numbers are compared exactly', () => {
    const d = diffContent({ elements: [el('a', { data: { n: 1 } })] }, { elements: [el('a', { data: { n: 1.2 } })] });
    expect(d.changes[0].fields).toEqual(['data']);
  });

  test('viewport is ignored; null and missing keys are equal; key order is irrelevant', () => {
    const a = { viewport: { x: 0, y: 0, scale: 1 }, elements: [{ id: 'a', x: 1, y: 2, parentFrameId: null, text: 't' }] };
    const b = { viewport: { x: 99, y: 99, scale: 2 }, elements: [{ text: 't', y: 2, id: 'a', x: 1 }] };
    expect(diffContent(a, b).changes).toEqual([]);
  });

  test('stable ordering: kind, then id, regardless of input order', () => {
    const from = { elements: [], connections: [], layers: [], groups: [] };
    const to = { elements: [el('b'), el('a'), el('c')], layers: [{ id: 'z' }, { id: 'y' }], connections: [cn('k2', 'a', 'b'), cn('k1', 'a', 'b')] };
    const d1 = diffContent(from, to);
    const d2 = diffContent(from, { ...to, elements: [...to.elements].reverse() });
    expect(ids(d1)).toEqual(['element:a:added', 'element:b:added', 'element:c:added', 'connection:k1:added', 'connection:k2:added', 'layer:y:added', 'layer:z:added']);
    expect(d2).toEqual(d1);
  });

  test('element changes carry a display label and bounds (new side; old side for removed)', () => {
    const d = diffContent(
      { elements: [el('gone', { x: 5, y: 6, text: 'Gone' }), el('m', { x: 0 })] },
      { elements: [el('m', { x: 50 }), el('fresh', { x: 7, y: 8, size: { width: 10, height: 20 }, text: 'Fresh' })] }
    );
    const by = Object.fromEntries(d.changes.map((c) => [c.id, c]));
    expect(by.gone).toMatchObject({ label: 'Gone', bounds: { x: 5, y: 6, width: 100, height: 60 } });
    expect(by.fresh).toMatchObject({ label: 'Fresh', bounds: { x: 7, y: 8, width: 10, height: 20 } });
    expect(by.m.bounds).toEqual({ x: 50, y: 0, width: 100, height: 60 });
  });

  test('tolerates garbage: missing collections, entries without ids, duplicate ids, non-objects', () => {
    expect(diffContent(null, undefined)).toEqual({ changes: [], summary: { added: 0, removed: 0, changed: 0 } });
    const d = diffContent({ elements: [null, 3, { x: 1 }, el('a', { x: 1 }), el('a', { x: 2 })] }, { elements: 'nope' });
    expect(ids(d)).toEqual(['element:a:removed']);
  });

  test('does not mutate its inputs', () => {
    const from = { elements: [el('a')] };
    const to = { elements: [el('a', { x: 9 })] };
    const snap = JSON.stringify([from, to]);
    diffContent(from, to);
    expect(JSON.stringify([from, to])).toBe(snap);
  });
});
