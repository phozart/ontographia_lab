// components/diagram-studio/packs/PackRegistry.js
// Registry for diagram packs (stencil sets)

// ============ PACK REGISTRY CLASS ============

export class PackRegistry {
  constructor() {
    this.packs = new Map();
  }

  // Register a pack
  register(pack) {
    if (!pack.id) {
      throw new Error('Pack must have an id');
    }
    this.packs.set(pack.id, pack);
    return this;
  }

  // Get a pack by ID
  get(id) {
    return this.packs.get(id);
  }

  // Check if pack exists
  has(id) {
    return this.packs.has(id);
  }

  // Get all packs
  getAll() {
    return Array.from(this.packs.values());
  }

  // Get all pack IDs
  getIds() {
    return Array.from(this.packs.keys());
  }

  // Get stencils for a pack
  getStencils(packId) {
    const pack = this.get(packId);
    return pack?.stencils || [];
  }

  // Get connection types for a pack
  getConnectionTypes(packId) {
    const pack = this.get(packId);
    return pack?.connectionTypes || [];
  }

  // Get validators for a pack
  getValidators(packId) {
    const pack = this.get(packId);
    return pack?.validators || [];
  }

  // Get templates for a pack
  getTemplates(packId) {
    const pack = this.get(packId);
    return pack?.templates || [];
  }

  // Find stencil by ID across all packs
  findStencil(stencilId, packId = null) {
    if (packId) {
      const pack = this.get(packId);
      return pack?.stencils?.find(s => s.id === stencilId);
    }
    for (const pack of this.packs.values()) {
      const stencil = pack.stencils?.find(s => s.id === stencilId);
      if (stencil) return stencil;
    }
    return null;
  }

  // Create element from stencil
  createElementFromStencil(stencilId, packId, position = { x: 100, y: 100 }) {
    const stencil = this.findStencil(stencilId, packId);
    if (!stencil) return null;

    return {
      id: generateId(),
      type: stencil.id,
      packId: packId,
      label: stencil.name,
      x: position.x,
      y: position.y,
      size: stencil.defaultSize || { width: 120, height: 60 },
      color: stencil.color,
      ports: stencil.ports || getDefaultPorts(),
      data: {},
      createdAt: new Date().toISOString(),
    };
  }
}

// ============ DEFAULT PACK REGISTRY ============

let defaultRegistry = null;

export function getDefaultRegistry() {
  if (!defaultRegistry) {
    defaultRegistry = new PackRegistry();
  }
  return defaultRegistry;
}

export function createRegistry() {
  return new PackRegistry();
}

// ============ HELPERS ============

function generateId() {
  return 'el_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
}

function getDefaultPorts() {
  return [
    { id: 'top', position: 'top' },
    { id: 'right', position: 'right' },
    { id: 'bottom', position: 'bottom' },
    { id: 'left', position: 'left' },
  ];
}

// ============ PACK INTERFACE (TypeScript-style documentation) ============

/**
 * Pack Interface:
 * {
 *   id: string,                    // Unique pack identifier
 *   name: string,                  // Display name
 *   description: string,           // Pack description
 *   icon: string | ReactComponent, // Pack icon
 *   stencils: Stencil[],          // Available stencils
 *   connectionTypes: ConnectionType[], // Connection styles
 *   validators: Validator[],       // Validation rules
 *   templates: Template[],         // Starter templates
 *   nodeProperties: PropertySchema[], // Custom node properties
 *   renderNode?: (node, selected) => ReactNode, // Custom renderer
 * }
 *
 * Stencil Interface:
 * {
 *   id: string,                    // Unique stencil ID
 *   name: string,                  // Display name
 *   description: string,           // Tooltip description
 *   group: string,                 // Group name for palette organization
 *   shape: 'rect' | 'circle' | 'diamond' | 'ellipse' | 'parallelogram' | 'sticky' | 'custom',
 *   icon: string | ReactComponent, // Icon for palette
 *   color: string,                 // Default color
 *   defaultSize: { width, height }, // Default dimensions
 *   ports: Port[],                 // Connection ports
 *   isContainer: boolean,          // Can contain other elements
 *   properties: PropertySchema[],  // Stencil-specific properties
 * }
 *
 * ConnectionType Interface:
 * {
 *   id: string,                    // Connection type ID
 *   name: string,                  // Display name
 *   style: 'solid' | 'dashed' | 'dotted',
 *   arrowStart: 'none' | 'arrow' | 'diamond' | 'circle',
 *   arrowEnd: 'none' | 'arrow' | 'diamond' | 'circle',
 *   color: string,                 // Default color
 *   labelPosition: 'center' | 'start' | 'end',
 * }
 */

export default PackRegistry;
