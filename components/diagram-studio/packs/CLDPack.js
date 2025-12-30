// components/diagram-studio/packs/CLDPack.js
// Causal Loop Diagram pack for system dynamics

import React from 'react';

// ============ STENCILS ============

const stencils = [
  // Variables
  {
    id: 'variable',
    name: 'Variable',
    description: 'A system variable that can change over time',
    group: 'Variables',
    shape: 'rect',
    icon: 'V',
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
      { id: 'variableType', label: 'Type', type: 'select', options: [
        { value: 'state', label: 'State Variable' },
        { value: 'rate', label: 'Rate Variable' },
        { value: 'auxiliary', label: 'Auxiliary' },
        { value: 'exogenous', label: 'Exogenous' },
      ]},
      { id: 'units', label: 'Units', type: 'text' },
    ],
  },

  // Stocks (accumulators)
  {
    id: 'stock',
    name: 'Stock',
    description: 'An accumulator that changes over time (level/state)',
    group: 'Stocks & Flows',
    shape: 'rect',
    icon: '▭',
    color: '#22c55e',
    defaultSize: { width: 100, height: 60 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
    properties: [
      { id: 'initialValue', label: 'Initial Value', type: 'number' },
      { id: 'units', label: 'Units', type: 'text' },
    ],
  },

  // Flow (rate of change)
  {
    id: 'flow',
    name: 'Flow',
    description: 'Rate of change into or out of a stock',
    group: 'Stocks & Flows',
    shape: 'rect',
    icon: '⋈',
    color: '#f59e0b',
    defaultSize: { width: 80, height: 40 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
    properties: [
      { id: 'flowType', label: 'Flow Type', type: 'select', options: [
        { value: 'inflow', label: 'Inflow' },
        { value: 'outflow', label: 'Outflow' },
        { value: 'biflow', label: 'Biflow' },
      ]},
      { id: 'equation', label: 'Equation', type: 'textarea' },
    ],
  },

  // Cloud (source/sink)
  {
    id: 'cloud',
    name: 'Source/Sink',
    description: 'External source or sink (outside system boundary)',
    group: 'Stocks & Flows',
    shape: 'ellipse',
    icon: '☁',
    color: '#94a3b8',
    defaultSize: { width: 60, height: 40 },
    ports: [
      { id: 'right', position: 'right' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
  },

  // Loop Markers
  {
    id: 'reinforcing-loop',
    name: 'Reinforcing Loop',
    description: 'Marker for reinforcing (R) feedback loop',
    group: 'Loop Markers',
    shape: 'circle',
    icon: 'R',
    color: '#ef4444',
    defaultSize: { width: 50, height: 50 },
    ports: [],
    isContainer: false,
    properties: [
      { id: 'loopName', label: 'Loop Name', type: 'text' },
      { id: 'loopNumber', label: 'Loop Number', type: 'text' },
    ],
  },
  {
    id: 'balancing-loop',
    name: 'Balancing Loop',
    description: 'Marker for balancing (B) feedback loop',
    group: 'Loop Markers',
    shape: 'circle',
    icon: 'B',
    color: '#3b82f6',
    defaultSize: { width: 50, height: 50 },
    ports: [],
    isContainer: false,
    properties: [
      { id: 'loopName', label: 'Loop Name', type: 'text' },
      { id: 'loopNumber', label: 'Loop Number', type: 'text' },
    ],
  },

  // Auxiliary elements
  {
    id: 'constant',
    name: 'Constant',
    description: 'A fixed value that does not change',
    group: 'Auxiliary',
    shape: 'diamond',
    icon: 'C',
    color: '#8b5cf6',
    defaultSize: { width: 50, height: 50 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
    properties: [
      { id: 'value', label: 'Value', type: 'number' },
      { id: 'units', label: 'Units', type: 'text' },
    ],
  },
  {
    id: 'table-function',
    name: 'Table Function',
    description: 'Lookup table for non-linear relationships',
    group: 'Auxiliary',
    shape: 'rect',
    icon: '📈',
    color: '#06b6d4',
    defaultSize: { width: 80, height: 50 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
    properties: [
      { id: 'tableData', label: 'Table Data', type: 'textarea' },
    ],
  },

  // Annotations
  {
    id: 'system-boundary',
    name: 'System Boundary',
    description: 'Boundary defining the system scope',
    group: 'Annotations',
    shape: 'rect',
    icon: '⬜',
    color: '#e5e7eb',
    defaultSize: { width: 400, height: 300 },
    ports: [],
    isContainer: true,
    properties: [
      { id: 'boundaryName', label: 'Boundary Name', type: 'text' },
    ],
  },
  {
    id: 'annotation',
    name: 'Annotation',
    description: 'Text annotation or note',
    group: 'Annotations',
    shape: 'rect',
    icon: '📝',
    color: '#fef3c7',
    defaultSize: { width: 150, height: 60 },
    ports: [],
    isContainer: false,
  },
];

// ============ CONNECTION TYPES ============

const connectionTypes = [
  {
    id: 'positive-link',
    name: 'Positive Link (+)',
    description: 'Same-direction causal link: when A increases, B increases',
    style: 'solid',
    arrowStart: 'none',
    arrowEnd: 'arrow',
    color: '#22c55e',
    labelPosition: 'center',
    defaultLabel: '+',
  },
  {
    id: 'negative-link',
    name: 'Negative Link (-)',
    description: 'Opposite-direction causal link: when A increases, B decreases',
    style: 'solid',
    arrowStart: 'none',
    arrowEnd: 'arrow',
    color: '#ef4444',
    labelPosition: 'center',
    defaultLabel: '-',
  },
  {
    id: 'delayed-positive',
    name: 'Delayed Positive (+//)',
    description: 'Positive link with time delay',
    style: 'dashed',
    arrowStart: 'none',
    arrowEnd: 'arrow',
    color: '#22c55e',
    labelPosition: 'center',
    defaultLabel: '+//',
  },
  {
    id: 'delayed-negative',
    name: 'Delayed Negative (-//)',
    description: 'Negative link with time delay',
    style: 'dashed',
    arrowStart: 'none',
    arrowEnd: 'arrow',
    color: '#ef4444',
    labelPosition: 'center',
    defaultLabel: '-//',
  },
  {
    id: 'flow-pipe',
    name: 'Flow Pipe',
    description: 'Physical flow connection',
    style: 'solid',
    arrowStart: 'none',
    arrowEnd: 'arrow',
    color: '#3b82f6',
    strokeWidth: 3,
  },
  {
    id: 'information-link',
    name: 'Information Link',
    description: 'Information flow (no physical transfer)',
    style: 'dotted',
    arrowStart: 'none',
    arrowEnd: 'arrow',
    color: '#6b7280',
  },
];

// ============ VALIDATORS ============

const validators = [
  {
    id: 'has-feedback-loop',
    name: 'Has Feedback Loop',
    description: 'CLD should contain at least one feedback loop',
    level: 'info',
    validate: (elements, connections) => {
      // Simple check: look for cycles in the graph
      const hasLoop = detectCycle(elements, connections);
      if (!hasLoop) {
        return { message: 'No feedback loops detected. Consider adding reinforcing or balancing loops.' };
      }
      return null;
    },
  },
  {
    id: 'polarity-marked',
    name: 'All Links Have Polarity',
    description: 'All causal links should have + or - polarity marked',
    level: 'warn',
    validate: (elements, connections) => {
      const unmarked = connections.filter(
        c => !c.type?.includes('positive') && !c.type?.includes('negative') && c.type !== 'flow-pipe'
      );
      if (unmarked.length > 0) {
        return unmarked.map(c => ({
          elementId: c.id,
          message: `Connection from "${findLabel(elements, c.sourceId)}" to "${findLabel(elements, c.targetId)}" needs polarity`,
        }));
      }
      return null;
    },
  },
  {
    id: 'loop-markers-present',
    name: 'Loop Markers Present',
    description: 'Feedback loops should have R or B markers',
    level: 'info',
    validate: (elements) => {
      const hasLoopMarker = elements.some(
        el => el.type === 'reinforcing-loop' || el.type === 'balancing-loop'
      );
      if (!hasLoopMarker) {
        return { message: 'Consider adding loop markers (R or B) to identify feedback loops' };
      }
      return null;
    },
  },
];

// ============ TEMPLATES ============

const templates = [
  {
    id: 'blank',
    name: 'Blank CLD',
    description: 'Empty causal loop diagram',
    thumbnail: null,
    elements: [],
    connections: [],
  },
  {
    id: 'reinforcing-loop',
    name: 'Reinforcing Loop',
    description: 'Simple reinforcing feedback loop example',
    thumbnail: null,
    elements: [
      { id: 'v1', type: 'variable', label: 'Sales', x: 100, y: 100, size: { width: 140, height: 50 } },
      { id: 'v2', type: 'variable', label: 'Revenue', x: 350, y: 100, size: { width: 140, height: 50 } },
      { id: 'v3', type: 'variable', label: 'Marketing Budget', x: 350, y: 250, size: { width: 140, height: 50 } },
      { id: 'v4', type: 'variable', label: 'Brand Awareness', x: 100, y: 250, size: { width: 140, height: 50 } },
      { id: 'r1', type: 'reinforcing-loop', label: 'R1', x: 225, y: 165, size: { width: 50, height: 50 } },
    ],
    connections: [
      { id: 'c1', sourceId: 'v1', targetId: 'v2', type: 'positive-link', label: '+' },
      { id: 'c2', sourceId: 'v2', targetId: 'v3', type: 'positive-link', label: '+' },
      { id: 'c3', sourceId: 'v3', targetId: 'v4', type: 'positive-link', label: '+' },
      { id: 'c4', sourceId: 'v4', targetId: 'v1', type: 'positive-link', label: '+' },
    ],
  },
  {
    id: 'balancing-loop',
    name: 'Balancing Loop',
    description: 'Simple balancing feedback loop example',
    thumbnail: null,
    elements: [
      { id: 'v1', type: 'variable', label: 'Gap', x: 100, y: 150, size: { width: 140, height: 50 } },
      { id: 'v2', type: 'variable', label: 'Corrective Action', x: 350, y: 150, size: { width: 140, height: 50 } },
      { id: 'v3', type: 'variable', label: 'Actual State', x: 225, y: 300, size: { width: 140, height: 50 } },
      { id: 'b1', type: 'balancing-loop', label: 'B1', x: 225, y: 180, size: { width: 50, height: 50 } },
    ],
    connections: [
      { id: 'c1', sourceId: 'v1', targetId: 'v2', type: 'positive-link', label: '+' },
      { id: 'c2', sourceId: 'v2', targetId: 'v3', type: 'positive-link', label: '+' },
      { id: 'c3', sourceId: 'v3', targetId: 'v1', type: 'negative-link', label: '-' },
    ],
  },
  {
    id: 'limits-to-growth',
    name: 'Limits to Growth',
    description: 'Classic systems archetype: growth with limiting factor',
    thumbnail: null,
    elements: [
      { id: 'v1', type: 'variable', label: 'Performance', x: 200, y: 50, size: { width: 140, height: 50 } },
      { id: 'v2', type: 'variable', label: 'Effort', x: 50, y: 150, size: { width: 140, height: 50 } },
      { id: 'v3', type: 'variable', label: 'Resources', x: 350, y: 150, size: { width: 140, height: 50 } },
      { id: 'v4', type: 'variable', label: 'Resource Gap', x: 350, y: 300, size: { width: 140, height: 50 } },
      { id: 'r1', type: 'reinforcing-loop', label: 'R', x: 130, y: 90, size: { width: 40, height: 40 } },
      { id: 'b1', type: 'balancing-loop', label: 'B', x: 280, y: 200, size: { width: 40, height: 40 } },
    ],
    connections: [
      { id: 'c1', sourceId: 'v1', targetId: 'v2', type: 'positive-link', label: '+' },
      { id: 'c2', sourceId: 'v2', targetId: 'v1', type: 'positive-link', label: '+' },
      { id: 'c3', sourceId: 'v1', targetId: 'v3', type: 'negative-link', label: '-' },
      { id: 'c4', sourceId: 'v3', targetId: 'v4', type: 'negative-link', label: '-' },
      { id: 'c5', sourceId: 'v4', targetId: 'v1', type: 'negative-link', label: '-' },
    ],
  },
];

// ============ NODE PROPERTIES ============

const nodeProperties = [
  { id: 'equation', label: 'Equation', type: 'textarea' },
  { id: 'documentation', label: 'Documentation', type: 'textarea' },
  { id: 'dataSource', label: 'Data Source', type: 'text' },
];

// ============ HELPERS ============

function detectCycle(elements, connections) {
  const graph = {};
  elements.forEach(el => { graph[el.id] = []; });
  connections.forEach(c => {
    if (graph[c.sourceId]) {
      graph[c.sourceId].push(c.targetId);
    }
  });

  const visited = new Set();
  const recStack = new Set();

  function dfs(node) {
    if (recStack.has(node)) return true;
    if (visited.has(node)) return false;

    visited.add(node);
    recStack.add(node);

    for (const neighbor of (graph[node] || [])) {
      if (dfs(neighbor)) return true;
    }

    recStack.delete(node);
    return false;
  }

  for (const node of Object.keys(graph)) {
    if (dfs(node)) return true;
  }
  return false;
}

function findLabel(elements, id) {
  const el = elements.find(e => e.id === id);
  return el?.label || el?.name || id;
}

// ============ CUSTOM RENDERERS ============

/**
 * Variable Renderer - Clean rounded rectangle for CLD variables
 */
function VariableNode({ element, stencil, isSelected }) {
  const width = element.size?.width || stencil.defaultSize.width;
  const height = element.size?.height || stencil.defaultSize.height;
  const color = element.color || stencil.color;
  const label = element.label || '';

  return (
    <g>
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        rx={6}
        ry={6}
        fill="#ffffff"
        stroke={isSelected ? 'var(--accent, #0e74a3)' : color}
        strokeWidth={isSelected ? 2.5 : 2}
      />
      <text
        x={width / 2}
        y={height / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#1f2937"
        fontSize="13"
        fontWeight="500"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {label}
      </text>
    </g>
  );
}

/**
 * Stock Renderer - Rectangle with double vertical borders (System Dynamics notation)
 */
function StockNode({ element, stencil, isSelected }) {
  const width = element.size?.width || stencil.defaultSize.width;
  const height = element.size?.height || stencil.defaultSize.height;
  const color = element.color || stencil.color;
  const label = element.label || '';
  const inset = 6; // Width of the double-line effect

  return (
    <g>
      {/* Main rectangle */}
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="#f0fdf4"
        stroke={isSelected ? 'var(--accent, #0e74a3)' : color}
        strokeWidth={isSelected ? 2.5 : 2}
      />
      {/* Left double border */}
      <line
        x1={inset}
        y1={0}
        x2={inset}
        y2={height}
        stroke={isSelected ? 'var(--accent, #0e74a3)' : color}
        strokeWidth={1.5}
      />
      {/* Right double border */}
      <line
        x1={width - inset}
        y1={0}
        x2={width - inset}
        y2={height}
        stroke={isSelected ? 'var(--accent, #0e74a3)' : color}
        strokeWidth={1.5}
      />
      <text
        x={width / 2}
        y={height / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#166534"
        fontSize="12"
        fontWeight="600"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {label}
      </text>
    </g>
  );
}

/**
 * Flow Renderer - Hourglass/valve shape (System Dynamics notation)
 */
function FlowNode({ element, stencil, isSelected }) {
  const width = element.size?.width || stencil.defaultSize.width;
  const height = element.size?.height || stencil.defaultSize.height;
  const color = element.color || stencil.color;
  const label = element.label || '';

  // Hourglass/bowtie shape for flow regulator
  const notch = width * 0.25;

  return (
    <g>
      <path
        d={`
          M 0 0
          L ${width} 0
          L ${width - notch} ${height / 2}
          L ${width} ${height}
          L 0 ${height}
          L ${notch} ${height / 2}
          Z
        `}
        fill="#fef3c7"
        stroke={isSelected ? 'var(--accent, #0e74a3)' : color}
        strokeWidth={isSelected ? 2.5 : 2}
      />
      <text
        x={width / 2}
        y={height / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#92400e"
        fontSize="11"
        fontWeight="500"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {label}
      </text>
    </g>
  );
}

/**
 * Cloud Renderer - Cloud shape for source/sink outside system boundary
 */
function CloudNode({ element, stencil, isSelected }) {
  const width = element.size?.width || stencil.defaultSize.width;
  const height = element.size?.height || stencil.defaultSize.height;
  const color = element.color || stencil.color;

  // Create cloud shape using bezier curves
  const cx = width / 2;
  const cy = height / 2;

  return (
    <g>
      <ellipse
        cx={cx}
        cy={cy}
        rx={width / 2 - 2}
        ry={height / 2 - 2}
        fill="#f1f5f9"
        stroke={isSelected ? 'var(--accent, #0e74a3)' : color}
        strokeWidth={isSelected ? 2 : 1.5}
        strokeDasharray="4,2"
      />
      {/* Cloud bumps */}
      <circle cx={cx - width * 0.2} cy={cy - height * 0.1} r={width * 0.12} fill="#f1f5f9" stroke="none" />
      <circle cx={cx + width * 0.15} cy={cy - height * 0.12} r={width * 0.1} fill="#f1f5f9" stroke="none" />
    </g>
  );
}

/**
 * Reinforcing Loop Marker - Circle with R and curved arrow
 */
function ReinforcingLoopNode({ element, stencil, isSelected }) {
  const width = element.size?.width || stencil.defaultSize.width;
  const height = element.size?.height || stencil.defaultSize.height;
  const color = element.color || stencil.color;
  const label = element.label || 'R';
  const r = Math.min(width, height) / 2 - 2;
  const cx = width / 2;
  const cy = height / 2;

  // Curved arrow parameters
  const arrowR = r * 0.65;
  const arrowStartAngle = -45;
  const arrowEndAngle = 225;

  const startRad = (arrowStartAngle * Math.PI) / 180;
  const endRad = (arrowEndAngle * Math.PI) / 180;

  const x1 = cx + arrowR * Math.cos(startRad);
  const y1 = cy + arrowR * Math.sin(startRad);
  const x2 = cx + arrowR * Math.cos(endRad);
  const y2 = cy + arrowR * Math.sin(endRad);

  return (
    <g>
      {/* Outer circle */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="#fef2f2"
        stroke={isSelected ? 'var(--accent, #0e74a3)' : color}
        strokeWidth={isSelected ? 2.5 : 2}
      />
      {/* Curved arrow (clockwise) */}
      <path
        d={`M ${x1} ${y1} A ${arrowR} ${arrowR} 0 1 1 ${x2} ${y2}`}
        fill="none"
        stroke={color}
        strokeWidth={2}
        markerEnd="url(#cld-arrow-marker)"
      />
      {/* R label */}
      <text
        x={cx}
        y={cy + 1}
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontSize="14"
        fontWeight="700"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {label}
      </text>
      {/* Define arrow marker */}
      <defs>
        <marker
          id="cld-arrow-marker"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L6,3 L0,6 Z" fill={color} />
        </marker>
      </defs>
    </g>
  );
}

/**
 * Balancing Loop Marker - Circle with B and curved arrow (counter-clockwise)
 */
function BalancingLoopNode({ element, stencil, isSelected }) {
  const width = element.size?.width || stencil.defaultSize.width;
  const height = element.size?.height || stencil.defaultSize.height;
  const color = element.color || stencil.color;
  const label = element.label || 'B';
  const r = Math.min(width, height) / 2 - 2;
  const cx = width / 2;
  const cy = height / 2;

  // Curved arrow parameters (counter-clockwise)
  const arrowR = r * 0.65;
  const arrowStartAngle = 225;
  const arrowEndAngle = -45;

  const startRad = (arrowStartAngle * Math.PI) / 180;
  const endRad = (arrowEndAngle * Math.PI) / 180;

  const x1 = cx + arrowR * Math.cos(startRad);
  const y1 = cy + arrowR * Math.sin(startRad);
  const x2 = cx + arrowR * Math.cos(endRad);
  const y2 = cy + arrowR * Math.sin(endRad);

  return (
    <g>
      {/* Outer circle */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="#eff6ff"
        stroke={isSelected ? 'var(--accent, #0e74a3)' : color}
        strokeWidth={isSelected ? 2.5 : 2}
      />
      {/* Curved arrow (counter-clockwise) */}
      <path
        d={`M ${x1} ${y1} A ${arrowR} ${arrowR} 0 1 0 ${x2} ${y2}`}
        fill="none"
        stroke={color}
        strokeWidth={2}
        markerEnd="url(#cld-arrow-marker-b)"
      />
      {/* B label */}
      <text
        x={cx}
        y={cy + 1}
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontSize="14"
        fontWeight="700"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {label}
      </text>
      {/* Define arrow marker */}
      <defs>
        <marker
          id="cld-arrow-marker-b"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L6,3 L0,6 Z" fill={color} />
        </marker>
      </defs>
    </g>
  );
}

/**
 * Constant Renderer - Diamond shape
 */
function ConstantNode({ element, stencil, isSelected }) {
  const width = element.size?.width || stencil.defaultSize.width;
  const height = element.size?.height || stencil.defaultSize.height;
  const color = element.color || stencil.color;
  const label = element.label || '';

  return (
    <g>
      <polygon
        points={`
          ${width / 2},0
          ${width},${height / 2}
          ${width / 2},${height}
          0,${height / 2}
        `}
        fill="#f5f3ff"
        stroke={isSelected ? 'var(--accent, #0e74a3)' : color}
        strokeWidth={isSelected ? 2.5 : 2}
      />
      <text
        x={width / 2}
        y={height / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#6d28d9"
        fontSize="11"
        fontWeight="600"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {label}
      </text>
    </g>
  );
}

/**
 * Table Function Renderer - Rectangle with graph icon
 */
function TableFunctionNode({ element, stencil, isSelected }) {
  const width = element.size?.width || stencil.defaultSize.width;
  const height = element.size?.height || stencil.defaultSize.height;
  const color = element.color || stencil.color;
  const label = element.label || '';

  // Mini graph icon
  const graphPadding = 8;
  const graphHeight = height * 0.4;
  const graphY = height - graphPadding - graphHeight;

  return (
    <g>
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        rx={4}
        ry={4}
        fill="#ecfeff"
        stroke={isSelected ? 'var(--accent, #0e74a3)' : color}
        strokeWidth={isSelected ? 2.5 : 2}
      />
      {/* Mini chart icon */}
      <polyline
        points={`
          ${graphPadding},${graphY + graphHeight}
          ${graphPadding + width * 0.2},${graphY + graphHeight * 0.7}
          ${graphPadding + width * 0.4},${graphY + graphHeight * 0.3}
          ${graphPadding + width * 0.6},${graphY + graphHeight * 0.5}
          ${width - graphPadding},${graphY}
        `}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Label */}
      <text
        x={width / 2}
        y={height * 0.28}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#0891b2"
        fontSize="10"
        fontWeight="500"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {label}
      </text>
    </g>
  );
}

/**
 * System Boundary Renderer - Dashed container
 */
function SystemBoundaryNode({ element, stencil, isSelected }) {
  const width = element.size?.width || stencil.defaultSize.width;
  const height = element.size?.height || stencil.defaultSize.height;
  const color = element.color || stencil.color;
  const label = element.label || '';

  return (
    <g>
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        rx={8}
        ry={8}
        fill={color}
        fillOpacity={0.15}
        stroke={isSelected ? 'var(--accent, #0e74a3)' : '#6b7280'}
        strokeWidth={isSelected ? 2.5 : 2}
        strokeDasharray="12,6"
      />
      {label && (
        <text
          x={14}
          y={22}
          textAnchor="start"
          fill="#4b5563"
          fontSize="12"
          fontWeight="600"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {label}
        </text>
      )}
    </g>
  );
}

/**
 * Annotation Renderer - Note-style with folded corner
 */
function AnnotationNode({ element, stencil, isSelected }) {
  const width = element.size?.width || stencil.defaultSize.width;
  const height = element.size?.height || stencil.defaultSize.height;
  const color = element.color || stencil.color;
  const label = element.label || '';
  const fold = 12;

  return (
    <g>
      {/* Main shape with folded corner */}
      <path
        d={`
          M 0 0
          L ${width - fold} 0
          L ${width} ${fold}
          L ${width} ${height}
          L 0 ${height}
          Z
        `}
        fill={color}
        stroke={isSelected ? 'var(--accent, #0e74a3)' : '#d1d5db'}
        strokeWidth={isSelected ? 2 : 1}
      />
      {/* Fold line */}
      <path
        d={`M ${width - fold} 0 L ${width - fold} ${fold} L ${width} ${fold}`}
        fill="none"
        stroke="#d1d5db"
        strokeWidth={1}
      />
      <text
        x={width / 2}
        y={height / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#374151"
        fontSize="11"
        fontWeight="400"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {label}
      </text>
    </g>
  );
}

/**
 * Main render function for CLDPack
 */
function renderNode(element, stencil, isSelected) {
  if (!stencil) return null;

  const props = { element, stencil, isSelected };

  switch (stencil.id) {
    case 'variable':
      return <VariableNode {...props} />;
    case 'stock':
      return <StockNode {...props} />;
    case 'flow':
      return <FlowNode {...props} />;
    case 'cloud':
      return <CloudNode {...props} />;
    case 'reinforcing-loop':
      return <ReinforcingLoopNode {...props} />;
    case 'balancing-loop':
      return <BalancingLoopNode {...props} />;
    case 'constant':
      return <ConstantNode {...props} />;
    case 'table-function':
      return <TableFunctionNode {...props} />;
    case 'system-boundary':
      return <SystemBoundaryNode {...props} />;
    case 'annotation':
      return <AnnotationNode {...props} />;
    default:
      // Fallback to variable style
      return <VariableNode {...props} />;
  }
}

// ============ PACK EXPORT ============

const CLDPack = {
  id: 'cld',
  name: 'Causal Loop Diagram',
  description: 'System dynamics causal loop diagrams with polarity',
  icon: '🔄',
  stencils,
  connectionTypes,
  validators,
  templates,
  nodeProperties,
  renderNode,
  defaultLineStyle: 'curved', // CLD uses curved/bow lines for causal links
};

export default CLDPack;
export { stencils, connectionTypes, validators, templates, nodeProperties };
