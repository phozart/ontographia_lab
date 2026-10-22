/**
 * @jest-environment node
 */
// ADR-0007 P2 deck compilers: slide_add with layouts and blocks, slide_update re-compose, text_add, theme_apply.
import { compileNewSlides, compileSlideRecompose, compileTextAdd, compileThemeApply } from '../../lib/mcp/slideCompose';
import { compilePresentationCreate } from '../../lib/mcp/deckTools';
import { validateDiagramContent } from '../../lib/diagramContent';

let n = 0;
const newId = (p) => `${p}-${(n += 1)}`;
const reset = () => { n = 0; };

const rect = (id, x, y, w, h, extra = {}) => ({ id, type: 'rectangle', packId: 'core', x, y, size: { width: w, height: h }, label: id, ...extra });
const tbl = { id: 'tb', type: 'table', packId: 'core', x: 3000, y: 0, size: { width: 400, height: 100 }, label: '', data: { table: { columns: [{ id: 'col-a', name: 'A', type: 'text' }], rows: [{ id: 'row-1', cells: { 'col-a': 'x' } }] } } };
const board = () => ({ elements: [rect('a', 0, 0, 300, 200), rect('b', 400, 0, 300, 200), tbl], connections: [{ id: 'c1', sourceId: 'a', targetId: 'b' }] });
const withDeck = (content = board()) => {
  const r = compilePresentationCreate(content, { title: 'Deck' });
  return { content: r.content, presentationId: r.presentationId };
};
const frames = (c) => c.elements.filter((e) => e.type === 'frame');

describe('compileNewSlides', () => {
  test('a cover slide: frame 1920x1080 with theme background, accent bar, title and subtitle in preset slots', () => {
    reset();
    const { content, presentationId } = withDeck();
    const r = compileNewSlides(content, { presentationId, slides: [{ title: 'Checkout review', layout: 'title', blocks: [{ text: { markdown: 'October readout' } }], notes: 'say hi' }], revision: 3, newId });
    expect(r.ok).toBe(true);
    const f = frames(r.content)[0];
    expect(f.size).toEqual({ width: 1920, height: 1080 });
    expect(f.data).toMatchObject({ aspect: '16:9', backgroundColor: '@surface', layout: 'title' }); // the cover sits on the surface ground
    expect(f.label).toBe('Checkout review');
    const kids = r.content.elements.filter((e) => e.parentFrameId === f.id);
    const title = kids.find((e) => e.data?.text?.preset === 'title');
    const sub = kids.find((e) => e.data?.text?.preset === 'subtitle');
    expect(title.data.text.markdown).toBe('Checkout review');
    expect(title.fontSize).toBe(72);
    expect(title.origin).toEqual({ slot: 'title' });
    expect(sub.data.text.markdown).toBe('October readout');
    expect(sub.origin.slot).toBe('subtitle');
    expect(kids.some((e) => e.origin?.slot === 'decor' && e.backgroundColor === '@accent')).toBe(true);
    const deck = r.content.presentations[0];
    expect(deck.slides).toHaveLength(1);
    expect(deck.slides[0]).toMatchObject({ frameId: f.id, notes: 'say hi' });
    expect(r.slideIds).toEqual([deck.slides[0].id]);
    expect(validateDiagramContent(r.content).ok).toBe(true);
  });

  test('two-column with a text block and a copy block (snapshot with provenance, sources untouched)', () => {
    reset();
    const { content, presentationId } = withDeck();
    const r = compileNewSlides(content, {
      presentationId, revision: 9, newId,
      slides: [{ title: 'Side by side', layout: 'two-column', blocks: [{ slot: 'left', copy: { elementIds: ['a', 'b'] } }, { slot: 'right', text: { markdown: '- one\n- two' } }] }],
    });
    expect(r.ok).toBe(true);
    const f = frames(r.content)[0];
    const kids = r.content.elements.filter((e) => e.parentFrameId === f.id);
    const copies = kids.filter((e) => e.origin?.copiedFrom);
    expect(copies).toHaveLength(2);
    expect(copies.map((c) => c.origin.copiedFrom.elementId).sort()).toEqual(['a', 'b']);
    expect(copies.every((c) => c.origin.copiedFrom.revision === 9 && c.origin.slot === 'left')).toBe(true);
    expect(r.content.connections.filter((c) => c.sourceId !== 'a')).toHaveLength(1); // the copied connection
    // originals untouched
    expect(r.content.elements.find((e) => e.id === 'a')).toEqual(rect('a', 0, 0, 300, 200));
    // the copies fit inside the left half of the slide
    for (const c of copies) {
      expect(c.x).toBeGreaterThanOrEqual(f.x + 96);
      expect(c.x + c.size.width).toBeLessThanOrEqual(f.x + 96 + (1728 - 48) / 2 + 1);
    }
    const right = kids.find((e) => e.origin?.slot === 'right');
    expect(right.data.text.markdown).toBe('- one\n- two');
  });

  test('a table block is scaled into its slot with table.scale', () => {
    reset();
    const { content, presentationId } = withDeck();
    const wide = { columns: Array.from({ length: 8 }, (_, i) => ({ name: `C${i}`, width: 240 })), rows: [Array.from({ length: 8 }, (_, i) => `v${i}`)] };
    const r = compileNewSlides(content, { presentationId, revision: 1, newId, slides: [{ title: 'T', layout: 'title-visual', blocks: [{ table: wide }] }] });
    expect(r.ok).toBe(true);
    const t = r.content.elements.find((e) => e.type === 'table' && e.origin?.slot === 'visual');
    expect(t.data.table.scale).toBeLessThan(1);
    expect(t.size.width).toBeLessThanOrEqual(1728 + 1);
  });

  test('five slides in one call: ordered, spaced, one frame each, one deck update', () => {
    reset();
    const { content, presentationId } = withDeck();
    const slides = ['title', 'title-body', 'two-column', 'big-number', 'title-visual'].map((layout, i) => ({
      title: `Slide ${i + 1}`, layout,
      blocks: layout === 'title' ? [{ text: { markdown: 'Sub' } }] : layout === 'title-body' ? [{ text: { markdown: '- a\n- b' } }]
        : layout === 'two-column' ? [{ text: { markdown: 'L' } }, { text: { markdown: 'R' } }]
        : layout === 'big-number' ? [{ text: { markdown: '42%' } }, { text: { markdown: 'conversion' } }, { text: { markdown: 'because' } }]
        : [{ copy: { elementIds: ['a', 'b'] } }],
    }));
    const r = compileNewSlides(content, { presentationId, slides, revision: 1, newId });
    expect(r.ok).toBe(true);
    expect(r.slideIds).toHaveLength(5);
    const fs = frames(r.content);
    expect(fs).toHaveLength(5);
    const xs = fs.map((f) => f.x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
    expect(xs[1] - xs[0]).toBe(1920 + 160);
    expect(r.content.presentations[0].slides.map((s) => s.frameId)).toEqual(r.frameIds);
    expect(validateDiagramContent(r.content).ok).toBe(true);
  });

  test('deterministic for the same input and id sequence', () => {
    const { content, presentationId } = withDeck();
    const call = () => { reset(); return compileNewSlides(content, { presentationId, revision: 2, newId, slides: [{ title: 'X', layout: 'two-column', blocks: [{ copy: { elementIds: ['a'] } }, { text: { markdown: 'y' } }] }] }); };
    const a = call();
    const b = call();
    expect(a.content).toEqual(b.content);
  });

  test('errors say what to fix and nothing is half-applied', () => {
    const { content, presentationId } = withDeck();
    const slide = (o) => compileNewSlides(content, { presentationId, revision: 1, newId, slides: [o] });
    expect(slide({ title: 'x', layout: 'carousel' }).ok).toBe(false);
    expect(slide({ title: 'x', layout: 'title-body', blocks: [{ text: { markdown: 'a' } }, { text: { markdown: 'b' } }] }).errors[0].message).toMatch(/slot/);
    expect(slide({ title: 'x', layout: 'two-column', blocks: [{ slot: 'middle', text: { markdown: 'a' } }] }).ok).toBe(false);
    expect(slide({ title: 'x', layout: 'title-body', blocks: [{ text: { markdown: 'a' }, copy: { elementIds: ['a'] } }] }).ok).toBe(false);
    expect(slide({ title: 'x', evil: 1 }).ok).toBe(false);
    expect(slide({ title: 'x', layout: 'title-body', blocks: [{ copy: { elementIds: ['nope'] } }] }).errors[0].message).toMatch(/nope/);
    expect(compileNewSlides(content, { presentationId: 'pres-x', slides: [{}], revision: 1 }).ok).toBe(false);
    expect(compileNewSlides(content, { presentationId, slides: Array.from({ length: 41 }, () => ({})), revision: 1 }).ok).toBe(false);
  });

  test('a copy that would shrink below 0.35x is refused with the own-slide suggestion', () => {
    const huge = { elements: [rect('h1', 0, 0, 6000, 3000)], connections: [] };
    const { content, presentationId } = withDeck(huge);
    const r = compileNewSlides(content, { presentationId, revision: 1, newId, slides: [{ title: 'x', layout: 'title-visual', blocks: [{ copy: { elementIds: ['h1'] } }] }] });
    expect(r.ok).toBe(false);
    expect(r.errors[0].message).toMatch(/own slide/);
  });

  test('a long text warns that the slot is too small instead of clipping silently', () => {
    const { content, presentationId } = withDeck();
    const r = compileNewSlides(content, { presentationId, revision: 1, newId, slides: [{ title: 't', layout: 'title-body', blocks: [{ text: { markdown: 'word '.repeat(600) } }] }] });
    expect(r.ok).toBe(true);
    expect(r.warnings.join(' ')).toMatch(/needs .* height|grew to fit/);
  });

  test('hostile markdown in a block is neutralized', () => {
    const { content, presentationId } = withDeck();
    const r = compileNewSlides(content, { presentationId, revision: 1, newId, slides: [{ title: '<img src=x onerror=1>', layout: 'title-body', blocks: [{ text: { markdown: '[a](javascript:alert(1))' } }] }] });
    expect(r.ok).toBe(true);
    const all = JSON.stringify(r.content.elements.filter((e) => e.type === 'text-block').map((e) => e.data));
    expect(all).not.toMatch(/\]\(javascript:/i);
    expect(all).not.toMatch(/[^\\]<img/);
  });
});

describe('compileSlideRecompose', () => {
  const built = () => {
    reset();
    const { content, presentationId } = withDeck();
    const r = compileNewSlides(content, { presentationId, revision: 1, newId, slides: [{ title: 'One', layout: 'two-column', blocks: [{ text: { markdown: 'L' } }, { text: { markdown: 'R' } }] }] });
    // a person adds their own sticky to the slide
    const frameId = r.frameIds[0];
    const mine = rect('mine', 5, 5, 50, 50, { parentFrameId: frameId });
    return { content: { ...r.content, elements: [...r.content.elements, mine] }, presentationId, slideId: r.slideIds[0], frameId };
  };
  test('replaces only what the tool placed, keeps the person\'s own elements, updates layout and title', () => {
    const { content, presentationId, slideId, frameId } = built();
    const r = compileSlideRecompose(content, { presentationId, slideId, layout: 'three-column', title: 'Renamed', blocks: [{ text: { markdown: 'A' } }, { text: { markdown: 'B' } }, { text: { markdown: 'C' } }], revision: 2, newId });
    expect(r.ok).toBe(true);
    const kids = r.content.elements.filter((e) => e.parentFrameId === frameId);
    expect(kids.some((e) => e.id === 'mine')).toBe(true);
    expect(kids.filter((e) => e.origin?.slot).map((e) => e.origin.slot).sort()).toEqual(['c1', 'c2', 'c3', 'decor', 'title']);
    expect(r.content.elements.find((e) => e.id === frameId)).toMatchObject({ label: 'Renamed', data: expect.objectContaining({ layout: 'three-column' }) });
    expect(validateDiagramContent(r.content).ok).toBe(true);
  });
  test('without layout it reuses the stored one; unknown slide / layout fail', () => {
    const { content, presentationId, slideId } = built();
    const r = compileSlideRecompose(content, { presentationId, slideId, blocks: [{ text: { markdown: 'only left' } }], revision: 2, newId });
    expect(r.ok).toBe(true);
    expect(compileSlideRecompose(content, { presentationId, slideId: 'nope', blocks: [], revision: 1 }).ok).toBe(false);
    expect(compileSlideRecompose(content, { presentationId, slideId, layout: 'zzz', revision: 1 }).ok).toBe(false);
  });
  test('a locked placed element is kept and reported', () => {
    const { content, presentationId, slideId, frameId } = built();
    const locked = { ...content, elements: content.elements.map((e) => (e.parentFrameId === frameId && e.origin?.slot === 'left' ? { ...e, locked: true } : e)) };
    const r = compileSlideRecompose(locked, { presentationId, slideId, blocks: [{ text: { markdown: 'new' } }], revision: 2, newId });
    expect(r.ok).toBe(true);
    expect(r.warnings.join(' ')).toMatch(/locked/);
  });
});

describe('compileTextAdd', () => {
  test('inSlide replaces the tool-placed text in that slot', () => {
    reset();
    const { content, presentationId } = withDeck();
    const s = compileNewSlides(content, { presentationId, revision: 1, newId, slides: [{ title: 'T', layout: 'title-body', blocks: [{ text: { markdown: 'old' } }] }] });
    const r = compileTextAdd(s.content, { markdown: 'new **body**', preset: 'body', inSlide: { presentationId, slideId: s.slideIds[0], slot: 'body' } });
    expect(r.ok).toBe(true);
    const bodies = r.content.elements.filter((e) => e.origin?.slot === 'body');
    expect(bodies).toHaveLength(1);
    expect(bodies[0].data.text.markdown).toBe('new **body**');
    expect(r.elementId).toBe(bodies[0].id);
  });
  test('inSlide needs a layout and a real slot', () => {
    const { content, presentationId } = withDeck();
    const s = compileNewSlides(content, { presentationId, revision: 1, newId, slides: [{ title: 'T', layout: 'title-body' }] });
    expect(compileTextAdd(s.content, { markdown: 'x', preset: 'body', inSlide: { presentationId, slideId: s.slideIds[0], slot: 'zzz' } }).ok).toBe(false);
    const plain = { ...s.content, elements: s.content.elements.map((e) => (e.type === 'frame' ? { ...e, data: { ...e.data, layout: undefined } } : e)) };
    expect(compileTextAdd(plain, { markdown: 'x', preset: 'body', inSlide: { presentationId, slideId: s.slideIds[0], slot: 'body' } }).ok).toBe(false);
  });
  test('anchor near an element places a preset text beside it', () => {
    const r = compileTextAdd(board(), { markdown: 'Note', preset: 'caption', anchor: { near: 'a' }, width: 400 });
    expect(r.ok).toBe(true);
    const el = r.content.elements.find((e) => e.id === r.elementId);
    expect(el.data.text.preset).toBe('caption');
    expect(el.x).toBeGreaterThan(300);
  });
  test('bad anchors fail', () => {
    expect(compileTextAdd(board(), { markdown: 'x', preset: 'body', anchor: { near: 'zz' } }).ok).toBe(false);
    expect(compileTextAdd(board(), { markdown: 'x', preset: 'body', anchor: { near: 'a', at: { x: 1, y: 1 } } }).ok).toBe(false);
    expect(compileTextAdd(board(), { markdown: 'x', preset: 'body', anchor: { near: 'a' }, inSlide: {} }).ok).toBe(false);
  });
});

describe('compileThemeApply', () => {
  test('applies a preset and returns the theme', () => {
    const r = compileThemeApply(board(), { preset: 'paper' });
    expect(r.ok).toBe(true);
    expect(r.theme.preset).toBe('paper');
  });
  test('rejects an empty patch', () => {
    expect(compileThemeApply(board(), {}).ok).toBe(false);
  });
});
