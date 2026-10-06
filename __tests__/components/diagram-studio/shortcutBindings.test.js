import fs from 'fs';
import path from 'path';
import { resolveFKey } from '../../../components/diagram-studio/hooks/interaction/editorShortcuts';
import { flattenShortcuts, commandShortcut } from '../../../components/diagram-studio/ui/shortcutKeymap';

const root = path.join(__dirname, '../../../components/diagram-studio');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const canvas = read('DiagramCanvas.js');
const studio = read('DiagramStudio.js');
const editor = read('hooks/interaction/editorShortcuts.js');
const palette = read('ui/CommandPalette.js');
const overlay = read('ui/KeyboardShortcutsOverlay.js');

describe('F = fit only, Shift+F = focus mode only', () => {
  const ev = (key, extra = {}) => ({ key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...extra });
  test('resolver', () => {
    expect(resolveFKey(ev('f'))).toBe('fit');
    expect(resolveFKey(ev('F', { shiftKey: true }))).toBe('focus-mode');
    expect(resolveFKey(ev('f', { ctrlKey: true }))).toBeNull();
    expect(resolveFKey(ev('f', { metaKey: true }))).toBeNull();
    expect(resolveFKey(ev('g'))).toBeNull();
  });
  test('handlers use the resolver, so each key triggers exactly one action', () => {
    expect(studio).toMatch(/resolveFKey\(e\) === 'focus-mode'/);
    expect(studio).not.toMatch(/resolveFKey\(e\) === 'fit'/);
    expect(canvas).toMatch(/resolveFKey\(e\) === 'fit'/);
    expect(canvas).not.toMatch(/resolveFKey\(e\) === 'focus-mode'/);
  });
});

// One proof of binding per keymap entry: the source file must contain the handler.
// Adding a keymap entry without a row here fails the test.
const PROOF = {
  'V': [editor, /key === 'v'/], 'C': [canvas, /e\.key === 'c' && !e\.ctrlKey/], 'H': [editor, /key === 'h'/],
  'Space': [canvas, /e\.key === ' ' && !e\.repeat/], 'K': [studio, /e\.key === 'k' && !e\.ctrlKey/],
  'S': [canvas, /e\.key === 's' && !e\.ctrlKey/], 'N': [canvas, /e\.key === 'n' \|\| e\.key === 'N'/],
  'Mod+A': [canvas, /e\.key === 'a'/], 'Esc': [canvas, /e\.key === 'Escape'/],
  'Click': [canvas, /handleCanvasMouseDown/], 'Shift+Click': [canvas, /e\.shiftKey/],
  'Tab': [canvas, /e\.key === 'Tab'/], 'Enter': [canvas, /e\.key === 'Enter' && !e\.ctrlKey/],
  'Mod+[': [canvas, /e\.key === '\[' && \(e\.ctrlKey \|\| e\.metaKey\)/],
  'Mod+]': [canvas, /e\.key === '\]' && \(e\.ctrlKey \|\| e\.metaKey\) && !e\.shiftKey/],
  'Mod+Shift+]': [canvas, /e\.key === '\]' && \(e\.ctrlKey \|\| e\.metaKey\) && e\.shiftKey/],
  'Delete': [canvas, /e\.key === 'Delete'/], 'Backspace': [canvas, /e\.key === 'Backspace'/],
  'Mod+D': [canvas, /e\.key === 'd'/], 'Mod+C': [canvas, /e\.key === 'c' && !readOnly/], 'Mod+V': [canvas, /e\.key === 'v' && !readOnly/],
  'Mod+Z': [editor, /key === 'z'/], 'Mod+Y': [editor, /key === 'y'/], 'Mod+Shift+Z': [editor, /e\.shiftKey \? 'redo'/],
  'Mod+B': [canvas, /e\.key === 'b'/], 'Mod+I': [canvas, /e\.key === 'i'/], 'Mod+U': [canvas, /e\.key === 'u'/],
  'Mod+G': [canvas, /e\.key === 'g' && !e\.shiftKey/], 'Mod+Shift+G': [canvas, /e\.key === 'g' && e\.shiftKey/],
  '[': [canvas, /e\.key === '\[' && !e\.ctrlKey/], ']': [canvas, /e\.key === '\]' && !e\.ctrlKey/],
  'Shift+H': [canvas, /e\.key === 'H' && e\.shiftKey/], 'Shift+V': [canvas, /e\.key === 'V' && e\.shiftKey/],
  'Arrow keys': [canvas, /e\.key === 'ArrowLeft'/], 'Shift+Arrow': [canvas, /e\.shiftKey \? GRID_SIZE \* 2/],
  '+': [editor, /e\.key === '\+'/], '-': [editor, /e\.key === '-'/],
  '0': [canvas, /e\.key === '0' \|\| e\.key === 'Home'/], 'Home': [canvas, /e\.key === 'Home'/],
  'Mod+0': [canvas, /e\.key === '0' && \(e\.ctrlKey/], 'F': [editor, /'fit'/], 'Shift+F': [editor, /'focus-mode'/],
  'M': [canvas, /e\.key === 'm'/], '1': [studio, /e\.key === '1'/], 'P': [studio, /e\.key === 'p'/],
  'T': [studio, /e\.key === 't'/], 'Mod+K': [palette, /e\.key === 'k'/], '?': [overlay, /e\.key === '\?'/],
  'Mod+S': [studio, /e\.key === 's'/],
};

describe('every listed shortcut is really bound', () => {
  const entries = flattenShortcuts().filter((s) => s.keys[0] !== 'Any text field');
  test.each(entries.map((s) => [s.keys.join('+'), s]))('%s', (id) => {
    const proof = PROOF[id];
    expect(proof).toBeDefined();
    expect(proof[0]).toMatch(proof[1]);
  });
});

describe('command palette labels come from the keymap', () => {
  test('known commands', () => {
    expect(commandShortcut('save', false)).toBe('Ctrl+S');
    expect(commandShortcut('save', true)).toBe('⌘S');
    expect(commandShortcut('zoom-in', false)).toBe('+');
    expect(commandShortcut('focus-mode', false)).toBe('Shift+F');
    expect(commandShortcut('zoom-100', false)).toBe('');
    expect(commandShortcut('toggle-grid', false)).toBe('');
  });
  test('palette has no hard-coded shortcut strings', () => {
    expect(palette).not.toMatch(/shortcut: '/);
  });
});
