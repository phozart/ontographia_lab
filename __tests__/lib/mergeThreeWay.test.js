import { mergeContent } from '../../lib/merge/threeWay';

const el = (id, extra = {}) => ({ id, type: 'rectangle', x: 0, y: 0, size: { width: 100, height: 60 }, label: id, ...extra });
const cn = (id, s, t, extra = {}) => ({ id, sourceId: s, targetId: t, ...extra });
const content = (elements = [], connections = [], extra = {}) => ({ elements, connections, layers: [{ id: 'default', name: 'Default' }], groups: [], viewport: { x: 0, y: 0, scale: 1 }, ...extra });
const ids = (list) => list.map((e) => e.id);
const byId = (list, id) => list.find((e) => e.id === id);
const run = (b, o, t) => { const r = mergeContent(b, o, t); expect(r.ok).toBe(true); return r; };

describe('elements: add / remove', () => {
  it('remote add + local move of another element: both survive', () => {
    const base = content([el('a'), el('b')]);
    const ours = content([el('a', { x: 50 }), el('b')]);
    const theirs = content([el('a'), el('b'), el('n')]);
    const r = run(base, ours, theirs);
    expect(ids(r.content.elements)).toEqual(['a', 'b', 'n']);
    expect(byId(r.content.elements, 'a').x).toBe(50);
    expect(r.conflicts).toEqual([]);
    expect(r.summary.remote.added).toBe(1);
  });
  it('local add + remote add: both kept', () => {
    const base = content([el('a')]);
    const r = run(base, content([el('a'), el('l')]), content([el('a'), el('r')]));
    expect(ids(r.content.elements).sort()).toEqual(['a', 'l', 'r']);
  });
  it('add/add with the same id and different fields merges per field, local wins on equal fields', () => {
    const r = run(content([]), content([el('x', { label: 'mine' })]), content([el('x', { label: 'theirs', color: 'red' })]));
    const x = byId(r.content.elements, 'x');
    expect(x.label).toBe('mine');
    expect(x.color).toBe('red');
    expect(r.conflicts.map((c) => c.id)).toEqual(['x']);
  });
  it('remote delete of an untouched element deletes it', () => {
    const base = content([el('a'), el('b')]);
    const r = run(base, content([el('a'), el('b')]), content([el('a')]));
    expect(ids(r.content.elements)).toEqual(['a']);
    expect(r.summary.remote.removed).toBe(1);
  });
  it('local delete of an element the remote did not touch stays deleted', () => {
    const base = content([el('a'), el('b')]);
    const r = run(base, content([el('a')]), content([el('a'), el('b')]));
    expect(ids(r.content.elements)).toEqual(['a']);
  });
  it('both deleted: stays deleted, no conflict', () => {
    const base = content([el('a'), el('b')]);
    const r = run(base, content([el('a')]), content([el('a')]));
    expect(ids(r.content.elements)).toEqual(['a']);
    expect(r.conflicts).toEqual([]);
  });
  it('remote delete vs local edit: the edited element is kept and reported', () => {
    const base = content([el('a'), el('b')]);
    const r = run(base, content([el('a', { label: 'edited' }), el('b')]), content([el('b')]));
    expect(byId(r.content.elements, 'a').label).toBe('edited');
    expect(r.conflicts).toEqual([expect.objectContaining({ kind: 'element', id: 'a', resolution: 'kept-local-edit' })]);
  });
  it('local delete vs remote edit: the deletion wins and is reported', () => {
    const base = content([el('a'), el('b')]);
    const r = run(base, content([el('b')]), content([el('a', { label: 'agent edit' }), el('b')]));
    expect(ids(r.content.elements)).toEqual(['b']);
    expect(r.conflicts).toEqual([expect.objectContaining({ kind: 'element', id: 'a', resolution: 'kept-local-delete' })]);
  });
});

describe('elements: field-level merge', () => {
  it('edit/edit different fields: both applied', () => {
    const base = content([el('a')]);
    const r = run(base, content([el('a', { label: 'mine' })]), content([el('a', { color: '#f00' })]));
    const a = byId(r.content.elements, 'a');
    expect([a.label, a.color]).toEqual(['mine', '#f00']);
    expect(r.conflicts).toEqual([]);
  });
  it('edit/edit same field: local wins and the field is listed', () => {
    const base = content([el('a')]);
    const r = run(base, content([el('a', { label: 'mine' })]), content([el('a', { label: 'theirs' })]));
    expect(byId(r.content.elements, 'a').label).toBe('mine');
    expect(r.conflicts).toEqual([expect.objectContaining({ id: 'a', fields: ['label'], resolution: 'local-wins' })]);
  });
  it('same value on both sides is not a conflict', () => {
    const base = content([el('a')]);
    const r = run(base, content([el('a', { label: 'same' })]), content([el('a', { label: 'same' })]));
    expect(r.conflicts).toEqual([]);
  });
  it('move (local) vs label edit (remote): both applied', () => {
    const base = content([el('a')]);
    const r = run(base, content([el('a', { x: 300, y: 40 })]), content([el('a', { label: 'renamed' })]));
    const a = byId(r.content.elements, 'a');
    expect([a.x, a.y, a.label]).toEqual([300, 40, 'renamed']);
  });
  it('position is atomic: both moved takes local x AND y, never a diagonal mix', () => {
    const base = content([el('a')]);
    const r = run(base, content([el('a', { x: 10 })]), content([el('a', { x: 500, y: 500 })]));
    const a = byId(r.content.elements, 'a');
    expect([a.x, a.y]).toEqual([10, 0]);
    expect(r.conflicts[0].fields).toEqual(['position']);
  });
  it('size is atomic', () => {
    const base = content([el('a')]);
    const r = run(base, content([el('a', { size: { width: 200, height: 60 } })]), content([el('a', { size: { width: 100, height: 400 } })]));
    expect(byId(r.content.elements, 'a').size).toEqual({ width: 200, height: 60 });
  });
  it('nested data object merges per key', () => {
    const base = content([el('a', { data: { owner: 'x', status: 'todo' } })]);
    const r = run(base, content([el('a', { data: { owner: 'me', status: 'todo' } })]), content([el('a', { data: { owner: 'x', status: 'done' } })]));
    expect(byId(r.content.elements, 'a').data).toEqual({ owner: 'me', status: 'done' });
    expect(r.conflicts).toEqual([]);
  });
  it('jitter below the diff tolerance counts as unchanged, so a remote move is adopted', () => {
    const base = content([el('a', { x: 100 })]);
    const r = run(base, content([el('a', { x: 100.2 })]), content([el('a', { x: 400 })]));
    expect(byId(r.content.elements, 'a').x).toBe(400);
  });
  it('remote clears a field the local side did not touch: removed', () => {
    const base = content([el('a', { color: 'red' })]);
    const rest = el('a');
    const r = run(base, content([el('a', { color: 'red' })]), content([rest]));
    expect('color' in byId(r.content.elements, 'a')).toBe(false);
  });
  it('does not mutate its inputs', () => {
    const base = content([el('a')]); const ours = content([el('a', { x: 5 })]); const theirs = content([el('a'), el('n')]);
    const snap = JSON.stringify([base, ours, theirs]);
    mergeContent(base, ours, theirs);
    expect(JSON.stringify([base, ours, theirs])).toBe(snap);
  });
});

describe('connections', () => {
  it('remote adds a connection between untouched elements', () => {
    const base = content([el('a'), el('b')]);
    const r = run(base, content([el('a', { x: 9 }), el('b')]), content([el('a'), el('b')], [cn('c1', 'a', 'b')]));
    expect(ids(r.content.connections)).toEqual(['c1']);
  });
  it('remote connection to an element the user deleted is dropped and reported', () => {
    const base = content([el('a'), el('b')]);
    const r = run(base, content([el('a')]), content([el('a'), el('b')], [cn('c1', 'a', 'b')]));
    expect(r.content.connections).toEqual([]);
    expect(r.conflicts).toEqual([expect.objectContaining({ kind: 'connection', id: 'c1', resolution: 'dropped-dangling' })]);
  });
  it('local connection to an element the agent deleted (untouched) is dropped', () => {
    const base = content([el('a'), el('b')]);
    const r = run(base, content([el('a'), el('b')], [cn('c1', 'a', 'b')]), content([el('a')]));
    expect(r.content.connections).toEqual([]);
  });
  it('connection survives when the endpoint is kept because of a local edit', () => {
    const base = content([el('a'), el('b')], [cn('c1', 'a', 'b')]);
    const r = run(base, content([el('a'), el('b', { label: 'keep me' })], [cn('c1', 'a', 'b')]), content([el('a')], []));
    expect(ids(r.content.elements)).toEqual(['a', 'b']);
    expect(ids(r.content.connections)).toEqual(['c1']);
  });
  it('connection style edits merge per field', () => {
    const base = content([el('a'), el('b')], [cn('c1', 'a', 'b', { lineStyle: 'straight' })]);
    const r = run(base, content([el('a'), el('b')], [cn('c1', 'a', 'b', { lineStyle: 'step' })]), content([el('a'), el('b')], [cn('c1', 'a', 'b', { lineStyle: 'straight', label: 'x' })]));
    expect(r.content.connections[0]).toMatchObject({ lineStyle: 'step', label: 'x' });
  });
  it('remote delete of a connection the user edited keeps it', () => {
    const base = content([el('a'), el('b')], [cn('c1', 'a', 'b')]);
    const r = run(base, content([el('a'), el('b')], [cn('c1', 'a', 'b', { color: 'red' })]), content([el('a'), el('b')], []));
    expect(ids(r.content.connections)).toEqual(['c1']);
  });
});

describe('frames, groups and layers', () => {
  it('remote moves a shape into a frame while the user moves it: position local, parentFrameId remote', () => {
    const base = content([el('f', { isFrame: true }), el('a')]);
    const r = run(base, content([el('f', { isFrame: true }), el('a', { x: 20 })]), content([el('f', { isFrame: true }), el('a', { parentFrameId: 'f' })]));
    expect(byId(r.content.elements, 'a')).toMatchObject({ x: 20, parentFrameId: 'f' });
  });
  it('a member whose frame was deleted remotely is released (parentFrameId null), not dangling', () => {
    const base = content([el('f', { isFrame: true }), el('a', { parentFrameId: 'f' })]);
    const r = run(base, content([el('f', { isFrame: true }), el('a', { parentFrameId: 'f', x: 5 })]), content([el('a', { parentFrameId: null })]));
    expect(byId(r.content.elements, 'a').parentFrameId).toBeNull();
    expect(ids(r.content.elements)).toEqual(['a']);
  });
  it('remote member added to a local frame that still exists', () => {
    const base = content([el('f', { isFrame: true })]);
    const r = run(base, content([el('f', { isFrame: true, x: 40 })]), content([el('f', { isFrame: true }), el('n', { parentFrameId: 'f' })]));
    expect(byId(r.content.elements, 'n').parentFrameId).toBe('f');
  });
  it('remote member pointing at a frame the user deleted is released', () => {
    const base = content([el('f', { isFrame: true })]);
    const r = run(base, content([]), content([el('f', { isFrame: true }), el('n', { parentFrameId: 'f' })]));
    expect(byId(r.content.elements, 'n').parentFrameId).toBeNull();
  });
  it('group elementIds merge as a set; removed elements are pruned', () => {
    const g = (elementIds) => ({ id: 'g1', name: 'G', elementIds });
    const base = content([el('a'), el('b'), el('c')], [], { groups: [g(['a', 'b'])] });
    const ours = content([el('a'), el('b'), el('c')], [], { groups: [g(['a', 'b', 'c'])] });
    const theirs = content([el('a'), el('c')], [], { groups: [g(['a'])] });
    const r = run(base, ours, theirs);
    expect(r.content.groups[0].elementIds.sort()).toEqual(['a', 'c']);
  });
  it('an element pointing at a removed group loses the groupId; at a removed layer falls back to default', () => {
    const base = content([el('a', { groupId: 'g1', layerId: 'L2' })], [], { groups: [{ id: 'g1', elementIds: ['a'] }], layers: [{ id: 'default' }, { id: 'L2' }] });
    const theirs = content([el('a', { groupId: 'g1', layerId: 'L2' })], [], { groups: [], layers: [{ id: 'default' }] });
    const ours = content([el('a', { groupId: 'g1', layerId: 'L2', x: 7 })], [], { groups: [{ id: 'g1', elementIds: ['a'] }], layers: [{ id: 'default' }, { id: 'L2' }] });
    const r = run(base, ours, theirs);
    const a = byId(r.content.elements, 'a');
    expect(a.groupId).toBeUndefined();
    expect(a.layerId).toBe('default');
    expect(r.content.groups).toEqual([]);
  });
  it('layers merge by id: remote adds a layer, local renames another', () => {
    const base = content([], [], { layers: [{ id: 'default', name: 'Default' }, { id: 'L2', name: 'Two' }] });
    const r = run(base,
      content([], [], { layers: [{ id: 'default', name: 'Default' }, { id: 'L2', name: 'Mine' }] }),
      content([], [], { layers: [{ id: 'default', name: 'Default' }, { id: 'L2', name: 'Two' }, { id: 'L3', name: 'New' }] }));
    expect(r.content.layers.map((l) => [l.id, l.name])).toEqual([['default', 'Default'], ['L2', 'Mine'], ['L3', 'New']]);
  });
});

describe('order (z-order) and other keys', () => {
  it('keeps the local order and inserts remote additions after their predecessor', () => {
    const base = content([el('a'), el('b'), el('c')]);
    const ours = content([el('b'), el('a'), el('c')]); // local reordered
    const theirs = content([el('a'), el('n'), el('b'), el('c')]);
    const r = run(base, ours, theirs);
    expect(ids(r.content.elements)).toEqual(['b', 'a', 'n', 'c']);
  });
  it('adopts the remote order when the user did not reorder', () => {
    const base = content([el('a'), el('b'), el('c')]);
    const r = run(base, content([el('a', { x: 1 }), el('b'), el('c')]), content([el('c'), el('a'), el('b')]));
    expect(ids(r.content.elements)).toEqual(['c', 'a', 'b']);
  });
  it('keeps the local viewport; other top-level keys merge three-way', () => {
    const base = content([], [], { settings: { grid: true } });
    const ours = content([], [], { viewport: { x: 9, y: 9, scale: 2 }, settings: { grid: true } });
    const theirs = content([], [], { settings: { grid: false } });
    const r = run(base, ours, theirs);
    expect(r.content.viewport).toEqual({ x: 9, y: 9, scale: 2 });
    expect(r.content.settings).toEqual({ grid: false });
  });
  it('nothing changed remotely: result equals ours and summary is empty', () => {
    const base = content([el('a')]);
    const ours = content([el('a', { x: 3 })]);
    const r = run(base, ours, base);
    expect(r.content).toEqual(ours);
    expect(r.summary.remote).toEqual({ added: 0, removed: 0, changed: 0 });
  });
});

describe('unmergeable input', () => {
  it.each([[null], ['x'], [[]]])('rejects a non-object side (%p)', (bad) => {
    expect(mergeContent(bad, content(), content()).ok).toBe(false);
    expect(mergeContent(content(), bad, content()).ok).toBe(false);
    expect(mergeContent(content(), content(), bad).ok).toBe(false);
  });
  it('rejects collections that are not arrays', () => {
    expect(mergeContent(content(), content(), { elements: 'nope' }).ok).toBe(false);
  });
  it('entities without an id are kept from ours and ignored from theirs', () => {
    const r = run(content([]), content([{ type: 'x' }]), content([{ type: 'y' }]));
    expect(r.content.elements).toEqual([{ type: 'x' }]);
  });
});

describe('duplicate ids (review follow-up)', () => {
  it.each(['base', 'ours', 'theirs'])('duplicate id in %s -> ok:false, never a corrupt merge', (side) => {
    const clean = content([el('a'), el('b')]);
    const dupe = content([el('a'), el('b'), el('a', { x: 9 })]);
    const args = { base: clean, ours: clean, theirs: clean, [side]: dupe };
    const r = mergeContent(args.base, args.ours, args.theirs);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/duplicate id/);
  });
  it('duplicate connection or group ids are also refused', () => {
    const c = content([el('a'), el('b')], [cn('c1', 'a', 'b'), cn('c1', 'b', 'a')]);
    expect(mergeContent(c, c, c).ok).toBe(false);
    const g = content([el('a')], [], { groups: [{ id: 'g', elementIds: [] }, { id: 'g', elementIds: [] }] });
    expect(mergeContent(g, g, g).ok).toBe(false);
  });
});

describe('group membership consistency (review follow-up)', () => {
  it('group.elementIds follows element.groupId after a merge', () => {
    const grp = (ids) => ({ id: 'g1', elementIds: ids });
    const base = content([el('a', { groupId: 'g1' }), el('b', { groupId: 'g1' }), el('c')], [], { groups: [grp(['a', 'b'])] });
    // local: c joins the group (element and group list); remote: b leaves it (element only, as a stale writer might)
    const ours = content([el('a', { groupId: 'g1' }), el('b', { groupId: 'g1' }), el('c', { groupId: 'g1' })], [], { groups: [grp(['a', 'b', 'c'])] });
    const theirs = content([el('a', { groupId: 'g1' }), el('b'), el('c')], [], { groups: [grp(['a', 'b'])] });
    const r = run(base, ours, theirs);
    const members = r.content.elements.filter((e) => e.groupId === 'g1').map((e) => e.id).sort();
    expect([...byId(r.content.groups, 'g1').elementIds].sort()).toEqual(members);
  });
  it('an element removed remotely leaves the group list', () => {
    const base = content([el('a', { groupId: 'g1' }), el('b', { groupId: 'g1' })], [], { groups: [{ id: 'g1', elementIds: ['a', 'b'] }] });
    const theirs = content([el('a', { groupId: 'g1' })], [], { groups: [{ id: 'g1', elementIds: ['a', 'b'] }] });
    const r = run(base, base, theirs);
    expect(byId(r.content.groups, 'g1').elementIds).toEqual(['a']);
  });
});
