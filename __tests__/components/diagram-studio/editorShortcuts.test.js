import { resolveEditorShortcut, isTypingTarget } from '../../../components/diagram-studio/hooks/interaction/editorShortcuts';

const ev = (key, extra = {}) => ({ key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, target: { tagName: 'DIV' }, ...extra });

describe('resolveEditorShortcut', () => {
  test('undo with Ctrl or Cmd+Z', () => {
    expect(resolveEditorShortcut(ev('z', { ctrlKey: true }))).toBe('undo');
    expect(resolveEditorShortcut(ev('z', { metaKey: true }))).toBe('undo');
  });
  test('redo with Ctrl/Cmd+Shift+Z and Ctrl+Y', () => {
    expect(resolveEditorShortcut(ev('Z', { metaKey: true, shiftKey: true }))).toBe('redo');
    expect(resolveEditorShortcut(ev('z', { ctrlKey: true, shiftKey: true }))).toBe('redo');
    expect(resolveEditorShortcut(ev('y', { ctrlKey: true }))).toBe('redo');
  });
  test('tool and zoom keys', () => {
    expect(resolveEditorShortcut(ev('v'))).toBe('tool-select');
    expect(resolveEditorShortcut(ev('h'))).toBe('tool-pan');
    expect(resolveEditorShortcut(ev('+'))).toBe('zoom-in');
    expect(resolveEditorShortcut(ev('='))).toBe('zoom-in');
    expect(resolveEditorShortcut(ev('-'))).toBe('zoom-out');
  });
  test('ignores shift-modified V/H (alignment shortcuts) and other modifiers', () => {
    expect(resolveEditorShortcut(ev('V', { shiftKey: true }))).toBeNull();
    expect(resolveEditorShortcut(ev('H', { shiftKey: true }))).toBeNull();
    expect(resolveEditorShortcut(ev('v', { ctrlKey: true }))).toBeNull();
    expect(resolveEditorShortcut(ev('h', { altKey: true }))).toBeNull();
  });
  test('ignored while typing', () => {
    expect(resolveEditorShortcut(ev('z', { ctrlKey: true, target: { tagName: 'INPUT' } }))).toBeNull();
    expect(resolveEditorShortcut(ev('v', { target: { tagName: 'TEXTAREA' } }))).toBeNull();
    expect(resolveEditorShortcut(ev('h', { target: { tagName: 'DIV', isContentEditable: true } }))).toBeNull();
    expect(isTypingTarget({ tagName: 'SELECT' })).toBe(true);
  });
});
