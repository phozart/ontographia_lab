// components/diagram-studio/hooks/interaction/index.js
// Barrel export for interaction hooks

export { useClipboard } from './useClipboard';
export {
  useKeyboardShortcuts,
  createShortcut,
  createDiagramShortcuts,
  ShortcutHelpers,
} from './useKeyboardShortcuts';
export {
  useContextMenu,
  getNodeMenuItems,
  getConnectionMenuItems,
  getCanvasMenuItems,
  createDiagramContextActions,
} from './useContextMenu';

export { useViewportControls } from './useViewportControls';
export { useAlignmentGuides, renderAlignmentGuides } from './useAlignmentGuides';
export { useDragSystem } from './useDragSystem';
export { useConnectionDrag } from './useConnectionDrag';
export { useQuickCreate } from './useQuickCreate';
