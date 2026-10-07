import { anchorState, contentIds, resolveMarker, elementAtPoint } from '../../lib/comments/anchors';
import { planImport, readLegacyComments, clearLegacyComments, legacyKey } from '../../lib/comments/legacyImport';
import { validateAnchor, validateBody, validateListQuery } from '../../lib/comments/validate';

const els = [{ id: 'a', x: 100, y: 50, width: 40, height: 20 }, { id: 'b', x: 120, y: 60, width: 40, height: 20 }];
const elAnchor = { type: 'element', targetId: 'a', x: 5, y: 6, fallbackX: 105, fallbackY: 56 };

describe('anchor resolution (read-time projection)', () => {
  test('canvas / attached / detached', () => {
    const ids = contentIds({ elements: els, connections: [{ id: 'k' }] });
    expect(anchorState({ type: 'canvas', x: 1, y: 1 }, ids)).toBe('canvas');
    expect(anchorState(elAnchor, ids)).toBe('attached');
    expect(anchorState({ ...elAnchor, targetId: 'zz' }, ids)).toBe('detached');
    expect(anchorState({ type: 'connection', targetId: 'k', x: 0, y: 0 }, ids)).toBe('attached');
    expect(anchorState({ type: 'connection', targetId: 'a', x: 0, y: 0 }, ids)).toBe('detached'); // ids are per kind
  });
  test('contentIds tolerates garbage', () => {
    expect(contentIds(null).elementIds.size).toBe(0);
    expect(contentIds({ elements: 'x', connections: [null, { id: 5 }] }).connectionIds.size).toBe(0);
  });
  test('marker follows its element when it moves, and falls back when detached', () => {
    expect(resolveMarker(elAnchor, { elements: els })).toEqual({ state: 'attached', x: 105, y: 56 });
    const moved = [{ ...els[0], x: 300, y: 400 }, els[1]];
    expect(resolveMarker(elAnchor, { elements: moved })).toEqual({ state: 'attached', x: 305, y: 406 });
    expect(resolveMarker(elAnchor, { elements: [els[1]] })).toEqual({ state: 'detached', x: 105, y: 56 });
    expect(resolveMarker({ type: 'canvas', x: 9, y: 8 }, { elements: [] })).toEqual({ state: 'canvas', x: 9, y: 8 });
  });
  test('elementAtPoint returns the topmost element', () => {
    expect(elementAtPoint(els, 125, 65).id).toBe('b');
    expect(elementAtPoint(els, 105, 52).id).toBe('a');
    expect(elementAtPoint(els, 0, 0)).toBeNull();
  });
});

describe('legacy localStorage import plan (Q-C1)', () => {
  test('keeps element anchors that still exist, drops unusable entries, keeps replies and resolved', () => {
    const legacy = [
      { id: '1', text: 'on a', x: 110, y: 55, elementId: 'a', resolved: true, replies: [{ text: 'r1' }, { text: '' }, { text: 'r2' }] },
      { id: '2', text: 'gone el', x: 1, y: 2, elementId: 'missing', replies: [] },
      { id: '3', text: '', x: 1, y: 2 },
      { id: '4', text: 'no pos' },
      null,
    ];
    const plan = planImport(legacy, els);
    expect(plan).toHaveLength(2);
    expect(plan[0]).toMatchObject({ anchor: { type: 'element', targetId: 'a', x: 10, y: 5, fallbackX: 110, fallbackY: 55 }, body: 'on a', replies: ['r1', 'r2'], resolved: true });
    expect(plan[1].anchor).toEqual({ type: 'canvas', x: 1, y: 2 });
  });
  test('bodies are clamped to the server limit', () => {
    expect(planImport([{ text: 'x'.repeat(20000), x: 1, y: 1 }])[0].body).toHaveLength(10000);
  });
  test('storage helpers never throw', () => {
    const bad = { getItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } };
    expect(readLegacyComments(bad, 'd')).toEqual([]);
    expect(() => clearLegacyComments(bad, 'd')).not.toThrow();
    const store = { [legacyKey('d')]: '{not json' };
    expect(readLegacyComments({ getItem: (k) => store[k] }, 'd')).toEqual([]);
    expect(readLegacyComments({ getItem: () => '{"a":1}' }, 'd')).toEqual([]);
  });
});

describe('validate', () => {
  test('body: text kept verbatim, limits enforced', () => {
    expect(validateBody('<script>alert(1)</script>')).toEqual({ ok: true, value: '<script>alert(1)</script>' });
    expect(validateBody('x'.repeat(10001)).status).toBe(413);
    expect(validateBody('\n\t ').ok).toBe(false);
    // counted in characters (code points) like the DB constraint, not UTF-16 units
    expect(validateBody('\u{1F600}'.repeat(10000)).ok).toBe(true);
    expect(validateBody('\u{1F600}'.repeat(10001)).status).toBe(413);
  });
  test('anchor normalizes to known keys only', () => {
    const r = validateAnchor({ type: 'element', targetId: 'e', x: 1, y: 2, fallbackX: 3, fallbackY: 4, evil: 'x' });
    expect(r.value).toEqual({ type: 'element', targetId: 'e', x: 1, y: 2, fallbackX: 3, fallbackY: 4 });
  });
  test('list query defaults', () => {
    expect(validateListQuery({}).value).toEqual({ status: 'open', anchorTarget: null, limit: undefined, cursor: null });
  });
});
