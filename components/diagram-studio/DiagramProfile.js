// components/diagram-studio/DiagramProfile.js
// Profile configuration for DiagramStudio component
// Controls what features, modes, and capabilities are available per embedding context

// ============ PROFILE SCHEMA ============

/**
 * DiagramProfile defines what the DiagramStudio can do in a specific context.
 *
 * @typedef {Object} DiagramProfile
 * @property {string} id - Unique profile identifier
 * @property {string} name - Display name
 * @property {string[]} allowedModes - Which pack IDs are available
 * @property {string} defaultMode - Initial pack when opening
 * @property {EditingPolicy} editingPolicy - What editing actions are allowed
 * @property {UIPolicy} uiPolicy - What UI elements are visible
 * @property {ValidationPolicy} validationPolicy - Validation behavior
 * @property {ExportPolicy} exportPolicy - Export options
 * @property {number} autosaveInterval - Auto-save interval in ms (0 = disabled)
 */

/**
 * @typedef {Object} EditingPolicy
 * @property {boolean} canCreate - Can add new elements
 * @property {boolean} canDelete - Can delete elements
 * @property {boolean} canMove - Can drag/reposition elements
 * @property {boolean} canResize - Can resize elements
 * @property {boolean} canConnect - Can create connections
 * @property {boolean} canEditProperties - Can edit element properties
 * @property {boolean} canEditLabel - Can edit element labels inline
 * @property {boolean} readOnly - Override: makes everything read-only
 */

/**
 * @typedef {Object} UIPolicy
 * @property {boolean} showTopBar - Show top toolbar
 * @property {boolean} showLeftPalette - Show left stencil palette
 * @property {boolean} showRightPanel - Show right properties panel
 * @property {boolean} showBottomPanel - Show bottom validation panel
 * @property {boolean} showMinimap - Show minimap navigation
 * @property {boolean} showGrid - Show grid by default
 * @property {boolean} allowModeSwitch - Can switch between allowed modes
 * @property {boolean} allowExport - Can export diagrams
 * @property {boolean} allowZoom - Can zoom in/out
 * @property {boolean} allowPan - Can pan the canvas
 * @property {boolean} collapsiblePanels - Panels can be collapsed
 * @property {PanelSizes} panelSizes - Default panel sizes
 */

/**
 * @typedef {Object} PanelSizes
 * @property {number} leftWidth - Default left panel width
 * @property {number} rightWidth - Default right panel width
 * @property {number} bottomHeight - Default bottom panel height
 */

/**
 * @typedef {Object} ValidationPolicy
 * @property {boolean} enabled - Run validation
 * @property {'none'|'warn'|'strict'} level - Validation strictness
 * @property {boolean} showInline - Show inline validation markers on elements
 * @property {boolean} showPanel - Show validation panel
 */

/**
 * @typedef {Object} ExportPolicy
 * @property {string[]} formats - Allowed export formats: 'svg', 'png', 'json', 'pdf'
 * @property {boolean} includeMetadata - Include data-* attributes in SVG
 * @property {boolean} includeBackground - Include background in export
 */

// ============ DEFAULT POLICIES ============

export const DEFAULT_EDITING_POLICY = {
  canCreate: true,
  canDelete: true,
  canMove: true,
  canResize: true,
  canConnect: true,
  canEditProperties: true,
  canEditLabel: true,
  readOnly: false,
};

export const DEFAULT_UI_POLICY = {
  showTopBar: true,
  showLeftPalette: true,
  showRightPanel: true,
  showBottomPanel: false,
  showMinimap: false,
  showGrid: true,
  allowModeSwitch: true,
  allowExport: true,
  allowZoom: true,
  allowPan: true,
  collapsiblePanels: true,
  panelSizes: {
    leftWidth: 240,
    rightWidth: 320,
    bottomHeight: 150,
  },
};

export const DEFAULT_VALIDATION_POLICY = {
  enabled: true,
  level: 'warn',
  showInline: true,
  showPanel: false,
};

export const DEFAULT_EXPORT_POLICY = {
  formats: ['svg', 'png', 'json'],
  includeMetadata: true,
  includeBackground: true,
};

// ============ ALL PACK IDS ============

const ALL_PACK_IDS = [
  'core', // Always include Core for frames and basic shapes
  'process-flow',
  'sticky-notes',
  'cld',
  'uml-class',
  'mind-map',
  'product-design',
  'erd',
  'togaf',
  'itil',
  'capability-map',
];

// ============ PREDEFINED PROFILES ============

/**
 * Infinite Canvas profile - freeform workspace
 * All stencil packs available, no restrictions, modern minimal UI
 */
export const PROFILE_INFINITE_CANVAS = {
  id: 'infinite-canvas',
  name: 'Infinite Canvas',
  allowedModes: ALL_PACK_IDS, // ALL packs available
  defaultMode: 'sticky-notes', // Start with simple sticky notes
  editingPolicy: {
    ...DEFAULT_EDITING_POLICY,
    // All editing enabled
  },
  uiPolicy: {
    ...DEFAULT_UI_POLICY,
    showTopBar: true,
    showLeftPalette: true,
    showRightPanel: true,
    showBottomPanel: false, // No validation panel in freeform mode
    showMinimap: true, // Essential for infinite canvas navigation
    showGrid: true,
    allowModeSwitch: false, // No mode switching - all always available
    allowExport: true,
    allowZoom: true,
    allowPan: true,
    collapsiblePanels: true,
    panelSizes: {
      leftWidth: 280, // Wider for multi-pack stencil browser
      rightWidth: 320,
      bottomHeight: 0,
    },
  },
  validationPolicy: {
    ...DEFAULT_VALIDATION_POLICY,
    enabled: false, // No strict validation in freeform canvas
    showInline: false,
    showPanel: false,
  },
  exportPolicy: {
    ...DEFAULT_EXPORT_POLICY,
    formats: ['svg', 'png', 'json', 'pdf'],
  },
  autosaveInterval: 15000, // 15 seconds - more frequent for active work
};

/**
 * Full studio profile - all features enabled
 * Use for standalone diagram workspace
 */
export const PROFILE_FULL_STUDIO = {
  id: 'full-studio',
  name: 'Full Studio',
  allowedModes: ['process-flow', 'cld', 'uml-class', 'mind-map', 'sticky-notes'],
  defaultMode: 'process-flow',
  editingPolicy: { ...DEFAULT_EDITING_POLICY },
  uiPolicy: {
    ...DEFAULT_UI_POLICY,
    showBottomPanel: true,
  },
  validationPolicy: {
    ...DEFAULT_VALIDATION_POLICY,
    showPanel: true,
  },
  exportPolicy: {
    ...DEFAULT_EXPORT_POLICY,
    formats: ['svg', 'png', 'json', 'pdf'],
  },
  autosaveInterval: 30000, // 30 seconds
};

/**
 * Embedded read-only profile - view only
 * Use for embedding diagrams in detail views
 */
export const PROFILE_EMBEDDED_READONLY = {
  id: 'embedded-readonly',
  name: 'Embedded Read-Only',
  allowedModes: ['process-flow', 'cld', 'uml-class', 'mind-map', 'sticky-notes'],
  defaultMode: 'process-flow',
  editingPolicy: {
    ...DEFAULT_EDITING_POLICY,
    canCreate: false,
    canDelete: false,
    canMove: false,
    canResize: false,
    canConnect: false,
    canEditProperties: false,
    canEditLabel: false,
    readOnly: true,
  },
  uiPolicy: {
    ...DEFAULT_UI_POLICY,
    showTopBar: false,
    showLeftPalette: false,
    showRightPanel: false,
    showBottomPanel: false,
    showMinimap: false,
    allowModeSwitch: false,
    allowExport: false,
    collapsiblePanels: false,
  },
  validationPolicy: {
    ...DEFAULT_VALIDATION_POLICY,
    enabled: false,
    showInline: false,
    showPanel: false,
  },
  exportPolicy: {
    formats: [],
    includeMetadata: false,
    includeBackground: true,
  },
  autosaveInterval: 0, // Disabled
};

/**
 * Embedded editable profile - minimal UI with editing
 * Use for inline diagram editing in forms
 */
export const PROFILE_EMBEDDED_EDITABLE = {
  id: 'embedded-editable',
  name: 'Embedded Editable',
  allowedModes: ['process-flow', 'cld', 'uml-class', 'mind-map', 'sticky-notes'],
  defaultMode: 'process-flow',
  editingPolicy: { ...DEFAULT_EDITING_POLICY },
  uiPolicy: {
    ...DEFAULT_UI_POLICY,
    showTopBar: true,
    showLeftPalette: false, // Compact mode
    showRightPanel: false,
    showBottomPanel: false,
    showMinimap: false,
    allowModeSwitch: false,
    allowExport: false,
    collapsiblePanels: false,
  },
  validationPolicy: {
    ...DEFAULT_VALIDATION_POLICY,
    showPanel: false,
  },
  exportPolicy: {
    formats: [],
    includeMetadata: false,
    includeBackground: true,
  },
  autosaveInterval: 10000, // 10 seconds (more frequent for embedded)
};

/**
 * Process-only profile - limited to process flow diagrams
 * Use in Requirements/BA workspace
 */
export const PROFILE_PROCESS_ONLY = {
  id: 'process-only',
  name: 'Process Flow Only',
  allowedModes: ['process-flow'],
  defaultMode: 'process-flow',
  editingPolicy: { ...DEFAULT_EDITING_POLICY },
  uiPolicy: {
    ...DEFAULT_UI_POLICY,
    allowModeSwitch: false,
  },
  validationPolicy: { ...DEFAULT_VALIDATION_POLICY },
  exportPolicy: { ...DEFAULT_EXPORT_POLICY },
  autosaveInterval: 30000,
};

/**
 * CLD-only profile - limited to causal loop diagrams
 * Use in System Dynamics workspace
 */
export const PROFILE_CLD_ONLY = {
  id: 'cld-only',
  name: 'CLD Only',
  allowedModes: ['cld'],
  defaultMode: 'cld',
  editingPolicy: { ...DEFAULT_EDITING_POLICY },
  uiPolicy: {
    ...DEFAULT_UI_POLICY,
    allowModeSwitch: false,
  },
  validationPolicy: { ...DEFAULT_VALIDATION_POLICY },
  exportPolicy: { ...DEFAULT_EXPORT_POLICY },
  autosaveInterval: 30000,
};

/**
 * UML-only profile - limited to UML class diagrams
 * Use in EA workspace for data modeling
 */
export const PROFILE_UML_ONLY = {
  id: 'uml-only',
  name: 'UML Only',
  allowedModes: ['uml-class'],
  defaultMode: 'uml-class',
  editingPolicy: { ...DEFAULT_EDITING_POLICY },
  uiPolicy: {
    ...DEFAULT_UI_POLICY,
    allowModeSwitch: false,
  },
  validationPolicy: { ...DEFAULT_VALIDATION_POLICY },
  exportPolicy: { ...DEFAULT_EXPORT_POLICY },
  autosaveInterval: 30000,
};

/**
 * Workshop profile - sticky notes and mind maps
 * Use for brainstorming and workshop sessions
 */
export const PROFILE_WORKSHOP = {
  id: 'workshop',
  name: 'Workshop',
  allowedModes: ['sticky-notes', 'mind-map'],
  defaultMode: 'sticky-notes',
  editingPolicy: { ...DEFAULT_EDITING_POLICY },
  uiPolicy: {
    ...DEFAULT_UI_POLICY,
    showBottomPanel: false,
  },
  validationPolicy: {
    ...DEFAULT_VALIDATION_POLICY,
    enabled: false, // No validation in workshop mode
  },
  exportPolicy: { ...DEFAULT_EXPORT_POLICY },
  autosaveInterval: 15000, // 15 seconds (frequent for workshops)
};

/**
 * Capability Map profile - for capability modeling
 * Use in Capability Studio workspace
 */
export const PROFILE_CAPABILITY_MAP = {
  id: 'capability-map',
  name: 'Capability Map',
  allowedModes: ['capability-map'],
  defaultMode: 'capability-map',
  editingPolicy: { ...DEFAULT_EDITING_POLICY },
  uiPolicy: {
    ...DEFAULT_UI_POLICY,
    showTopBar: true,
    showLeftPalette: true,
    showRightPanel: true,
    showBottomPanel: false,
    showMinimap: true,
    allowModeSwitch: false,
    allowExport: true,
    panelSizes: {
      leftWidth: 220,
      rightWidth: 300,
      bottomHeight: 150,
    },
  },
  validationPolicy: {
    ...DEFAULT_VALIDATION_POLICY,
    showPanel: false,
  },
  exportPolicy: {
    ...DEFAULT_EXPORT_POLICY,
    formats: ['svg', 'png', 'json'],
  },
  autosaveInterval: 30000,
};

// ============ PROFILES REGISTRY ============

export const PROFILES = {
  infiniteCanvas: PROFILE_INFINITE_CANVAS,
  fullStudio: PROFILE_FULL_STUDIO,
  embeddedReadonly: PROFILE_EMBEDDED_READONLY,
  embeddedEditable: PROFILE_EMBEDDED_EDITABLE,
  processOnly: PROFILE_PROCESS_ONLY,
  cldOnly: PROFILE_CLD_ONLY,
  umlOnly: PROFILE_UML_ONLY,
  workshop: PROFILE_WORKSHOP,
  capabilityMap: PROFILE_CAPABILITY_MAP,
};

// ============ HELPER FUNCTIONS ============

/**
 * Get a profile by ID
 * @param {string} profileId
 * @returns {DiagramProfile|null}
 */
export function getProfile(profileId) {
  return Object.values(PROFILES).find(p => p.id === profileId) || null;
}

/**
 * Create a custom profile by merging with a base profile
 * @param {string} baseProfileId - ID of base profile to extend
 * @param {Partial<DiagramProfile>} overrides - Properties to override
 * @returns {DiagramProfile}
 */
export function createProfile(baseProfileId, overrides = {}) {
  const base = getProfile(baseProfileId) || PROFILE_FULL_STUDIO;

  return {
    ...base,
    ...overrides,
    id: overrides.id || `custom-${Date.now()}`,
    editingPolicy: {
      ...base.editingPolicy,
      ...(overrides.editingPolicy || {}),
    },
    uiPolicy: {
      ...base.uiPolicy,
      ...(overrides.uiPolicy || {}),
      panelSizes: {
        ...base.uiPolicy.panelSizes,
        ...(overrides.uiPolicy?.panelSizes || {}),
      },
    },
    validationPolicy: {
      ...base.validationPolicy,
      ...(overrides.validationPolicy || {}),
    },
    exportPolicy: {
      ...base.exportPolicy,
      ...(overrides.exportPolicy || {}),
    },
  };
}

/**
 * Check if a specific action is allowed by the profile
 * @param {DiagramProfile} profile
 * @param {string} action - Action to check
 * @returns {boolean}
 */
export function isActionAllowed(profile, action) {
  if (!profile) return false;
  if (profile.editingPolicy.readOnly) return false;

  switch (action) {
    case 'create':
      return profile.editingPolicy.canCreate;
    case 'delete':
      return profile.editingPolicy.canDelete;
    case 'move':
      return profile.editingPolicy.canMove;
    case 'resize':
      return profile.editingPolicy.canResize;
    case 'connect':
      return profile.editingPolicy.canConnect;
    case 'editProperties':
      return profile.editingPolicy.canEditProperties;
    case 'editLabel':
      return profile.editingPolicy.canEditLabel;
    case 'export':
      return profile.uiPolicy.allowExport;
    case 'modeSwitch':
      return profile.uiPolicy.allowModeSwitch;
    default:
      return true;
  }
}

/**
 * Check if a specific mode is allowed by the profile
 * @param {DiagramProfile} profile
 * @param {string} modeId - Mode/pack ID to check
 * @returns {boolean}
 */
export function isModeAllowed(profile, modeId) {
  if (!profile || !profile.allowedModes) return false;
  return profile.allowedModes.includes(modeId);
}

/**
 * Validate a profile configuration
 * @param {DiagramProfile} profile
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateProfile(profile) {
  const errors = [];

  if (!profile.id) {
    errors.push('Profile must have an id');
  }

  if (!profile.allowedModes || profile.allowedModes.length === 0) {
    errors.push('Profile must have at least one allowed mode');
  }

  if (!profile.defaultMode) {
    errors.push('Profile must have a default mode');
  } else if (profile.allowedModes && !profile.allowedModes.includes(profile.defaultMode)) {
    errors.push('Default mode must be in allowed modes');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export default PROFILES;
