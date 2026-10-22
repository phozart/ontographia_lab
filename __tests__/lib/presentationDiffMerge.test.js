import { diffContent } from '../../lib/versions/diff';
import { mergeContent } from '../../lib/merge/threeWay';
import { dedupeContentIds, findDuplicateId } from '../../lib/dedupeIds';
import { contentHash } from '../../lib/versions/contentHash';

const slide = (id, extra = {}) => ({ id, frameId: `f-${id}`, ...extra });
const deck = (slides, extra = {}) => ({ id: 'p1', title: 'Deck', aspect: '16:9', slides, ...extra });
const c = (presentations) => ({ elements: [], connections: [], layers: [], groups: [], presentations });
const ids = (r) => r.content.presentations[0].slides.map((s) => s.id);

describe('diffContent: presentations', () => {
  it('reports an added and a removed deck with its title as label', () => {
    const d = diffContent(c([]), c([deck([slide('a')])]));
    expect(d.changes).toEqual([{ id: 'p1', kind: 'presentation', change: 'added', label: 'Deck' }]);
    expect(diffContent(c([deck([])]), c([])).changes[0]).toMatchObject({ change: 'removed', kind: 'presentation' });
    expect(diffContent({ elements: [] }, c([deck([])])).summary.added).toBe(1);
  });

  it('names what changed: order, slides, notes, hidden, title, aspect', () => {
    const base = c([deck([slide('a'), slide('b')])]);
    const f = (next) => diffContent(base, c([next])).changes[0].fields;
    expect(f(deck([slide('b'), slide('a')]))).toEqual(['order']);
    expect(f(deck([slide('a')]))).toEqual(['slides']);
    expect(f(deck([slide('a'), slide('b'), slide('c')]))).toEqual(['slides']);
    expect(f(deck([slide('a', { notes: 'x' }), slide('b')]))).toEqual(['notes']);
    expect(f(deck([slide('a', { hidden: true }), slide('b')]))).toEqual(['hidden']);
    expect(f(deck([slide('a'), slide('b')], { title: 'T2', aspect: '4:3' }))).toEqual(['aspect', 'title']);
    expect(f(deck([{ ...slide('a'), frameId: 'other' }, slide('b')]))).toEqual(['slides']);
  });

  it('reports nothing when equal (absent notes equal empty notes)', () => {
    expect(diffContent(c([deck([slide('a')])]), c([deck([slide('a', { notes: '' })])])).changes).toEqual([]);
  });
});

describe('mergeContent: presentations (order and notes rules)', () => {
  const base = c([deck([slide('a'), slide('b'), slide('c')])]);

  it('adopts a remote reorder when the user did not reorder', () => {
    const theirs = c([deck([slide('c'), slide('a'), slide('b')])]);
    const r = mergeContent(base, base, theirs);
    expect(r.ok).toBe(true);
    expect(ids(r)).toEqual(['c', 'a', 'b']);
    expect(r.conflicts).toEqual([]);
    expect(r.summary.remote.changed).toBe(1);
  });

  it('keeps the local reorder when only the user reordered', () => {
    const ours = c([deck([slide('b'), slide('c'), slide('a')])]);
    expect(ids(mergeContent(base, ours, base))).toEqual(['b', 'c', 'a']);
  });

  it('both reordered differently: local order wins and the conflict is reported', () => {
    const ours = c([deck([slide('b'), slide('a'), slide('c')])]);
    const theirs = c([deck([slide('c'), slide('b'), slide('a')])]);
    const r = mergeContent(base, ours, theirs);
    expect(ids(r)).toEqual(['b', 'a', 'c']);
    expect(r.conflicts).toEqual([{ kind: 'presentation', id: 'p1', fields: ['slides.order'], resolution: 'local-wins' }]);
  });

  it('both reordered the same way: no conflict', () => {
    const same = c([deck([slide('c'), slide('b'), slide('a')])]);
    const r = mergeContent(base, same, same);
    expect(ids(r)).toEqual(['c', 'b', 'a']);
    expect(r.conflicts).toEqual([]);
  });

  it('notes edited on different slides merge; the same slide: local wins and is reported', () => {
    const ours = c([deck([slide('a', { notes: 'mine' }), slide('b'), slide('c')])]);
    const theirs = c([deck([slide('a'), slide('b', { notes: 'theirs' }), slide('c')])]);
    const r = mergeContent(base, ours, theirs);
    expect(r.content.presentations[0].slides.map((s) => s.notes)).toEqual(['mine', 'theirs', undefined]);
    expect(r.conflicts).toEqual([]);
    const both = mergeContent(base, ours, c([deck([slide('a', { notes: 'other' }), slide('b'), slide('c')])]));
    expect(both.content.presentations[0].slides[0].notes).toBe('mine');
    expect(both.conflicts[0]).toMatchObject({ kind: 'presentation', fields: ['slides.a.notes'], resolution: 'local-wins' });
  });

  it('a reorder on one side and a note on the other both survive', () => {
    const ours = c([deck([slide('c'), slide('a'), slide('b')])]);
    const theirs = c([deck([slide('a', { notes: 'n' }), slide('b'), slide('c')])]);
    const r = mergeContent(base, ours, theirs);
    expect(ids(r)).toEqual(['c', 'a', 'b']);
    expect(r.content.presentations[0].slides[1].notes).toBe('n');
  });

  it('slides added on both sides are both kept, remote ones after their predecessor', () => {
    const ours = c([deck([slide('a'), slide('x'), slide('b'), slide('c')])]);
    const theirs = c([deck([slide('a'), slide('b'), slide('y'), slide('c')])]);
    expect(ids(mergeContent(base, ours, theirs))).toEqual(['a', 'x', 'b', 'y', 'c']);
  });

  it('remote removal of an untouched slide applies; of an edited one keeps it (reported)', () => {
    const theirs = c([deck([slide('a'), slide('c')])]);
    expect(ids(mergeContent(base, base, theirs))).toEqual(['a', 'c']);
    const ours = c([deck([slide('a'), slide('b', { notes: 'keep me' }), slide('c')])]);
    const r = mergeContent(base, ours, theirs);
    expect(ids(r)).toEqual(['a', 'b', 'c']);
    expect(r.conflicts[0].fields).toEqual(['slides.b']);
  });

  it('local removal beats a remote edit of that slide', () => {
    const ours = c([deck([slide('a'), slide('c')])]);
    const theirs = c([deck([slide('a'), slide('b', { notes: 'edited' }), slide('c')])]);
    const r = mergeContent(base, ours, theirs);
    expect(ids(r)).toEqual(['a', 'c']);
    expect(r.conflicts[0].fields).toEqual(['slides.b']);
  });

  it('adds a deck remotely and merges deck fields (title) independently of slides', () => {
    const r = mergeContent(c([]), c([]), c([deck([slide('a')])]));
    expect(r.content.presentations).toHaveLength(1);
    expect(r.summary.remote.added).toBe(1);
    const renamed = mergeContent(base, c([deck(base.presentations[0].slides, { title: 'Mine' })]), c([deck([slide('a'), slide('b'), slide('c'), slide('d')])]));
    expect(renamed.content.presentations[0].title).toBe('Mine');
    expect(ids(renamed)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('does not repair a slide whose frame vanished (it is a missing slide)', () => {
    const withFrame = { ...base, elements: [{ id: 'f-a', type: 'frame', x: 0, y: 0 }] };
    const theirs = { ...base, elements: [] };
    const r = mergeContent(withFrame, withFrame, theirs);
    expect(r.content.presentations[0].slides.map((s) => s.frameId)).toEqual(['f-a', 'f-b', 'f-c']);
  });

  it('is not mergeable with a duplicate deck id; content without the key merges', () => {
    const dup = c([deck([]), deck([])]);
    expect(mergeContent(base, dup, base).ok).toBe(false);
    const r = mergeContent({ elements: [] }, { elements: [] }, { elements: [] });
    expect(r.ok).toBe(true);
    expect(r.content.presentations).toEqual([]);
  });
});

describe('ids and hashing', () => {
  it('finds and renames duplicate presentation ids', () => {
    const dup = c([deck([]), deck([])]);
    expect(findDuplicateId(dup)).toBe('presentations:p1');
    expect(dedupeContentIds(dup).presentations.map((p) => p.id)).toEqual(['p1', 'p1-dup2']);
  });

  it('the content hash changes when the slide order changes', () => {
    expect(contentHash(c([deck([slide('a'), slide('b')])]))).not.toBe(contentHash(c([deck([slide('b'), slide('a')])])));
  });
});
