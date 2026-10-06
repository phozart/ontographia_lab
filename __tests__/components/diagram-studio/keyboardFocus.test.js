import { shouldHandleShortcut, isTypingTarget, isInsideOverlay } from '../../../components/diagram-studio/hooks/interaction/keyboardFocus';

const el = (tagName, extra = {}) => ({ tagName, closest: () => null, ...extra });
const ev = (key, extra = {}) => ({ key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, target: el('DIV'), ...extra });

describe('isTypingTarget', () => {
  test.each(['INPUT', 'TEXTAREA', 'SELECT'])('%s is a text field', (t) => expect(isTypingTarget(el(t))).toBe(true));
  test('contenteditable and role=textbox', () => {
    expect(isTypingTarget(el('DIV', { isContentEditable: true }))).toBe(true);
    expect(isTypingTarget(el('DIV', { getAttribute: (a) => (a === 'role' ? 'textbox' : null) }))).toBe(true);
  });
  test('plain nodes are not', () => {
    expect(isTypingTarget(el('DIV'))).toBe(false);
    expect(isTypingTarget(el('BODY'))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe('isInsideOverlay', () => {
  test('matches a dialog ancestor', () => {
    expect(isInsideOverlay(el('DIV', { closest: () => ({}) }))).toBe(true);
    expect(isInsideOverlay(el('DIV'))).toBe(false);
    expect(isInsideOverlay(null)).toBe(false);
  });
});

describe('shouldHandleShortcut: single-key shortcuts over a matrix of focus states', () => {
  const focusStates = {
    'body/canvas': [ev('n'), {}, true],
    'input': [ev('n', { target: el('INPUT') }), {}, false],
    'textarea': [ev('n', { target: el('TEXTAREA') }), {}, false],
    'select': [ev('n', { target: el('SELECT') }), {}, false],
    'contenteditable': [ev('n', { target: el('DIV', { isContentEditable: true }) }), {}, false],
    'activeElement is input while target is body': [ev('n'), { activeElement: el('INPUT') }, false],
    'on-canvas label editor active (not yet focused)': [ev('n'), { editorActive: true }, false],
    'inside dialog': [ev('n', { target: el('DIV', { closest: () => ({}) }) }), {}, false],
    'dialog open anywhere': [ev('n'), { overlayOpen: true }, false],
    'IME composing': [ev('n', { isComposing: true }), {}, false],
    'shift+letter is still single-key': [ev('N', { shiftKey: true, target: el('INPUT') }), {}, false],
  };
  test.each(Object.entries(focusStates))('%s', (_n, [event, state, expected]) => {
    expect(shouldHandleShortcut(event, state)).toBe(expected);
  });

  test('Enter/Space/Tab are not hijacked from a focused button or link', () => {
    for (const k of ['Enter', ' ', 'Tab']) {
      expect(shouldHandleShortcut(ev(k, { target: el('BUTTON') }), {})).toBe(false);
      expect(shouldHandleShortcut(ev(k, { target: el('A') }), {})).toBe(false);
    }
    expect(shouldHandleShortcut(ev('n', { target: el('BUTTON') }), {})).toBe(true);
  });
});

describe('shouldHandleShortcut: modified shortcuts', () => {
  test('ctrl/cmd shortcuts are left to the text field while typing', () => {
    expect(shouldHandleShortcut(ev('z', { ctrlKey: true, target: el('INPUT') }), {})).toBe(false);
    expect(shouldHandleShortcut(ev('z', { metaKey: true }), { editorActive: true })).toBe(false);
  });
  test('ctrl/cmd shortcuts still work on canvas and with a dialog open', () => {
    expect(shouldHandleShortcut(ev('s', { ctrlKey: true }), {})).toBe(true);
    expect(shouldHandleShortcut(ev('s', { ctrlKey: true }), { overlayOpen: true })).toBe(true);
  });
});
