import { formatShortcut, isMac } from '../../../lib/platform';

// components/diagram-studio/ui/shortcutKeymap.js
// Single source of truth for the shortcut list shown in ShortcutsHelp and
// KeyboardShortcutsOverlay. Every entry must match a real key binding in
// DiagramStudio.js / DiagramCanvas.js / hooks/interaction/editorShortcuts.js.
// 'Mod' renders as Cmd on macOS and Ctrl elsewhere.

export const SHORTCUT_GROUPS = [
  {
    name: 'Tools',
    shortcuts: [
      { keys: ['V'], description: 'Select tool' },
      { keys: ['C'], description: 'Connect tool' },
      { keys: ['H'], description: 'Pan tool' },
      { keys: ['Space'], description: 'Pan (hold, then drag)' },
      { keys: ['K'], description: 'Comment mode', commandId: 'add-comment' },
      { keys: ['S'], description: 'Draw a Task shape' },
      { keys: ['N'], description: 'Add a sticky note near the center' },
    ],
  },
  {
    name: 'Selection',
    shortcuts: [
      { keys: ['Mod', 'A'], description: 'Select all', commandId: 'select-all' },
      { keys: ['Esc'], description: 'Deselect / cancel', commandId: 'deselect' },
      { keys: ['Click'], description: 'Select element' },
      { keys: ['Shift', 'Click'], description: 'Add to selection' },
    ],
  },
  {
    name: 'Mind map',
    shortcuts: [
      { keys: ['Tab'], description: 'Add child topic' },
      { keys: ['Enter'], description: 'Add sibling topic' },
      { keys: ['Mod', '['], description: 'Collapse subtree' },
      { keys: ['Mod', ']'], description: 'Expand subtree' },
      { keys: ['Mod', 'Shift', ']'], description: 'Expand all' },
    ],
  },
  {
    name: 'Editing',
    shortcuts: [
      { keys: ['Delete'], description: 'Delete selected', commandId: 'delete-selected' },
      { keys: ['Backspace'], description: 'Delete selected' },
      { keys: ['Mod', 'D'], description: 'Duplicate selected', commandId: 'duplicate' },
      { keys: ['Mod', 'C'], description: 'Copy', commandId: 'copy' },
      { keys: ['Mod', 'V'], description: 'Paste', commandId: 'paste' },
      { keys: ['Mod', 'Z'], description: 'Undo' },
      { keys: ['Mod', 'Y'], description: 'Redo' },
      { keys: ['Mod', 'Shift', 'Z'], description: 'Redo' },
      { keys: ['Mod', 'B'], description: 'Bold' },
      { keys: ['Mod', 'I'], description: 'Italic' },
      { keys: ['Mod', 'U'], description: 'Underline' },
      { keys: ['Mod', 'G'], description: 'Group' },
      { keys: ['Mod', 'Shift', 'G'], description: 'Ungroup' },
      { keys: ['['], description: 'Rotate 90° counter-clockwise' },
      { keys: [']'], description: 'Rotate 90° clockwise' },
      { keys: ['Shift', 'H'], description: 'Flip horizontal' },
      { keys: ['Shift', 'V'], description: 'Flip vertical' },
      { keys: ['Arrow keys'], description: 'Nudge selected elements' },
      { keys: ['Shift', 'Arrow'], description: 'Nudge by a larger step' },
    ],
  },
  {
    name: 'View',
    shortcuts: [
      { keys: ['+'], description: 'Zoom in', commandId: 'zoom-in' },
      { keys: ['-'], description: 'Zoom out', commandId: 'zoom-out' },
      { keys: ['0'], description: 'Fit all to screen' },
      { keys: ['Home'], description: 'Fit all to screen' },
      { keys: ['Mod', '0'], description: 'Zoom to selection' },
      { keys: ['F'], description: 'Fit all to screen', commandId: 'zoom-fit' },
      { keys: ['Shift', 'F'], description: 'Toggle focus mode', commandId: 'focus-mode' },
      { keys: ['M'], description: 'Toggle minimap', commandId: 'toggle-minimap' },
    ],
  },
  {
    name: 'Panels',
    shortcuts: [
      { keys: ['1'], description: 'Toggle left (shapes) panel', commandId: 'toggle-left-panel' },
      { keys: ['P'], description: 'Toggle properties panel (with a selection)' },
      { keys: ['T'], description: 'Toggle style toolbar' },
      { keys: ['Mod', 'K'], description: 'Open command palette' },
      { keys: ['?'], description: 'Show keyboard shortcuts' },
    ],
  },
  {
    name: 'File',
    shortcuts: [
      { keys: ['Mod', 'S'], description: 'Save', commandId: 'save' },
    ],
  },
  {
    name: 'Typing',
    shortcuts: [
      { keys: ['Any text field'], description: 'Single-key shortcuts pause while you are typing in a text field, label, note or dialog' },
    ],
  },
];

export function flattenShortcuts(groups = SHORTCUT_GROUPS) {
  return groups.flatMap((g) => g.shortcuts.map((s) => ({ ...s, group: g.name })));
}

/** Render a key token for the current platform. */
export function displayKey(key, mac = false) {
  if (key === 'Mod') return mac ? '⌘' : 'Ctrl';
  if (key === 'Shift' && mac) return '⇧';
  return key;
}

/** Shortcut label for a command-palette command, derived from the keymap ('' if unbound). */
export function commandShortcut(commandId, mac = isMac()) {
  const entry = flattenShortcuts().find((e) => e.commandId === commandId);
  if (!entry) return '';
  return formatShortcut(entry.keys.join('+'), mac);
}
