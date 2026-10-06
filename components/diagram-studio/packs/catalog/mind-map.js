// Catalog data for the "mind-map" pack: plain data, no React. Shared by the pack (rendering) and the MCP server.
// Do not import UI code here (enforced by __tests__/lib/catalog.test.js).

export const stencils = [
  // Central Topic
  {
    id: 'central-topic',
    name: 'Central Topic',
    description: 'Main topic at the center of the mind map',
    group: 'Topics',
    shape: 'ellipse',
    icon: '◉',
    color: '#3b82f6',
    defaultSize: { width: 160, height: 80 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
    properties: [
      { id: 'priority', label: 'Priority', type: 'select', options: [
        { value: 'high', label: 'High' },
        { value: 'medium', label: 'Medium' },
        { value: 'low', label: 'Low' },
      ]},
    ],
  },

  // Main Branch
  {
    id: 'main-topic',
    name: 'Main Topic',
    description: 'Primary branch from central topic',
    group: 'Topics',
    shape: 'rect',
    icon: '◆',
    color: '#22c55e',
    defaultSize: { width: 140, height: 50 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
    properties: [
      { id: 'priority', label: 'Priority', type: 'select', options: [
        { value: 'high', label: 'High' },
        { value: 'medium', label: 'Medium' },
        { value: 'low', label: 'Low' },
      ]},
      { id: 'status', label: 'Status', type: 'select', options: [
        { value: 'open', label: 'Open' },
        { value: 'in-progress', label: 'In Progress' },
        { value: 'done', label: 'Done' },
      ]},
    ],
  },

  // Sub-topic
  {
    id: 'sub-topic',
    name: 'Sub-topic',
    description: 'Secondary branch topic',
    group: 'Topics',
    shape: 'rect',
    icon: '◇',
    color: '#f59e0b',
    defaultSize: { width: 120, height: 40 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
    properties: [
      { id: 'status', label: 'Status', type: 'select', options: [
        { value: 'open', label: 'Open' },
        { value: 'in-progress', label: 'In Progress' },
        { value: 'done', label: 'Done' },
      ]},
    ],
  },

  // Floating Topic
  {
    id: 'floating-topic',
    name: 'Floating Topic',
    description: 'Unconnected idea or note',
    group: 'Topics',
    shape: 'rect',
    icon: '○',
    color: '#8b5cf6',
    defaultSize: { width: 100, height: 35 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
  },

  // Colored Topics
  {
    id: 'topic-red',
    name: 'Red Topic',
    description: 'Red colored topic',
    group: 'Colored',
    shape: 'rect',
    icon: '●',
    tintIcon: true, // palette tile shows the topic's own colour
    color: '#ef4444',
    defaultSize: { width: 120, height: 40 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
  },
  {
    id: 'topic-blue',
    name: 'Blue Topic',
    description: 'Blue colored topic',
    group: 'Colored',
    shape: 'rect',
    icon: '●',
    tintIcon: true, // palette tile shows the topic's own colour
    color: '#3b82f6',
    defaultSize: { width: 120, height: 40 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
  },
  {
    id: 'topic-green',
    name: 'Green Topic',
    description: 'Green colored topic',
    group: 'Colored',
    shape: 'rect',
    icon: '●',
    tintIcon: true, // palette tile shows the topic's own colour
    color: '#22c55e',
    defaultSize: { width: 120, height: 40 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
  },
  {
    id: 'topic-purple',
    name: 'Purple Topic',
    description: 'Purple colored topic',
    group: 'Colored',
    shape: 'rect',
    icon: '●',
    tintIcon: true, // palette tile shows the topic's own colour
    color: '#8b5cf6',
    defaultSize: { width: 120, height: 40 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
  },

  // Special Elements
  {
    id: 'callout',
    name: 'Callout',
    description: 'Callout note attached to a topic',
    group: 'Special',
    shape: 'rect',
    icon: '💬',
    color: '#fef3c7',
    defaultSize: { width: 140, height: 60 },
    ports: [
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
  },
  {
    id: 'image',
    name: 'Image',
    description: 'Image placeholder',
    group: 'Special',
    shape: 'rect',
    icon: '🖼',
    color: '#e5e7eb',
    defaultSize: { width: 100, height: 80 },
    ports: [],
    isContainer: false,
    properties: [
      { id: 'imageUrl', label: 'Image URL', type: 'text' },
    ],
  },
  {
    id: 'link',
    name: 'Link',
    description: 'External link reference',
    group: 'Special',
    shape: 'rect',
    icon: '🔗',
    color: '#dbeafe',
    defaultSize: { width: 120, height: 40 },
    ports: [],
    isContainer: false,
    properties: [
      { id: 'url', label: 'URL', type: 'text' },
    ],
  },

  // Boundaries
  {
    id: 'boundary',
    name: 'Boundary',
    description: 'Group boundary around topics',
    group: 'Grouping',
    shape: 'rect',
    icon: '⬜',
    color: '#f3f4f6',
    defaultSize: { width: 250, height: 200 },
    ports: [],
    isContainer: true,
  },
  {
    id: 'summary',
    name: 'Summary',
    description: 'Summary bracket for multiple topics',
    group: 'Grouping',
    shape: 'rect',
    icon: '⊏',
    color: '#e5e7eb',
    defaultSize: { width: 30, height: 100 },
    ports: [
      { id: 'right', position: 'right' },
    ],
    isContainer: false,
  },
];

export const connectionTypes = [
  {
    id: 'branch',
    name: 'Branch',
    description: 'Standard mind map branch connection',
    style: 'solid',
    arrowStart: 'none',
    arrowEnd: 'none',
    color: '#374151',
    curved: true,
  },
  {
    id: 'arrow-branch',
    name: 'Arrow Branch',
    description: 'Branch with directional arrow',
    style: 'solid',
    arrowStart: 'none',
    arrowEnd: 'arrow',
    color: '#374151',
    curved: true,
  },
  {
    id: 'dashed-branch',
    name: 'Dashed Branch',
    description: 'Dashed connection for related topics',
    style: 'dashed',
    arrowStart: 'none',
    arrowEnd: 'none',
    color: '#6b7280',
    curved: true,
  },
  {
    id: 'relationship',
    name: 'Relationship',
    description: 'Cross-branch relationship',
    style: 'dashed',
    arrowStart: 'none',
    arrowEnd: 'arrow',
    color: '#ef4444',
    curved: true,
  },
  {
    id: 'callout-link',
    name: 'Callout Link',
    description: 'Link to callout note',
    style: 'dotted',
    arrowStart: 'none',
    arrowEnd: 'none',
    color: '#9ca3af',
  },
];
