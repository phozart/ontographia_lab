import { validatePresentations, cleanNotes } from '../../lib/present/presentationSchema';
import { validateDiagramContent } from '../../lib/diagramContent';
import { MAX_PRESENTATIONS, MAX_SLIDES, MAX_NOTES_BYTES } from '../../lib/diagramLimits';

const deck = (over = {}) => ({ id: 'pres-1', title: 'Deck', aspect: '16:9', slides: [{ id: 's1', frameId: 'f1' }], ...over });

describe('validatePresentations', () => {
  it('passes undefined through and accepts an empty list', () => {
    expect(validatePresentations(undefined)).toEqual({ ok: true, presentations: undefined, warnings: [] });
    expect(validatePresentations([]).presentations).toEqual([]);
  });

  it('normalizes: defaults title and aspect, drops empty notes and false hidden', () => {
    const r = validatePresentations([{ id: 'p', slides: [{ id: 's', frameId: 'f', notes: '', hidden: false }] }]);
    expect(r.presentations).toEqual([{ id: 'p', title: 'Presentation', aspect: '16:9', slides: [{ id: 's', frameId: 'f' }] }]);
  });

  it('keeps notes (with newlines and tabs) and hidden:true', () => {
    const r = validatePresentations([deck({ slides: [{ id: 's', frameId: 'f', notes: 'a\n\tb', hidden: true }] })]);
    expect(r.presentations[0].slides[0]).toEqual({ id: 's', frameId: 'f', notes: 'a\n\tb', hidden: true });
  });

  it('strips control and bidi characters from notes and title', () => {
    expect(cleanNotes('a\u0000b‮c\u0007d\n')).toBe('abcd\n');
    const r = validatePresentations([deck({ title: 'T‮itle\n x', slides: [{ id: 's', frameId: 'f', notes: 'x\u0000y' }] })]);
    expect(r.presentations[0].title).toBe('T itle x');
    expect(r.presentations[0].slides[0].notes).toBe('xy');
  });

  it.each([
    ['not an array', {}],
    ['non-object deck', ['x']],
    ['unknown deck key', [deck({ extra: 1 })]],
    ['unknown slide key', [deck({ slides: [{ id: 's', frameId: 'f', color: 'red' }] })]],
    ['bad aspect', [deck({ aspect: 'free' })]],
    ['missing id', [deck({ id: undefined })]],
    ['id too long', [deck({ id: 'x'.repeat(129) })]],
    ['slide id too long', [deck({ slides: [{ id: 'x'.repeat(129), frameId: 'f' }] })]],
    ['missing frameId', [deck({ slides: [{ id: 's' }] })]],
    ['frameId not a string', [deck({ slides: [{ id: 's', frameId: 5 }] })]],
    ['duplicate deck ids', [deck(), deck()]],
    ['duplicate slide ids', [deck({ slides: [{ id: 's', frameId: 'a' }, { id: 's', frameId: 'b' }] })]],
    ['hidden not boolean', [deck({ slides: [{ id: 's', frameId: 'f', hidden: 'yes' }] })]],
    ['notes not a string', [deck({ slides: [{ id: 's', frameId: 'f', notes: 5 }] })]],
    ['slides not an array', [deck({ slides: {} })]],
  ])('rejects %s', (_n, input) => {
    const r = validatePresentations(input);
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });

  it('enforces the caps (20 decks, 200 slides, 10 KB notes -> 413)', () => {
    const many = Array.from({ length: MAX_PRESENTATIONS + 1 }, (_, i) => deck({ id: `p${i}` }));
    expect(validatePresentations(many).ok).toBe(false);
    const slides = Array.from({ length: MAX_SLIDES + 1 }, (_, i) => ({ id: `s${i}`, frameId: 'f' }));
    expect(validatePresentations([deck({ slides })]).ok).toBe(false);
    const big = validatePresentations([deck({ slides: [{ id: 's', frameId: 'f', notes: 'x'.repeat(MAX_NOTES_BYTES + 1) }] })]);
    expect(big).toMatchObject({ ok: false, status: 413, code: 'PAYLOAD_TOO_LARGE' });
    expect(validatePresentations([deck({ slides: [{ id: 's', frameId: 'f', notes: 'x'.repeat(MAX_NOTES_BYTES) }] })]).ok).toBe(true);
  });

  it('does not validate that frames exist: a dangling reference is a "missing" slide, not an error', () => {
    const r = validateDiagramContent({ elements: [], presentations: [deck({ slides: [{ id: 's', frameId: 'gone' }] })] });
    expect(r.ok).toBe(true);
    expect(r.content.presentations[0].slides[0].frameId).toBe('gone');
  });
});

describe('validateDiagramContent with presentations', () => {
  it('accepts the new top-level key and stores the normalized value', () => {
    const r = validateDiagramContent({ elements: [], presentations: [{ id: 'p', slides: [] }] });
    expect(r.ok).toBe(true);
    expect(r.content.presentations).toEqual([{ id: 'p', title: 'Presentation', aspect: '16:9', slides: [] }]);
  });

  it('rejects an invalid deck with 400 and a path in the message', () => {
    const r = validateDiagramContent({ presentations: [{ id: 'p', slides: [{ id: 's' }] }] });
    expect(r).toMatchObject({ ok: false, status: 400 });
    expect(r.error).toMatch(/presentations\[0\]\.slides\[0\]\.frameId/);
  });

  it('rejects duplicate presentation ids through the shared id rule', () => {
    const r = validateDiagramContent({ presentations: [{ id: 'p', slides: [] }, { id: 'p', slides: [] }] });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/more than one/);
  });

  it('rejects an id over 128 characters', () => {
    expect(validateDiagramContent({ presentations: [{ id: 'p'.repeat(129), slides: [] }] }).ok).toBe(false);
  });

  it('rejects a forbidden key anywhere inside', () => {
    const r = validateDiagramContent(JSON.parse('{"presentations":[{"id":"p","slides":[],"__proto__":{"x":1}}]}'));
    expect(r.ok).toBe(false);
  });
});
