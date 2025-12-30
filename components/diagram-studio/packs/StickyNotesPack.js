// components/diagram-studio/packs/StickyNotesPack.js
// Sticky notes pack for freeform canvas

// ============ STENCILS ============

const stencils = [
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

// ============ CONNECTION TYPES ============

const connectionTypes = [
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

// ============ VALIDATORS ============

const validators = [
  {
    id: 'has-content',
    name: 'Notes Have Content',
    description: 'All notes should have labels/content',
    level: 'info',
    validate: (elements) => {
      const emptyNotes = elements.filter(
        el => el.type.startsWith('sticky-') && !el.label?.trim()
      );
      if (emptyNotes.length > 0) {
        return emptyNotes.map(note => ({
          elementId: note.id,
          message: `Note has no content`,
        }));
      }
      return null;
    },
  },
];

// ============ TEMPLATES ============

const templates = [
  {
    id: 'blank',
    name: 'Blank Canvas',
    description: 'Empty canvas for freeform notes',
    thumbnail: null,
    elements: [],
    connections: [],
  },
  {
    id: 'retrospective',
    name: 'Retrospective',
    description: 'Sprint retrospective board with columns',
    thumbnail: null,
    elements: [
      { id: 'sec1', type: 'section', label: 'What Went Well', x: 20, y: 20, size: { width: 300, height: 500 }, color: '#dcfce7' },
      { id: 'sec2', type: 'section', label: 'What Could Improve', x: 340, y: 20, size: { width: 300, height: 500 }, color: '#fef3c7' },
      { id: 'sec3', type: 'section', label: 'Action Items', x: 660, y: 20, size: { width: 300, height: 500 }, color: '#dbeafe' },
      { id: 'n1', type: 'sticky-green', label: 'Good teamwork', x: 50, y: 80, size: { width: 150, height: 100 } },
      { id: 'n2', type: 'sticky-orange', label: 'Need better communication', x: 370, y: 80, size: { width: 150, height: 100 } },
      { id: 'n3', type: 'sticky-blue', label: 'Schedule daily standup', x: 690, y: 80, size: { width: 150, height: 100 } },
    ],
    connections: [],
  },
  {
    id: 'affinity-map',
    name: 'Affinity Map',
    description: 'Group related ideas together',
    thumbnail: null,
    elements: [
      { id: 'grp1', type: 'group-box', label: 'Category A', x: 20, y: 20, size: { width: 280, height: 300 } },
      { id: 'grp2', type: 'group-box', label: 'Category B', x: 320, y: 20, size: { width: 280, height: 300 } },
      { id: 'grp3', type: 'group-box', label: 'Category C', x: 620, y: 20, size: { width: 280, height: 300 } },
      { id: 'n1', type: 'sticky-small', label: 'Idea 1', x: 40, y: 80, size: { width: 100, height: 100 } },
      { id: 'n2', type: 'sticky-small', label: 'Idea 2', x: 160, y: 80, size: { width: 100, height: 100 } },
      { id: 'n3', type: 'sticky-small', label: 'Idea 3', x: 40, y: 200, size: { width: 100, height: 100 } },
    ],
    connections: [],
  },
  {
    id: 'brainstorm',
    name: 'Brainstorm',
    description: 'Central topic with surrounding ideas',
    thumbnail: null,
    elements: [
      { id: 'center', type: 'sticky-large', label: 'Main Topic', x: 350, y: 200, size: { width: 200, height: 200 }, color: '#fef08a' },
      { id: 'n1', type: 'sticky-blue', label: 'Idea 1', x: 100, y: 100, size: { width: 150, height: 100 } },
      { id: 'n2', type: 'sticky-green', label: 'Idea 2', x: 600, y: 100, size: { width: 150, height: 100 } },
      { id: 'n3', type: 'sticky-pink', label: 'Idea 3', x: 100, y: 400, size: { width: 150, height: 100 } },
      { id: 'n4', type: 'sticky-orange', label: 'Idea 4', x: 600, y: 400, size: { width: 150, height: 100 } },
    ],
    connections: [
      { id: 'c1', sourceId: 'n1', targetId: 'center', type: 'line' },
      { id: 'c2', sourceId: 'n2', targetId: 'center', type: 'line' },
      { id: 'c3', sourceId: 'n3', targetId: 'center', type: 'line' },
      { id: 'c4', sourceId: 'n4', targetId: 'center', type: 'line' },
    ],
  },
  {
    id: 'kanban',
    name: 'Kanban Board',
    description: 'Simple kanban-style board',
    thumbnail: null,
    elements: [
      { id: 'sec1', type: 'section', label: 'To Do', x: 20, y: 20, size: { width: 250, height: 500 }, color: '#f3f4f6' },
      { id: 'sec2', type: 'section', label: 'In Progress', x: 290, y: 20, size: { width: 250, height: 500 }, color: '#dbeafe' },
      { id: 'sec3', type: 'section', label: 'Done', x: 560, y: 20, size: { width: 250, height: 500 }, color: '#dcfce7' },
    ],
    connections: [],
  },
];

// ============ NODE PROPERTIES ============

const nodeProperties = [
  { id: 'votes', label: 'Votes', type: 'number' },
  { id: 'priority', label: 'Priority', type: 'select', options: [
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
  ]},
  { id: 'tags', label: 'Tags', type: 'list' },
];

// ============ VISUAL RENDERER ============

// Sticky Note with realistic paper look
function StickyNoteNode({ element, stencil, isSelected }) {
  const label = element.label || element.name || '';
  const { width, height } = element.size || stencil?.defaultSize || { width: 150, height: 150 };
  const color = element.color || stencil?.color || '#fef08a';

  // Darken color for shadow
  const shadowColor = color.replace(/^#/, '');
  const r = parseInt(shadowColor.substr(0, 2), 16);
  const g = parseInt(shadowColor.substr(2, 2), 16);
  const b = parseInt(shadowColor.substr(4, 2), 16);
  const darkerColor = `rgb(${Math.max(0, r - 30)}, ${Math.max(0, g - 30)}, ${Math.max(0, b - 30)})`;

  return (
    <div
      className="sticky-note-node"
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
      }}
    >
      {/* Main sticky note shape */}
      <svg
        width={width}
        height={height}
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        {/* Paper shadow effect */}
        <defs>
          <filter id={`shadow-${element.id}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="2" dy="3" stdDeviation="3" floodOpacity="0.15" />
          </filter>
          <linearGradient id={`fold-${element.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={darkerColor} stopOpacity="0.2" />
            <stop offset="100%" stopColor={darkerColor} stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {/* Main paper background */}
        <rect
          x="0"
          y="0"
          width={width}
          height={height}
          fill={color}
          filter={`url(#shadow-${element.id})`}
          rx="2"
        />

        {/* Folded corner effect */}
        <path
          d={`M ${width - 20} 0 L ${width} 0 L ${width} 20 Z`}
          fill={`url(#fold-${element.id})`}
        />
        <path
          d={`M ${width - 20} 0 Q ${width - 10} 5 ${width} 20 L ${width - 20} 20 Z`}
          fill="white"
          opacity="0.3"
        />

        {/* Paper texture lines (optional subtle effect) */}
        {height > 80 && (
          <>
            <line x1="15" y1={height * 0.3} x2={width - 15} y2={height * 0.3} stroke={darkerColor} strokeOpacity="0.08" strokeWidth="1" />
            <line x1="15" y1={height * 0.5} x2={width - 15} y2={height * 0.5} stroke={darkerColor} strokeOpacity="0.08" strokeWidth="1" />
            <line x1="15" y1={height * 0.7} x2={width - 15} y2={height * 0.7} stroke={darkerColor} strokeOpacity="0.08" strokeWidth="1" />
          </>
        )}
      </svg>

      {/* Content */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px',
        boxSizing: 'border-box',
      }}>
        <div style={{
          fontSize: Math.min(14, Math.max(11, width / 12)),
          fontWeight: 500,
          color: '#1f2937',
          textAlign: 'center',
          lineHeight: 1.3,
          overflow: 'hidden',
          wordBreak: 'break-word',
          fontFamily: "'Patrick Hand', 'Comic Sans MS', cursive, sans-serif",
        }}>
          {label}
        </div>
      </div>
    </div>
  );
}

// Container/Section with subtle background
function ContainerNode({ element, stencil, isSelected }) {
  const label = element.label || element.name || '';
  const { width, height } = element.size || stencil?.defaultSize || { width: 300, height: 250 };
  const color = element.color || stencil?.color || '#e5e7eb';

  return (
    <div
      className="container-node"
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
      }}
    >
      <svg
        width={width}
        height={height}
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        {/* Container background */}
        <rect
          x="1"
          y="1"
          width={width - 2}
          height={height - 2}
          fill={color}
          fillOpacity="0.4"
          stroke={color}
          strokeWidth="2"
          strokeDasharray="8 4"
          rx="8"
        />

        {/* Header background */}
        <rect
          x="1"
          y="1"
          width={width - 2}
          height="32"
          fill={color}
          fillOpacity="0.6"
          rx="8"
        />
        <rect
          x="1"
          y="25"
          width={width - 2}
          height="8"
          fill={color}
          fillOpacity="0.6"
        />
      </svg>

      {/* Label */}
      <div style={{
        position: 'absolute',
        top: '6px',
        left: '12px',
        fontSize: 13,
        fontWeight: 600,
        color: '#374151',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>
        {label}
      </div>
    </div>
  );
}

// Circle marker
function CircleMarkerNode({ element, stencil }) {
  const { width, height } = element.size || stencil?.defaultSize || { width: 40, height: 40 };
  const color = element.color || stencil?.color || '#ef4444';

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
        <circle
          cx={width / 2}
          cy={height / 2}
          r={Math.min(width, height) / 2 - 2}
          fill={color}
          stroke={color}
          strokeWidth="2"
          opacity="0.8"
        />
      </svg>
    </div>
  );
}

// Arrow marker
function ArrowMarkerNode({ element, stencil }) {
  const { width, height } = element.size || stencil?.defaultSize || { width: 60, height: 30 };
  const color = element.color || stencil?.color || '#374151';

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
        <path
          d={`M 5 ${height / 2} L ${width - 15} ${height / 2} L ${width - 15} ${height / 2 - 8} L ${width - 5} ${height / 2} L ${width - 15} ${height / 2 + 8} L ${width - 15} ${height / 2} Z`}
          fill={color}
          stroke={color}
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}

// Image placeholder
function ImagePlaceholderNode({ element, stencil }) {
  const label = element.label || element.name || 'Image';
  const { width, height } = element.size || stencil?.defaultSize || { width: 200, height: 150 };
  const imageUrl = element.data?.imageUrl;

  if (imageUrl) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        backgroundImage: `url(${imageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        borderRadius: 4,
        border: '2px solid #d1d5db',
      }} />
    );
  }

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f3f4f6',
      border: '2px dashed #d1d5db',
      borderRadius: 4,
    }}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" fill="#9ca3af" />
        <path d="M21 15l-5-5L5 21" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>{label}</span>
    </div>
  );
}

// Link card
function LinkCardNode({ element, stencil }) {
  const label = element.label || element.data?.linkTitle || 'Link';
  const url = element.data?.url || '';
  const { width, height } = element.size || stencil?.defaultSize || { width: 180, height: 80 };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: '#dbeafe',
      border: '1px solid #93c5fd',
      borderRadius: 6,
      display: 'flex',
      flexDirection: 'column',
      padding: '10px',
      boxSizing: 'border-box',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" strokeLinecap="round" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" strokeLinecap="round" />
        </svg>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#1e40af' }}>{label}</span>
      </div>
      {url && (
        <span style={{
          fontSize: 10,
          color: '#3b82f6',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {url}
        </span>
      )}
    </div>
  );
}

// Text block (transparent)
function TextBlockNode({ element }) {
  const label = element.label || '';

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '8px',
      boxSizing: 'border-box',
    }}>
      <div style={{
        fontSize: 14,
        color: '#1f2937',
        textAlign: 'center',
        lineHeight: 1.4,
      }}>
        {label}
      </div>
    </div>
  );
}

// Main render function
function renderNode(element, stencil, isSelected) {
  const type = element.type;

  // Sticky notes
  if (type.startsWith('sticky-')) {
    return <StickyNoteNode element={element} stencil={stencil} isSelected={isSelected} />;
  }

  // Containers
  if (['group-box', 'section'].includes(type)) {
    return <ContainerNode element={element} stencil={stencil} isSelected={isSelected} />;
  }

  // Circle marker
  if (type === 'circle-marker') {
    return <CircleMarkerNode element={element} stencil={stencil} />;
  }

  // Arrow marker
  if (type === 'arrow-marker') {
    return <ArrowMarkerNode element={element} stencil={stencil} />;
  }

  // Image placeholder
  if (type === 'image-placeholder') {
    return <ImagePlaceholderNode element={element} stencil={stencil} />;
  }

  // Link card
  if (type === 'link-card') {
    return <LinkCardNode element={element} stencil={stencil} />;
  }

  // Text block
  if (type === 'text-block') {
    return <TextBlockNode element={element} />;
  }

  // Default - return null to use standard rendering
  return null;
}

// ============ PACK EXPORT ============

const StickyNotesPack = {
  id: 'sticky-notes',
  name: 'Sticky Notes',
  description: 'Freeform canvas with sticky notes for brainstorming',
  icon: '📝',
  stencils,
  connectionTypes,
  validators,
  templates,
  nodeProperties,
  renderNode,
  defaultLineStyle: 'curved', // Sticky notes use organic curved lines
};

export default StickyNotesPack;
export { stencils, connectionTypes, validators, templates, nodeProperties, renderNode };
