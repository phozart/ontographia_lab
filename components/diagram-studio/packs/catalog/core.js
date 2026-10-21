// Catalog data for the "core" pack: plain data, no React. Shared by the pack (rendering) and the MCP server.
// Do not import UI code here (enforced by __tests__/lib/catalog.test.js).

export const stencils = [
  // Frame/Canvas - A container for organizing content (no connection ports, just resize)
  {
    id: 'frame',
    name: 'Frame',
    description: 'A visual frame for organizing related elements. Can be exported separately.',
    group: 'Organization',
    shape: 'frame',
    icon: '⬜',
    color: '#64748b',
    defaultSize: { width: 600, height: 400 },
    defaultData: { backgroundColor: '#ffffff', showTitle: true }, // White background by default
    ports: [], // No ports - frames don't connect to lines
    isContainer: true,
    isFrame: true,
    noConnections: true, // Disable connections for frames
    properties: [
      { id: 'frameTitle', label: 'Title', type: 'text' },
      { id: 'backgroundColor', label: 'Background', type: 'color', default: '#ffffff' },
      { id: 'showTitle', label: 'Show Title Bar', type: 'boolean', default: true },
    ],
  },

  // Doc card (AI-5): a Markdown document that lives on the board. Content is data.doc = {title, markdown, ...};
  // the card shows the title and the first lines, the side panel edits it (components/diagram-studio/elements/doc).
  {
    id: 'doc',
    name: 'Doc',
    description: 'A text document on the board (Markdown). Link to elements with #el= links; write summaries next to the map.',
    group: 'Basic',
    shape: 'doc',
    icon: '\uD83D\uDCC4',
    color: '#4FB3CE',
    defaultSize: { width: 320, height: 220 },
    defaultLabel: 'Untitled doc',
    defaultData: { doc: { title: 'Untitled doc', markdown: '' } },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
  },

  // Section - A lighter container for grouping
  {
    id: 'section',
    name: 'Section',
    description: 'A lightweight grouping container',
    group: 'Organization',
    shape: 'section',
    icon: '▭',
    color: '#94a3b8',
    defaultSize: { width: 400, height: 300 },
    ports: [],
    isContainer: true,
    properties: [
      { id: 'sectionTitle', label: 'Title', type: 'text' },
    ],
  },

  // Table (AI-4): a typed matrix. Rows, columns and cells live in `element.data.table` (lib/table/tableModel.js);
  // the size follows the content (height grows with rows), so it is kept in sync by the table editor and the MCP tools.
  {
    id: 'table',
    name: 'Table',
    description: 'A table with typed columns (text, number, select, boolean). Rows can link to elements on the board.',
    group: 'Basic',
    shape: 'table',
    icon: '▦',
    color: '#4FB3CE',
    defaultSize: { width: 520, height: 130 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
    properties: [],
  },

  // Text Block
  {
    id: 'text-block',
    name: 'Text',
    description: 'A text block for labels and annotations',
    group: 'Basic',
    shape: 'rect',
    icon: 'T',
    color: '#374151',
    defaultSize: { width: 200, height: 40 },
    ports: [],
    isContainer: false,
    properties: [
      { id: 'fontSize', label: 'Font Size', type: 'select', options: [
        { value: '12', label: 'Small' },
        { value: '14', label: 'Normal' },
        { value: '18', label: 'Large' },
        { value: '24', label: 'Heading' },
      ]},
      { id: 'fontWeight', label: 'Weight', type: 'select', options: [
        { value: 'normal', label: 'Normal' },
        { value: 'bold', label: 'Bold' },
      ]},
    ],
  },

  // Basic shapes
  {
    id: 'rectangle',
    name: 'Rectangle',
    description: 'A basic rectangle shape',
    group: 'Basic',
    shape: 'rect',
    icon: '▭',
    color: '#3b82f6',
    defaultSize: { width: 120, height: 80 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
  },
  {
    id: 'circle',
    name: 'Circle',
    description: 'A basic circle shape',
    group: 'Basic',
    shape: 'circle',
    icon: '○',
    color: '#22c55e',
    defaultSize: { width: 80, height: 80 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
  },
  {
    id: 'diamond',
    name: 'Diamond',
    description: 'A diamond/rhombus shape',
    group: 'Basic',
    shape: 'diamond',
    icon: '◇',
    color: '#f59e0b',
    defaultSize: { width: 80, height: 80 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
  },

  // Divider line
  {
    id: 'divider',
    name: 'Divider',
    description: 'A horizontal or vertical divider line',
    group: 'Basic',
    shape: 'line',
    icon: '—',
    color: '#cbd5e1',
    defaultSize: { width: 200, height: 2 },
    ports: [],
    isContainer: false,
    properties: [
      { id: 'orientation', label: 'Orientation', type: 'select', options: [
        { value: 'horizontal', label: 'Horizontal' },
        { value: 'vertical', label: 'Vertical' },
      ]},
    ],
  },
];

export const connectionTypes = [
  {
    id: 'line',
    name: 'Line',
    description: 'A simple connecting line',
    style: 'solid',
    arrowStart: 'none',
    arrowEnd: 'none',
    color: '#64748b',
  },
  {
    id: 'arrow',
    name: 'Arrow',
    description: 'A line with arrow head',
    style: 'solid',
    arrowStart: 'none',
    arrowEnd: 'arrow',
    color: '#64748b',
  },
  {
    id: 'dashed',
    name: 'Dashed Line',
    description: 'A dashed connecting line',
    style: 'dashed',
    arrowStart: 'none',
    arrowEnd: 'none',
    color: '#94a3b8',
  },
];
