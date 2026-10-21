// LA-1 change highlight: mergeContent reports which ids the remote side added, changed and removed.
import { mergeContent } from '../../lib/merge/threeWay';

const el = (id, extra = {}) => ({ id, type: 'rectangle', x: 0, y: 0, size: { width: 100, height: 60 }, label: id, ...extra });
const cn = (id, s, t, extra = {}) => ({ id, sourceId: s, targetId: t, ...extra });
const content = (elements = [], connections = [], extra = {}) => ({ elements, connections, layers: [{ id: 'default', name: 'Default' }], groups: [], viewport: { x: 0, y: 0, scale: 1 }, ...extra });
const run = (b, o, t) => { const r = mergeContent(b, o, t); expect(r.ok).toBe(true); return r; };

describe('summary.remote.ids', () => {
  it('lists exactly the ids the remote side added, changed and removed (elements and connections)', () => {
    const base = content([el('a'), el('b'), el('c')], [cn('k1', 'a', 'b'), cn('k2', 'b', 'c')]);
    const theirs = content(
      [el('a', { x: 40 }), el('b'), el('n')],
      [cn('k1', 'a', 'b', { color: 'red' }), cn('k3', 'a', 'n')],
    );
    const r = run(base, base, theirs);
    const got = r.summary.remote.ids;
    expect([...got.added].sort()).toEqual(['k3', 'n']);
    expect([...got.changed].sort()).toEqual(['a', 'k1']);
    expect([...got.removed].sort()).toEqual(['c', 'k2']);
    expect(got.truncated).toBe(false);
  });
  it('does not list ids whose remote change equals ours or that only changed locally', () => {
    const base = content([el('a'), el('b')]);
    const ours = content([el('a', { x: 30 }), el('b', { y: 9 })]);
    const theirs = content([el('a', { x: 30 }), el('b')]);
    const r = run(base, ours, theirs);
    expect(r.summary.remote.ids).toEqual({ added: [], changed: [], removed: [], truncated: false });
  });
  it('a remote delete that a local edit kept alive is not reported as removed', () => {
    const base = content([el('a'), el('b')]);
    const ours = content([el('a'), el('b', { x: 5 })]);
    const r = run(base, ours, content([el('a')]));
    expect(r.summary.remote.ids.removed).toEqual([]);
  });
  it('counts stay consistent with ids for elements and connections', () => {
    const base = content([el('a')]);
    const r = run(base, base, content([el('a'), el('n1'), el('n2')]));
    expect(r.summary.remote.added).toBe(2);
    expect(r.summary.remote.ids.added).toEqual(['n1', 'n2']);
  });
  it('caps each list at 500 ids and sets truncated', () => {
    const many = Array.from({ length: 620 }, (_, i) => el(`n${i}`));
    const r = run(content([]), content([]), content(many));
    expect(r.summary.remote.added).toBe(620);
    expect(r.summary.remote.ids.added).toHaveLength(500);
    expect(r.summary.remote.ids.truncated).toBe(true);
  });
  it('layers and groups are counted but never listed as highlightable ids', () => {
    const base = content([el('a')]);
    const theirs = content([el('a')], [], { groups: [{ id: 'g9', elementIds: [] }] });
    const r = run(base, base, theirs);
    expect(r.summary.remote.added).toBe(1);
    expect(r.summary.remote.ids.added).toEqual([]);
  });
});
