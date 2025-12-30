// components/diagram-studio/packs/ITILPack.js
// ITIL 4 IT Service Management Pack

// ============ STENCILS ============

const stencils = [
  // ==================== SERVICE VALUE CHAIN ====================
  {
    id: 'svc-engage',
    name: 'Engage',
    description: 'Understanding stakeholder needs and maintaining relationships',
    group: 'Service Value Chain',
    shape: 'rect',
    icon: '🤝',
    color: '#3b82f6',
    defaultSize: { width: 140, height: 70 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
  },
  {
    id: 'svc-plan',
    name: 'Plan',
    description: 'Ensuring shared understanding of vision and direction',
    group: 'Service Value Chain',
    shape: 'rect',
    icon: '📋',
    color: '#8b5cf6',
    defaultSize: { width: 140, height: 70 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
  },
  {
    id: 'svc-design',
    name: 'Design & Transition',
    description: 'Ensuring products meet stakeholder expectations',
    group: 'Service Value Chain',
    shape: 'rect',
    icon: '🎨',
    color: '#ec4899',
    defaultSize: { width: 140, height: 70 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
  },
  {
    id: 'svc-obtain',
    name: 'Obtain/Build',
    description: 'Ensuring service components are available',
    group: 'Service Value Chain',
    shape: 'rect',
    icon: '🔧',
    color: '#f59e0b',
    defaultSize: { width: 140, height: 70 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
  },
  {
    id: 'svc-deliver',
    name: 'Deliver & Support',
    description: 'Ensuring services are delivered and supported',
    group: 'Service Value Chain',
    shape: 'rect',
    icon: '🚀',
    color: '#22c55e',
    defaultSize: { width: 140, height: 70 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
  },
  {
    id: 'svc-improve',
    name: 'Improve',
    description: 'Ensuring continual improvement of services',
    group: 'Service Value Chain',
    shape: 'rect',
    icon: '📈',
    color: '#06b6d4',
    defaultSize: { width: 140, height: 70 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
  },

  // ==================== SERVICE MANAGEMENT ====================
  {
    id: 'service',
    name: 'Service',
    description: 'IT Service that delivers value',
    group: 'Service Management',
    shape: 'rect',
    icon: '⚙️',
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
      { id: 'serviceType', label: 'Service Type', type: 'select', options: [
        { value: 'business', label: 'Business Service' },
        { value: 'technical', label: 'Technical Service' },
        { value: 'supporting', label: 'Supporting Service' },
      ]},
      { id: 'criticality', label: 'Criticality', type: 'select', options: [
        { value: 'critical', label: 'Critical' },
        { value: 'high', label: 'High' },
        { value: 'medium', label: 'Medium' },
        { value: 'low', label: 'Low' },
      ]},
      { id: 'slaTarget', label: 'SLA Target', type: 'text' },
    ],
  },
  {
    id: 'practice',
    name: 'Practice',
    description: 'ITIL Practice or capability',
    group: 'Service Management',
    shape: 'rect',
    icon: '📚',
    color: '#8b5cf6',
    defaultSize: { width: 160, height: 80 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
    properties: [
      { id: 'practiceType', label: 'Practice Type', type: 'select', options: [
        { value: 'general', label: 'General Management' },
        { value: 'service', label: 'Service Management' },
        { value: 'technical', label: 'Technical Management' },
      ]},
    ],
  },
  {
    id: 'process',
    name: 'Process',
    description: 'Documented process or procedure',
    group: 'Service Management',
    shape: 'rect',
    icon: '🔄',
    color: '#22c55e',
    defaultSize: { width: 160, height: 80 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
    properties: [
      { id: 'owner', label: 'Process Owner', type: 'text' },
      { id: 'status', label: 'Status', type: 'select', options: [
        { value: 'active', label: 'Active' },
        { value: 'draft', label: 'Draft' },
        { value: 'deprecated', label: 'Deprecated' },
      ]},
    ],
  },

  // ==================== INCIDENT & PROBLEM ====================
  {
    id: 'incident',
    name: 'Incident',
    description: 'Unplanned interruption to a service',
    group: 'Incident & Problem',
    shape: 'rect',
    icon: '⚠️',
    color: '#ef4444',
    defaultSize: { width: 140, height: 70 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
    properties: [
      { id: 'priority', label: 'Priority', type: 'select', options: [
        { value: 'p1', label: 'P1 - Critical' },
        { value: 'p2', label: 'P2 - High' },
        { value: 'p3', label: 'P3 - Medium' },
        { value: 'p4', label: 'P4 - Low' },
      ]},
      { id: 'impact', label: 'Impact', type: 'select', options: [
        { value: 'high', label: 'High' },
        { value: 'medium', label: 'Medium' },
        { value: 'low', label: 'Low' },
      ]},
    ],
  },
  {
    id: 'problem',
    name: 'Problem',
    description: 'Root cause of one or more incidents',
    group: 'Incident & Problem',
    shape: 'rect',
    icon: '🔍',
    color: '#f59e0b',
    defaultSize: { width: 140, height: 70 },
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
        { value: 'investigating', label: 'Investigating' },
        { value: 'known-error', label: 'Known Error' },
        { value: 'resolved', label: 'Resolved' },
      ]},
    ],
  },
  {
    id: 'known-error',
    name: 'Known Error',
    description: 'Problem with documented root cause and workaround',
    group: 'Incident & Problem',
    shape: 'rect',
    icon: '📋',
    color: '#6b7280',
    defaultSize: { width: 140, height: 70 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
    properties: [
      { id: 'workaround', label: 'Workaround', type: 'textarea' },
    ],
  },

  // ==================== CHANGE MANAGEMENT ====================
  {
    id: 'change-request',
    name: 'Change Request',
    description: 'Request for change to the IT environment',
    group: 'Change Management',
    shape: 'rect',
    icon: '📝',
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
      { id: 'changeType', label: 'Change Type', type: 'select', options: [
        { value: 'standard', label: 'Standard' },
        { value: 'normal', label: 'Normal' },
        { value: 'emergency', label: 'Emergency' },
      ]},
      { id: 'risk', label: 'Risk Level', type: 'select', options: [
        { value: 'high', label: 'High' },
        { value: 'medium', label: 'Medium' },
        { value: 'low', label: 'Low' },
      ]},
    ],
  },
  {
    id: 'release',
    name: 'Release',
    description: 'Collection of changes deployed together',
    group: 'Change Management',
    shape: 'rect',
    icon: '📦',
    color: '#22c55e',
    defaultSize: { width: 140, height: 70 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
    properties: [
      { id: 'version', label: 'Version', type: 'text' },
      { id: 'releaseDate', label: 'Release Date', type: 'text' },
    ],
  },

  // ==================== CONFIGURATION ====================
  {
    id: 'ci',
    name: 'Configuration Item',
    description: 'Component that needs to be managed',
    group: 'Configuration',
    shape: 'rect',
    icon: '🖥️',
    color: '#8b5cf6',
    defaultSize: { width: 140, height: 70 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
    properties: [
      { id: 'ciType', label: 'CI Type', type: 'select', options: [
        { value: 'hardware', label: 'Hardware' },
        { value: 'software', label: 'Software' },
        { value: 'network', label: 'Network' },
        { value: 'document', label: 'Document' },
        { value: 'service', label: 'Service' },
      ]},
      { id: 'status', label: 'Status', type: 'select', options: [
        { value: 'active', label: 'Active' },
        { value: 'planned', label: 'Planned' },
        { value: 'retired', label: 'Retired' },
      ]},
      { id: 'owner', label: 'Owner', type: 'text' },
    ],
  },
  {
    id: 'cmdb',
    name: 'CMDB',
    description: 'Configuration Management Database',
    group: 'Configuration',
    shape: 'rect',
    icon: '🗄️',
    color: '#06b6d4',
    defaultSize: { width: 200, height: 150 },
    ports: [],
    isContainer: true,
  },

  // ==================== STAKEHOLDERS ====================
  {
    id: 'stakeholder',
    name: 'Stakeholder',
    description: 'Person or organization with interest in the service',
    group: 'Stakeholders',
    shape: 'rect',
    icon: '👤',
    color: '#3b82f6',
    defaultSize: { width: 80, height: 100 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
    properties: [
      { id: 'role', label: 'Role', type: 'text' },
      { id: 'organization', label: 'Organization', type: 'text' },
    ],
  },
  {
    id: 'team',
    name: 'Team',
    description: 'Group responsible for service delivery',
    group: 'Stakeholders',
    shape: 'rect',
    icon: '👥',
    color: '#22c55e',
    defaultSize: { width: 160, height: 80 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
    properties: [
      { id: 'teamType', label: 'Team Type', type: 'select', options: [
        { value: 'support', label: 'Support Team' },
        { value: 'development', label: 'Development Team' },
        { value: 'operations', label: 'Operations Team' },
        { value: 'security', label: 'Security Team' },
      ]},
    ],
  },

  // ==================== ANNOTATIONS ====================
  {
    id: 'sla',
    name: 'SLA',
    description: 'Service Level Agreement',
    group: 'Annotations',
    shape: 'rect',
    icon: '📜',
    color: '#f59e0b',
    defaultSize: { width: 120, height: 60 },
    ports: [
      { id: 'left', position: 'left' },
      { id: 'right', position: 'right' },
    ],
    isContainer: false,
    properties: [
      { id: 'target', label: 'Target', type: 'text', placeholder: '99.9%' },
      { id: 'metric', label: 'Metric', type: 'text', placeholder: 'Availability' },
    ],
  },
  {
    id: 'kpi',
    name: 'KPI',
    description: 'Key Performance Indicator',
    group: 'Annotations',
    shape: 'rect',
    icon: '📊',
    color: '#22c55e',
    defaultSize: { width: 120, height: 60 },
    ports: [
      { id: 'left', position: 'left' },
      { id: 'right', position: 'right' },
    ],
    isContainer: false,
    properties: [
      { id: 'value', label: 'Value', type: 'text' },
      { id: 'target', label: 'Target', type: 'text' },
    ],
  },
];

// ============ CONNECTION TYPES ============

const connectionTypes = [
  {
    id: 'depends-on',
    name: 'Depends On',
    description: 'Dependency relationship',
    style: 'solid',
    arrowStart: 'none',
    arrowEnd: 'arrow',
    color: '#374151',
  },
  {
    id: 'supports',
    name: 'Supports',
    description: 'Supporting relationship',
    style: 'solid',
    arrowStart: 'none',
    arrowEnd: 'arrow',
    color: '#22c55e',
  },
  {
    id: 'triggers',
    name: 'Triggers',
    description: 'Triggering relationship',
    style: 'dashed',
    arrowStart: 'none',
    arrowEnd: 'arrow',
    color: '#f59e0b',
  },
  {
    id: 'escalates-to',
    name: 'Escalates To',
    description: 'Escalation path',
    style: 'dashed',
    arrowStart: 'none',
    arrowEnd: 'arrow',
    color: '#ef4444',
  },
  {
    id: 'relates-to',
    name: 'Relates To',
    description: 'General relationship',
    style: 'dotted',
    arrowStart: 'none',
    arrowEnd: 'none',
    color: '#6b7280',
  },
  {
    id: 'contains',
    name: 'Contains',
    description: 'Containment relationship',
    style: 'solid',
    arrowStart: 'diamond-filled',
    arrowEnd: 'none',
    color: '#374151',
  },
  {
    id: 'input-output',
    name: 'Input/Output',
    description: 'Data or value flow',
    style: 'solid',
    arrowStart: 'none',
    arrowEnd: 'arrow',
    color: '#3b82f6',
  },
];

// ============ TEMPLATES ============

const templates = [
  {
    id: 'blank',
    name: 'Blank ITIL Diagram',
    description: 'Empty ITIL diagram',
    thumbnail: null,
    elements: [],
    connections: [],
  },
  {
    id: 'service-value-chain',
    name: 'Service Value Chain',
    description: 'ITIL 4 Service Value Chain',
    thumbnail: null,
    elements: [
      { id: 'plan', type: 'svc-plan', label: 'Plan', x: 300, y: 50, size: { width: 140, height: 70 } },
      { id: 'improve', type: 'svc-improve', label: 'Improve', x: 300, y: 300, size: { width: 140, height: 70 } },
      { id: 'engage', type: 'svc-engage', label: 'Engage', x: 50, y: 175, size: { width: 140, height: 70 } },
      { id: 'design', type: 'svc-design', label: 'Design & Transition', x: 250, y: 175, size: { width: 140, height: 70 } },
      { id: 'obtain', type: 'svc-obtain', label: 'Obtain/Build', x: 450, y: 175, size: { width: 140, height: 70 } },
      { id: 'deliver', type: 'svc-deliver', label: 'Deliver & Support', x: 650, y: 175, size: { width: 140, height: 70 } },
    ],
    connections: [
      { id: 'c1', sourceId: 'engage', targetId: 'design', type: 'input-output' },
      { id: 'c2', sourceId: 'design', targetId: 'obtain', type: 'input-output' },
      { id: 'c3', sourceId: 'obtain', targetId: 'deliver', type: 'input-output' },
      { id: 'c4', sourceId: 'plan', targetId: 'design', type: 'supports' },
      { id: 'c5', sourceId: 'improve', targetId: 'design', type: 'supports' },
    ],
  },
  {
    id: 'incident-management',
    name: 'Incident Management Flow',
    description: 'Basic incident management process',
    thumbnail: null,
    elements: [
      { id: 'i1', type: 'incident', label: 'Incident Detected', x: 50, y: 100, size: { width: 140, height: 70 } },
      { id: 'p1', type: 'process', label: 'Triage', x: 250, y: 100, size: { width: 140, height: 70 } },
      { id: 'p2', type: 'process', label: 'Investigation', x: 450, y: 100, size: { width: 140, height: 70 } },
      { id: 'p3', type: 'process', label: 'Resolution', x: 650, y: 100, size: { width: 140, height: 70 } },
      { id: 'prob', type: 'problem', label: 'Problem Record', x: 450, y: 250, size: { width: 140, height: 70 } },
    ],
    connections: [
      { id: 'c1', sourceId: 'i1', targetId: 'p1', type: 'triggers' },
      { id: 'c2', sourceId: 'p1', targetId: 'p2', type: 'input-output' },
      { id: 'c3', sourceId: 'p2', targetId: 'p3', type: 'input-output' },
      { id: 'c4', sourceId: 'p2', targetId: 'prob', type: 'triggers', label: 'If root cause unknown' },
    ],
  },
];

// ============ CUSTOM RENDERERS ============

// Service Value Chain Activity Renderer
function SVCActivityRenderer({ element, stencil }) {
  const color = element.color || stencil?.color || '#3b82f6';
  const icon = stencil?.icon || '⚙️';

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: `linear-gradient(135deg, ${color}15, ${color}30)`,
      border: `2px solid ${color}`,
      borderRadius: 8,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      padding: 8,
      boxSizing: 'border-box',
    }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 600, textAlign: 'center', color: 'var(--text)' }}>
        {element.label || stencil?.name}
      </span>
    </div>
  );
}

// Service Renderer
function ServiceRenderer({ element, stencil }) {
  const color = element.color || stencil?.color || '#3b82f6';
  const serviceType = element.data?.serviceType || 'business';
  const criticality = element.data?.criticality;

  const critColors = {
    critical: '#ef4444',
    high: '#f59e0b',
    medium: '#22c55e',
    low: '#6b7280',
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: 'white',
      border: `2px solid ${color}`,
      borderRadius: 8,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{
        background: color,
        color: 'white',
        padding: '6px 10px',
        fontSize: 11,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span>⚙️ {serviceType.toUpperCase()}</span>
        {criticality && (
          <span style={{
            background: critColors[criticality],
            padding: '2px 6px',
            borderRadius: 4,
            fontSize: 9,
          }}>
            {criticality.toUpperCase()}
          </span>
        )}
      </div>
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 8,
        fontSize: 13,
        fontWeight: 500,
        textAlign: 'center',
      }}>
        {element.label || 'Service'}
      </div>
    </div>
  );
}

// Incident Renderer
function IncidentRenderer({ element, stencil }) {
  const priority = element.data?.priority || 'p3';
  const colors = {
    p1: '#ef4444',
    p2: '#f59e0b',
    p3: '#3b82f6',
    p4: '#6b7280',
  };
  const color = colors[priority];

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: `linear-gradient(135deg, ${color}15, ${color}30)`,
      border: `2px solid ${color}`,
      borderRadius: 8,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{
        background: color,
        color: 'white',
        padding: '4px 8px',
        fontSize: 10,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}>
        <span>⚠️</span>
        <span>{priority.toUpperCase()}</span>
      </div>
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 6,
        fontSize: 12,
        fontWeight: 500,
        textAlign: 'center',
      }}>
        {element.label || 'Incident'}
      </div>
    </div>
  );
}

// Problem Renderer
function ProblemRenderer({ element, stencil }) {
  const status = element.data?.status || 'open';
  const statusColors = {
    open: '#ef4444',
    investigating: '#f59e0b',
    'known-error': '#6b7280',
    resolved: '#22c55e',
  };
  const color = statusColors[status];

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: 'white',
      border: `2px solid ${color}`,
      borderRadius: 8,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{
        background: color,
        color: 'white',
        padding: '4px 8px',
        fontSize: 10,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}>
        <span>🔍</span>
        <span>{status.replace('-', ' ').toUpperCase()}</span>
      </div>
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 6,
        fontSize: 12,
        fontWeight: 500,
        textAlign: 'center',
      }}>
        {element.label || 'Problem'}
      </div>
    </div>
  );
}

// CI Renderer
function CIRenderer({ element, stencil }) {
  const ciType = element.data?.ciType || 'hardware';
  const color = element.color || stencil?.color || '#8b5cf6';
  const icons = {
    hardware: '🖥️',
    software: '💿',
    network: '🌐',
    document: '📄',
    service: '⚙️',
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: `linear-gradient(135deg, ${color}10, ${color}25)`,
      border: `2px solid ${color}`,
      borderRadius: 8,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      padding: 8,
      boxSizing: 'border-box',
    }}>
      <span style={{ fontSize: 18 }}>{icons[ciType]}</span>
      <span style={{ fontSize: 11, fontWeight: 600, textAlign: 'center', color: 'var(--text)' }}>
        {element.label || 'CI'}
      </span>
      <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
        {ciType}
      </span>
    </div>
  );
}

// Stakeholder Renderer (stick figure)
function StakeholderRenderer({ element, stencil }) {
  const color = element.color || stencil?.color || '#3b82f6';

  return (
    <svg width="100%" height="100%" viewBox="0 0 80 100" style={{ overflow: 'visible' }}>
      {/* Head */}
      <circle cx="40" cy="18" r="14" fill="none" stroke={color} strokeWidth="2" />
      {/* Body */}
      <line x1="40" y1="32" x2="40" y2="60" stroke={color} strokeWidth="2" />
      {/* Arms */}
      <line x1="20" y1="45" x2="60" y2="45" stroke={color} strokeWidth="2" />
      {/* Left leg */}
      <line x1="40" y1="60" x2="25" y2="85" stroke={color} strokeWidth="2" />
      {/* Right leg */}
      <line x1="40" y1="60" x2="55" y2="85" stroke={color} strokeWidth="2" />
      {/* Label */}
      <text x="40" y="98" textAnchor="middle" fontSize="10" fill="var(--text)">
        {element.label || 'Stakeholder'}
      </text>
    </svg>
  );
}

// Main render function
function renderNode(element, stencil, isSelected) {
  switch (element.type) {
    case 'svc-engage':
    case 'svc-plan':
    case 'svc-design':
    case 'svc-obtain':
    case 'svc-deliver':
    case 'svc-improve':
      return <SVCActivityRenderer element={element} stencil={stencil} />;
    case 'service':
      return <ServiceRenderer element={element} stencil={stencil} />;
    case 'incident':
      return <IncidentRenderer element={element} stencil={stencil} />;
    case 'problem':
    case 'known-error':
      return <ProblemRenderer element={element} stencil={stencil} />;
    case 'ci':
      return <CIRenderer element={element} stencil={stencil} />;
    case 'stakeholder':
      return <StakeholderRenderer element={element} stencil={stencil} />;
    default:
      return null;
  }
}

// ============ PACK EXPORT ============

const ITILPack = {
  id: 'itil',
  name: 'ITIL Service Management',
  description: 'ITIL 4 IT Service Management diagrams',
  icon: '🔧',
  stencils,
  connectionTypes,
  templates,
  renderNode,
  defaultLineStyle: 'step', // ITIL uses orthogonal service flow lines
};

export default ITILPack;
export { stencils, connectionTypes, templates };
