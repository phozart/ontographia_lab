import { stencils, connectionTypes, COLORS, CAP_MATURITY_LEVELS, CAP_STRATEGIC_IMPORTANCE, CAP_INVESTMENT_LEVEL } from './catalog/capability-map';
// components/diagram-studio/packs/CapabilityMapPack.js
// Capability Map Pack - Stencils for capability modeling and operating model design

// ============ CAPABILITY TYPES ============




// ============ COLORS ============


// ============ STENCILS ============


// ============ CONNECTION TYPES ============


// ============ VALIDATORS ============

const validators = [
  {
    id: 'capability-has-name',
    name: 'Capabilities Have Names',
    description: 'All capabilities should have a descriptive name',
    level: 'warning',
    validate: (elements) => {
      const unnamed = elements.filter(
        el => el.type?.startsWith('cap-') && !el.label?.trim() && !el.isZone
      );
      if (unnamed.length > 0) {
        return unnamed.map(el => ({
          elementId: el.id,
          message: 'Capability element should have a name',
        }));
      }
      return null;
    },
  },
  {
    id: 'capability-has-maturity',
    name: 'Capabilities Have Maturity',
    description: 'Capabilities should have maturity level assessed',
    level: 'info',
    validate: (elements) => {
      const unassessed = elements.filter(
        el => el.type === 'cap-capability' && !el.data?.maturity
      );
      if (unassessed.length > 0) {
        return unassessed.map(el => ({
          elementId: el.id,
          message: 'Capability should have maturity level assessed',
        }));
      }
      return null;
    },
  },
  {
    id: 'gap-has-severity',
    name: 'Gaps Have Severity',
    description: 'Gaps should have severity level',
    level: 'warning',
    validate: (elements) => {
      const unrated = elements.filter(
        el => el.type === 'cap-gap' && !el.data?.severity
      );
      if (unrated.length > 0) {
        return unrated.map(el => ({
          elementId: el.id,
          message: 'Gap should have severity level',
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
    name: 'Blank Capability Map',
    description: 'Empty canvas for capability mapping',
    thumbnail: null,
    elements: [],
    connections: [],
  },
  {
    id: 'basic-capability-map',
    name: 'Basic Capability Map',
    description: 'Simple three-level capability hierarchy',
    thumbnail: null,
    elements: [
      { id: 'g1', type: 'cap-capability-group', label: 'Customer Domain', x: 50, y: 50, size: { width: 300, height: 250 } },
      { id: 'c1', type: 'cap-capability', label: 'Customer Acquisition', x: 70, y: 100, size: { width: 160, height: 80 } },
      { id: 'c2', type: 'cap-capability', label: 'Customer Onboarding', x: 70, y: 200, size: { width: 160, height: 80 } },
      { id: 'g2', type: 'cap-capability-group', label: 'Operations Domain', x: 400, y: 50, size: { width: 300, height: 250 } },
      { id: 'c3', type: 'cap-capability', label: 'Order Management', x: 420, y: 100, size: { width: 160, height: 80 } },
      { id: 'c4', type: 'cap-capability', label: 'Fulfillment', x: 420, y: 200, size: { width: 160, height: 80 } },
    ],
    connections: [
      { id: 'conn1', sourceId: 'c1', targetId: 'c2', type: 'enables' },
      { id: 'conn2', sourceId: 'c2', targetId: 'c3', type: 'enables' },
      { id: 'conn3', sourceId: 'c3', targetId: 'c4', type: 'depends-on' },
    ],
  },
  {
    id: 'value-stream-map',
    name: 'Value Stream Map',
    description: 'End-to-end value stream with capability mapping',
    thumbnail: null,
    elements: [
      { id: 'vs1', type: 'cap-value-stream', label: 'Order-to-Cash', x: 50, y: 50, size: { width: 700, height: 60 } },
      { id: 'st1', type: 'cap-value-stage', label: 'Order', x: 70, y: 140, size: { width: 140, height: 50 } },
      { id: 'st2', type: 'cap-value-stage', label: 'Fulfill', x: 230, y: 140, size: { width: 140, height: 50 } },
      { id: 'st3', type: 'cap-value-stage', label: 'Ship', x: 390, y: 140, size: { width: 140, height: 50 } },
      { id: 'st4', type: 'cap-value-stage', label: 'Invoice', x: 550, y: 140, size: { width: 140, height: 50 } },
      { id: 'c1', type: 'cap-capability', label: 'Order Management', x: 70, y: 220, size: { width: 140, height: 60 } },
      { id: 'c2', type: 'cap-capability', label: 'Inventory Mgmt', x: 230, y: 220, size: { width: 140, height: 60 } },
      { id: 'c3', type: 'cap-capability', label: 'Logistics', x: 390, y: 220, size: { width: 140, height: 60 } },
      { id: 'c4', type: 'cap-capability', label: 'Billing', x: 550, y: 220, size: { width: 140, height: 60 } },
    ],
    connections: [
      { id: 'f1', sourceId: 'st1', targetId: 'st2', type: 'flows-to' },
      { id: 'f2', sourceId: 'st2', targetId: 'st3', type: 'flows-to' },
      { id: 'f3', sourceId: 'st3', targetId: 'st4', type: 'flows-to' },
      { id: 's1', sourceId: 'c1', targetId: 'st1', type: 'supports' },
      { id: 's2', sourceId: 'c2', targetId: 'st2', type: 'supports' },
      { id: 's3', sourceId: 'c3', targetId: 'st3', type: 'supports' },
      { id: 's4', sourceId: 'c4', targetId: 'st4', type: 'supports' },
    ],
  },
  {
    id: 'maturity-assessment',
    name: 'Maturity Assessment View',
    description: 'Capabilities with assessments and gaps',
    thumbnail: null,
    elements: [
      { id: 'c1', type: 'cap-capability', label: 'Customer Data Mgmt', x: 50, y: 50, size: { width: 160, height: 80 }, data: { maturity: 'developing' } },
      { id: 'c2', type: 'cap-capability', label: 'Analytics', x: 250, y: 50, size: { width: 160, height: 80 }, data: { maturity: 'initial' } },
      { id: 'c3', type: 'cap-capability', label: 'Reporting', x: 450, y: 50, size: { width: 160, height: 80 }, data: { maturity: 'managed' } },
      { id: 'a1', type: 'cap-assessment', label: 'Q4 Assessment', x: 50, y: 170, size: { width: 140, height: 70 }, data: { currentScore: 'developing', targetScore: 'managed' } },
      { id: 'g1', type: 'cap-gap', label: 'Data Quality Gap', x: 250, y: 170, size: { width: 140, height: 70 }, data: { severity: 'high' } },
      { id: 'i1', type: 'cap-initiative', label: 'Data Quality Program', x: 150, y: 280, size: { width: 160, height: 70 }, data: { status: 'approved', priority: 'high' } },
    ],
    connections: [
      { id: 'as1', sourceId: 'a1', targetId: 'c1', type: 'assesses' },
      { id: 'ig1', sourceId: 'a1', targetId: 'g1', type: 'identifies-gap' },
      { id: 'ad1', sourceId: 'i1', targetId: 'g1', type: 'addresses' },
      { id: 'dv1', sourceId: 'i1', targetId: 'c1', type: 'develops' },
    ],
  },
];

// ============ NODE PROPERTIES ============

const nodeProperties = [
  { id: 'documentation', label: 'Documentation', type: 'textarea' },
  { id: 'owner', label: 'Owner', type: 'text' },
  {
    id: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'draft', label: 'Draft' },
      { value: 'in_review', label: 'In Review' },
      { value: 'validated', label: 'Validated' },
      { value: 'archived', label: 'Archived' },
    ]
  },
];

// ============ CUSTOM NODE RENDERER ============

function CapabilityNode({ element, stencil, isSelected }) {
  const type = element.type;
  const label = element.label || element.name || '';
  const { width, height } = element.size || stencil?.defaultSize || { width: 120, height: 60 };
  const data = element.data || {};

  // Get maturity color for capabilities
  const getMaturityColor = () => {
    if (type === 'cap-capability' && data.maturity) {
      const level = CAP_MATURITY_LEVELS.find(l => l.id === data.maturity);
      return level?.color || stencil?.color || COLORS.capability;
    }
    return stencil?.color || COLORS.capability;
  };

  // Get severity color for gaps
  const getSeverityColor = () => {
    if (type === 'cap-gap' && data.severity) {
      const colors = {
        low: '#10b981',
        medium: '#f59e0b',
        high: '#ca8a04',
        critical: '#dc2626',
      };
      return colors[data.severity] || COLORS.gap;
    }
    return stencil?.color || COLORS.gap;
  };

  const baseColor = type === 'cap-capability' ? getMaturityColor() :
                   type === 'cap-gap' ? getSeverityColor() :
                   stencil?.color || '#0e74a3';

  // Chevron shape for value streams
  if (type === 'cap-value-stream' || type === 'cap-value-stage') {
    const point = 15;
    return (
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
          <path
            d={`M 2 2 L ${width - point - 2} 2 L ${width - 2} ${height / 2} L ${width - point - 2} ${height - 2} L 2 ${height - 2} L ${point + 2} ${height / 2} Z`}
            fill={`${baseColor}20`}
            stroke={baseColor}
            strokeWidth="2"
          />
        </svg>
        <div style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          paddingLeft: point + 8,
          paddingRight: point + 8,
        }}>
          <span style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#1f2937',
            textAlign: 'center',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>{label}</span>
        </div>
      </div>
    );
  }

  // Container shape for groups and swimlanes
  if (stencil?.isContainer && (type === 'cap-capability-group' || type === 'cap-swimlane' || type === 'cap-operating-model')) {
    return (
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
          <rect
            x="2"
            y="2"
            width={width - 4}
            height={height - 4}
            rx="4"
            fill={`${baseColor}08`}
            stroke={baseColor}
            strokeWidth="2"
            strokeDasharray={type === 'cap-swimlane' ? '8 4' : 'none'}
          />
          <rect
            x="2"
            y="2"
            width={width - 4}
            height="28"
            rx="4"
            fill={`${baseColor}15`}
          />
        </svg>
        <div style={{
          position: 'relative',
          zIndex: 1,
          padding: '6px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <span style={{ fontSize: 14 }}>{stencil?.icon || '📁'}</span>
          <span style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#1f2937',
          }}>{label}</span>
        </div>
      </div>
    );
  }

  // Sticky note for annotations
  if (type === 'cap-annotation') {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        background: '#fef3c7',
        borderRadius: 4,
        padding: 8,
        boxShadow: '2px 2px 4px rgba(0,0,0,0.1)',
      }}>
        <span style={{
          fontSize: 11,
          color: '#78716c',
          whiteSpace: 'pre-wrap',
        }}>{label || data.content || ''}</span>
      </div>
    );
  }

  // Default card rendering for capabilities and other elements
  return (
    <div style={{
      width: '100%',
      height: '100%',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: 8,
    }}>
      <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
        <rect
          x="2"
          y="2"
          width={width - 4}
          height={height - 4}
          rx="6"
          fill="#ffffff"
          stroke={baseColor}
          strokeWidth="2"
        />
        {/* Color indicator bar */}
        <rect
          x="2"
          y="2"
          width="4"
          height={height - 4}
          fill={baseColor}
          rx="2"
        />
      </svg>
      <div style={{
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        paddingLeft: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14 }}>{stencil?.icon || '🎯'}</span>
          <span style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#1f2937',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}>{label}</span>
        </div>
        {/* Show maturity badge for capabilities */}
        {type === 'cap-capability' && data.maturity && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}>
            <span style={{
              fontSize: 9,
              padding: '2px 6px',
              borderRadius: 10,
              backgroundColor: `${getMaturityColor()}20`,
              color: getMaturityColor(),
              fontWeight: 600,
            }}>
              {CAP_MATURITY_LEVELS.find(l => l.id === data.maturity)?.label || data.maturity}
            </span>
          </div>
        )}
        {/* Show severity badge for gaps */}
        {type === 'cap-gap' && data.severity && (
          <span style={{
            fontSize: 9,
            padding: '2px 6px',
            borderRadius: 10,
            backgroundColor: `${getSeverityColor()}20`,
            color: getSeverityColor(),
            fontWeight: 600,
            alignSelf: 'flex-start',
          }}>
            {data.severity.charAt(0).toUpperCase() + data.severity.slice(1)}
          </span>
        )}
      </div>
    </div>
  );
}

function renderNode(element, stencil, isSelected) {
  return <CapabilityNode element={element} stencil={stencil} isSelected={isSelected} />;
}

// ============ PACK EXPORT ============

const CapabilityMapPack = {
  id: 'capability-map',
  name: 'Capability Map',
  description: 'Business capability modeling and operating model design',
  icon: '🎯',
  stencils,
  connectionTypes,
  validators,
  templates,
  nodeProperties,
  renderNode,
  defaultLineStyle: 'step', // Capability maps use orthogonal dependency lines
};

export default CapabilityMapPack;
export { stencils, connectionTypes, validators, templates, nodeProperties, renderNode };
