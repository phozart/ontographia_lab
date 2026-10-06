// Catalog data for the "sticky-notes" pack: plain data, no React. Shared by the pack (rendering) and the MCP server.
// Do not import UI code here (enforced by __tests__/lib/catalog.test.js).

export const stencils = [
  // Sticky Notes - Different sizes
  {
    id: 'sticky-small',
    name: 'Small Note',
    description: 'Small sticky note',
    group: 'Notes',
    shape: 'sticky',
    icon: '📋',
    color: '#fef08a', // yellow
    defaultSize: { width: 100, height: 100 },
    ports: [],
    isContainer: false,
    properties: [
      { id: 'author', label: 'Author', type: 'text' },
    ],
  },
  {
    id: 'sticky-medium',
    name: 'Medium Note',
    description: 'Medium sticky note',
    group: 'Notes',
    shape: 'sticky',
    icon: '📋',
    color: '#fef08a', // yellow
    defaultSize: { width: 150, height: 150 },
    ports: [],
    isContainer: false,
    properties: [
      { id: 'author', label: 'Author', type: 'text' },
    ],
  },
  {
    id: 'sticky-large',
    name: 'Large Note',
    description: 'Large sticky note',
    group: 'Notes',
    shape: 'sticky',
    icon: '📋',
    color: '#fef08a', // yellow
    defaultSize: { width: 200, height: 200 },
    ports: [],
    isContainer: false,
    properties: [
      { id: 'author', label: 'Author', type: 'text' },
    ],
  },

  // Colored Sticky Notes
  {
    id: 'sticky-blue',
    name: 'Blue Note',
    description: 'Blue sticky note',
    group: 'Colors',
    shape: 'sticky',
    icon: '📋',
    color: '#93c5fd', // blue
    defaultSize: { width: 150, height: 150 },
    ports: [],
    isContainer: false,
  },
  {
    id: 'sticky-green',
    name: 'Green Note',
    description: 'Green sticky note',
    group: 'Colors',
    shape: 'sticky',
    icon: '📋',
    color: '#86efac', // green
    defaultSize: { width: 150, height: 150 },
    ports: [],
    isContainer: false,
  },
  {
    id: 'sticky-pink',
    name: 'Pink Note',
    description: 'Pink sticky note',
    group: 'Colors',
    shape: 'sticky',
    icon: '📋',
    color: '#f9a8d4', // pink
    defaultSize: { width: 150, height: 150 },
    ports: [],
    isContainer: false,
  },
  {
    id: 'sticky-orange',
    name: 'Orange Note',
    description: 'Orange sticky note',
    group: 'Colors',
    shape: 'sticky',
    icon: '📋',
    color: '#fdba74', // orange
    defaultSize: { width: 150, height: 150 },
    ports: [],
    isContainer: false,
  },
  {
    id: 'sticky-purple',
    name: 'Purple Note',
    description: 'Purple sticky note',
    group: 'Colors',
    shape: 'sticky',
    icon: '📋',
    color: '#c4b5fd', // purple
    defaultSize: { width: 150, height: 150 },
    ports: [],
    isContainer: false,
  },

  // Containers/Groups
  {
    id: 'group-box',
    name: 'Group Box',
    description: 'Container for grouping notes',
    group: 'Containers',
    shape: 'rect',
    icon: '⬜',
    color: '#e5e7eb',
    defaultSize: { width: 300, height: 250 },
    ports: [],
    isContainer: true,
    properties: [
      { id: 'category', label: 'Category', type: 'text' },
    ],
  },
  {
    id: 'section',
    name: 'Section',
    description: 'Large section divider',
    group: 'Containers',
    shape: 'rect',
    icon: '▭',
    color: '#f3f4f6',
    defaultSize: { width: 500, height: 400 },
    ports: [],
    isContainer: true,
    properties: [
      { id: 'sectionTitle', label: 'Section Title', type: 'text' },
    ],
  },

  // Shapes
  {
    id: 'text-block',
    name: 'Text Block',
    description: 'Plain text block',
    group: 'Shapes',
    shape: 'rect',
    icon: 'T',
    color: 'transparent',
    defaultSize: { width: 200, height: 60 },
    ports: [],
    isContainer: false,
  },
  {
    id: 'circle-marker',
    name: 'Circle Marker',
    description: 'Circle marker for emphasis',
    group: 'Shapes',
    shape: 'circle',
    icon: '●',
    color: '#ef4444',
    defaultSize: { width: 40, height: 40 },
    ports: [],
    isContainer: false,
  },
  {
    id: 'arrow-marker',
    name: 'Arrow Marker',
    description: 'Arrow for pointing',
    group: 'Shapes',
    shape: 'rect',
    icon: '→',
    color: '#374151',
    defaultSize: { width: 60, height: 30 },
    ports: [],
    isContainer: false,
  },

  // Special
  {
    id: 'image-placeholder',
    name: 'Image',
    description: 'Placeholder for image',
    group: 'Special',
    shape: 'rect',
    icon: '🖼',
    color: '#d1d5db',
    defaultSize: { width: 200, height: 150 },
    ports: [],
    isContainer: false,
    properties: [
      { id: 'imageUrl', label: 'Image URL', type: 'text' },
      { id: 'altText', label: 'Alt Text', type: 'text' },
    ],
  },
  {
    id: 'link-card',
    name: 'Link Card',
    description: 'Card with external link',
    group: 'Special',
    shape: 'rect',
    icon: '🔗',
    color: '#dbeafe',
    defaultSize: { width: 180, height: 80 },
    ports: [],
    isContainer: false,
    properties: [
      { id: 'url', label: 'URL', type: 'text' },
      { id: 'linkTitle', label: 'Link Title', type: 'text' },
    ],
  },
];

export const connectionTypes = [
  {
    id: 'line',
    name: 'Line',
    description: 'Simple connecting line',
    style: 'solid',
    arrowStart: 'none',
    arrowEnd: 'none',
    color: '#6b7280',
  },
  {
    id: 'arrow',
    name: 'Arrow',
    description: 'Directional arrow',
    style: 'solid',
    arrowStart: 'none',
    arrowEnd: 'arrow',
    color: '#374151',
  },
  {
    id: 'dashed-line',
    name: 'Dashed Line',
    description: 'Dashed connecting line',
    style: 'dashed',
    arrowStart: 'none',
    arrowEnd: 'none',
    color: '#9ca3af',
  },
  {
    id: 'double-arrow',
    name: 'Double Arrow',
    description: 'Bidirectional arrow',
    style: 'solid',
    arrowStart: 'arrow',
    arrowEnd: 'arrow',
    color: '#374151',
  },
];
