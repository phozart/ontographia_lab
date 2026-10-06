// Catalog data for the "erd" pack: plain data, no React. Shared by the pack (rendering) and the MCP server.
// Do not import UI code here (enforced by __tests__/lib/catalog.test.js).

export const stencils = [
  // Entity
  {
    id: 'entity',
    name: 'Entity',
    description: 'Database entity/table with fields',
    group: 'Tables',
    shape: 'rect',
    icon: '▤',
    color: '#3b82f6',
    defaultSize: { width: 200, height: 160 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
    compartments: ['name', 'fields', 'indexes'],
    properties: [
      { id: 'fields', label: 'Fields', type: 'fieldList' },
      { id: 'indexes', label: 'Indexes', type: 'list' },
      { id: 'schema', label: 'Schema', type: 'text', placeholder: 'public' },
      { id: 'engine', label: 'Engine', type: 'text', placeholder: 'InnoDB' },
    ],
  },
  // Weak Entity
  {
    id: 'weak-entity',
    name: 'Weak Entity',
    description: 'Entity dependent on another entity',
    group: 'Tables',
    shape: 'rect',
    icon: '▤▤',
    color: '#8b5cf6',
    defaultSize: { width: 200, height: 140 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
    compartments: ['name', 'fields'],
    properties: [
      { id: 'fields', label: 'Fields', type: 'fieldList' },
      { id: 'partialKey', label: 'Partial Key', type: 'text' },
    ],
  },
  // View
  {
    id: 'view',
    name: 'View',
    description: 'Database view',
    group: 'Tables',
    shape: 'rect',
    icon: '⧉',
    color: '#06b6d4',
    defaultSize: { width: 180, height: 100 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
    properties: [
      { id: 'fields', label: 'Fields', type: 'list' },
      { id: 'query', label: 'Query', type: 'textarea' },
    ],
  },
  // Junction Table (for M:N)
  {
    id: 'junction',
    name: 'Junction Table',
    description: 'Junction table for many-to-many relationships',
    group: 'Tables',
    shape: 'rect',
    icon: '⊞',
    color: '#f59e0b',
    defaultSize: { width: 160, height: 100 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
    compartments: ['name', 'fields'],
    properties: [
      { id: 'fields', label: 'Foreign Keys', type: 'fieldList' },
    ],
  },
  // Attribute (Chen notation)
  {
    id: 'attribute',
    name: 'Attribute',
    description: 'Entity attribute (Chen notation)',
    group: 'Chen Notation',
    shape: 'ellipse',
    icon: '○',
    color: '#22c55e',
    defaultSize: { width: 100, height: 50 },
    ports: [
      { id: 'center', position: 'center' },
    ],
    isContainer: false,
    properties: [
      { id: 'dataType', label: 'Data Type', type: 'text' },
      { id: 'isPrimaryKey', label: 'Primary Key', type: 'boolean' },
      { id: 'isMultivalued', label: 'Multivalued', type: 'boolean' },
      { id: 'isDerived', label: 'Derived', type: 'boolean' },
    ],
  },
  // Relationship (Chen notation)
  {
    id: 'relationship-chen',
    name: 'Relationship',
    description: 'Relationship diamond (Chen notation)',
    group: 'Chen Notation',
    shape: 'diamond',
    icon: '◇',
    color: '#ef4444',
    defaultSize: { width: 100, height: 80 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
    properties: [
      { id: 'cardinality', label: 'Cardinality', type: 'text' },
    ],
  },
  // Note
  {
    id: 'erd-note',
    name: 'Note',
    description: 'Documentation note',
    group: 'Annotations',
    shape: 'rect',
    icon: '📝',
    color: '#fef3c7',
    defaultSize: { width: 150, height: 80 },
    ports: [],
    isContainer: false,
  },
];

export const connectionTypes = [
  // One-to-One
  {
    id: 'one-to-one',
    name: 'One to One (1:1)',
    description: 'One-to-one relationship',
    style: 'solid',
    arrowStart: 'one',
    arrowEnd: 'one',
    color: '#374151',
  },
  // One-to-Many
  {
    id: 'one-to-many',
    name: 'One to Many (1:N)',
    description: 'One-to-many relationship',
    style: 'solid',
    arrowStart: 'one',
    arrowEnd: 'many',
    color: '#374151',
  },
  // Many-to-One
  {
    id: 'many-to-one',
    name: 'Many to One (N:1)',
    description: 'Many-to-one relationship',
    style: 'solid',
    arrowStart: 'many',
    arrowEnd: 'one',
    color: '#374151',
  },
  // Many-to-Many
  {
    id: 'many-to-many',
    name: 'Many to Many (M:N)',
    description: 'Many-to-many relationship',
    style: 'solid',
    arrowStart: 'many',
    arrowEnd: 'many',
    color: '#374151',
  },
  // Zero-or-One
  {
    id: 'zero-or-one',
    name: 'Zero or One (0..1)',
    description: 'Optional one relationship',
    style: 'solid',
    arrowStart: 'none',
    arrowEnd: 'zero-one',
    color: '#374151',
  },
  // Zero-or-Many
  {
    id: 'zero-or-many',
    name: 'Zero or Many (0..*)',
    description: 'Optional many relationship',
    style: 'solid',
    arrowStart: 'none',
    arrowEnd: 'zero-many',
    color: '#374151',
  },
  // Identifying Relationship
  {
    id: 'identifying',
    name: 'Identifying Relationship',
    description: 'Identifying relationship (solid line)',
    style: 'solid',
    arrowStart: 'none',
    arrowEnd: 'none',
    color: '#374151',
    strokeWidth: 2,
  },
  // Non-Identifying
  {
    id: 'non-identifying',
    name: 'Non-Identifying',
    description: 'Non-identifying relationship (dashed)',
    style: 'dashed',
    arrowStart: 'none',
    arrowEnd: 'none',
    color: '#6b7280',
  },
];
