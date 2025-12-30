// components/diagram-studio/packs/ProductDesignPack.js
// Product Design canvas pack with structured canvas templates

// ============ STENCILS ============

const stencils = [
  // Generic Cards
  {
    id: 'insight-card',
    name: 'Insight Card',
    description: 'Card for insights and observations',
    group: 'Cards',
    shape: 'sticky',
    icon: '💡',
    color: '#fef08a',
    defaultSize: { width: 160, height: 100 },
    ports: [],
    isContainer: false,
    properties: [
      { id: 'evidence', label: 'Evidence', type: 'text' },
      { id: 'confidence', label: 'Confidence', type: 'select', options: [
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' },
      ]},
      { id: 'source', label: 'Source', type: 'text' },
    ],
  },
  {
    id: 'action-card',
    name: 'Action Card',
    description: 'Card for actions and behaviors',
    group: 'Cards',
    shape: 'sticky',
    icon: '⚡',
    color: '#93c5fd',
    defaultSize: { width: 160, height: 100 },
    ports: [],
    isContainer: false,
  },
  {
    id: 'pain-point',
    name: 'Pain Point',
    description: 'Pain point or friction',
    group: 'Cards',
    shape: 'sticky',
    icon: '❌',
    color: '#fca5a5',
    defaultSize: { width: 160, height: 100 },
    ports: [],
    isContainer: false,
  },
  {
    id: 'opportunity-card',
    name: 'Opportunity',
    description: 'Opportunity or improvement idea',
    group: 'Cards',
    shape: 'sticky',
    icon: '✨',
    color: '#86efac',
    defaultSize: { width: 160, height: 100 },
    ports: [],
    isContainer: false,
  },
  {
    id: 'quote-card',
    name: 'Quote',
    description: 'Direct user quote',
    group: 'Cards',
    shape: 'sticky',
    icon: '"',
    color: '#e9d5ff',
    defaultSize: { width: 160, height: 100 },
    ports: [],
    isContainer: false,
    properties: [
      { id: 'speaker', label: 'Speaker', type: 'text' },
    ],
  },

  // OST Nodes
  {
    id: 'outcome-node',
    name: 'Outcome',
    description: 'Desired outcome (OST root)',
    group: 'OST',
    shape: 'rect',
    icon: '🎯',
    color: '#3b82f6',
    defaultSize: { width: 220, height: 80 },
    ports: ['bottom'],
    isContainer: false,
    properties: [
      { id: 'metric', label: 'Success Metric', type: 'text' },
      { id: 'timeHorizon', label: 'Time Horizon', type: 'text' },
    ],
  },
  {
    id: 'opportunity-node',
    name: 'Opportunity',
    description: 'Problem or unmet need (OST)',
    group: 'OST',
    shape: 'rect',
    icon: '🔍',
    color: '#8b5cf6',
    defaultSize: { width: 180, height: 70 },
    ports: ['top', 'bottom'],
    isContainer: false,
    properties: [
      { id: 'evidence', label: 'Evidence', type: 'text' },
      { id: 'impact', label: 'Impact', type: 'select', options: [
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' },
      ]},
    ],
  },
  {
    id: 'solution-node',
    name: 'Solution',
    description: 'Solution idea (OST)',
    group: 'OST',
    shape: 'rect',
    icon: '💡',
    color: '#10b981',
    defaultSize: { width: 160, height: 60 },
    ports: ['top', 'bottom'],
    isContainer: false,
    properties: [
      { id: 'assumptions', label: 'Assumptions', type: 'text' },
      { id: 'feasibility', label: 'Feasibility', type: 'text' },
    ],
  },
  {
    id: 'experiment-node',
    name: 'Experiment',
    description: 'Validation experiment (OST)',
    group: 'OST',
    shape: 'rect',
    icon: '🧪',
    color: '#f59e0b',
    defaultSize: { width: 150, height: 55 },
    ports: ['top'],
    isContainer: false,
    style: { borderStyle: 'dashed' },
    properties: [
      { id: 'hypothesis', label: 'Hypothesis', type: 'text' },
      { id: 'successSignal', label: 'Success Signal', type: 'text' },
    ],
  },

  // Zone Containers (for fixed layouts)
  {
    id: 'quadrant-zone',
    name: 'Quadrant Zone',
    description: 'Fixed zone for 2x2 layouts',
    group: 'Zones',
    shape: 'rect',
    icon: '▦',
    color: '#f3f4f6',
    defaultSize: { width: 400, height: 300 },
    ports: [],
    isContainer: true,
    isZone: true, // Special flag for constrained placement
    properties: [
      { id: 'zoneId', label: 'Zone ID', type: 'text' },
    ],
  },
  {
    id: 'lane-zone',
    name: 'Lane Zone',
    description: 'Horizontal lane for timeline layouts',
    group: 'Zones',
    shape: 'rect',
    icon: '═',
    color: '#f9fafb',
    defaultSize: { width: 800, height: 100 },
    ports: [],
    isContainer: true,
    isZone: true,
  },
  {
    id: 'phase-container',
    name: 'Phase',
    description: 'Phase container for journey maps',
    group: 'Zones',
    shape: 'rect',
    icon: '▭',
    color: '#e5e7eb',
    defaultSize: { width: 200, height: 500 },
    ports: [],
    isContainer: true,
    isZone: true,
  },
  {
    id: 'column-zone',
    name: 'Column Zone',
    description: 'Column for board layouts',
    group: 'Zones',
    shape: 'rect',
    icon: '▯',
    color: '#f3f4f6',
    defaultSize: { width: 220, height: 500 },
    ports: [],
    isContainer: true,
    isZone: true,
  },
  {
    id: 'section-zone',
    name: 'Section',
    description: 'Section for structured canvases',
    group: 'Zones',
    shape: 'rect',
    icon: '▭',
    color: '#fafafa',
    defaultSize: { width: 350, height: 180 },
    ports: [],
    isContainer: true,
    isZone: true,
  },

  // Persona Elements
  {
    id: 'persona-header',
    name: 'Persona Header',
    description: 'Persona profile header',
    group: 'Persona',
    shape: 'rect',
    icon: '👤',
    color: '#dbeafe',
    defaultSize: { width: 720, height: 120 },
    ports: [],
    isContainer: false,
    properties: [
      { id: 'role', label: 'Role', type: 'text' },
      { id: 'segment', label: 'Segment', type: 'text' },
    ],
  },

  // Journey Map Elements
  {
    id: 'touchpoint',
    name: 'Touchpoint',
    description: 'Customer touchpoint',
    group: 'Journey',
    shape: 'rect',
    icon: '📱',
    color: '#c4b5fd',
    defaultSize: { width: 140, height: 60 },
    ports: [],
    isContainer: false,
    properties: [
      { id: 'channel', label: 'Channel', type: 'text' },
    ],
  },
  {
    id: 'emotion-point',
    name: 'Emotion Point',
    description: 'Emotion indicator on journey',
    group: 'Journey',
    shape: 'circle',
    icon: '😊',
    color: '#fbbf24',
    defaultSize: { width: 40, height: 40 },
    ports: ['left', 'right'],
    isContainer: false,
    properties: [
      { id: 'score', label: 'Emotion Score (-2 to +2)', type: 'number' },
    ],
  },

  // RICE/Table Elements
  {
    id: 'scored-item',
    name: 'Scored Item',
    description: 'Item with RICE scoring',
    group: 'Scoring',
    shape: 'rect',
    icon: '📊',
    color: '#e0e7ff',
    defaultSize: { width: 180, height: 50 },
    ports: [],
    isContainer: false,
    properties: [
      { id: 'reach', label: 'Reach', type: 'number' },
      { id: 'impact', label: 'Impact (1-3)', type: 'number' },
      { id: 'confidence', label: 'Confidence (0-1)', type: 'number' },
      { id: 'effort', label: 'Effort', type: 'number' },
    ],
  },

  // Generic sticky note variants
  {
    id: 'yellow-card',
    name: 'Yellow Card',
    group: 'Colors',
    shape: 'sticky',
    icon: '📋',
    color: '#fef08a',
    defaultSize: { width: 140, height: 100 },
    ports: [],
    isContainer: false,
  },
  {
    id: 'blue-card',
    name: 'Blue Card',
    group: 'Colors',
    shape: 'sticky',
    icon: '📋',
    color: '#93c5fd',
    defaultSize: { width: 140, height: 100 },
    ports: [],
    isContainer: false,
  },
  {
    id: 'green-card',
    name: 'Green Card',
    group: 'Colors',
    shape: 'sticky',
    icon: '📋',
    color: '#86efac',
    defaultSize: { width: 140, height: 100 },
    ports: [],
    isContainer: false,
  },
  {
    id: 'pink-card',
    name: 'Pink Card',
    group: 'Colors',
    shape: 'sticky',
    icon: '📋',
    color: '#f9a8d4',
    defaultSize: { width: 140, height: 100 },
    ports: [],
    isContainer: false,
  },
  {
    id: 'orange-card',
    name: 'Orange Card',
    group: 'Colors',
    shape: 'sticky',
    icon: '📋',
    color: '#fdba74',
    defaultSize: { width: 140, height: 100 },
    ports: [],
    isContainer: false,
  },
  {
    id: 'purple-card',
    name: 'Purple Card',
    group: 'Colors',
    shape: 'sticky',
    icon: '📋',
    color: '#c4b5fd',
    defaultSize: { width: 140, height: 100 },
    ports: [],
    isContainer: false,
  },
];

// ============ CONNECTION TYPES ============

const connectionTypes = [
  {
    id: 'hierarchy',
    name: 'Hierarchy',
    description: 'Parent-child relationship',
    style: 'solid',
    arrowStart: 'none',
    arrowEnd: 'arrow',
    color: '#6b7280',
  },
  {
    id: 'emotion-curve',
    name: 'Emotion Curve',
    description: 'Connects emotion points in journey',
    style: 'solid',
    arrowStart: 'none',
    arrowEnd: 'none',
    color: '#f59e0b',
    strokeWidth: 2,
  },
  {
    id: 'relationship',
    name: 'Relationship',
    description: 'General relationship',
    style: 'dashed',
    arrowStart: 'none',
    arrowEnd: 'none',
    color: '#9ca3af',
  },
  {
    id: 'flow',
    name: 'Flow',
    description: 'Flow between phases',
    style: 'solid',
    arrowStart: 'none',
    arrowEnd: 'arrow',
    color: '#3b82f6',
  },
];

// ============ VALIDATORS ============

const validators = [
  {
    id: 'ost-has-outcome',
    name: 'OST Has Outcome',
    description: 'Opportunity Solution Tree must have exactly one outcome',
    level: 'error',
    appliesToTemplates: ['opportunity-solution-tree'],
    validate: (elements) => {
      const outcomes = elements.filter(el => el.type === 'outcome-node');
      if (outcomes.length === 0) {
        return [{ message: 'Add a Desired Outcome node at the top of the tree' }];
      }
      if (outcomes.length > 1) {
        return [{ message: 'Only one Outcome node is allowed per tree' }];
      }
      return null;
    },
  },
  {
    id: 'opportunity-needs-evidence',
    name: 'Opportunity Needs Evidence',
    description: 'Opportunities should have evidence links',
    level: 'warn',
    validate: (elements) => {
      const opps = elements.filter(el => el.type === 'opportunity-node');
      const missing = opps.filter(o => !o.properties?.evidence);
      if (missing.length > 0) {
        return missing.map(o => ({
          elementId: o.id,
          message: `Opportunity "${o.label}" lacks evidence`,
        }));
      }
      return null;
    },
  },
  {
    id: 'empathy-map-balance',
    name: 'Empathy Map Balance',
    description: 'All quadrants should have items',
    level: 'info',
    appliesToTemplates: ['empathy-map'],
    validate: (elements, connections, diagram) => {
      // Check if all zones have at least one card
      const zones = elements.filter(el => el.type === 'quadrant-zone');
      const cards = elements.filter(el => !el.type?.includes('zone'));

      const emptyZones = zones.filter(zone => {
        const cardsInZone = cards.filter(card =>
          card.x >= zone.x &&
          card.x <= zone.x + (zone.size?.width || 400) &&
          card.y >= zone.y &&
          card.y <= zone.y + (zone.size?.height || 300)
        );
        return cardsInZone.length === 0;
      });

      if (emptyZones.length > 0) {
        return emptyZones.map(z => ({
          elementId: z.id,
          message: `Zone "${z.label}" has no items`,
        }));
      }
      return null;
    },
  },
];

// ============ TEMPLATES ============

const templates = [
  // ========== 2x2 MATRIX TEMPLATES ==========
  {
    id: 'empathy-map',
    name: 'Empathy Map',
    description: 'Synthesize user research into 4 quadrants: Thinks, Feels, Says, Does',
    category: 'Discovery',
    layout: 'matrix-2x2',
    thumbnail: null,
    elements: [
      // Center persona reference
      { id: 'persona-ref', type: 'persona-header', label: 'User Persona', x: 310, y: 260, size: { width: 180, height: 80 }, color: '#dbeafe' },
      // Quadrants
      { id: 'q1', type: 'quadrant-zone', label: 'THINKS', x: 20, y: 20, size: { width: 380, height: 280 }, color: '#eff6ff', properties: { zoneId: 'thinks' } },
      { id: 'q2', type: 'quadrant-zone', label: 'FEELS', x: 410, y: 20, size: { width: 380, height: 280 }, color: '#fef3c7', properties: { zoneId: 'feels' } },
      { id: 'q3', type: 'quadrant-zone', label: 'SAYS', x: 20, y: 310, size: { width: 380, height: 280 }, color: '#dcfce7', properties: { zoneId: 'says' } },
      { id: 'q4', type: 'quadrant-zone', label: 'DOES', x: 410, y: 310, size: { width: 380, height: 280 }, color: '#fce7f3', properties: { zoneId: 'does' } },
      // Sample cards
      { id: 'c1', type: 'insight-card', label: 'Beliefs & assumptions...', x: 40, y: 60, size: { width: 150, height: 80 } },
      { id: 'c2', type: 'insight-card', label: 'Emotions & feelings...', x: 430, y: 60, size: { width: 150, height: 80 }, color: '#fef08a' },
      { id: 'c3', type: 'quote-card', label: '"Direct quotes..."', x: 40, y: 350, size: { width: 150, height: 80 } },
      { id: 'c4', type: 'action-card', label: 'Observable behaviors...', x: 430, y: 350, size: { width: 150, height: 80 } },
    ],
    connections: [],
    settings: {
      constrainToZones: true,
      allowConnections: false,
    },
  },
  {
    id: 'swot-analysis',
    name: 'SWOT Analysis',
    description: 'Assess Strengths, Weaknesses, Opportunities, and Threats',
    category: 'Strategy',
    layout: 'matrix-2x2',
    thumbnail: null,
    elements: [
      // Quadrants
      { id: 'q1', type: 'quadrant-zone', label: 'STRENGTHS (Internal +)', x: 20, y: 20, size: { width: 380, height: 280 }, color: '#dcfce7', properties: { zoneId: 'strengths' } },
      { id: 'q2', type: 'quadrant-zone', label: 'WEAKNESSES (Internal -)', x: 410, y: 20, size: { width: 380, height: 280 }, color: '#fecaca', properties: { zoneId: 'weaknesses' } },
      { id: 'q3', type: 'quadrant-zone', label: 'OPPORTUNITIES (External +)', x: 20, y: 310, size: { width: 380, height: 280 }, color: '#dbeafe', properties: { zoneId: 'opportunities' } },
      { id: 'q4', type: 'quadrant-zone', label: 'THREATS (External -)', x: 410, y: 310, size: { width: 380, height: 280 }, color: '#fef3c7', properties: { zoneId: 'threats' } },
    ],
    connections: [],
    settings: {
      constrainToZones: true,
      allowConnections: false,
    },
  },
  {
    id: 'impact-effort-matrix',
    name: 'Impact/Effort Matrix',
    description: 'Prioritize by comparing expected impact vs required effort',
    category: 'Prioritization',
    layout: 'matrix-2x2',
    thumbnail: null,
    elements: [
      // Axis labels
      { id: 'y-axis', type: 'section-zone', label: '← EFFORT →', x: 390, y: 605, size: { width: 200, height: 30 }, color: 'transparent' },
      // Quadrants
      { id: 'q1', type: 'quadrant-zone', label: 'BIG BETS (High Impact, High Effort)', x: 410, y: 20, size: { width: 380, height: 280 }, color: '#fef3c7', properties: { zoneId: 'big-bets' } },
      { id: 'q2', type: 'quadrant-zone', label: 'QUICK WINS (High Impact, Low Effort)', x: 20, y: 20, size: { width: 380, height: 280 }, color: '#dcfce7', properties: { zoneId: 'quick-wins' } },
      { id: 'q3', type: 'quadrant-zone', label: 'FILL-INS (Low Impact, Low Effort)', x: 20, y: 310, size: { width: 380, height: 280 }, color: '#e5e7eb', properties: { zoneId: 'fill-ins' } },
      { id: 'q4', type: 'quadrant-zone', label: 'THANKLESS TASKS (Low Impact, High Effort)', x: 410, y: 310, size: { width: 380, height: 280 }, color: '#fecaca', properties: { zoneId: 'thankless' } },
    ],
    connections: [],
    settings: {
      constrainToZones: true,
      allowConnections: false,
    },
  },
  {
    id: 'assumption-mapping',
    name: 'Assumption Mapping',
    description: 'Identify and prioritize risky assumptions',
    category: 'Validation',
    layout: 'matrix-2x2',
    thumbnail: null,
    elements: [
      // Quadrants
      { id: 'q1', type: 'quadrant-zone', label: 'VALIDATE FIRST (High Impact, High Uncertainty)', x: 20, y: 20, size: { width: 380, height: 280 }, color: '#fecaca', properties: { zoneId: 'validate-first' } },
      { id: 'q2', type: 'quadrant-zone', label: 'EXPLORE LATER (Low Impact, High Uncertainty)', x: 410, y: 20, size: { width: 380, height: 280 }, color: '#fef3c7', properties: { zoneId: 'explore-later' } },
      { id: 'q3', type: 'quadrant-zone', label: 'SAFE BETS (High Impact, Low Uncertainty)', x: 20, y: 310, size: { width: 380, height: 280 }, color: '#dcfce7', properties: { zoneId: 'safe-bets' } },
      { id: 'q4', type: 'quadrant-zone', label: 'MONITOR (Low Impact, Low Uncertainty)', x: 410, y: 310, size: { width: 380, height: 280 }, color: '#e5e7eb', properties: { zoneId: 'monitor' } },
    ],
    connections: [],
    settings: {
      constrainToZones: true,
      allowConnections: false,
    },
  },
  {
    id: 'kano-model',
    name: 'Kano Model',
    description: 'Classify features by customer satisfaction impact',
    category: 'Prioritization',
    layout: 'matrix-2x2',
    thumbnail: null,
    elements: [
      // Quadrants
      { id: 'q1', type: 'quadrant-zone', label: 'DELIGHTERS', x: 20, y: 20, size: { width: 380, height: 280 }, color: '#dcfce7', properties: { zoneId: 'delighters' } },
      { id: 'q2', type: 'quadrant-zone', label: 'PERFORMANCE', x: 410, y: 20, size: { width: 380, height: 280 }, color: '#dbeafe', properties: { zoneId: 'performance' } },
      { id: 'q3', type: 'quadrant-zone', label: 'INDIFFERENT', x: 20, y: 310, size: { width: 380, height: 280 }, color: '#e5e7eb', properties: { zoneId: 'indifferent' } },
      { id: 'q4', type: 'quadrant-zone', label: 'BASIC (Must-Be)', x: 410, y: 310, size: { width: 380, height: 280 }, color: '#fef3c7', properties: { zoneId: 'basic' } },
    ],
    connections: [],
    settings: {
      constrainToZones: true,
      allowConnections: false,
    },
  },

  // ========== TIMELINE/LANE TEMPLATES ==========
  {
    id: 'customer-journey-map',
    name: 'Customer Journey Map',
    description: 'Visualize end-to-end user experience over time',
    category: 'Discovery',
    layout: 'timeline-lanes',
    thumbnail: null,
    elements: [
      // Phase containers (top row)
      { id: 'ph1', type: 'phase-container', label: 'DISCOVER', x: 20, y: 20, size: { width: 200, height: 550 }, color: '#eff6ff' },
      { id: 'ph2', type: 'phase-container', label: 'EVALUATE', x: 230, y: 20, size: { width: 200, height: 550 }, color: '#f0fdf4' },
      { id: 'ph3', type: 'phase-container', label: 'ONBOARD', x: 440, y: 20, size: { width: 200, height: 550 }, color: '#fefce8' },
      { id: 'ph4', type: 'phase-container', label: 'USE', x: 650, y: 20, size: { width: 200, height: 550 }, color: '#fef2f2' },
      { id: 'ph5', type: 'phase-container', label: 'ADVOCATE', x: 860, y: 20, size: { width: 200, height: 550 }, color: '#faf5ff' },
      // Lane labels (left side)
      { id: 'l1', type: 'section-zone', label: 'User Actions', x: -180, y: 80, size: { width: 170, height: 60 }, color: '#e5e7eb' },
      { id: 'l2', type: 'section-zone', label: 'Touchpoints', x: -180, y: 150, size: { width: 170, height: 60 }, color: '#e5e7eb' },
      { id: 'l3', type: 'section-zone', label: 'Emotions', x: -180, y: 220, size: { width: 170, height: 80 }, color: '#e5e7eb' },
      { id: 'l4', type: 'section-zone', label: 'Pain Points', x: -180, y: 310, size: { width: 170, height: 80 }, color: '#e5e7eb' },
      { id: 'l5', type: 'section-zone', label: 'Opportunities', x: -180, y: 400, size: { width: 170, height: 80 }, color: '#e5e7eb' },
      // Sample emotion curve points
      { id: 'e1', type: 'emotion-point', label: '', x: 110, y: 250, size: { width: 30, height: 30 }, properties: { score: 0 } },
      { id: 'e2', type: 'emotion-point', label: '', x: 320, y: 230, size: { width: 30, height: 30 }, properties: { score: 1 } },
      { id: 'e3', type: 'emotion-point', label: '', x: 530, y: 270, size: { width: 30, height: 30 }, properties: { score: -1 } },
      { id: 'e4', type: 'emotion-point', label: '', x: 740, y: 240, size: { width: 30, height: 30 }, properties: { score: 0 } },
      { id: 'e5', type: 'emotion-point', label: '', x: 950, y: 220, size: { width: 30, height: 30 }, properties: { score: 2 } },
    ],
    connections: [
      { id: 'ec1', sourceId: 'e1', targetId: 'e2', type: 'emotion-curve' },
      { id: 'ec2', sourceId: 'e2', targetId: 'e3', type: 'emotion-curve' },
      { id: 'ec3', sourceId: 'e3', targetId: 'e4', type: 'emotion-curve' },
      { id: 'ec4', sourceId: 'e4', targetId: 'e5', type: 'emotion-curve' },
    ],
    settings: {
      constrainToZones: false,
      allowConnections: true,
    },
  },
  {
    id: 'service-blueprint',
    name: 'Service Blueprint',
    description: 'Design and analyze end-to-end service delivery',
    category: 'Service Design',
    layout: 'timeline-lanes',
    thumbnail: null,
    elements: [
      // Phase containers
      { id: 'ph1', type: 'phase-container', label: 'Phase 1', x: 20, y: 20, size: { width: 250, height: 650 }, color: '#f3f4f6' },
      { id: 'ph2', type: 'phase-container', label: 'Phase 2', x: 280, y: 20, size: { width: 250, height: 650 }, color: '#f3f4f6' },
      { id: 'ph3', type: 'phase-container', label: 'Phase 3', x: 540, y: 20, size: { width: 250, height: 650 }, color: '#f3f4f6' },
      { id: 'ph4', type: 'phase-container', label: 'Phase 4', x: 800, y: 20, size: { width: 250, height: 650 }, color: '#f3f4f6' },
      // Lane divider lines (represented as thin zones)
      { id: 'lane-user', type: 'lane-zone', label: 'User Actions', x: 20, y: 60, size: { width: 1030, height: 80 }, color: '#dbeafe' },
      { id: 'line-interaction', type: 'section-zone', label: '─ Line of Interaction ─', x: 20, y: 145, size: { width: 1030, height: 20 }, color: '#94a3b8' },
      { id: 'lane-frontstage', type: 'lane-zone', label: 'Frontstage', x: 20, y: 170, size: { width: 1030, height: 100 }, color: '#dcfce7' },
      { id: 'line-visibility', type: 'section-zone', label: '─ Line of Visibility ─', x: 20, y: 275, size: { width: 1030, height: 20 }, color: '#94a3b8' },
      { id: 'lane-backstage', type: 'lane-zone', label: 'Backstage', x: 20, y: 300, size: { width: 1030, height: 100 }, color: '#fef3c7' },
      { id: 'line-internal', type: 'section-zone', label: '─ Line of Internal Interaction ─', x: 20, y: 405, size: { width: 1030, height: 20 }, color: '#94a3b8' },
      { id: 'lane-systems', type: 'lane-zone', label: 'Support Systems', x: 20, y: 430, size: { width: 1030, height: 80 }, color: '#e5e7eb' },
      { id: 'lane-pain', type: 'lane-zone', label: 'Pain Points', x: 20, y: 515, size: { width: 1030, height: 70 }, color: '#fecaca' },
      { id: 'lane-opp', type: 'lane-zone', label: 'Opportunities', x: 20, y: 590, size: { width: 1030, height: 70 }, color: '#bbf7d0' },
    ],
    connections: [],
    settings: {
      constrainToZones: false,
      allowConnections: true,
    },
  },

  // ========== TREE TEMPLATES ==========
  {
    id: 'opportunity-solution-tree',
    name: 'Opportunity Solution Tree',
    description: 'Structure discovery-to-solution reasoning',
    category: 'Discovery',
    layout: 'tree-top-down',
    thumbnail: null,
    elements: [
      // Outcome (root)
      { id: 'outcome', type: 'outcome-node', label: 'Desired Outcome', x: 350, y: 30, size: { width: 220, height: 70 } },
      // Opportunities (level 2)
      { id: 'opp1', type: 'opportunity-node', label: 'Opportunity 1', x: 100, y: 150, size: { width: 180, height: 60 } },
      { id: 'opp2', type: 'opportunity-node', label: 'Opportunity 2', x: 350, y: 150, size: { width: 180, height: 60 } },
      { id: 'opp3', type: 'opportunity-node', label: 'Opportunity 3', x: 600, y: 150, size: { width: 180, height: 60 } },
      // Solutions (level 3)
      { id: 'sol1', type: 'solution-node', label: 'Solution A', x: 50, y: 270, size: { width: 140, height: 50 } },
      { id: 'sol2', type: 'solution-node', label: 'Solution B', x: 210, y: 270, size: { width: 140, height: 50 } },
      { id: 'sol3', type: 'solution-node', label: 'Solution C', x: 380, y: 270, size: { width: 140, height: 50 } },
      { id: 'sol4', type: 'solution-node', label: 'Solution D', x: 620, y: 270, size: { width: 140, height: 50 } },
      // Experiments (level 4)
      { id: 'exp1', type: 'experiment-node', label: 'Experiment 1', x: 50, y: 380, size: { width: 130, height: 45 } },
      { id: 'exp2', type: 'experiment-node', label: 'Experiment 2', x: 380, y: 380, size: { width: 130, height: 45 } },
    ],
    connections: [
      { id: 'c1', sourceId: 'outcome', targetId: 'opp1', type: 'hierarchy' },
      { id: 'c2', sourceId: 'outcome', targetId: 'opp2', type: 'hierarchy' },
      { id: 'c3', sourceId: 'outcome', targetId: 'opp3', type: 'hierarchy' },
      { id: 'c4', sourceId: 'opp1', targetId: 'sol1', type: 'hierarchy' },
      { id: 'c5', sourceId: 'opp1', targetId: 'sol2', type: 'hierarchy' },
      { id: 'c6', sourceId: 'opp2', targetId: 'sol3', type: 'hierarchy' },
      { id: 'c7', sourceId: 'opp3', targetId: 'sol4', type: 'hierarchy' },
      { id: 'c8', sourceId: 'sol1', targetId: 'exp1', type: 'hierarchy' },
      { id: 'c9', sourceId: 'sol3', targetId: 'exp2', type: 'hierarchy' },
    ],
    settings: {
      constrainToZones: false,
      allowConnections: true,
      hierarchyRules: {
        'outcome-node': ['opportunity-node'],
        'opportunity-node': ['solution-node'],
        'solution-node': ['experiment-node'],
      },
    },
  },

  // ========== COLUMN BOARD TEMPLATES ==========
  {
    id: 'moscow-prioritization',
    name: 'MoSCoW Prioritization',
    description: 'Categorize scope: Must, Should, Could, Won\'t',
    category: 'Prioritization',
    layout: 'column-board',
    thumbnail: null,
    elements: [
      // Columns
      { id: 'col1', type: 'column-zone', label: 'MUST HAVE', x: 20, y: 20, size: { width: 220, height: 550 }, color: '#dcfce7', properties: { zoneId: 'must' } },
      { id: 'col2', type: 'column-zone', label: 'SHOULD HAVE', x: 250, y: 20, size: { width: 220, height: 550 }, color: '#dbeafe', properties: { zoneId: 'should' } },
      { id: 'col3', type: 'column-zone', label: 'COULD HAVE', x: 480, y: 20, size: { width: 220, height: 550 }, color: '#fef3c7', properties: { zoneId: 'could' } },
      { id: 'col4', type: 'column-zone', label: 'WON\'T HAVE', x: 710, y: 20, size: { width: 220, height: 550 }, color: '#fecaca', properties: { zoneId: 'wont' } },
    ],
    connections: [],
    settings: {
      constrainToZones: true,
      allowConnections: false,
    },
  },

  // ========== STRUCTURED SECTION TEMPLATES ==========
  {
    id: 'user-persona',
    name: 'User Persona',
    description: 'Create a credible user archetype',
    category: 'Discovery',
    layout: 'structured-sections',
    thumbnail: null,
    elements: [
      // Header
      { id: 'header', type: 'persona-header', label: 'Persona Name', x: 20, y: 20, size: { width: 760, height: 100 } },
      // Sections (2 columns x 3 rows)
      { id: 's1', type: 'section-zone', label: 'Goals & Motivations', x: 20, y: 140, size: { width: 370, height: 160 }, color: '#dcfce7' },
      { id: 's2', type: 'section-zone', label: 'Frustrations & Pain Points', x: 410, y: 140, size: { width: 370, height: 160 }, color: '#fecaca' },
      { id: 's3', type: 'section-zone', label: 'Behaviors', x: 20, y: 310, size: { width: 370, height: 160 }, color: '#dbeafe' },
      { id: 's4', type: 'section-zone', label: 'Skills & Context', x: 410, y: 310, size: { width: 370, height: 160 }, color: '#e5e7eb' },
      { id: 's5', type: 'section-zone', label: 'Needs', x: 20, y: 480, size: { width: 370, height: 160 }, color: '#fef3c7' },
      { id: 's6', type: 'section-zone', label: 'Quotes', x: 410, y: 480, size: { width: 370, height: 160 }, color: '#e9d5ff' },
    ],
    connections: [],
    settings: {
      constrainToZones: true,
      allowConnections: false,
      maxItemsPerSection: 7,
    },
  },
  {
    id: 'jtbd-canvas',
    name: 'Jobs To Be Done',
    description: 'Define what users are trying to accomplish',
    category: 'Discovery',
    layout: 'structured-sections',
    thumbnail: null,
    elements: [
      // Vertical sections
      { id: 's1', type: 'section-zone', label: 'Job Statement', x: 20, y: 20, size: { width: 760, height: 100 }, color: '#3b82f6', properties: { hint: 'When [situation], I want to [motivation], so I can [outcome]' } },
      { id: 's2', type: 'section-zone', label: 'Context & Triggers', x: 20, y: 130, size: { width: 370, height: 140 }, color: '#dbeafe' },
      { id: 's3', type: 'section-zone', label: 'Desired Outcomes', x: 410, y: 130, size: { width: 370, height: 140 }, color: '#dcfce7' },
      { id: 's4', type: 'section-zone', label: 'Current Workarounds', x: 20, y: 280, size: { width: 370, height: 140 }, color: '#fef3c7' },
      { id: 's5', type: 'section-zone', label: 'Constraints', x: 410, y: 280, size: { width: 370, height: 140 }, color: '#fecaca' },
      { id: 's6', type: 'section-zone', label: 'Success Measures', x: 20, y: 430, size: { width: 760, height: 100 }, color: '#e9d5ff' },
    ],
    connections: [],
    settings: {
      constrainToZones: true,
      allowConnections: false,
    },
  },
  {
    id: 'lean-canvas',
    name: 'Lean Canvas',
    description: 'Lightweight startup-style business model',
    category: 'Strategy',
    layout: 'structured-sections',
    thumbnail: null,
    elements: [
      // Row 1 (3 cols)
      { id: 'problem', type: 'section-zone', label: 'PROBLEM', x: 20, y: 20, size: { width: 240, height: 200 }, color: '#fecaca' },
      { id: 'solution', type: 'section-zone', label: 'SOLUTION', x: 270, y: 20, size: { width: 240, height: 200 }, color: '#dcfce7' },
      { id: 'uvp', type: 'section-zone', label: 'UNIQUE VALUE PROPOSITION', x: 520, y: 20, size: { width: 240, height: 200 }, color: '#dbeafe' },
      // Row 2
      { id: 'unfair', type: 'section-zone', label: 'UNFAIR ADVANTAGE', x: 20, y: 230, size: { width: 240, height: 150 }, color: '#e9d5ff' },
      { id: 'channels', type: 'section-zone', label: 'CHANNELS', x: 270, y: 230, size: { width: 240, height: 150 }, color: '#fef3c7' },
      { id: 'segments', type: 'section-zone', label: 'CUSTOMER SEGMENTS', x: 520, y: 230, size: { width: 240, height: 150 }, color: '#c7d2fe' },
      // Row 3
      { id: 'metrics', type: 'section-zone', label: 'KEY METRICS', x: 20, y: 390, size: { width: 365, height: 120 }, color: '#fed7aa' },
      { id: 'cost', type: 'section-zone', label: 'COST STRUCTURE', x: 395, y: 390, size: { width: 180, height: 120 }, color: '#e5e7eb' },
      { id: 'revenue', type: 'section-zone', label: 'REVENUE STREAMS', x: 585, y: 390, size: { width: 175, height: 120 }, color: '#bbf7d0' },
    ],
    connections: [],
    settings: {
      constrainToZones: true,
      allowConnections: false,
    },
  },
  {
    id: 'business-model-canvas',
    name: 'Business Model Canvas',
    description: 'Complete business model on one page',
    category: 'Strategy',
    layout: 'structured-sections',
    thumbnail: null,
    elements: [
      // Row 1 (5 cols)
      { id: 'partners', type: 'section-zone', label: 'KEY PARTNERS', x: 20, y: 20, size: { width: 180, height: 260 }, color: '#fef3c7' },
      { id: 'activities', type: 'section-zone', label: 'KEY ACTIVITIES', x: 210, y: 20, size: { width: 180, height: 120 }, color: '#fed7aa' },
      { id: 'resources', type: 'section-zone', label: 'KEY RESOURCES', x: 210, y: 150, size: { width: 180, height: 130 }, color: '#fca5a5' },
      { id: 'vp', type: 'section-zone', label: 'VALUE PROPOSITIONS', x: 400, y: 20, size: { width: 180, height: 260 }, color: '#86efac' },
      { id: 'relations', type: 'section-zone', label: 'CUSTOMER RELATIONSHIPS', x: 590, y: 20, size: { width: 180, height: 120 }, color: '#93c5fd' },
      { id: 'channels', type: 'section-zone', label: 'CHANNELS', x: 590, y: 150, size: { width: 180, height: 130 }, color: '#c4b5fd' },
      { id: 'segments', type: 'section-zone', label: 'CUSTOMER SEGMENTS', x: 780, y: 20, size: { width: 180, height: 260 }, color: '#f9a8d4' },
      // Row 2
      { id: 'cost', type: 'section-zone', label: 'COST STRUCTURE', x: 20, y: 290, size: { width: 470, height: 120 }, color: '#e5e7eb' },
      { id: 'revenue', type: 'section-zone', label: 'REVENUE STREAMS', x: 500, y: 290, size: { width: 460, height: 120 }, color: '#bbf7d0' },
    ],
    connections: [],
    settings: {
      constrainToZones: true,
      allowConnections: false,
    },
  },
  {
    id: 'value-proposition-canvas',
    name: 'Value Proposition Canvas',
    description: 'Align customer needs with product value',
    category: 'Strategy',
    layout: 'structured-sections',
    thumbnail: null,
    elements: [
      // Left side - Customer Profile
      { id: 'cp-header', type: 'section-zone', label: 'CUSTOMER PROFILE', x: 20, y: 20, size: { width: 370, height: 40 }, color: '#94a3b8' },
      { id: 'jobs', type: 'section-zone', label: 'Customer Jobs', x: 20, y: 70, size: { width: 370, height: 130 }, color: '#dbeafe' },
      { id: 'pains', type: 'section-zone', label: 'Pains', x: 20, y: 210, size: { width: 370, height: 130 }, color: '#fecaca' },
      { id: 'gains', type: 'section-zone', label: 'Gains', x: 20, y: 350, size: { width: 370, height: 130 }, color: '#dcfce7' },
      // Right side - Value Map
      { id: 'vm-header', type: 'section-zone', label: 'VALUE MAP', x: 410, y: 20, size: { width: 370, height: 40 }, color: '#94a3b8' },
      { id: 'products', type: 'section-zone', label: 'Products & Services', x: 410, y: 70, size: { width: 370, height: 130 }, color: '#c4b5fd' },
      { id: 'relievers', type: 'section-zone', label: 'Pain Relievers', x: 410, y: 210, size: { width: 370, height: 130 }, color: '#fef3c7' },
      { id: 'creators', type: 'section-zone', label: 'Gain Creators', x: 410, y: 350, size: { width: 370, height: 130 }, color: '#bbf7d0' },
    ],
    connections: [],
    settings: {
      constrainToZones: true,
      allowConnections: true,
      matchingEnabled: true, // Enable visual pairing of pains↔relievers
    },
  },
  {
    id: 'feature-canvas',
    name: 'Feature Canvas',
    description: 'Define a single feature in depth',
    category: 'Delivery',
    layout: 'structured-sections',
    thumbnail: null,
    elements: [
      // Header row
      { id: 'overview', type: 'section-zone', label: 'Feature Overview', x: 20, y: 20, size: { width: 760, height: 80 }, color: '#3b82f6' },
      // Row 2
      { id: 'problem', type: 'section-zone', label: 'Problem Statement', x: 20, y: 110, size: { width: 370, height: 100 }, color: '#fecaca' },
      { id: 'value', type: 'section-zone', label: 'User Value', x: 410, y: 110, size: { width: 370, height: 100 }, color: '#dcfce7' },
      // Row 3
      { id: 'functional', type: 'section-zone', label: 'Functional Requirements', x: 20, y: 220, size: { width: 370, height: 140 }, color: '#dbeafe' },
      { id: 'nonfunctional', type: 'section-zone', label: 'Non-Functional Considerations', x: 410, y: 220, size: { width: 370, height: 140 }, color: '#e5e7eb' },
      // Row 4
      { id: 'constraints', type: 'section-zone', label: 'Constraints & Assumptions', x: 20, y: 370, size: { width: 370, height: 100 }, color: '#fef3c7' },
      { id: 'outofscope', type: 'section-zone', label: 'Out of Scope', x: 410, y: 370, size: { width: 370, height: 100 }, color: '#fecaca' },
      // Footer
      { id: 'metrics', type: 'section-zone', label: 'Success Metrics', x: 20, y: 480, size: { width: 760, height: 80 }, color: '#bbf7d0' },
    ],
    connections: [],
    settings: {
      constrainToZones: true,
      allowConnections: false,
    },
  },
  {
    id: 'user-story-map',
    name: 'User Story Map',
    description: 'Organize user stories for release planning',
    category: 'Delivery',
    layout: 'story-map',
    thumbnail: null,
    elements: [
      // Backbone (activities)
      { id: 'act1', type: 'section-zone', label: 'DISCOVER', x: 20, y: 20, size: { width: 220, height: 60 }, color: '#3b82f6' },
      { id: 'act2', type: 'section-zone', label: 'EVALUATE', x: 250, y: 20, size: { width: 220, height: 60 }, color: '#3b82f6' },
      { id: 'act3', type: 'section-zone', label: 'USE', x: 480, y: 20, size: { width: 220, height: 60 }, color: '#3b82f6' },
      { id: 'act4', type: 'section-zone', label: 'SUPPORT', x: 710, y: 20, size: { width: 220, height: 60 }, color: '#3b82f6' },
      // Release bands
      { id: 'r1', type: 'lane-zone', label: 'Release 1 (MVP)', x: 20, y: 90, size: { width: 910, height: 150 }, color: '#dcfce7' },
      { id: 'r2', type: 'lane-zone', label: 'Release 2', x: 20, y: 250, size: { width: 910, height: 150 }, color: '#dbeafe' },
      { id: 'r3', type: 'lane-zone', label: 'Future', x: 20, y: 410, size: { width: 910, height: 150 }, color: '#e5e7eb' },
    ],
    connections: [],
    settings: {
      constrainToZones: false,
      allowConnections: false,
    },
  },

  // ========== VALIDATION/LEARNING TEMPLATES ==========
  {
    id: 'test-card',
    name: 'Test Card',
    description: 'Design a single focused validation test',
    category: 'Validation',
    layout: 'structured-sections',
    thumbnail: null,
    elements: [
      { id: 'assumption', type: 'section-zone', label: 'Assumption', x: 20, y: 20, size: { width: 460, height: 80 }, color: '#fecaca' },
      { id: 'hypothesis', type: 'section-zone', label: 'Hypothesis', x: 20, y: 110, size: { width: 460, height: 80 }, color: '#fef3c7', properties: { hint: 'If/then statement' } },
      { id: 'method', type: 'section-zone', label: 'Test Method', x: 20, y: 200, size: { width: 460, height: 80 }, color: '#dbeafe' },
      { id: 'success', type: 'section-zone', label: 'Success Criteria', x: 20, y: 290, size: { width: 225, height: 80 }, color: '#dcfce7' },
      { id: 'failure', type: 'section-zone', label: 'Failure Criteria', x: 255, y: 290, size: { width: 225, height: 80 }, color: '#fecaca' },
      { id: 'scope', type: 'section-zone', label: 'Test Scope', x: 20, y: 380, size: { width: 460, height: 70 }, color: '#e5e7eb' },
      { id: 'risks', type: 'section-zone', label: 'Risks & Constraints', x: 20, y: 460, size: { width: 460, height: 70 }, color: '#fed7aa' },
    ],
    connections: [],
    settings: {
      constrainToZones: true,
      allowConnections: false,
    },
  },
  {
    id: 'learning-card',
    name: 'Learning Card',
    description: 'Capture validated learning from an experiment',
    category: 'Validation',
    layout: 'structured-sections',
    thumbnail: null,
    elements: [
      { id: 'summary', type: 'section-zone', label: 'Experiment Summary', x: 20, y: 20, size: { width: 460, height: 70 }, color: '#dbeafe' },
      { id: 'results', type: 'section-zone', label: 'Observed Results', x: 20, y: 100, size: { width: 460, height: 100 }, color: '#e5e7eb' },
      { id: 'insights', type: 'section-zone', label: 'Key Insights', x: 20, y: 210, size: { width: 460, height: 100 }, color: '#fef3c7' },
      { id: 'implications', type: 'section-zone', label: 'Decision Implications', x: 20, y: 320, size: { width: 460, height: 80 }, color: '#c4b5fd' },
      { id: 'next', type: 'section-zone', label: 'Next Steps', x: 20, y: 410, size: { width: 340, height: 80 }, color: '#dcfce7' },
      { id: 'confidence', type: 'section-zone', label: 'Confidence', x: 370, y: 410, size: { width: 110, height: 80 }, color: '#fecaca' },
    ],
    connections: [],
    settings: {
      constrainToZones: true,
      allowConnections: false,
    },
  },
  {
    id: 'experiment-canvas',
    name: 'Experiment Canvas',
    description: 'Plan a complete validation experiment',
    category: 'Validation',
    layout: 'structured-sections',
    thumbnail: null,
    elements: [
      { id: 'objective', type: 'section-zone', label: 'Objective', x: 20, y: 20, size: { width: 760, height: 70 }, color: '#3b82f6' },
      { id: 'assumptions', type: 'section-zone', label: 'Assumptions to Test', x: 20, y: 100, size: { width: 370, height: 100 }, color: '#fecaca' },
      { id: 'hypotheses', type: 'section-zone', label: 'Hypotheses', x: 410, y: 100, size: { width: 370, height: 100 }, color: '#fef3c7' },
      { id: 'design', type: 'section-zone', label: 'Experiment Design', x: 20, y: 210, size: { width: 370, height: 120 }, color: '#dbeafe' },
      { id: 'metrics', type: 'section-zone', label: 'Metrics & Signals', x: 410, y: 210, size: { width: 370, height: 120 }, color: '#dcfce7' },
      { id: 'execution', type: 'section-zone', label: 'Execution Plan', x: 20, y: 340, size: { width: 370, height: 100 }, color: '#e5e7eb' },
      { id: 'risks', type: 'section-zone', label: 'Risks & Biases', x: 410, y: 340, size: { width: 370, height: 100 }, color: '#fed7aa' },
      { id: 'decision', type: 'section-zone', label: 'Decision Criteria', x: 20, y: 450, size: { width: 760, height: 70 }, color: '#c4b5fd' },
    ],
    connections: [],
    settings: {
      constrainToZones: true,
      allowConnections: false,
    },
  },

  // ========== TABLE/SCORING TEMPLATES ==========
  {
    id: 'rice-scoring',
    name: 'RICE Scoring',
    description: 'Quantitatively rank options using RICE model',
    category: 'Prioritization',
    layout: 'table',
    thumbnail: null,
    elements: [
      // Header row
      { id: 'h1', type: 'section-zone', label: 'Item', x: 20, y: 20, size: { width: 200, height: 50 }, color: '#1e293b' },
      { id: 'h2', type: 'section-zone', label: 'Reach', x: 230, y: 20, size: { width: 100, height: 50 }, color: '#1e293b' },
      { id: 'h3', type: 'section-zone', label: 'Impact', x: 340, y: 20, size: { width: 100, height: 50 }, color: '#1e293b' },
      { id: 'h4', type: 'section-zone', label: 'Confidence', x: 450, y: 20, size: { width: 100, height: 50 }, color: '#1e293b' },
      { id: 'h5', type: 'section-zone', label: 'Effort', x: 560, y: 20, size: { width: 100, height: 50 }, color: '#1e293b' },
      { id: 'h6', type: 'section-zone', label: 'RICE Score', x: 670, y: 20, size: { width: 110, height: 50 }, color: '#3b82f6' },
      // Sample rows
      { id: 'r1-item', type: 'scored-item', label: 'Feature A', x: 20, y: 80, size: { width: 200, height: 50 } },
      { id: 'r2-item', type: 'scored-item', label: 'Feature B', x: 20, y: 140, size: { width: 200, height: 50 } },
      { id: 'r3-item', type: 'scored-item', label: 'Feature C', x: 20, y: 200, size: { width: 200, height: 50 } },
    ],
    connections: [],
    settings: {
      constrainToZones: false,
      allowConnections: false,
      tableMode: true,
      formula: '(reach * impact * confidence) / effort',
    },
  },
  {
    id: 'competitive-analysis',
    name: 'Competitive Analysis',
    description: 'Compare market positioning',
    category: 'Strategy',
    layout: 'table',
    thumbnail: null,
    elements: [
      // Header row
      { id: 'h1', type: 'section-zone', label: 'Competitor', x: 20, y: 20, size: { width: 150, height: 50 }, color: '#1e293b' },
      { id: 'h2', type: 'section-zone', label: 'Dimension 1', x: 180, y: 20, size: { width: 140, height: 50 }, color: '#1e293b' },
      { id: 'h3', type: 'section-zone', label: 'Dimension 2', x: 330, y: 20, size: { width: 140, height: 50 }, color: '#1e293b' },
      { id: 'h4', type: 'section-zone', label: 'Dimension 3', x: 480, y: 20, size: { width: 140, height: 50 }, color: '#1e293b' },
      { id: 'h5', type: 'section-zone', label: 'Strengths', x: 630, y: 20, size: { width: 140, height: 50 }, color: '#dcfce7' },
      { id: 'h6', type: 'section-zone', label: 'Weaknesses', x: 780, y: 20, size: { width: 140, height: 50 }, color: '#fecaca' },
      // Our product row
      { id: 'us', type: 'section-zone', label: 'Our Product', x: 20, y: 80, size: { width: 150, height: 60 }, color: '#3b82f6' },
      // Competitor rows
      { id: 'c1', type: 'section-zone', label: 'Competitor A', x: 20, y: 150, size: { width: 150, height: 60 }, color: '#e5e7eb' },
      { id: 'c2', type: 'section-zone', label: 'Competitor B', x: 20, y: 220, size: { width: 150, height: 60 }, color: '#e5e7eb' },
      { id: 'c3', type: 'section-zone', label: 'Competitor C', x: 20, y: 290, size: { width: 150, height: 60 }, color: '#e5e7eb' },
    ],
    connections: [],
    settings: {
      constrainToZones: false,
      allowConnections: false,
      tableMode: true,
    },
  },

  // ========== BLANK TEMPLATE ==========
  {
    id: 'blank',
    name: 'Blank Canvas',
    description: 'Start with an empty canvas',
    category: 'General',
    layout: 'freeform',
    thumbnail: null,
    elements: [],
    connections: [],
    settings: {
      constrainToZones: false,
      allowConnections: true,
    },
  },
];

// ============ NODE PROPERTIES ============

const nodeProperties = [
  { id: 'evidence', label: 'Evidence', type: 'text' },
  { id: 'confidence', label: 'Confidence', type: 'select', options: [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
  ]},
  { id: 'source', label: 'Source', type: 'text' },
  { id: 'priority', label: 'Priority', type: 'select', options: [
    { value: 'critical', label: 'Critical' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
  ]},
  { id: 'tags', label: 'Tags', type: 'list' },
  { id: 'linkedItems', label: 'Linked Items', type: 'links' },
];

// ============ VISUAL RENDERERS ============

// Modern Card with icon badge - clean, professional design
function CardNode({ element, stencil, icon, iconBgColor, accentColor }) {
  const label = element.label || element.name || '';
  const { width, height } = element.size || stencil?.defaultSize || { width: 160, height: 100 };
  const bgColor = element.color || stencil?.color || '#fef08a';

  // Create complementary colors
  const hexColor = bgColor.replace(/^#/, '');
  const r = parseInt(hexColor.substr(0, 2), 16);
  const g = parseInt(hexColor.substr(2, 2), 16);
  const b = parseInt(hexColor.substr(4, 2), 16);
  const borderColor = `rgb(${Math.max(0, r - 40)}, ${Math.max(0, g - 40)}, ${Math.max(0, b - 40)})`;
  const accent = accentColor || borderColor;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
      }}
    >
      {/* Card background */}
      <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
        <defs>
          <filter id={`card-shadow-${element.id}`} x="-15%" y="-10%" width="130%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.12" />
          </filter>
          <linearGradient id={`card-bg-${element.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="100%" stopColor={bgColor} stopOpacity="0.3" />
          </linearGradient>
        </defs>

        {/* Main card body */}
        <rect
          x="1"
          y="1"
          width={width - 2}
          height={height - 2}
          fill={`url(#card-bg-${element.id})`}
          stroke={borderColor}
          strokeWidth="1.5"
          rx="12"
          filter={`url(#card-shadow-${element.id})`}
        />

        {/* Top accent bar */}
        <rect
          x="1"
          y="1"
          width={width - 2}
          height="6"
          fill={accent}
          rx="12"
        />
        <rect
          x="1"
          y="4"
          width={width - 2}
          height="4"
          fill={accent}
        />
      </svg>

      {/* Icon badge - floating pill style */}
      <div style={{
        position: 'absolute',
        top: 12,
        left: 10,
        height: 28,
        minWidth: 28,
        padding: '0 8px',
        borderRadius: '14px',
        background: 'white',
        border: `2px solid ${accent}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 15,
        boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
        gap: 4,
      }}>
        {icon}
      </div>

      {/* Content */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 12px 12px',
        boxSizing: 'border-box',
      }}>
        <div style={{
          fontSize: 12,
          fontWeight: 600,
          color: '#374151',
          textAlign: 'center',
          lineHeight: 1.4,
          overflow: 'hidden',
          wordBreak: 'break-word',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
        }}>
          {label}
        </div>
      </div>
    </div>
  );
}

// OST Node (hierarchical tree node)
function OSTNode({ element, stencil, icon, borderStyle = 'solid' }) {
  const label = element.label || element.name || '';
  const { width, height } = element.size || stencil?.defaultSize || { width: 180, height: 70 };
  const color = element.color || stencil?.color || '#3b82f6';

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
        <defs>
          <filter id={`ost-shadow-${element.id}`} x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15" />
          </filter>
        </defs>
        <rect
          x="2"
          y="2"
          width={width - 4}
          height={height - 4}
          fill="white"
          stroke={color}
          strokeWidth="3"
          strokeDasharray={borderStyle === 'dashed' ? '8 4' : 'none'}
          rx="8"
          filter={`url(#ost-shadow-${element.id})`}
        />
        {/* Color accent bar on left */}
        <rect
          x="2"
          y="2"
          width="6"
          height={height - 4}
          fill={color}
          rx="8"
        />
        <rect
          x="2"
          y="2"
          width="6"
          height={height - 4}
          fill={color}
          clipPath="inset(0 50% 0 0)"
        />
      </svg>

      <div style={{
        position: 'relative',
        zIndex: 1,
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        padding: '8px 10px 8px 16px',
        boxSizing: 'border-box',
        gap: 8,
      }}>
        {/* Icon */}
        <div style={{
          fontSize: 20,
          flexShrink: 0,
        }}>
          {icon}
        </div>

        {/* Label */}
        <div style={{
          fontSize: 12,
          fontWeight: 600,
          color: '#1f2937',
          lineHeight: 1.3,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}>
          {label}
        </div>
      </div>
    </div>
  );
}

// Zone/Container Node
function ZoneNode({ element, stencil }) {
  const label = element.label || element.name || '';
  const { width, height } = element.size || stencil?.defaultSize || { width: 350, height: 180 };
  const color = element.color || stencil?.color || '#f3f4f6';

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
        <rect
          x="1"
          y="1"
          width={width - 2}
          height={height - 2}
          fill={color}
          fillOpacity="0.5"
          stroke={color}
          strokeWidth="2"
          strokeDasharray="6 3"
          rx="8"
        />
        {/* Header area */}
        <rect
          x="1"
          y="1"
          width={width - 2}
          height="28"
          fill={color}
          rx="8"
        />
        <rect
          x="1"
          y="22"
          width={width - 2}
          height="7"
          fill={color}
        />
      </svg>

      {/* Label */}
      <div style={{
        position: 'absolute',
        top: 5,
        left: 10,
        fontSize: 11,
        fontWeight: 700,
        color: '#374151',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>
        {label}
      </div>
    </div>
  );
}

// Persona Header
function PersonaNode({ element, stencil }) {
  const label = element.label || element.name || 'Persona';
  const { width, height } = element.size || stencil?.defaultSize || { width: 720, height: 120 };
  const color = element.color || stencil?.color || '#dbeafe';

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
        <rect
          x="1"
          y="1"
          width={width - 2}
          height={height - 2}
          fill={color}
          stroke="#93c5fd"
          strokeWidth="2"
          rx="12"
        />
      </svg>

      <div style={{
        position: 'relative',
        zIndex: 1,
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        padding: '16px',
        gap: 16,
        boxSizing: 'border-box',
      }}>
        {/* Avatar */}
        <div style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: '#fff',
          border: '2px solid #93c5fd',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 32,
          flexShrink: 0,
        }}>
          👤
        </div>

        {/* Info */}
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1e40af' }}>{label}</div>
          <div style={{ fontSize: 12, color: '#3b82f6', marginTop: 4 }}>
            {element.data?.role || 'Role / Segment'}
          </div>
        </div>
      </div>
    </div>
  );
}

// Emotion Point
function EmotionPointNode({ element, stencil }) {
  const { width, height } = element.size || stencil?.defaultSize || { width: 40, height: 40 };
  const score = element.data?.score || element.properties?.score || 0;
  const color = score > 0 ? '#22c55e' : score < 0 ? '#ef4444' : '#f59e0b';
  const emoji = score >= 2 ? '😄' : score >= 1 ? '🙂' : score <= -2 ? '😠' : score <= -1 ? '😟' : '😐';

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
        <circle
          cx={width / 2}
          cy={height / 2}
          r={Math.min(width, height) / 2 - 2}
          fill="white"
          stroke={color}
          strokeWidth="3"
        />
      </svg>

      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        fontSize: Math.min(width, height) * 0.5,
      }}>
        {emoji}
      </div>
    </div>
  );
}

// Touchpoint
function TouchpointNode({ element, stencil }) {
  const label = element.label || element.name || '';
  const { width, height } = element.size || stencil?.defaultSize || { width: 140, height: 60 };
  const color = element.color || stencil?.color || '#c4b5fd';

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
        <rect
          x="1"
          y="1"
          width={width - 2}
          height={height - 2}
          fill={color}
          stroke="#a78bfa"
          strokeWidth="2"
          rx="6"
        />
      </svg>

      <div style={{
        position: 'relative',
        zIndex: 1,
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        padding: '8px',
        gap: 8,
        boxSizing: 'border-box',
      }}>
        <span style={{ fontSize: 20 }}>📱</span>
        <div style={{
          fontSize: 11,
          fontWeight: 500,
          color: '#1f2937',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {label}
        </div>
      </div>
    </div>
  );
}

// Colored Card (generic sticky)
function ColoredCardNode({ element, stencil }) {
  const label = element.label || element.name || '';
  const { width, height } = element.size || stencil?.defaultSize || { width: 140, height: 100 };
  const color = element.color || stencil?.color || '#fef08a';

  const darkerColor = color.replace(/^#/, '');
  const r = parseInt(darkerColor.substr(0, 2), 16);
  const g = parseInt(darkerColor.substr(2, 2), 16);
  const b = parseInt(darkerColor.substr(4, 2), 16);
  const shadow = `rgb(${Math.max(0, r - 30)}, ${Math.max(0, g - 30)}, ${Math.max(0, b - 30)})`;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
        <defs>
          <filter id={`color-shadow-${element.id}`} x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="2" dy="3" stdDeviation="3" floodOpacity="0.15" />
          </filter>
        </defs>
        <rect
          x="0"
          y="0"
          width={width}
          height={height}
          fill={color}
          rx="4"
          filter={`url(#color-shadow-${element.id})`}
        />
        <path
          d={`M ${width - 16} 0 L ${width} 0 L ${width} 16 Z`}
          fill={shadow}
          fillOpacity="0.3"
        />
      </svg>

      <div style={{
        position: 'relative',
        zIndex: 1,
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '10px',
        boxSizing: 'border-box',
      }}>
        <div style={{
          fontSize: 12,
          fontWeight: 500,
          color: '#1f2937',
          textAlign: 'center',
          lineHeight: 1.3,
          overflow: 'hidden',
          wordBreak: 'break-word',
        }}>
          {label}
        </div>
      </div>
    </div>
  );
}

// Main render function
function renderNode(element, stencil, isSelected) {
  const type = element.type;

  // Cards with icons
  switch (type) {
    case 'insight-card':
      return <CardNode element={element} stencil={stencil} icon="💡" iconBgColor="rgba(254,240,138,0.9)" />;
    case 'action-card':
      return <CardNode element={element} stencil={stencil} icon="⚡" iconBgColor="rgba(147,197,253,0.9)" />;
    case 'pain-point':
      return <CardNode element={element} stencil={stencil} icon="❌" iconBgColor="rgba(252,165,165,0.9)" />;
    case 'opportunity-card':
      return <CardNode element={element} stencil={stencil} icon="✨" iconBgColor="rgba(134,239,172,0.9)" />;
    case 'quote-card':
      return <CardNode element={element} stencil={stencil} icon="❝" iconBgColor="rgba(233,213,255,0.9)" />;

    // OST Nodes
    case 'outcome-node':
      return <OSTNode element={element} stencil={stencil} icon="🎯" />;
    case 'opportunity-node':
      return <OSTNode element={element} stencil={stencil} icon="🔍" />;
    case 'solution-node':
      return <OSTNode element={element} stencil={stencil} icon="💡" />;
    case 'experiment-node':
      return <OSTNode element={element} stencil={stencil} icon="🧪" borderStyle="dashed" />;

    // Zones/Containers
    case 'quadrant-zone':
    case 'lane-zone':
    case 'phase-container':
    case 'column-zone':
    case 'section-zone':
      return <ZoneNode element={element} stencil={stencil} />;

    // Persona
    case 'persona-header':
      return <PersonaNode element={element} stencil={stencil} />;

    // Journey elements
    case 'touchpoint':
      return <TouchpointNode element={element} stencil={stencil} />;
    case 'emotion-point':
      return <EmotionPointNode element={element} stencil={stencil} />;

    // Colored cards
    case 'yellow-card':
    case 'blue-card':
    case 'green-card':
    case 'pink-card':
    case 'orange-card':
    case 'purple-card':
      return <ColoredCardNode element={element} stencil={stencil} />;

    // Scored item
    case 'scored-item':
      return <ColoredCardNode element={element} stencil={stencil} />;

    default:
      return null;
  }
}

// ============ PACK EXPORT ============

const ProductDesignPack = {
  id: 'product-design',
  name: 'Product Design',
  description: 'Structured canvases for product discovery, strategy, and validation',
  icon: '🎨',
  stencils,
  connectionTypes,
  validators,
  templates,
  nodeProperties,
  renderNode,
  defaultLineStyle: 'curved', // Product design uses organic flow lines
  // Additional metadata for canvas selection UI
  categories: [
    { id: 'discovery', name: 'Discovery', description: 'User research and insight synthesis' },
    { id: 'strategy', name: 'Strategy', description: 'Business model and value proposition' },
    { id: 'prioritization', name: 'Prioritization', description: 'Decision making and trade-offs' },
    { id: 'validation', name: 'Validation', description: 'Hypothesis testing and learning' },
    { id: 'delivery', name: 'Delivery', description: 'Feature definition and planning' },
  ],
};

export default ProductDesignPack;
export { stencils, connectionTypes, validators, templates, nodeProperties, renderNode };
