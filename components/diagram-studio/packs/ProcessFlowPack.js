// components/diagram-studio/packs/ProcessFlowPack.js
// Unified Process Flows pack - combines BPMN and general process flow elements

import { StyledRectRenderer, getVariantTextColor } from '../styling';

// ============ STENCILS ============

const stencils = [
  // ==================== GROUP 1: TASKS & EVENTS ====================
  {
    id: 'start-event',
    name: 'Start',
    description: 'Start event - beginning of the process',
    group: 'Tasks & Events',
    shape: 'circle',
    icon: '▶',
    color: '#22c55e',
    defaultSize: { width: 44, height: 44 },
    ports: [
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
    ],
    isContainer: false,
  },
  {
    id: 'end-event',
    name: 'End',
    description: 'End event - termination of the process',
    group: 'Tasks & Events',
    shape: 'circle',
    icon: '⬤',
    color: '#ef4444',
    defaultSize: { width: 44, height: 44 },
    ports: [
      { id: 'left', position: 'left' },
      { id: 'top', position: 'top' },
    ],
    isContainer: false,
  },
  {
    id: 'task',
    name: 'Task',
    description: 'A unit of work to be performed',
    group: 'Tasks & Events',
    shape: 'rect',
    icon: '☐',
    color: '#3b82f6',
    defaultSize: { width: 140, height: 70 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
    properties: [
      { id: 'assignee', label: 'Assignee', type: 'text' },
      { id: 'duration', label: 'Duration', type: 'text' },
      { id: 'taskType', label: 'Task Type', type: 'select', options: [
        { value: 'manual', label: 'Manual' },
        { value: 'automated', label: 'Automated' },
        { value: 'user', label: 'User Task' },
        { value: 'service', label: 'Service Task' },
      ]},
    ],
  },
  {
    id: 'subprocess',
    name: 'Subprocess',
    description: 'A compound activity that references another process',
    group: 'Tasks & Events',
    shape: 'rect',
    icon: '⊞',
    color: '#8b5cf6',
    defaultSize: { width: 160, height: 80 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: true,
    properties: [
      { id: 'linkedProcess', label: 'Linked Process', type: 'text' },
      { id: 'collapsed', label: 'Collapsed', type: 'boolean' },
    ],
  },
  {
    id: 'intermediate-event',
    name: 'Intermediate',
    description: 'Intermediate event - something that happens during the process',
    group: 'Tasks & Events',
    shape: 'circle',
    icon: '◎',
    color: '#f59e0b',
    defaultSize: { width: 44, height: 44 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
    properties: [
      { id: 'eventType', label: 'Event Type', type: 'select', options: [
        { value: 'timer', label: 'Timer' },
        { value: 'message', label: 'Message' },
        { value: 'error', label: 'Error' },
        { value: 'signal', label: 'Signal' },
      ]},
    ],
  },

  // ==================== GROUP 2: FLOW CONTROL ====================
  {
    id: 'exclusive-gateway',
    name: 'Decision',
    description: 'Exclusive gateway - only one path can be taken (XOR)',
    group: 'Flow Control',
    shape: 'diamond',
    icon: '✕',
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
    id: 'parallel-gateway',
    name: 'Parallel',
    description: 'Parallel gateway - all paths are taken simultaneously (AND)',
    group: 'Flow Control',
    shape: 'diamond',
    icon: '+',
    color: '#22c55e',
    defaultSize: { width: 50, height: 50 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
  },
  {
    id: 'inclusive-gateway',
    name: 'Inclusive',
    description: 'Inclusive gateway - one or more paths can be taken (OR)',
    group: 'Flow Control',
    shape: 'diamond',
    icon: '○',
    color: '#8b5cf6',
    defaultSize: { width: 50, height: 50 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
  },
  {
    id: 'merge',
    name: 'Merge',
    description: 'Merge multiple paths back into one',
    group: 'Flow Control',
    shape: 'diamond',
    icon: '⋈',
    color: '#06b6d4',
    defaultSize: { width: 50, height: 50 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
  },

  // ==================== GROUP 3: ORGANIZATION ====================
  {
    id: 'pool',
    name: 'Pool',
    description: 'A container for a single process',
    group: 'Organization',
    shape: 'rect',
    icon: '▭',
    color: '#374151',
    defaultSize: { width: 600, height: 300 },
    ports: [],
    isContainer: true,
    properties: [
      { id: 'participant', label: 'Participant', type: 'text' },
    ],
  },
  {
    id: 'lane',
    name: 'Lane',
    description: 'A sub-partition within a pool (role/department)',
    group: 'Organization',
    shape: 'rect',
    icon: '▬',
    color: '#e5e7eb',
    defaultSize: { width: 500, height: 150 },
    ports: [],
    isContainer: true,
    properties: [
      { id: 'role', label: 'Role/Department', type: 'text' },
    ],
  },
  {
    id: 'data-object',
    name: 'Document',
    description: 'Information/data that flows through the process',
    group: 'Organization',
    shape: 'rect',
    icon: '📄',
    color: '#6b7280',
    defaultSize: { width: 50, height: 65 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
    properties: [
      { id: 'dataType', label: 'Data Type', type: 'text' },
    ],
  },
  {
    id: 'data-store',
    name: 'Database',
    description: 'A place to store data persistently',
    group: 'Organization',
    shape: 'rect',
    icon: '🗄',
    color: '#6b7280',
    defaultSize: { width: 70, height: 60 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
    properties: [
      { id: 'storeName', label: 'Store Name', type: 'text' },
    ],
  },
  {
    id: 'annotation',
    name: 'Note',
    description: 'Additional text annotation',
    group: 'Organization',
    shape: 'rect',
    icon: '📝',
    color: '#9ca3af',
    defaultSize: { width: 150, height: 60 },
    ports: [
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
  },
];

// ============ CONNECTION TYPES ============

const connectionTypes = [
  {
    id: 'sequence-flow',
    name: 'Sequence Flow',
    description: 'Normal flow between activities',
    style: 'solid',
    arrowStart: 'none',
    arrowEnd: 'arrow',
    color: '#374151',
  },
  {
    id: 'conditional-flow',
    name: 'Conditional Flow',
    description: 'Flow with a condition',
    style: 'solid',
    arrowStart: 'diamond',
    arrowEnd: 'arrow',
    color: '#f59e0b',
  },
  {
    id: 'default-flow',
    name: 'Default Flow',
    description: 'Default path from a gateway',
    style: 'solid',
    arrowStart: 'none',
    arrowEnd: 'arrow',
    color: '#374151',
    marker: 'slash',
  },
  {
    id: 'message-flow',
    name: 'Message Flow',
    description: 'Communication between pools',
    style: 'dashed',
    arrowStart: 'circle',
    arrowEnd: 'arrow',
    color: '#3b82f6',
  },
  {
    id: 'association',
    name: 'Association',
    description: 'Association with data or annotations',
    style: 'dotted',
    arrowStart: 'none',
    arrowEnd: 'none',
    color: '#9ca3af',
  },
];

// ============ VALIDATORS ============

const validators = [
  {
    id: 'has-start',
    name: 'Has Start Event',
    description: 'Process should have at least one start event',
    level: 'error',
    validate: (elements) => {
      const hasStart = elements.some(el => el.type === 'start-event');
      return hasStart ? null : { message: 'Process must have a start event' };
    },
  },
  {
    id: 'has-end',
    name: 'Has End Event',
    description: 'Process should have at least one end event',
    level: 'error',
    validate: (elements) => {
      const hasEnd = elements.some(el => el.type === 'end-event');
      return hasEnd ? null : { message: 'Process must have an end event' };
    },
  },
  {
    id: 'decision-has-outputs',
    name: 'Decision Has Multiple Outputs',
    description: 'Decision gateways should have at least 2 outgoing flows',
    level: 'warn',
    validate: (elements, connections) => {
      const decisions = elements.filter(el => el.type === 'exclusive-gateway');
      const issues = [];
      for (const dec of decisions) {
        const outgoing = connections.filter(c => c.sourceId === dec.id);
        if (outgoing.length < 2) {
          issues.push({
            elementId: dec.id,
            message: `Decision "${dec.label || dec.id}" should have at least 2 outgoing flows`,
          });
        }
      }
      return issues.length > 0 ? issues : null;
    },
  },
];

// ============ TEMPLATES ============

const templates = [
  {
    id: 'blank',
    name: 'Blank Process',
    description: 'Empty process flow diagram',
    thumbnail: null,
    elements: [],
    connections: [],
  },
  {
    id: 'simple-flow',
    name: 'Simple Flow',
    description: 'Basic start-task-end flow',
    thumbnail: null,
    elements: [
      { id: 'start1', type: 'start-event', label: 'Start', x: 100, y: 150, size: { width: 44, height: 44 } },
      { id: 'task1', type: 'task', label: 'Process Task', x: 200, y: 127, size: { width: 140, height: 70 } },
      { id: 'end1', type: 'end-event', label: 'End', x: 400, y: 150, size: { width: 44, height: 44 } },
    ],
    connections: [
      { id: 'conn1', sourceId: 'start1', targetId: 'task1', sourcePort: 'right', targetPort: 'left', type: 'sequence-flow' },
      { id: 'conn2', sourceId: 'task1', targetId: 'end1', sourcePort: 'right', targetPort: 'left', type: 'sequence-flow' },
    ],
  },
  {
    id: 'approval-workflow',
    name: 'Approval Workflow',
    description: 'Process with decision point for approval',
    thumbnail: null,
    elements: [
      { id: 'start1', type: 'start-event', label: 'Start', x: 50, y: 150, size: { width: 44, height: 44 } },
      { id: 'task1', type: 'task', label: 'Submit Request', x: 150, y: 127, size: { width: 140, height: 70 } },
      { id: 'task2', type: 'task', label: 'Review Request', x: 340, y: 127, size: { width: 140, height: 70 } },
      { id: 'dec1', type: 'exclusive-gateway', label: 'Approved?', x: 530, y: 145, size: { width: 50, height: 50 } },
      { id: 'task3', type: 'task', label: 'Process Approved', x: 650, y: 50, size: { width: 140, height: 70 } },
      { id: 'task4', type: 'task', label: 'Handle Rejection', x: 650, y: 220, size: { width: 140, height: 70 } },
      { id: 'end1', type: 'end-event', label: 'End', x: 850, y: 150, size: { width: 44, height: 44 } },
    ],
    connections: [
      { id: 'conn1', sourceId: 'start1', targetId: 'task1', sourcePort: 'right', targetPort: 'left', type: 'sequence-flow' },
      { id: 'conn2', sourceId: 'task1', targetId: 'task2', sourcePort: 'right', targetPort: 'left', type: 'sequence-flow' },
      { id: 'conn3', sourceId: 'task2', targetId: 'dec1', sourcePort: 'right', targetPort: 'left', type: 'sequence-flow' },
      { id: 'conn4', sourceId: 'dec1', targetId: 'task3', sourcePort: 'top', targetPort: 'left', type: 'conditional-flow', label: 'Yes' },
      { id: 'conn5', sourceId: 'dec1', targetId: 'task4', sourcePort: 'bottom', targetPort: 'left', type: 'conditional-flow', label: 'No' },
      { id: 'conn6', sourceId: 'task3', targetId: 'end1', sourcePort: 'right', targetPort: 'top', type: 'sequence-flow' },
      { id: 'conn7', sourceId: 'task4', targetId: 'end1', sourcePort: 'right', targetPort: 'bottom', type: 'sequence-flow' },
    ],
  },
];

// ============ NODE PROPERTIES ============

const nodeProperties = [
  { id: 'documentation', label: 'Documentation', type: 'textarea' },
  { id: 'performers', label: 'Performers', type: 'list' },
];

// ============ VISUAL RENDERERS ============

// Start Event (modern green circle with play icon)
function StartEventNode({ element, stencil }) {
  const { width, height } = element.size || stencil?.defaultSize || { width: 44, height: 44 };
  const color = element.color || stencil?.color || '#22c55e';
  const r = Math.min(width, height) / 2 - 4;
  const cx = width / 2;
  const cy = height / 2;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
        <defs>
          <filter id={`start-shadow-${element.id}`} x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor={color} floodOpacity="0.2" />
          </filter>
          <linearGradient id={`start-gradient-${element.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.1" />
            <stop offset="100%" stopColor={color} stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* Circle with shadow */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill={`url(#start-gradient-${element.id})`}
          stroke={color}
          strokeWidth="2.5"
          filter={`url(#start-shadow-${element.id})`}
        />

        {/* Play triangle */}
        <path
          d={`M ${cx - 4} ${cy - 7} L ${cx + 8} ${cy} L ${cx - 4} ${cy + 7} Z`}
          fill={color}
        />
      </svg>
    </div>
  );
}

// End Event (modern red circle with stop square)
function EndEventNode({ element, stencil }) {
  const { width, height } = element.size || stencil?.defaultSize || { width: 44, height: 44 };
  const color = element.color || stencil?.color || '#ef4444';
  const r = Math.min(width, height) / 2 - 4;
  const cx = width / 2;
  const cy = height / 2;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
        <defs>
          <filter id={`end-shadow-${element.id}`} x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor={color} floodOpacity="0.25" />
          </filter>
          <linearGradient id={`end-gradient-${element.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.1" />
            <stop offset="100%" stopColor={color} stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* Circle with thicker stroke (BPMN end event style) */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill={`url(#end-gradient-${element.id})`}
          stroke={color}
          strokeWidth="3"
          filter={`url(#end-shadow-${element.id})`}
        />

        {/* Stop square */}
        <rect
          x={cx - 6}
          y={cy - 6}
          width="12"
          height="12"
          fill={color}
          rx="2"
        />
      </svg>
    </div>
  );
}

// Intermediate Event (modern double circle)
function IntermediateEventNode({ element, stencil }) {
  const { width, height } = element.size || stencil?.defaultSize || { width: 44, height: 44 };
  const color = element.color || stencil?.color || '#f59e0b';
  const r = Math.min(width, height) / 2 - 4;
  const cx = width / 2;
  const cy = height / 2;
  const eventType = element.data?.eventType || 'timer';

  const getEventIcon = () => {
    switch (eventType) {
      case 'timer':
        return (
          <>
            <circle cx={cx} cy={cy} r="6" fill="none" stroke={color} strokeWidth="1.5" />
            <line x1={cx} y1={cy - 4} x2={cx} y2={cy} stroke={color} strokeWidth="1.5" strokeLinecap="round" />
            <line x1={cx} y1={cy} x2={cx + 3} y2={cy + 2} stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          </>
        );
      case 'message':
        return (
          <g>
            <rect x={cx - 6} y={cy - 4} width="12" height="8" fill="none" stroke={color} strokeWidth="1.5" rx="1" />
            <path d={`M ${cx - 5} ${cy - 3} L ${cx} ${cy} L ${cx + 5} ${cy - 3}`} fill="none" stroke={color} strokeWidth="1.5" />
          </g>
        );
      case 'error':
        return (
          <path
            d={`M ${cx - 5} ${cy + 5} L ${cx - 2} ${cy - 2} L ${cx + 2} ${cy + 2} L ${cx + 5} ${cy - 5}`}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      case 'signal':
        return (
          <polygon
            points={`${cx},${cy - 6} ${cx + 6},${cy + 4} ${cx - 6},${cy + 4}`}
            fill="none"
            stroke={color}
            strokeWidth="1.5"
          />
        );
      default:
        return null;
    }
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
        <defs>
          <filter id={`intermediate-shadow-${element.id}`} x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor={color} floodOpacity="0.2" />
          </filter>
        </defs>

        {/* Outer circle */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="white"
          stroke={color}
          strokeWidth="2"
          filter={`url(#intermediate-shadow-${element.id})`}
        />

        {/* Inner circle (intermediate event marker) */}
        <circle
          cx={cx}
          cy={cy}
          r={r - 3}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
        />

        {/* Event type icon */}
        {getEventIcon()}
      </svg>
    </div>
  );
}

// Task (modern rounded rectangle with style variant support)
function TaskNode({ element, stencil, isSelected }) {
  const label = element.label || element.name || '';
  const color = element.color || stencil?.color || '#3b82f6';
  const variant = element.styleVariant || 'floating';
  const taskType = element.data?.taskType || 'manual';

  // Get text color - use element's textColor if set, otherwise calculate from variant
  const textColor = element.textColor || getVariantTextColor(variant, color);
  const iconColor = variant === 'filled' ? 'white' : color;

  const getTaskIcon = () => {
    switch (taskType) {
      case 'user':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2">
            <circle cx="12" cy="8" r="4" />
            <path d="M6 21v-2a6 6 0 0 1 12 0v2" />
          </svg>
        );
      case 'service':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        );
      case 'automated':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <StyledRectRenderer element={element} stencil={stencil} isSelected={isSelected}>
      {/* Task type icon in top-right */}
      {taskType !== 'manual' && (
        <div style={{
          position: 'absolute',
          top: 8,
          right: 10,
          opacity: 0.7,
        }}>
          {getTaskIcon()}
        </div>
      )}

      {/* Label */}
      <div style={{
        fontSize: element.fontSize || 13,
        fontFamily: element.fontFamily || 'inherit',
        fontWeight: element.fontWeight || 500,
        fontStyle: element.fontStyle || 'normal',
        textDecoration: element.textDecoration || 'none',
        color: textColor,
        textAlign: element.textAlign || 'center',
        lineHeight: 1.3,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        paddingRight: taskType !== 'manual' ? 20 : 0,
        width: '100%',
      }}>
        {label}
      </div>
    </StyledRectRenderer>
  );
}

// Subprocess (modern task with expand marker)
function SubprocessNode({ element, stencil }) {
  const label = element.label || element.name || '';
  const { width, height } = element.size || stencil?.defaultSize || { width: 160, height: 80 };
  const color = element.color || stencil?.color || '#8b5cf6';

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
        <defs>
          <filter id={`subprocess-shadow-${element.id}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000000" floodOpacity="0.08" />
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#000000" floodOpacity="0.05" />
          </filter>
        </defs>

        {/* Main rectangle with shadow */}
        <rect
          x="3"
          y="3"
          width={width - 6}
          height={height - 6}
          rx="8"
          fill="white"
          filter={`url(#subprocess-shadow-${element.id})`}
        />

        {/* Left accent bar */}
        <rect
          x="3"
          y="3"
          width="4"
          height={height - 6}
          rx="4"
          fill={color}
        />
        <rect
          x="5"
          y="3"
          width="2"
          height={height - 6}
          fill={color}
        />

        {/* Dashed inner border for subprocess indication */}
        <rect
          x="10"
          y="8"
          width={width - 20}
          height={height - 28}
          rx="4"
          fill="none"
          stroke={color}
          strokeWidth="1"
          strokeDasharray="4,2"
          opacity="0.4"
        />

        {/* Border */}
        <rect
          x="3"
          y="3"
          width={width - 6}
          height={height - 6}
          rx="8"
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="1"
        />

        {/* Subprocess expand marker (bottom center) */}
        <rect
          x={width / 2 - 10}
          y={height - 16}
          width="20"
          height="12"
          rx="3"
          fill="white"
          stroke={color}
          strokeWidth="1.5"
        />
        <line x1={width / 2} y1={height - 13} x2={width / 2} y2={height - 7} stroke={color} strokeWidth="1.5" />
        <line x1={width / 2 - 4} y1={height - 10} x2={width / 2 + 4} y2={height - 10} stroke={color} strokeWidth="1.5" />
      </svg>

      {/* Content layer */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '10px 12px 22px 16px',
        boxSizing: 'border-box',
      }}>
        <div style={{
          fontSize: 13,
          fontWeight: 500,
          color: '#1f2937',
          textAlign: 'left',
          lineHeight: 1.3,
        }}>
          {label}
        </div>
      </div>
    </div>
  );
}

// Gateway (modern diamond shape with internal marker)
function GatewayNode({ element, stencil, gatewayType }) {
  const { width, height } = element.size || stencil?.defaultSize || { width: 50, height: 50 };
  const cx = width / 2;
  const cy = height / 2;

  const colors = {
    exclusive: '#f59e0b',
    parallel: '#22c55e',
    inclusive: '#8b5cf6',
    merge: '#06b6d4',
  };
  const color = colors[gatewayType] || '#f59e0b';

  const getMarker = () => {
    switch (gatewayType) {
      case 'exclusive':
        return (
          <>
            <line x1={cx - 7} y1={cy - 7} x2={cx + 7} y2={cy + 7} stroke={color} strokeWidth="2.5" strokeLinecap="round" />
            <line x1={cx + 7} y1={cy - 7} x2={cx - 7} y2={cy + 7} stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          </>
        );
      case 'parallel':
        return (
          <>
            <line x1={cx} y1={cy - 8} x2={cx} y2={cy + 8} stroke={color} strokeWidth="2.5" strokeLinecap="round" />
            <line x1={cx - 8} y1={cy} x2={cx + 8} y2={cy} stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          </>
        );
      case 'inclusive':
        return (
          <circle cx={cx} cy={cy} r="7" fill="none" stroke={color} strokeWidth="2.5" />
        );
      case 'merge':
        return (
          <path d={`M ${cx - 6} ${cy - 4} L ${cx} ${cy + 4} L ${cx + 6} ${cy - 4}`} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        );
      default:
        return null;
    }
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
        <defs>
          <filter id={`gateway-shadow-${element.id}`} x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000000" floodOpacity="0.1" />
          </filter>
        </defs>

        {/* Diamond with shadow */}
        <polygon
          points={`${cx},4 ${width - 4},${cy} ${cx},${height - 4} 4,${cy}`}
          fill="white"
          filter={`url(#gateway-shadow-${element.id})`}
        />

        {/* Diamond border */}
        <polygon
          points={`${cx},4 ${width - 4},${cy} ${cx},${height - 4} 4,${cy}`}
          fill="white"
          stroke={color}
          strokeWidth="2"
        />

        {/* Inner marker */}
        {getMarker()}
      </svg>
    </div>
  );
}

// Pool/Lane (swimlane container)
function SwimLaneNode({ element, stencil, isPool }) {
  const label = element.label || element.name || '';
  const { width, height } = element.size || stencil?.defaultSize || { width: 600, height: 300 };
  const color = isPool ? '#374151' : '#9ca3af';
  const headerWidth = 30;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
        <rect
          x="1"
          y="1"
          width={width - 2}
          height={height - 2}
          fill="white"
          fillOpacity="0.5"
          stroke={color}
          strokeWidth={isPool ? "2" : "1"}
          rx="4"
        />
        {/* Header section */}
        <rect
          x="1"
          y="1"
          width={headerWidth}
          height={height - 2}
          fill={isPool ? color : '#f3f4f6'}
          fillOpacity={isPool ? 1 : 1}
          rx="4"
        />
        <line x1={headerWidth} y1="1" x2={headerWidth} y2={height - 1} stroke={color} strokeWidth="1" />
      </svg>

      {/* Vertical label */}
      <div style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: headerWidth,
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          transform: 'rotate(-90deg)',
          whiteSpace: 'nowrap',
          fontSize: 12,
          fontWeight: 600,
          color: isPool ? 'white' : '#374151',
        }}>
          {label}
        </div>
      </div>
    </div>
  );
}

// Data Object (document shape)
function DataObjectNode({ element, stencil }) {
  const label = element.label || element.name || '';
  const { width, height } = element.size || stencil?.defaultSize || { width: 50, height: 65 };
  const color = element.color || stencil?.color || '#6b7280';
  const fold = 10;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
        <path
          d={`M 2 2 L ${width - fold - 2} 2 L ${width - 2} ${fold + 2} L ${width - 2} ${height - 2} L 2 ${height - 2} Z`}
          fill="white"
          stroke={color}
          strokeWidth="1.5"
        />
        <path
          d={`M ${width - fold - 2} 2 L ${width - fold - 2} ${fold + 2} L ${width - 2} ${fold + 2}`}
          fill={color}
          fillOpacity="0.2"
          stroke={color}
          strokeWidth="1"
        />
      </svg>

      <div style={{
        position: 'absolute',
        bottom: 4,
        left: 0,
        right: 0,
        textAlign: 'center',
        fontSize: 9,
        color: '#374151',
      }}>
        {label}
      </div>
    </div>
  );
}

// Data Store (cylinder)
function DataStoreNode({ element, stencil }) {
  const label = element.label || element.name || '';
  const { width, height } = element.size || stencil?.defaultSize || { width: 70, height: 60 };
  const color = element.color || stencil?.color || '#6b7280';

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
        <path
          d={`M 2 12 Q 2 2 ${width / 2} 2 Q ${width - 2} 2 ${width - 2} 12 L ${width - 2} ${height - 12} Q ${width - 2} ${height - 2} ${width / 2} ${height - 2} Q 2 ${height - 2} 2 ${height - 12} Z`}
          fill="white"
          stroke={color}
          strokeWidth="1.5"
        />
        <ellipse
          cx={width / 2}
          cy="12"
          rx={width / 2 - 2}
          ry="10"
          fill="white"
          stroke={color}
          strokeWidth="1.5"
        />
      </svg>

      <div style={{
        position: 'absolute',
        top: '55%',
        left: 0,
        right: 0,
        textAlign: 'center',
        fontSize: 10,
        color: '#374151',
      }}>
        {label}
      </div>
    </div>
  );
}

// Annotation (bracket with text)
function AnnotationNode({ element }) {
  const label = element.label || '';
  const { width, height } = element.size || { width: 150, height: 60 };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
        <path
          d={`M 10 2 L 2 2 L 2 ${height - 2} L 10 ${height - 2}`}
          fill="none"
          stroke="#9ca3af"
          strokeWidth="1.5"
        />
      </svg>

      <div style={{
        position: 'absolute',
        left: 14,
        top: 0,
        bottom: 0,
        right: 0,
        display: 'flex',
        alignItems: 'center',
        fontSize: 12,
        color: '#6b7280',
        fontStyle: 'italic',
      }}>
        {label}
      </div>
    </div>
  );
}

// Main render function
function renderNode(element, stencil, isSelected) {
  const type = element.type;

  switch (type) {
    case 'start-event':
      return <StartEventNode element={element} stencil={stencil} />;
    case 'end-event':
      return <EndEventNode element={element} stencil={stencil} />;
    case 'intermediate-event':
      return <IntermediateEventNode element={element} stencil={stencil} />;
    case 'task':
      return <TaskNode element={element} stencil={stencil} isSelected={isSelected} />;
    case 'subprocess':
      return <SubprocessNode element={element} stencil={stencil} />;
    case 'exclusive-gateway':
      return <GatewayNode element={element} stencil={stencil} gatewayType="exclusive" />;
    case 'parallel-gateway':
      return <GatewayNode element={element} stencil={stencil} gatewayType="parallel" />;
    case 'inclusive-gateway':
      return <GatewayNode element={element} stencil={stencil} gatewayType="inclusive" />;
    case 'merge':
      return <GatewayNode element={element} stencil={stencil} gatewayType="merge" />;
    case 'pool':
      return <SwimLaneNode element={element} stencil={stencil} isPool={true} />;
    case 'lane':
      return <SwimLaneNode element={element} stencil={stencil} isPool={false} />;
    case 'data-object':
      return <DataObjectNode element={element} stencil={stencil} />;
    case 'data-store':
      return <DataStoreNode element={element} stencil={stencil} />;
    case 'annotation':
      return <AnnotationNode element={element} />;
    default:
      return null;
  }
}

// ============ PACK EXPORT ============

const ProcessFlowPack = {
  id: 'process-flow',
  name: 'Process Flows',
  description: 'Process flow diagrams with tasks, events, gateways, and swimlanes',
  icon: '📊',
  stencils,
  connectionTypes,
  validators,
  templates,
  nodeProperties,
  renderNode,
  defaultLineStyle: 'step', // Process flow uses orthogonal/step lines
};

export default ProcessFlowPack;
export { stencils, connectionTypes, validators, templates, nodeProperties, renderNode };
