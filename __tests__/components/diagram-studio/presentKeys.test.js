import { actionForKey, actionForClick, actionForSwipe, moveIndex } from '../../../components/diagram-studio/present/presentKeys';
import { addFramesToDeck, addNewSlide, setFrameShape, pickDeck, clampIndex } from '../../../components/diagram-studio/present/deckActions';
import { applyPresentationPatch } from '../../../lib/present/presentationPatch';

describe('present mode keyboard contract', () => {
  test.each([
    ['ArrowRight', 'next'], ['ArrowDown', 'next'], [' ', 'next'], ['PageDown', 'next'], ['Enter', 'next'],
    ['ArrowLeft', 'prev'], ['ArrowUp', 'prev'], ['PageUp', 'prev'], ['Backspace', 'prev'],
    ['Home', 'first'], ['End', 'last'], ['Escape', 'exit'], ['b', 'black'], ['B', 'black'], ['f', 'fullscreen'], ['n', 'notes'],
  ])('%s -> %s', (key, type) => {
    expect(actionForKey(key)).toEqual({ type });
  });

  test('digits build a slide number, Enter goes there, Backspace deletes a digit first', () => {
    expect(actionForKey('7')).toEqual({ type: 'digit', digit: '7' });
    expect(actionForKey('Enter', '12')).toEqual({ type: 'goto', n: 12 });
    expect(actionForKey('Backspace', '12')).toEqual({ type: 'digit-back' });
  });

  test('other keys are not claimed (the editor shortcuts are blocked separately)', () => {
    expect(actionForKey('v')).toBeNull();
    expect(actionForKey('Delete')).toBeNull();
    expect(actionForKey('Tab')).toBeNull();
  });

  test('moveIndex clamps at both ends and supports goto / first / last', () => {
    expect(moveIndex(0, { type: 'prev' }, 5)).toBe(0);
    expect(moveIndex(4, { type: 'next' }, 5)).toBe(4);
    expect(moveIndex(1, { type: 'next' }, 5)).toBe(2);
    expect(moveIndex(3, { type: 'first' }, 5)).toBe(0);
    expect(moveIndex(0, { type: 'last' }, 5)).toBe(4);
    expect(moveIndex(0, { type: 'goto', n: 3 }, 5)).toBe(2);
    expect(moveIndex(0, { type: 'goto', n: 99 }, 5)).toBe(4);
    expect(moveIndex(0, { type: 'goto', n: 0 }, 5)).toBe(0);
    expect(moveIndex(2, { type: 'next' }, 0)).toBe(0);
  });

  test('click thirds and swipes', () => {
    expect(actionForClick(10, 900)).toEqual({ type: 'prev' });
    expect(actionForClick(450, 900)).toBeNull();
    expect(actionForClick(800, 900)).toEqual({ type: 'next' });
    expect(actionForSwipe(-80, 5)).toEqual({ type: 'next' });
    expect(actionForSwipe(80, 5)).toEqual({ type: 'prev' });
    expect(actionForSwipe(20, 0)).toBeNull();
    expect(actionForSwipe(-80, 90)).toBeNull(); // mostly vertical
  });
});

describe('deck actions', () => {
  let n = 0;
  const newId = (p) => `${p}-${++n}`;
  const frame = (id, x = 0) => ({ id, type: 'frame', packId: 'core', x, y: 0, size: { width: 1920, height: 1080 }, label: id });
  // a tiny stand-in for the context: elements and presentations in a box, patchPresentation like the provider's
  const harness = (elements, presentations) => {
    const box = { elements: [...elements], presentations };
    return {
      box,
      patchPresentation: (patch) => {
        const r = applyPresentationPatch(box.presentations, box.elements, patch, { newId });
        if (r.ok) box.presentations = r.presentations;
        return r;
      },
      addElement: (el) => { const e = { id: newId('el'), ...el }; box.elements.push(e); return e; },
      updateElement: (id, u) => { box.elements = box.elements.map((e) => (e.id === id ? { ...e, ...u } : e)); },
    };
  };

  test('"Add to presentation" with no deck creates Presentation 1 and adds the frame', () => {
    const h = harness([frame('f1')], undefined);
    const r = addFramesToDeck({ ...h, presentations: h.box.presentations, activeId: null, frameIds: ['f1'] });
    expect(r.ok).toBe(true);
    expect(h.box.presentations).toHaveLength(1);
    expect(h.box.presentations[0]).toMatchObject({ title: 'Presentation 1', slides: [{ frameId: 'f1' }] });
  });

  test('"Add to presentation" targets the active deck, else the first', () => {
    const decks = [{ id: 'a', title: 'A', aspect: '16:9', slides: [] }, { id: 'b', title: 'B', aspect: '16:9', slides: [] }];
    expect(pickDeck(decks, 'b').id).toBe('b');
    expect(pickDeck(decks, 'gone').id).toBe('a');
    expect(pickDeck([], 'a')).toBeNull();
    const h = harness([frame('f1')], decks);
    addFramesToDeck({ ...h, presentations: decks, activeId: 'b', frameIds: ['f1'] });
    expect(h.box.presentations[1].slides).toHaveLength(1);
    expect(h.box.presentations[0].slides).toHaveLength(0);
  });

  test('"Add slide" makes a 16:9 frame right of the last slide and references it', () => {
    const decks = [{ id: 'a', title: 'A', aspect: '16:9', slides: [{ id: 's1', frameId: 'f1' }] }];
    const h = harness([frame('f1', 100)], decks);
    const r = addNewSlide({ ...h, presentations: decks, activeId: 'a', elements: h.box.elements });
    expect(r.ok).toBe(true);
    const made = h.box.elements.find((e) => e.id === r.frameId);
    expect(made).toMatchObject({ type: 'frame', label: 'Slide 2', x: 100 + 1920 + 160, size: { width: 1920, height: 1080 }, data: { aspect: '16:9' } });
    expect(h.box.presentations[0].slides.map((s) => s.frameId)).toEqual(['f1', r.frameId]);
  });

  test('slide shape presets grow a frame to the ratio and "free" unlocks', () => {
    const h = harness([{ ...frame('f1'), size: { width: 600, height: 400 }, data: { backgroundColor: '#fff' } }], []);
    setFrameShape(h.box.elements[0], '16:9', h.updateElement);
    expect(h.box.elements[0]).toMatchObject({ size: { width: 711, height: 400 }, data: { backgroundColor: '#fff', aspect: '16:9' } });
    setFrameShape(h.box.elements[0], 'free', h.updateElement);
    expect(h.box.elements[0].data.aspect).toBe('free');
    expect(h.box.elements[0].size).toEqual({ width: 711, height: 400 });
  });

  test('clampIndex', () => {
    expect(clampIndex(5, 3)).toBe(2);
    expect(clampIndex(-1, 3)).toBe(0);
    expect(clampIndex(1, 0)).toBe(0);
  });
});
