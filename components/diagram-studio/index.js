// components/diagram-studio/index.js
// Barrel exports for DiagramStudio

// Main component
export { default as DiagramStudio } from './DiagramStudio';
export { DiagramProvider } from './DiagramStudio';

// Context and hooks
export {
  useDiagram,
  useDiagramSelection,
  useDiagramHistory,
  useDiagramViewport,
} from './DiagramContext';

// Profiles
export {
  getProfile,
  createProfile,
  isActionAllowed,
  isModeAllowed,
  PROFILES,
} from './DiagramProfile';

// UI Components
export { default as DiagramCanvas } from './DiagramCanvas';
export { default as TopBar } from './TopBar';
export { default as LeftPalette } from './LeftPalette';
export { default as PropertiesPanel } from './PropertiesPanel';
export { ResizablePanel, PanelGroup, usePanelState } from './ResizablePanel';

// Packs
export {
  PackRegistry,
  createRegistry,
  createDefaultRegistry,
  ProcessFlowPack,
  StickyNotesPack,
  CLDPack,
  UMLClassPack,
  MindMapPack,
  PACK_IDS,
} from './packs';

// Validation
export { ValidationEngine, useValidation, ValidationPanel } from './validation';

// Export
export { ExportManager, useExport, downloadExport } from './export';

// Templates
export { TemplateManager, TemplateSelector, SaveTemplateDialog, useTemplates } from './templates';

// Utilities
export { getPortPosition, getConnectionPath, snapToGrid } from './DiagramCanvas';
export { StencilShape, OutlineTree } from './LeftPalette';
