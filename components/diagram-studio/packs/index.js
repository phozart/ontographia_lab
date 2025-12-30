// components/diagram-studio/packs/index.js
// Barrel exports for diagram packs

export { default as PackRegistry, createRegistry, getDefaultRegistry } from './PackRegistry';
export { default as CorePack } from './CorePack';
export { default as ProcessFlowPack } from './ProcessFlowPack';
export { default as StickyNotesPack } from './StickyNotesPack';
export { default as CLDPack } from './CLDPack';
export { default as UMLClassPack } from './UMLClassPack';
export { default as MindMapPack } from './MindMapPack';
export { default as ProductDesignPack } from './ProductDesignPack';
export { default as ERDPack } from './ERDPack';
export { default as TOGAFPack } from './TOGAFPack';
export { default as ITILPack } from './ITILPack';
export { default as CapabilityMapPack } from './CapabilityMapPack';

// Helper to create a registry with all default packs
// NOTE: StickyNotesPack is NOT registered here - sticky notes are accessed via top bar annotation tools
export function createDefaultRegistry() {
  const { PackRegistry } = require('./PackRegistry');
  const CorePack = require('./CorePack').default;
  const ProcessFlowPack = require('./ProcessFlowPack').default;
  const StickyNotesPack = require('./StickyNotesPack').default;
  const CLDPack = require('./CLDPack').default;
  const UMLClassPack = require('./UMLClassPack').default;
  const MindMapPack = require('./MindMapPack').default;
  const ProductDesignPack = require('./ProductDesignPack').default;
  const ERDPack = require('./ERDPack').default;
  const TOGAFPack = require('./TOGAFPack').default;
  const ITILPack = require('./ITILPack').default;
  const CapabilityMapPack = require('./CapabilityMapPack').default;

  const registry = new PackRegistry();
  registry.register(CorePack);
  registry.register(ProcessFlowPack);
  registry.register(StickyNotesPack); // Registered for rendering, but not shown in sidebar
  registry.register(CLDPack);
  registry.register(UMLClassPack);
  registry.register(MindMapPack);
  registry.register(ProductDesignPack);
  registry.register(ERDPack);
  registry.register(TOGAFPack);
  registry.register(ITILPack);
  registry.register(CapabilityMapPack);

  return registry;
}

// List of all available pack IDs (sticky-notes removed - it's in top bar annotation tools)
export const PACK_IDS = [
  'core',
  'process-flow',
  'cld',
  'uml-class',
  'mind-map',
  'product-design',
  'erd',
  'togaf',
  'itil',
  'capability-map',
];
