// components/diagram-studio/packs/UMLClassPack.js
// UML Comprehensive Pack - Class, Use Case, Activity, State Machine, Sequence diagrams

// ============ STENCILS ============

const stencils = [
  // ==================== CLASS DIAGRAM ====================
  // Classes
  {
    id: 'class',
    name: 'Class',
    description: 'UML Class with name, attributes, and methods',
    group: 'Class Diagram',
    shape: 'rect',
    icon: '☐',
    color: '#3b82f6',
    defaultSize: { width: 180, height: 120 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
    compartments: ['name', 'attributes', 'methods'],
    properties: [
      { id: 'stereotype', label: 'Stereotype', type: 'text', placeholder: 'e.g., entity, controller' },
      { id: 'isAbstract', label: 'Abstract', type: 'boolean' },
      { id: 'attributes', label: 'Attributes', type: 'list', placeholder: '+ name: String' },
      { id: 'methods', label: 'Methods', type: 'list', placeholder: '+ getName(): String' },
      { id: 'visibility', label: 'Default Visibility', type: 'select', options: [
        { value: 'public', label: 'Public (+)' },
        { value: 'private', label: 'Private (-)' },
        { value: 'protected', label: 'Protected (#)' },
        { value: 'package', label: 'Package (~)' },
      ]},
    ],
  },
  {
    id: 'abstract-class',
    name: 'Abstract Class',
    description: 'Abstract class (cannot be instantiated)',
    group: 'Class Diagram',
    shape: 'rect',
    icon: '☐',
    color: '#8b5cf6',
    defaultSize: { width: 180, height: 120 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
    compartments: ['name', 'attributes', 'methods'],
    properties: [
      { id: 'stereotype', label: 'Stereotype', type: 'text' },
      { id: 'attributes', label: 'Attributes', type: 'list' },
      { id: 'methods', label: 'Methods', type: 'list' },
    ],
  },
  {
    id: 'interface',
    name: 'Interface',
    description: 'UML Interface',
    group: 'Class Diagram',
    shape: 'rect',
    icon: '○',
    color: '#22c55e',
    defaultSize: { width: 160, height: 100 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
    compartments: ['name', 'methods'],
    properties: [
      { id: 'methods', label: 'Methods', type: 'list' },
    ],
  },
  {
    id: 'enum',
    name: 'Enumeration',
    description: 'UML Enumeration',
    group: 'Class Diagram',
    shape: 'rect',
    icon: '≡',
    color: '#f59e0b',
    defaultSize: { width: 140, height: 100 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
    compartments: ['name', 'values'],
    properties: [
      { id: 'values', label: 'Values', type: 'list', placeholder: 'VALUE1, VALUE2' },
    ],
  },

  // Packages
  {
    id: 'package',
    name: 'Package',
    description: 'UML Package for organizing classes',
    group: 'Class Diagram',
    shape: 'rect',
    icon: '📦',
    color: '#64748b',
    defaultSize: { width: 250, height: 200 },
    ports: [],
    isContainer: true,
    properties: [
      { id: 'packagePath', label: 'Package Path', type: 'text', placeholder: 'com.example.models' },
    ],
  },
  {
    id: 'data-type',
    name: 'Data Type',
    description: 'Primitive or custom data type',
    group: 'Class Diagram',
    shape: 'rect',
    icon: 'T',
    color: '#06b6d4',
    defaultSize: { width: 120, height: 60 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
    properties: [
      { id: 'baseType', label: 'Base Type', type: 'text' },
    ],
  },

  // ==================== USE CASE DIAGRAM ====================
  {
    id: 'actor',
    name: 'Actor',
    description: 'Person or system that interacts with the system',
    group: 'Use Case Diagram',
    shape: 'rect',
    icon: '🧑',
    color: '#3b82f6',
    defaultSize: { width: 60, height: 100 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
    properties: [
      { id: 'actorType', label: 'Actor Type', type: 'select', options: [
        { value: 'person', label: 'Person' },
        { value: 'system', label: 'External System' },
        { value: 'time', label: 'Time/Scheduler' },
      ]},
    ],
  },
  {
    id: 'use-case',
    name: 'Use Case',
    description: 'A specific functionality the system provides',
    group: 'Use Case Diagram',
    shape: 'ellipse',
    icon: '◯',
    color: '#22c55e',
    defaultSize: { width: 140, height: 70 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
    properties: [
      { id: 'preconditions', label: 'Preconditions', type: 'textarea' },
      { id: 'postconditions', label: 'Postconditions', type: 'textarea' },
      { id: 'mainFlow', label: 'Main Flow', type: 'textarea' },
    ],
  },
  {
    id: 'system-boundary',
    name: 'System Boundary',
    description: 'Container representing the system scope',
    group: 'Use Case Diagram',
    shape: 'rect',
    icon: '▢',
    color: '#64748b',
    defaultSize: { width: 400, height: 300 },
    ports: [],
    isContainer: true,
    properties: [
      { id: 'systemName', label: 'System Name', type: 'text' },
    ],
  },

  // ==================== ACTIVITY DIAGRAM ====================
  {
    id: 'initial-node',
    name: 'Initial Node',
    description: 'Starting point of the activity',
    group: 'Activity Diagram',
    shape: 'circle',
    icon: '●',
    color: '#1f2937',
    defaultSize: { width: 30, height: 30 },
    ports: [
      { id: 'bottom', position: 'bottom' },
      { id: 'right', position: 'right' },
    ],
    isContainer: false,
  },
  {
    id: 'final-node',
    name: 'Final Node',
    description: 'End point of the activity',
    group: 'Activity Diagram',
    shape: 'circle',
    icon: '◉',
    color: '#1f2937',
    defaultSize: { width: 30, height: 30 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
  },
  {
    id: 'flow-final',
    name: 'Flow Final',
    description: 'End point of a flow (not entire activity)',
    group: 'Activity Diagram',
    shape: 'circle',
    icon: '⊗',
    color: '#6b7280',
    defaultSize: { width: 30, height: 30 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
  },
  {
    id: 'action',
    name: 'Action',
    description: 'A single step in the activity',
    group: 'Activity Diagram',
    shape: 'rect',
    icon: '▭',
    color: '#3b82f6',
    defaultSize: { width: 140, height: 50 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
    properties: [
      { id: 'actionType', label: 'Action Type', type: 'select', options: [
        { value: 'call', label: 'Call Action' },
        { value: 'send', label: 'Send Signal' },
        { value: 'accept', label: 'Accept Event' },
        { value: 'time', label: 'Time Event' },
      ]},
    ],
  },
  {
    id: 'decision',
    name: 'Decision/Merge',
    description: 'Branch or merge point in the flow',
    group: 'Activity Diagram',
    shape: 'diamond',
    icon: '◇',
    color: '#f59e0b',
    defaultSize: { width: 50, height: 50 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
    properties: [
      { id: 'condition', label: 'Condition', type: 'text' },
    ],
  },
  {
    id: 'fork-join',
    name: 'Fork/Join',
    description: 'Parallel execution bar',
    group: 'Activity Diagram',
    shape: 'rect',
    icon: '▬',
    color: '#1f2937',
    defaultSize: { width: 150, height: 8 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'bottom', position: 'bottom' },
    ],
    isContainer: false,
    properties: [
      { id: 'orientation', label: 'Orientation', type: 'select', options: [
        { value: 'horizontal', label: 'Horizontal' },
        { value: 'vertical', label: 'Vertical' },
      ]},
    ],
  },
  {
    id: 'swimlane',
    name: 'Swimlane',
    description: 'Partition for organizing activities by role',
    group: 'Activity Diagram',
    shape: 'rect',
    icon: '▯',
    color: '#e5e7eb',
    defaultSize: { width: 200, height: 400 },
    ports: [],
    isContainer: true,
    properties: [
      { id: 'responsible', label: 'Responsible', type: 'text' },
    ],
  },
  {
    id: 'object-node',
    name: 'Object Node',
    description: 'Data or object flowing through the activity',
    group: 'Activity Diagram',
    shape: 'rect',
    icon: '▭',
    color: '#8b5cf6',
    defaultSize: { width: 100, height: 50 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
    properties: [
      { id: 'objectState', label: 'State', type: 'text' },
    ],
  },

  // ==================== STATE MACHINE DIAGRAM ====================
  {
    id: 'initial-state',
    name: 'Initial State',
    description: 'Starting point of the state machine',
    group: 'State Machine',
    shape: 'circle',
    icon: '●',
    color: '#1f2937',
    defaultSize: { width: 30, height: 30 },
    ports: [
      { id: 'bottom', position: 'bottom' },
      { id: 'right', position: 'right' },
    ],
    isContainer: false,
  },
  {
    id: 'final-state',
    name: 'Final State',
    description: 'End point of the state machine',
    group: 'State Machine',
    shape: 'circle',
    icon: '◉',
    color: '#1f2937',
    defaultSize: { width: 30, height: 30 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
  },
  {
    id: 'state',
    name: 'State',
    description: 'A state in the state machine',
    group: 'State Machine',
    shape: 'rect',
    icon: '▢',
    color: '#22c55e',
    defaultSize: { width: 140, height: 80 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
    properties: [
      { id: 'entry', label: 'Entry Action', type: 'text', placeholder: 'entry / action' },
      { id: 'exit', label: 'Exit Action', type: 'text', placeholder: 'exit / action' },
      { id: 'doActivity', label: 'Do Activity', type: 'text', placeholder: 'do / activity' },
      { id: 'internalTransitions', label: 'Internal Transitions', type: 'list' },
    ],
  },
  {
    id: 'composite-state',
    name: 'Composite State',
    description: 'State containing sub-states',
    group: 'State Machine',
    shape: 'rect',
    icon: '▣',
    color: '#3b82f6',
    defaultSize: { width: 300, height: 200 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: true,
    properties: [
      { id: 'entry', label: 'Entry Action', type: 'text' },
      { id: 'exit', label: 'Exit Action', type: 'text' },
    ],
  },
  {
    id: 'choice',
    name: 'Choice',
    description: 'Dynamic conditional branch',
    group: 'State Machine',
    shape: 'diamond',
    icon: '◇',
    color: '#f59e0b',
    defaultSize: { width: 40, height: 40 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
  },
  {
    id: 'history',
    name: 'History',
    description: 'Shallow or deep history pseudo-state',
    group: 'State Machine',
    shape: 'circle',
    icon: 'H',
    color: '#6b7280',
    defaultSize: { width: 30, height: 30 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
    properties: [
      { id: 'historyType', label: 'History Type', type: 'select', options: [
        { value: 'shallow', label: 'Shallow (H)' },
        { value: 'deep', label: 'Deep (H*)' },
      ]},
    ],
  },

  // ==================== SEQUENCE DIAGRAM ====================
  {
    id: 'lifeline',
    name: 'Lifeline',
    description: 'Participant in a sequence diagram',
    group: 'Sequence Diagram',
    shape: 'rect',
    icon: '│',
    color: '#3b82f6',
    defaultSize: { width: 100, height: 300 },
    ports: [
      { id: 'left', position: 'left' },
      { id: 'right', position: 'right' },
    ],
    isContainer: false,
    properties: [
      { id: 'objectName', label: 'Object Name', type: 'text' },
      { id: 'className', label: 'Class Name', type: 'text' },
    ],
  },
  {
    id: 'activation',
    name: 'Activation',
    description: 'Period when lifeline is active',
    group: 'Sequence Diagram',
    shape: 'rect',
    icon: '▮',
    color: '#22c55e',
    defaultSize: { width: 16, height: 60 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'bottom', position: 'bottom' },
    ],
    isContainer: false,
  },
  {
    id: 'combined-fragment',
    name: 'Combined Fragment',
    description: 'Alt, loop, opt, or other fragment',
    group: 'Sequence Diagram',
    shape: 'rect',
    icon: '▢',
    color: '#64748b',
    defaultSize: { width: 300, height: 150 },
    ports: [],
    isContainer: true,
    properties: [
      { id: 'fragmentType', label: 'Fragment Type', type: 'select', options: [
        { value: 'alt', label: 'alt (alternative)' },
        { value: 'opt', label: 'opt (optional)' },
        { value: 'loop', label: 'loop' },
        { value: 'break', label: 'break' },
        { value: 'par', label: 'par (parallel)' },
        { value: 'critical', label: 'critical' },
        { value: 'ref', label: 'ref (reference)' },
      ]},
      { id: 'guard', label: 'Guard Condition', type: 'text', placeholder: '[condition]' },
    ],
  },

  // ==================== COMMON/ANNOTATIONS ====================
  {
    id: 'note',
    name: 'Note',
    description: 'UML Note/Comment',
    group: 'Annotations',
    shape: 'rect',
    icon: '📝',
    color: '#fef3c7',
    defaultSize: { width: 150, height: 80 },
    ports: [
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
  },
  {
    id: 'constraint',
    name: 'Constraint',
    description: 'OCL or other constraint',
    group: 'Annotations',
    shape: 'rect',
    icon: '{',
    color: '#e5e7eb',
    defaultSize: { width: 140, height: 50 },
    ports: [],
    isContainer: false,
    properties: [
      { id: 'constraintBody', label: 'Constraint', type: 'textarea', placeholder: '{constraint expression}' },
    ],
  },
];

// ============ CONNECTION TYPES ============

const connectionTypes = [
  // ==================== CLASS DIAGRAM ====================
  {
    id: 'association',
    name: 'Association',
    description: 'Simple association between classes',
    style: 'solid',
    arrowStart: 'none',
    arrowEnd: 'none',
    color: '#374151',
    group: 'Class Diagram',
  },
  {
    id: 'directed-association',
    name: 'Directed Association',
    description: 'Navigable association',
    style: 'solid',
    arrowStart: 'none',
    arrowEnd: 'arrow',
    color: '#374151',
    group: 'Class Diagram',
  },
  {
    id: 'aggregation',
    name: 'Aggregation',
    description: 'Whole-part relationship (weak)',
    style: 'solid',
    arrowStart: 'diamond-empty',
    arrowEnd: 'none',
    color: '#374151',
    group: 'Class Diagram',
  },
  {
    id: 'composition',
    name: 'Composition',
    description: 'Whole-part relationship (strong)',
    style: 'solid',
    arrowStart: 'diamond-filled',
    arrowEnd: 'none',
    color: '#374151',
    group: 'Class Diagram',
  },
  {
    id: 'inheritance',
    name: 'Inheritance',
    description: 'Generalization (extends)',
    style: 'solid',
    arrowStart: 'none',
    arrowEnd: 'triangle-empty',
    color: '#374151',
    group: 'Class Diagram',
  },
  {
    id: 'realization',
    name: 'Realization',
    description: 'Interface implementation',
    style: 'dashed',
    arrowStart: 'none',
    arrowEnd: 'triangle-empty',
    color: '#374151',
    group: 'Class Diagram',
  },
  {
    id: 'dependency',
    name: 'Dependency',
    description: 'Dependency relationship',
    style: 'dashed',
    arrowStart: 'none',
    arrowEnd: 'arrow',
    color: '#6b7280',
    group: 'Class Diagram',
  },

  // ==================== USE CASE DIAGRAM ====================
  {
    id: 'uc-association',
    name: 'Association',
    description: 'Actor-UseCase association',
    style: 'solid',
    arrowStart: 'none',
    arrowEnd: 'none',
    color: '#374151',
    group: 'Use Case Diagram',
  },
  {
    id: 'include',
    name: 'Include',
    description: 'Include relationship (<<include>>)',
    style: 'dashed',
    arrowStart: 'none',
    arrowEnd: 'arrow',
    color: '#374151',
    group: 'Use Case Diagram',
    labelTemplate: '<<include>>',
  },
  {
    id: 'extend',
    name: 'Extend',
    description: 'Extend relationship (<<extend>>)',
    style: 'dashed',
    arrowStart: 'none',
    arrowEnd: 'arrow',
    color: '#374151',
    group: 'Use Case Diagram',
    labelTemplate: '<<extend>>',
  },
  {
    id: 'generalization',
    name: 'Generalization',
    description: 'Actor or UseCase generalization',
    style: 'solid',
    arrowStart: 'none',
    arrowEnd: 'triangle-empty',
    color: '#374151',
    group: 'Use Case Diagram',
  },

  // ==================== ACTIVITY DIAGRAM ====================
  {
    id: 'control-flow',
    name: 'Control Flow',
    description: 'Flow of control between actions',
    style: 'solid',
    arrowStart: 'none',
    arrowEnd: 'arrow',
    color: '#374151',
    group: 'Activity Diagram',
  },
  {
    id: 'object-flow',
    name: 'Object Flow',
    description: 'Flow of data/objects between nodes',
    style: 'solid',
    arrowStart: 'none',
    arrowEnd: 'arrow',
    color: '#8b5cf6',
    group: 'Activity Diagram',
  },

  // ==================== STATE MACHINE ====================
  {
    id: 'transition',
    name: 'Transition',
    description: 'State transition',
    style: 'solid',
    arrowStart: 'none',
    arrowEnd: 'arrow',
    color: '#374151',
    group: 'State Machine',
  },

  // ==================== SEQUENCE DIAGRAM ====================
  {
    id: 'sync-message',
    name: 'Synchronous Message',
    description: 'Synchronous call (filled arrow)',
    style: 'solid',
    arrowStart: 'none',
    arrowEnd: 'triangle-filled',
    color: '#374151',
    group: 'Sequence Diagram',
  },
  {
    id: 'async-message',
    name: 'Asynchronous Message',
    description: 'Asynchronous call (open arrow)',
    style: 'solid',
    arrowStart: 'none',
    arrowEnd: 'arrow',
    color: '#374151',
    group: 'Sequence Diagram',
  },
  {
    id: 'return-message',
    name: 'Return Message',
    description: 'Return from a call',
    style: 'dashed',
    arrowStart: 'none',
    arrowEnd: 'arrow',
    color: '#6b7280',
    group: 'Sequence Diagram',
  },
  {
    id: 'create-message',
    name: 'Create Message',
    description: 'Object creation',
    style: 'dashed',
    arrowStart: 'none',
    arrowEnd: 'arrow',
    color: '#22c55e',
    group: 'Sequence Diagram',
    labelTemplate: '<<create>>',
  },
  {
    id: 'destroy-message',
    name: 'Destroy Message',
    description: 'Object destruction',
    style: 'dashed',
    arrowStart: 'none',
    arrowEnd: 'arrow',
    color: '#ef4444',
    group: 'Sequence Diagram',
    labelTemplate: '<<destroy>>',
  },

  // ==================== COMMON ====================
  {
    id: 'note-link',
    name: 'Note Link',
    description: 'Link to note/comment',
    style: 'dotted',
    arrowStart: 'none',
    arrowEnd: 'none',
    color: '#9ca3af',
    group: 'Annotations',
  },
];

// ============ VALIDATORS ============

const validators = [
  {
    id: 'class-has-name',
    name: 'Classes Have Names',
    description: 'All classes should have a name',
    level: 'error',
    validate: (elements) => {
      const unnamed = elements.filter(
        el => (el.type === 'class' || el.type === 'abstract-class' || el.type === 'interface') &&
              !el.label?.trim()
      );
      if (unnamed.length > 0) {
        return unnamed.map(el => ({
          elementId: el.id,
          message: `${el.type} must have a name`,
        }));
      }
      return null;
    },
  },
  {
    id: 'interface-no-attributes',
    name: 'Interfaces Have No Attributes',
    description: 'Interfaces typically should not have attributes',
    level: 'info',
    validate: (elements) => {
      const withAttrs = elements.filter(
        el => el.type === 'interface' && el.data?.attributes?.length > 0
      );
      if (withAttrs.length > 0) {
        return withAttrs.map(el => ({
          elementId: el.id,
          message: `Interface "${el.label}" has attributes (unusual for interfaces)`,
        }));
      }
      return null;
    },
  },
  {
    id: 'circular-inheritance',
    name: 'No Circular Inheritance',
    description: 'Inheritance hierarchy should not be circular',
    level: 'error',
    validate: (elements, connections) => {
      const inheritanceLinks = connections.filter(c => c.type === 'inheritance');
      const graph = {};
      elements.forEach(el => { graph[el.id] = []; });
      inheritanceLinks.forEach(c => {
        if (graph[c.sourceId]) {
          graph[c.sourceId].push(c.targetId);
        }
      });

      // DFS to detect cycle
      const visited = new Set();
      const recStack = new Set();

      function hasCycle(node) {
        if (recStack.has(node)) return true;
        if (visited.has(node)) return false;
        visited.add(node);
        recStack.add(node);
        for (const parent of (graph[node] || [])) {
          if (hasCycle(parent)) return true;
        }
        recStack.delete(node);
        return false;
      }

      for (const node of Object.keys(graph)) {
        if (hasCycle(node)) {
          return { message: 'Circular inheritance detected in class hierarchy' };
        }
      }
      return null;
    },
  },
];

// ============ TEMPLATES ============

const templates = [
  {
    id: 'blank',
    name: 'Blank Class Diagram',
    description: 'Empty class diagram',
    thumbnail: null,
    elements: [],
    connections: [],
  },
  {
    id: 'simple-class',
    name: 'Simple Class',
    description: 'Single class example',
    thumbnail: null,
    elements: [
      {
        id: 'c1',
        type: 'class',
        label: 'Person',
        x: 200,
        y: 100,
        size: { width: 180, height: 140 },
        data: {
          attributes: ['- name: String', '- age: int', '- email: String'],
          methods: ['+ getName(): String', '+ setName(name: String): void', '+ getAge(): int'],
        },
      },
    ],
    connections: [],
  },
  {
    id: 'inheritance',
    name: 'Inheritance Example',
    description: 'Class hierarchy with inheritance',
    thumbnail: null,
    elements: [
      {
        id: 'c1',
        type: 'class',
        label: 'Animal',
        x: 250,
        y: 50,
        size: { width: 160, height: 100 },
        data: {
          attributes: ['# name: String'],
          methods: ['+ makeSound(): void'],
        },
      },
      {
        id: 'c2',
        type: 'class',
        label: 'Dog',
        x: 100,
        y: 220,
        size: { width: 160, height: 100 },
        data: {
          attributes: ['- breed: String'],
          methods: ['+ bark(): void'],
        },
      },
      {
        id: 'c3',
        type: 'class',
        label: 'Cat',
        x: 350,
        y: 220,
        size: { width: 160, height: 100 },
        data: {
          attributes: ['- indoor: boolean'],
          methods: ['+ meow(): void'],
        },
      },
    ],
    connections: [
      { id: 'i1', sourceId: 'c2', targetId: 'c1', type: 'inheritance' },
      { id: 'i2', sourceId: 'c3', targetId: 'c1', type: 'inheritance' },
    ],
  },
  {
    id: 'domain-model',
    name: 'Domain Model',
    description: 'Simple domain model with associations',
    thumbnail: null,
    elements: [
      {
        id: 'c1',
        type: 'class',
        label: 'Customer',
        x: 50,
        y: 100,
        size: { width: 160, height: 100 },
        data: {
          attributes: ['- id: Long', '- name: String'],
          methods: ['+ placeOrder(): Order'],
        },
      },
      {
        id: 'c2',
        type: 'class',
        label: 'Order',
        x: 300,
        y: 100,
        size: { width: 160, height: 100 },
        data: {
          attributes: ['- orderId: Long', '- date: Date', '- total: Money'],
          methods: ['+ addItem(item): void'],
        },
      },
      {
        id: 'c3',
        type: 'class',
        label: 'OrderItem',
        x: 550,
        y: 100,
        size: { width: 160, height: 100 },
        data: {
          attributes: ['- quantity: int', '- price: Money'],
        },
      },
      {
        id: 'c4',
        type: 'class',
        label: 'Product',
        x: 550,
        y: 280,
        size: { width: 160, height: 100 },
        data: {
          attributes: ['- sku: String', '- name: String', '- price: Money'],
        },
      },
    ],
    connections: [
      { id: 'a1', sourceId: 'c1', targetId: 'c2', type: 'directed-association', label: '1..*' },
      { id: 'a2', sourceId: 'c2', targetId: 'c3', type: 'composition', label: '1..*' },
      { id: 'a3', sourceId: 'c3', targetId: 'c4', type: 'association', label: '1' },
    ],
  },
  {
    id: 'interface-impl',
    name: 'Interface Implementation',
    description: 'Interface with implementing classes',
    thumbnail: null,
    elements: [
      {
        id: 'i1',
        type: 'interface',
        label: 'Repository',
        x: 200,
        y: 50,
        size: { width: 180, height: 80 },
        data: {
          methods: ['+ save(entity): void', '+ findById(id): Entity', '+ delete(entity): void'],
        },
      },
      {
        id: 'c1',
        type: 'class',
        label: 'JpaRepository',
        x: 50,
        y: 200,
        size: { width: 180, height: 100 },
        data: {
          attributes: ['- entityManager: EntityManager'],
        },
      },
      {
        id: 'c2',
        type: 'class',
        label: 'InMemoryRepository',
        x: 300,
        y: 200,
        size: { width: 180, height: 100 },
        data: {
          attributes: ['- storage: Map'],
        },
      },
    ],
    connections: [
      { id: 'r1', sourceId: 'c1', targetId: 'i1', type: 'realization' },
      { id: 'r2', sourceId: 'c2', targetId: 'i1', type: 'realization' },
    ],
  },
];

// ============ NODE PROPERTIES ============

const nodeProperties = [
  { id: 'documentation', label: 'Documentation', type: 'textarea' },
  { id: 'author', label: 'Author', type: 'text' },
  { id: 'version', label: 'Version', type: 'text' },
];

// ============ CUSTOM RENDERERS ============

// UML Class Renderer with compartments
function UMLClassRenderer({ element, stencil, isSelected }) {
  const { label, data } = element;
  const stereotype = data?.stereotype;
  const isAbstract = data?.isAbstract || element.type === 'abstract-class';
  const attributes = Array.isArray(data?.attributes) ? data.attributes : [];
  const methods = Array.isArray(data?.methods) ? data.methods : [];
  const values = Array.isArray(data?.values) ? data.values : []; // For enums
  const isInterface = element.type === 'interface';
  const isEnum = element.type === 'enum';

  // Get color from stencil
  const color = element.color || stencil?.color || '#3b82f6';

  return (
    <div className="uml-class-node" style={{ borderColor: color }}>
      {/* Header section with stereotype and name */}
      <div className="uml-class-header" style={{ backgroundColor: color }}>
        {(stereotype || isInterface || isEnum) && (
          <div className="uml-class-stereotype">
            «{stereotype || (isInterface ? 'interface' : isEnum ? 'enumeration' : '')}»
          </div>
        )}
        <div className={`uml-class-name ${isAbstract ? 'abstract' : ''}`}>
          {label || 'Unnamed'}
        </div>
      </div>

      {/* Attributes section (not for interfaces unless defined) */}
      {!isEnum && (
        <div className="uml-class-section uml-class-attributes">
          {attributes.length > 0 ? (
            attributes.map((attr, idx) => (
              <div key={idx} className="uml-class-member">
                {attr}
              </div>
            ))
          ) : (
            <div className="uml-class-member empty">─</div>
          )}
        </div>
      )}

      {/* Enum values section */}
      {isEnum && (
        <div className="uml-class-section uml-class-values">
          {values.length > 0 ? (
            values.map((val, idx) => (
              <div key={idx} className="uml-class-member enum-value">
                {val}
              </div>
            ))
          ) : (
            <div className="uml-class-member empty">─</div>
          )}
        </div>
      )}

      {/* Methods section */}
      {!isEnum && (
        <div className="uml-class-section uml-class-methods">
          {methods.length > 0 ? (
            methods.map((method, idx) => (
              <div key={idx} className="uml-class-member">
                {method}
              </div>
            ))
          ) : (
            <div className="uml-class-member empty">─</div>
          )}
        </div>
      )}
    </div>
  );
}

// UML Package Renderer
function UMLPackageRenderer({ element, stencil, isSelected }) {
  const color = element.color || stencil?.color || '#64748b';
  const packagePath = element.data?.packagePath || '';

  return (
    <div className="uml-package-node" style={{ borderColor: color }}>
      <div className="uml-package-tab" style={{ backgroundColor: color }}>
        <span className="uml-package-name">{element.label || 'Package'}</span>
      </div>
      <div className="uml-package-body">
        {packagePath && <span className="uml-package-path">{packagePath}</span>}
      </div>
    </div>
  );
}

// UML Note Renderer
function UMLNoteRenderer({ element, stencil }) {
  return (
    <div className="uml-note-node">
      <div className="uml-note-corner"></div>
      <div className="uml-note-content">
        {element.label || 'Note...'}
      </div>
    </div>
  );
}

// ============ USE CASE DIAGRAM RENDERERS ============

// Actor Renderer (stick figure)
function ActorRenderer({ element, stencil }) {
  const color = element.color || stencil?.color || '#3b82f6';
  const actorType = element.data?.actorType || 'person';

  return (
    <svg width="100%" height="100%" viewBox="0 0 60 100" style={{ overflow: 'visible' }}>
      {actorType === 'person' ? (
        <>
          {/* Head */}
          <circle cx="30" cy="15" r="12" fill="none" stroke={color} strokeWidth="2" />
          {/* Body */}
          <line x1="30" y1="27" x2="30" y2="55" stroke={color} strokeWidth="2" />
          {/* Arms */}
          <line x1="10" y1="40" x2="50" y2="40" stroke={color} strokeWidth="2" />
          {/* Left leg */}
          <line x1="30" y1="55" x2="15" y2="80" stroke={color} strokeWidth="2" />
          {/* Right leg */}
          <line x1="30" y1="55" x2="45" y2="80" stroke={color} strokeWidth="2" />
        </>
      ) : actorType === 'system' ? (
        <>
          {/* System box */}
          <rect x="5" y="5" width="50" height="60" rx="4" fill="none" stroke={color} strokeWidth="2" />
          {/* Monitor screen */}
          <rect x="10" y="10" width="40" height="30" fill={color} opacity="0.2" />
          {/* Stand */}
          <line x1="30" y1="65" x2="30" y2="75" stroke={color} strokeWidth="2" />
          <line x1="15" y1="75" x2="45" y2="75" stroke={color} strokeWidth="2" />
        </>
      ) : (
        <>
          {/* Clock face */}
          <circle cx="30" cy="35" r="25" fill="none" stroke={color} strokeWidth="2" />
          {/* Clock hands */}
          <line x1="30" y1="35" x2="30" y2="18" stroke={color} strokeWidth="2" />
          <line x1="30" y1="35" x2="42" y2="35" stroke={color} strokeWidth="2" />
        </>
      )}
      {/* Label */}
      <text x="30" y="95" textAnchor="middle" fontSize="11" fill="var(--text)">
        {element.label || 'Actor'}
      </text>
    </svg>
  );
}

// Use Case Renderer (ellipse)
function UseCaseRenderer({ element, stencil }) {
  const color = element.color || stencil?.color || '#22c55e';

  return (
    <svg width="100%" height="100%" viewBox="0 0 140 70" style={{ overflow: 'visible' }}>
      <ellipse
        cx="70"
        cy="35"
        rx="68"
        ry="33"
        fill="white"
        stroke={color}
        strokeWidth="2"
      />
      <text x="70" y="38" textAnchor="middle" fontSize="12" fill="var(--text)">
        {element.label || 'Use Case'}
      </text>
    </svg>
  );
}

// System Boundary Renderer
function SystemBoundaryRenderer({ element, stencil }) {
  const color = element.color || stencil?.color || '#64748b';
  const systemName = element.data?.systemName || element.label || 'System';

  return (
    <div style={{
      width: '100%',
      height: '100%',
      border: `2px solid ${color}`,
      borderRadius: 4,
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute',
        top: 4,
        left: 8,
        fontSize: 13,
        fontWeight: 600,
        color,
      }}>
        {systemName}
      </div>
    </div>
  );
}

// ============ ACTIVITY DIAGRAM RENDERERS ============

// Initial Node Renderer (filled circle)
function InitialNodeRenderer({ element, stencil }) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 30 30">
      <circle cx="15" cy="15" r="12" fill="#1f2937" />
    </svg>
  );
}

// Final Node Renderer (bullseye)
function FinalNodeRenderer({ element, stencil }) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 30 30">
      <circle cx="15" cy="15" r="13" fill="none" stroke="#1f2937" strokeWidth="2" />
      <circle cx="15" cy="15" r="8" fill="#1f2937" />
    </svg>
  );
}

// Flow Final Renderer (circle with X)
function FlowFinalRenderer({ element, stencil }) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 30 30">
      <circle cx="15" cy="15" r="12" fill="none" stroke="#6b7280" strokeWidth="2" />
      <line x1="8" y1="8" x2="22" y2="22" stroke="#6b7280" strokeWidth="2" />
      <line x1="22" y1="8" x2="8" y2="22" stroke="#6b7280" strokeWidth="2" />
    </svg>
  );
}

// Action Renderer (rounded rectangle)
function ActionRenderer({ element, stencil }) {
  const color = element.color || stencil?.color || '#3b82f6';
  const actionType = element.data?.actionType || 'call';

  const getIcon = () => {
    switch (actionType) {
      case 'send': return '▶';
      case 'accept': return '◀';
      case 'time': return '⏱';
      default: return null;
    }
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: 'white',
      border: `2px solid ${color}`,
      borderRadius: 12,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      padding: '4px 8px',
      boxSizing: 'border-box',
    }}>
      {getIcon() && <span style={{ opacity: 0.6 }}>{getIcon()}</span>}
      <span style={{ fontSize: 12, textAlign: 'center' }}>{element.label || 'Action'}</span>
    </div>
  );
}

// Decision/Merge Renderer (diamond)
function DecisionRenderer({ element, stencil }) {
  const color = element.color || stencil?.color || '#f59e0b';

  return (
    <svg width="100%" height="100%" viewBox="0 0 50 50">
      <polygon
        points="25,2 48,25 25,48 2,25"
        fill="white"
        stroke={color}
        strokeWidth="2"
      />
    </svg>
  );
}

// Fork/Join Renderer (thick bar)
function ForkJoinRenderer({ element, stencil }) {
  const orientation = element.data?.orientation || 'horizontal';

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: '#1f2937',
      borderRadius: 2,
    }} />
  );
}

// Swimlane Renderer
function SwimlaneRenderer({ element, stencil }) {
  const color = element.color || stencil?.color || '#e5e7eb';
  const responsible = element.data?.responsible || element.label || 'Lane';

  return (
    <div style={{
      width: '100%',
      height: '100%',
      border: `2px solid ${color}`,
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 28,
        background: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        fontWeight: 600,
        borderBottom: `2px solid ${color}`,
      }}>
        {responsible}
      </div>
    </div>
  );
}

// ============ STATE MACHINE RENDERERS ============

// State Renderer (rounded rectangle with compartments)
function StateRenderer({ element, stencil }) {
  const color = element.color || stencil?.color || '#22c55e';
  const entry = element.data?.entry;
  const exit = element.data?.exit;
  const doActivity = element.data?.doActivity;
  const hasActions = entry || exit || doActivity;

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: 'white',
      border: `2px solid ${color}`,
      borderRadius: 12,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '6px 8px',
        textAlign: 'center',
        fontWeight: 600,
        fontSize: 12,
        borderBottom: hasActions ? `1px solid ${color}` : 'none',
      }}>
        {element.label || 'State'}
      </div>
      {hasActions && (
        <div style={{ padding: '4px 6px', fontSize: 10, color: 'var(--text-muted)' }}>
          {entry && <div>entry / {entry}</div>}
          {doActivity && <div>do / {doActivity}</div>}
          {exit && <div>exit / {exit}</div>}
        </div>
      )}
    </div>
  );
}

// History Renderer
function HistoryRenderer({ element, stencil }) {
  const color = element.color || stencil?.color || '#6b7280';
  const isDeep = element.data?.historyType === 'deep';

  return (
    <svg width="100%" height="100%" viewBox="0 0 30 30">
      <circle cx="15" cy="15" r="12" fill="none" stroke={color} strokeWidth="2" />
      <text x="15" y="19" textAnchor="middle" fontSize="12" fontWeight="bold" fill={color}>
        {isDeep ? 'H*' : 'H'}
      </text>
    </svg>
  );
}

// ============ SEQUENCE DIAGRAM RENDERERS ============

// Lifeline Renderer
function LifelineRenderer({ element, stencil }) {
  const color = element.color || stencil?.color || '#3b82f6';
  const objectName = element.data?.objectName || element.label || 'object';
  const className = element.data?.className || '';

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      {/* Header box */}
      <div style={{
        padding: '6px 12px',
        border: `2px solid ${color}`,
        background: 'white',
        borderRadius: 4,
        textAlign: 'center',
        minWidth: 60,
      }}>
        <div style={{ fontSize: 12 }}>
          {objectName}{className && `:${className}`}
        </div>
      </div>
      {/* Dashed lifeline */}
      <div style={{
        flex: 1,
        width: 0,
        borderLeft: `2px dashed ${color}`,
        marginTop: 4,
      }} />
    </div>
  );
}

// Combined Fragment Renderer
function CombinedFragmentRenderer({ element, stencil }) {
  const color = element.color || stencil?.color || '#64748b';
  const fragmentType = element.data?.fragmentType || 'alt';
  const guard = element.data?.guard || '';

  return (
    <div style={{
      width: '100%',
      height: '100%',
      border: `2px solid ${color}`,
      position: 'relative',
    }}>
      {/* Fragment type label */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        background: color,
        color: 'white',
        padding: '2px 8px',
        fontSize: 10,
        fontWeight: 600,
      }}>
        {fragmentType}
      </div>
      {/* Guard condition */}
      {guard && (
        <div style={{
          position: 'absolute',
          top: 22,
          left: 8,
          fontSize: 10,
          color: 'var(--text-muted)',
        }}>
          {guard}
        </div>
      )}
    </div>
  );
}

// Main render function that delegates to specific renderers
function renderNode(element, stencil, isSelected) {
  switch (element.type) {
    // Class Diagram
    case 'class':
    case 'abstract-class':
    case 'interface':
    case 'enum':
      return <UMLClassRenderer element={element} stencil={stencil} isSelected={isSelected} />;
    case 'package':
      return <UMLPackageRenderer element={element} stencil={stencil} isSelected={isSelected} />;
    case 'note':
      return <UMLNoteRenderer element={element} stencil={stencil} />;

    // Use Case Diagram
    case 'actor':
      return <ActorRenderer element={element} stencil={stencil} />;
    case 'use-case':
      return <UseCaseRenderer element={element} stencil={stencil} />;
    case 'system-boundary':
      return <SystemBoundaryRenderer element={element} stencil={stencil} />;

    // Activity Diagram
    case 'initial-node':
      return <InitialNodeRenderer element={element} stencil={stencil} />;
    case 'final-node':
    case 'final-state':
      return <FinalNodeRenderer element={element} stencil={stencil} />;
    case 'flow-final':
      return <FlowFinalRenderer element={element} stencil={stencil} />;
    case 'action':
      return <ActionRenderer element={element} stencil={stencil} />;
    case 'decision':
    case 'choice':
      return <DecisionRenderer element={element} stencil={stencil} />;
    case 'fork-join':
      return <ForkJoinRenderer element={element} stencil={stencil} />;
    case 'swimlane':
      return <SwimlaneRenderer element={element} stencil={stencil} />;

    // State Machine
    case 'initial-state':
      return <InitialNodeRenderer element={element} stencil={stencil} />;
    case 'state':
    case 'composite-state':
      return <StateRenderer element={element} stencil={stencil} />;
    case 'history':
      return <HistoryRenderer element={element} stencil={stencil} />;

    // Sequence Diagram
    case 'lifeline':
      return <LifelineRenderer element={element} stencil={stencil} />;
    case 'combined-fragment':
      return <CombinedFragmentRenderer element={element} stencil={stencil} />;

    default:
      return null; // Use default rendering
  }
}

// ============ PACK EXPORT ============

const UMLClassPack = {
  id: 'uml-class',
  name: 'UML Diagrams',
  description: 'Comprehensive UML: Class, Use Case, Activity, State Machine, Sequence diagrams',
  icon: '📐',
  stencils,
  connectionTypes,
  validators,
  templates,
  nodeProperties,
  renderNode, // Custom renderer for all UML elements
  defaultLineStyle: 'step', // UML uses orthogonal lines
};

export default UMLClassPack;
export { stencils, connectionTypes, validators, templates, nodeProperties };
