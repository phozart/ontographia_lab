// ADR-0007 P2: editor deck actions for layouts and preset text.
import { addNewSlide, applyLayoutToFrame, addPresetText } from '../../../components/diagram-studio/present/deckActions';

const frame = { id: 'f', type: 'frame', packId: 'core', isFrame: true, x: 1000, y: 500, size: { width: 1920, height: 1080 }, label: 'S', data: { aspect: '16:9' } };

function harness(elements = []) {
  const added = [];
  const updated = [];
  return {
    added, updated,
    addElement: jest.fn((e) => { const el = { id: `new-${added.length + 1}`, ...e }; added.push(el); return el; }),
    updateElement: jest.fn((id, patch) => updated.push({ id, patch })),
    patchPresentation: jest.fn(() => ({ ok: true, presentationId: 'p1', slideIds: ['s1'] })),
    elements,
  };
}

describe('addNewSlide with a layout', () => {
  test('creates a themed frame (@bg) that remembers its layout, then its decor, title and placeholders as children', () => {
    const h = harness();
    const r = addNewSlide({ patchPresentation: h.patchPresentation, addElement: h.addElement, presentations: [{ id: 'p1', aspect: '16:9', slides: [] }], activeId: 'p1', elements: [], layout: 'two-column' });
    expect(r.ok).toBe(true);
    const f = h.added[0];
    expect(f.type).toBe('frame');
    expect(f.data).toMatchObject({ backgroundColor: '@bg', aspect: '16:9', layout: 'two-column' });
    const kids = h.added.slice(1);
    expect(kids.map((k) => k.origin.slot).sort()).toEqual(['decor', 'left', 'right', 'title']);
    expect(kids.every((k) => k.parentFrameId === f.id)).toBe(true);
  });
  test('without a layout it is the plain themed slide frame', () => {
    const h = harness();
    addNewSlide({ patchPresentation: h.patchPresentation, addElement: h.addElement, presentations: [{ id: 'p1', aspect: '16:9', slides: [] }], activeId: 'p1', elements: [] });
    expect(h.added).toHaveLength(1);
    expect(h.added[0].data.backgroundColor).toBe('@bg');
  });
});

describe('applyLayoutToFrame', () => {
  test('fails without a frame', () => {
    expect(applyLayoutToFrame({ frame: undefined, elements: [], layout: 'title-body', addElement: jest.fn(), updateElement: jest.fn() }).ok).toBe(false);
  });
  test('adds placeholders, remembers the layout on the frame', () => {
    const h = harness([frame]);
    const r = applyLayoutToFrame({ frame, elements: [frame], layout: 'title-body', addElement: h.addElement, updateElement: h.updateElement });
    expect(r).toMatchObject({ ok: true, added: 3 });
    expect(h.updated.find((u) => u.id === 'f').patch.data.layout).toBe('title-body');
  });
});

describe('addPresetText', () => {
  test('inside a frame: a child of the frame at the slide margins with the materialized size', () => {
    const h = harness();
    addPresetText({ preset: 'heading', frame, elements: [frame], addElement: h.addElement });
    const el = h.added[0];
    expect(el.parentFrameId).toBe('f');
    expect(el.x).toBe(1096);
    expect(el.y).toBe(500 + 96 + 168); // below the title band
    expect(el.fontSize).toBe(48);
    expect(el.data.text.preset).toBe('heading');
  });
  test('cascades: each text the person added before moves the next one down and right (slot placeholders do not count)', () => {
    const h = harness();
    const mine = { id: 'k', parentFrameId: 'f', x: 1100, y: 600, size: { width: 400, height: 100 } };
    const placeholder = { id: 'p', parentFrameId: 'f', origin: { slot: 'title' } };
    addPresetText({ preset: 'body', frame, elements: [frame, placeholder], addElement: h.addElement });
    addPresetText({ preset: 'body', frame, elements: [frame, placeholder, mine], addElement: h.addElement });
    expect(h.added[1].y - h.added[0].y).toBe(48);
    expect(h.added[1].x - h.added[0].x).toBe(24);
  });
  test('without a frame: centred on the given canvas point', () => {
    const h = harness();
    addPresetText({ preset: 'number', frame: null, elements: [], addElement: h.addElement, center: { x: 2000, y: 1000 } });
    const el = h.added[0];
    expect(el.parentFrameId).toBeUndefined();
    expect(el.x).toBe(1700);
    expect(el.data.text.markdown).toBe('42%');
  });
});
