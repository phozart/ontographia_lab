// components/diagram-studio/packs/CorePack.js
// Core pack with Frame/Canvas stencils for organizing content

// ============ STENCILS ============

const stencils = [
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

// ============ CONNECTION TYPES ============

const connectionTypes = [
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

// ============ VISUAL RENDERERS ============

// Frame renderer - dashed border with external title
function FrameNode({ element, stencil, isSelected }) {
  const label = element.label || element.name || 'Frame';
  const { width, height } = element.size || stencil?.defaultSize || { width: 600, height: 400 };
  const showTitle = element.data?.showTitle !== false;
  const bgColor = element.data?.backgroundColor || '#ffffff'; // White background by default
  const frameColor = element.color || '#64748b';

  return (
    <div style={{
      width: '100%',
      height: '100%',
      position: 'relative',
      pointerEvents: 'none',
    }}>
      {/* External title above frame */}
      {showTitle && (
        <div style={{
          position: 'absolute',
          top: -28,
          left: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          pointerEvents: 'auto',
        }}>
          <span style={{
            fontSize: 13,
            fontWeight: 600,
            color: frameColor,
            background: 'white',
            padding: '4px 8px',
            borderRadius: 4,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}>
            {label}
          </span>
        </div>
      )}

      <svg
        width={width}
        height={height}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
        }}
      >
        {/* Frame background */}
        {bgColor !== 'transparent' && (
          <rect
            x="1"
            y="1"
            width={width - 2}
            height={height - 2}
            fill={bgColor}
            rx="8"
          />
        )}

        {/* Dashed border - Miro style */}
        <rect
          x="1"
          y="1"
          width={width - 2}
          height={height - 2}
          fill="none"
          stroke={frameColor}
          strokeWidth="2"
          strokeDasharray="8 4"
          rx="8"
          opacity={isSelected ? 1 : 0.6}
        />

        {/* Corner resize handles shown when selected */}
        {isSelected && (
          <>
            <circle cx="0" cy="0" r="5" fill="white" stroke={frameColor} strokeWidth="2" />
            <circle cx={width} cy="0" r="5" fill="white" stroke={frameColor} strokeWidth="2" />
            <circle cx="0" cy={height} r="5" fill="white" stroke={frameColor} strokeWidth="2" />
            <circle cx={width} cy={height} r="5" fill={frameColor} stroke={frameColor} strokeWidth="2" />
          </>
        )}
      </svg>
    </div>
  );
}

// Section renderer
function SectionNode({ element, stencil }) {
  const label = element.label || element.name || '';
  const { width, height } = element.size || stencil?.defaultSize || { width: 400, height: 300 };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
        <rect
          x="1"
          y="1"
          width={width - 2}
          height={height - 2}
          fill="none"
          stroke="var(--border)"
          strokeWidth="1"
          strokeDasharray="6 3"
          rx="6"
        />
      </svg>

      {label && (
        <div style={{
          position: 'absolute',
          top: -10,
          left: 12,
          background: 'var(--panel)',
          padding: '0 8px',
          fontSize: 11,
          fontWeight: 500,
          color: 'var(--text-muted)',
        }}>
          {label}
        </div>
      )}
    </div>
  );
}

// Main render function
// Returns undefined for basic shapes (rectangle, circle, diamond, etc.) to use default rendering
function renderNode(element, stencil, isSelected) {
  const type = element.type;

  switch (type) {
    case 'frame':
      return <FrameNode element={element} stencil={stencil} isSelected={isSelected} />;
    case 'section':
      return <SectionNode element={element} stencil={stencil} />;
    default:
      // Return undefined (not null) to allow default rendering for basic shapes
      // like rectangle, circle, diamond, text-block, divider
      return undefined;
  }
}

// ============ PACK EXPORT ============

const CorePack = {
  id: 'core',
  name: 'Core',
  description: 'Basic shapes and organizational elements',
  icon: '⬜',
  stencils,
  connectionTypes,
  validators: [],
  templates: [],
  nodeProperties: [],
  renderNode,
  defaultLineStyle: 'straight',
};

export default CorePack;
export { stencils, connectionTypes, renderNode };
