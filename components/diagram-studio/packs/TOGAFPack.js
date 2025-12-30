// components/diagram-studio/packs/TOGAFPack.js
// TOGAF/ArchiMate Enterprise Architecture pack

// ============ STENCILS ============

const stencils = [
  // ============ BUSINESS LAYER ============
  {
    id: 'business-actor',
    name: 'Business Actor',
    description: 'A business entity that is capable of performing behavior',
    group: 'Business',
    shape: 'rect',
    icon: '👤',
    color: '#fbbf24',
    defaultSize: { width: 120, height: 60 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    properties: [
      { id: 'externalId', label: 'External ID', type: 'text' },
      { id: 'description', label: 'Description', type: 'textarea' },
    ],
  },
  {
    id: 'business-role',
    name: 'Business Role',
    description: 'The responsibility for performing specific behavior',
    group: 'Business',
    shape: 'rect',
    icon: '🎭',
    color: '#fbbf24',
    defaultSize: { width: 120, height: 60 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
  },
  {
    id: 'business-process',
    name: 'Business Process',
    description: 'A sequence of business behaviors',
    group: 'Business',
    shape: 'rect',
    icon: '⚙️',
    color: '#fbbf24',
    defaultSize: { width: 140, height: 60 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    properties: [
      { id: 'processId', label: 'Process ID', type: 'text' },
      { id: 'owner', label: 'Process Owner', type: 'text' },
    ],
  },
  {
    id: 'business-function',
    name: 'Business Function',
    description: 'A collection of business behavior',
    group: 'Business',
    shape: 'rect',
    icon: '📦',
    color: '#fbbf24',
    defaultSize: { width: 140, height: 60 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
  },
  {
    id: 'business-service',
    name: 'Business Service',
    description: 'An explicitly defined exposed business behavior',
    group: 'Business',
    shape: 'rect',
    icon: '🔶',
    color: '#fbbf24',
    defaultSize: { width: 140, height: 50 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
  },
  {
    id: 'business-object',
    name: 'Business Object',
    description: 'A concept used within a particular business domain',
    group: 'Business',
    shape: 'rect',
    icon: '📋',
    color: '#fbbf24',
    defaultSize: { width: 120, height: 60 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
  },
  {
    id: 'product',
    name: 'Product',
    description: 'A coherent collection of services and/or objects',
    group: 'Business',
    shape: 'rect',
    icon: '🎁',
    color: '#fbbf24',
    defaultSize: { width: 140, height: 80 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: true,
  },
  {
    id: 'contract',
    name: 'Contract',
    description: 'A formal agreement between parties',
    group: 'Business',
    shape: 'rect',
    icon: '📜',
    color: '#fbbf24',
    defaultSize: { width: 120, height: 60 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
  },

  // ============ APPLICATION LAYER ============
  {
    id: 'application-component',
    name: 'Application Component',
    description: 'An encapsulation of application functionality',
    group: 'Application',
    shape: 'rect',
    icon: '💻',
    color: '#60a5fa',
    defaultSize: { width: 140, height: 70 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    properties: [
      { id: 'version', label: 'Version', type: 'text' },
      { id: 'vendor', label: 'Vendor', type: 'text' },
      { id: 'technology', label: 'Technology', type: 'text' },
    ],
  },
  {
    id: 'application-service',
    name: 'Application Service',
    description: 'An explicitly defined exposed application behavior',
    group: 'Application',
    shape: 'rect',
    icon: '🔷',
    color: '#60a5fa',
    defaultSize: { width: 140, height: 50 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
  },
  {
    id: 'application-interface',
    name: 'Application Interface',
    description: 'A point of access for application services',
    group: 'Application',
    shape: 'rect',
    icon: '🔌',
    color: '#60a5fa',
    defaultSize: { width: 100, height: 50 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    properties: [
      { id: 'protocol', label: 'Protocol', type: 'text' },
      { id: 'apiVersion', label: 'API Version', type: 'text' },
    ],
  },
  {
    id: 'application-function',
    name: 'Application Function',
    description: 'Automated behavior that an application can perform',
    group: 'Application',
    shape: 'rect',
    icon: '⚡',
    color: '#60a5fa',
    defaultSize: { width: 140, height: 60 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
  },
  {
    id: 'data-object',
    name: 'Data Object',
    description: 'Data structured for automated processing',
    group: 'Application',
    shape: 'rect',
    icon: '🗃️',
    color: '#60a5fa',
    defaultSize: { width: 120, height: 60 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
  },

  // ============ TECHNOLOGY LAYER ============
  {
    id: 'node',
    name: 'Node',
    description: 'A computational resource upon which artifacts may be deployed',
    group: 'Technology',
    shape: 'rect',
    icon: '🖥️',
    color: '#34d399',
    defaultSize: { width: 140, height: 70 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: true,
    properties: [
      { id: 'hostname', label: 'Hostname', type: 'text' },
      { id: 'os', label: 'Operating System', type: 'text' },
    ],
  },
  {
    id: 'device',
    name: 'Device',
    description: 'A physical IT resource upon which artifacts may be deployed',
    group: 'Technology',
    shape: 'rect',
    icon: '📱',
    color: '#34d399',
    defaultSize: { width: 120, height: 60 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    properties: [
      { id: 'deviceType', label: 'Device Type', type: 'text' },
      { id: 'manufacturer', label: 'Manufacturer', type: 'text' },
    ],
  },
  {
    id: 'system-software',
    name: 'System Software',
    description: 'Software that provides or contributes to an environment',
    group: 'Technology',
    shape: 'rect',
    icon: '⚙️',
    color: '#34d399',
    defaultSize: { width: 140, height: 60 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    properties: [
      { id: 'version', label: 'Version', type: 'text' },
    ],
  },
  {
    id: 'technology-service',
    name: 'Technology Service',
    description: 'An explicitly defined technology capability',
    group: 'Technology',
    shape: 'rect',
    icon: '🔹',
    color: '#34d399',
    defaultSize: { width: 140, height: 50 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
  },
  {
    id: 'artifact',
    name: 'Artifact',
    description: 'A piece of data used or produced in a software development process',
    group: 'Technology',
    shape: 'rect',
    icon: '📄',
    color: '#34d399',
    defaultSize: { width: 100, height: 60 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
  },
  {
    id: 'communication-network',
    name: 'Communication Network',
    description: 'A set of structures connecting nodes',
    group: 'Technology',
    shape: 'rect',
    icon: '🌐',
    color: '#34d399',
    defaultSize: { width: 160, height: 40 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    properties: [
      { id: 'networkType', label: 'Network Type', type: 'text' },
      { id: 'bandwidth', label: 'Bandwidth', type: 'text' },
    ],
  },

  // ============ MOTIVATION LAYER ============
  {
    id: 'stakeholder',
    name: 'Stakeholder',
    description: 'The role of an individual, team, or organization',
    group: 'Motivation',
    shape: 'rect',
    icon: '👥',
    color: '#c084fc',
    defaultSize: { width: 120, height: 60 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
  },
  {
    id: 'driver',
    name: 'Driver',
    description: 'An external or internal condition that motivates change',
    group: 'Motivation',
    shape: 'rect',
    icon: '🎯',
    color: '#c084fc',
    defaultSize: { width: 120, height: 60 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
  },
  {
    id: 'assessment',
    name: 'Assessment',
    description: 'The result of an analysis of the state of affairs',
    group: 'Motivation',
    shape: 'rect',
    icon: '📊',
    color: '#c084fc',
    defaultSize: { width: 120, height: 60 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
  },
  {
    id: 'goal',
    name: 'Goal',
    description: 'A high-level statement of intent or direction',
    group: 'Motivation',
    shape: 'rect',
    icon: '🏆',
    color: '#c084fc',
    defaultSize: { width: 120, height: 60 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    properties: [
      { id: 'priority', label: 'Priority', type: 'select', options: [
        { value: 'high', label: 'High' },
        { value: 'medium', label: 'Medium' },
        { value: 'low', label: 'Low' },
      ]},
    ],
  },
  {
    id: 'outcome',
    name: 'Outcome',
    description: 'An end result that has been achieved',
    group: 'Motivation',
    shape: 'rect',
    icon: '✅',
    color: '#c084fc',
    defaultSize: { width: 120, height: 60 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
  },
  {
    id: 'principle',
    name: 'Principle',
    description: 'A qualitative statement of intent',
    group: 'Motivation',
    shape: 'rect',
    icon: '📐',
    color: '#c084fc',
    defaultSize: { width: 120, height: 60 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
  },
  {
    id: 'requirement',
    name: 'Requirement',
    description: 'A statement of need that must be met',
    group: 'Motivation',
    shape: 'rect',
    icon: '📝',
    color: '#c084fc',
    defaultSize: { width: 120, height: 60 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    properties: [
      { id: 'type', label: 'Type', type: 'select', options: [
        { value: 'functional', label: 'Functional' },
        { value: 'non-functional', label: 'Non-Functional' },
        { value: 'constraint', label: 'Constraint' },
      ]},
    ],
  },
  {
    id: 'constraint',
    name: 'Constraint',
    description: 'An external factor that limits the realization of goals',
    group: 'Motivation',
    shape: 'rect',
    icon: '⛔',
    color: '#c084fc',
    defaultSize: { width: 120, height: 60 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
  },

  // ============ STRATEGY LAYER ============
  {
    id: 'resource',
    name: 'Resource',
    description: 'An asset owned or controlled by an individual or organization',
    group: 'Strategy',
    shape: 'rect',
    icon: '💎',
    color: '#f472b6',
    defaultSize: { width: 120, height: 60 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
  },
  {
    id: 'capability',
    name: 'Capability',
    description: 'An ability that an active structure element possesses',
    group: 'Strategy',
    shape: 'rect',
    icon: '💪',
    color: '#f472b6',
    defaultSize: { width: 140, height: 60 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    properties: [
      { id: 'maturity', label: 'Maturity Level', type: 'select', options: [
        { value: '1', label: 'Initial' },
        { value: '2', label: 'Managed' },
        { value: '3', label: 'Defined' },
        { value: '4', label: 'Quantitatively Managed' },
        { value: '5', label: 'Optimizing' },
      ]},
    ],
  },
  {
    id: 'value-stream',
    name: 'Value Stream',
    description: 'A sequence of activities that create a result for a customer',
    group: 'Strategy',
    shape: 'rect',
    icon: '➡️',
    color: '#f472b6',
    defaultSize: { width: 160, height: 50 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
  },
  {
    id: 'course-of-action',
    name: 'Course of Action',
    description: 'An approach or plan for configuring capabilities',
    group: 'Strategy',
    shape: 'rect',
    icon: '🗺️',
    color: '#f472b6',
    defaultSize: { width: 140, height: 60 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
  },

  // ============ IMPLEMENTATION LAYER ============
  {
    id: 'work-package',
    name: 'Work Package',
    description: 'A series of actions to achieve a specific result',
    group: 'Implementation',
    shape: 'rect',
    icon: '📦',
    color: '#fb923c',
    defaultSize: { width: 140, height: 60 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    properties: [
      { id: 'status', label: 'Status', type: 'select', options: [
        { value: 'planned', label: 'Planned' },
        { value: 'in-progress', label: 'In Progress' },
        { value: 'completed', label: 'Completed' },
      ]},
    ],
  },
  {
    id: 'deliverable',
    name: 'Deliverable',
    description: 'A precisely-defined outcome of a work package',
    group: 'Implementation',
    shape: 'rect',
    icon: '📋',
    color: '#fb923c',
    defaultSize: { width: 120, height: 60 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
  },
  {
    id: 'plateau',
    name: 'Plateau',
    description: 'A relatively stable state of the architecture',
    group: 'Implementation',
    shape: 'rect',
    icon: '🏔️',
    color: '#fb923c',
    defaultSize: { width: 200, height: 100 },
    ports: [],
    isContainer: true,
    properties: [
      { id: 'targetDate', label: 'Target Date', type: 'text' },
    ],
  },
  {
    id: 'gap',
    name: 'Gap',
    description: 'A statement of difference between two plateaus',
    group: 'Implementation',
    shape: 'rect',
    icon: '⚠️',
    color: '#fb923c',
    defaultSize: { width: 120, height: 60 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
  },

  // ============ GROUPING ============
  {
    id: 'grouping',
    name: 'Grouping',
    description: 'A grouping of elements',
    group: 'Composite',
    shape: 'rect',
    icon: '▢',
    color: '#94a3b8',
    defaultSize: { width: 250, height: 180 },
    ports: [],
    isContainer: true,
  },
  {
    id: 'location',
    name: 'Location',
    description: 'A place or position',
    group: 'Composite',
    shape: 'rect',
    icon: '📍',
    color: '#94a3b8',
    defaultSize: { width: 200, height: 150 },
    ports: [],
    isContainer: true,
    properties: [
      { id: 'address', label: 'Address', type: 'text' },
    ],
  },
];

// ============ CONNECTION TYPES ============

const connectionTypes = [
  // Structural relationships
  {
    id: 'composition',
    name: 'Composition',
    description: 'Indicates that an element consists of other elements',
    style: 'solid',
    arrowStart: 'diamond-filled',
    arrowEnd: 'none',
    color: '#374151',
  },
  {
    id: 'aggregation',
    name: 'Aggregation',
    description: 'Indicates that an element combines other elements',
    style: 'solid',
    arrowStart: 'diamond-empty',
    arrowEnd: 'none',
    color: '#374151',
  },
  {
    id: 'assignment',
    name: 'Assignment',
    description: 'Links units of behavior with active elements',
    style: 'solid',
    arrowStart: 'none',
    arrowEnd: 'filled-circle',
    color: '#374151',
  },
  {
    id: 'realization',
    name: 'Realization',
    description: 'Indicates that an entity realizes another entity',
    style: 'dashed',
    arrowStart: 'none',
    arrowEnd: 'triangle-empty',
    color: '#374151',
  },
  // Dependency relationships
  {
    id: 'serving',
    name: 'Serving (Used By)',
    description: 'A service is provided to another element',
    style: 'solid',
    arrowStart: 'none',
    arrowEnd: 'arrow',
    color: '#374151',
  },
  {
    id: 'access',
    name: 'Access',
    description: 'The ability of behavior to observe or act upon data',
    style: 'dashed',
    arrowStart: 'none',
    arrowEnd: 'arrow',
    color: '#6b7280',
  },
  {
    id: 'influence',
    name: 'Influence',
    description: 'An element affects implementation of a motivation element',
    style: 'dashed',
    arrowStart: 'none',
    arrowEnd: 'arrow',
    color: '#9ca3af',
  },
  // Dynamic relationships
  {
    id: 'triggering',
    name: 'Triggering',
    description: 'A temporal or causal relationship',
    style: 'solid',
    arrowStart: 'none',
    arrowEnd: 'arrow',
    color: '#374151',
  },
  {
    id: 'flow',
    name: 'Flow',
    description: 'Transfer from one element to another',
    style: 'dashed',
    arrowStart: 'none',
    arrowEnd: 'arrow',
    color: '#374151',
  },
  // Other relationships
  {
    id: 'specialization',
    name: 'Specialization',
    description: 'An element is a specialization of another element',
    style: 'solid',
    arrowStart: 'none',
    arrowEnd: 'triangle-empty',
    color: '#374151',
  },
  {
    id: 'association',
    name: 'Association',
    description: 'A relationship not covered by other relationships',
    style: 'solid',
    arrowStart: 'none',
    arrowEnd: 'none',
    color: '#6b7280',
  },
];

// ============ VALIDATORS ============

const validators = [
  {
    id: 'element-has-name',
    name: 'Elements Have Names',
    description: 'All elements should have a name',
    level: 'warning',
    validate: (elements) => {
      const unnamed = elements.filter(el => !el.label?.trim() && !el.isZone);
      if (unnamed.length > 0) {
        return unnamed.map(el => ({
          elementId: el.id,
          message: 'Element should have a name',
        }));
      }
      return null;
    },
  },
  {
    id: 'layer-separation',
    name: 'Layer Separation',
    description: 'Relationships should respect layer boundaries',
    level: 'info',
    validate: (elements, connections) => {
      const getLayer = (type) => {
        if (['business-actor', 'business-role', 'business-process', 'business-function', 'business-service', 'business-object', 'product', 'contract'].includes(type)) return 'business';
        if (['application-component', 'application-service', 'application-interface', 'application-function', 'data-object'].includes(type)) return 'application';
        if (['node', 'device', 'system-software', 'technology-service', 'artifact', 'communication-network'].includes(type)) return 'technology';
        if (['stakeholder', 'driver', 'assessment', 'goal', 'outcome', 'principle', 'requirement', 'constraint'].includes(type)) return 'motivation';
        if (['resource', 'capability', 'value-stream', 'course-of-action'].includes(type)) return 'strategy';
        return 'other';
      };

      const violations = [];
      connections.forEach(conn => {
        const source = elements.find(el => el.id === conn.sourceId);
        const target = elements.find(el => el.id === conn.targetId);
        if (!source || !target) return;

        const sourceLayer = getLayer(source.type);
        const targetLayer = getLayer(target.type);

        // Allow same layer, motivation to any, strategy to any
        if (sourceLayer === targetLayer) return;
        if (sourceLayer === 'motivation' || targetLayer === 'motivation') return;
        if (sourceLayer === 'strategy' || targetLayer === 'strategy') return;
        if (sourceLayer === 'other' || targetLayer === 'other') return;

        violations.push({
          connectionId: conn.id,
          message: `Cross-layer relationship: ${sourceLayer} → ${targetLayer}`,
        });
      });

      return violations.length > 0 ? violations : null;
    },
  },
];

// ============ TEMPLATES ============

const templates = [
  {
    id: 'blank',
    name: 'Blank EA Diagram',
    description: 'Empty enterprise architecture diagram',
    thumbnail: null,
    elements: [],
    connections: [],
  },
  {
    id: 'application-landscape',
    name: 'Application Landscape',
    description: 'Overview of application components and services',
    thumbnail: null,
    elements: [
      { id: 'a1', type: 'application-component', label: 'CRM System', x: 50, y: 100, size: { width: 140, height: 70 } },
      { id: 'a2', type: 'application-component', label: 'ERP System', x: 250, y: 100, size: { width: 140, height: 70 } },
      { id: 'a3', type: 'application-component', label: 'Web Portal', x: 450, y: 100, size: { width: 140, height: 70 } },
      { id: 's1', type: 'application-service', label: 'Customer Service', x: 50, y: 220, size: { width: 140, height: 50 } },
      { id: 's2', type: 'application-service', label: 'Order Service', x: 250, y: 220, size: { width: 140, height: 50 } },
      { id: 's3', type: 'application-service', label: 'Portal Service', x: 450, y: 220, size: { width: 140, height: 50 } },
    ],
    connections: [
      { id: 'c1', sourceId: 'a1', targetId: 's1', type: 'realization' },
      { id: 'c2', sourceId: 'a2', targetId: 's2', type: 'realization' },
      { id: 'c3', sourceId: 'a3', targetId: 's3', type: 'realization' },
      { id: 'c4', sourceId: 's3', targetId: 's1', type: 'serving' },
      { id: 'c5', sourceId: 's3', targetId: 's2', type: 'serving' },
    ],
  },
  {
    id: 'capability-map',
    name: 'Capability Map',
    description: 'Business capability overview',
    thumbnail: null,
    elements: [
      { id: 'c1', type: 'capability', label: 'Customer Management', x: 50, y: 50, size: { width: 180, height: 60 } },
      { id: 'c2', type: 'capability', label: 'Product Management', x: 280, y: 50, size: { width: 180, height: 60 } },
      { id: 'c3', type: 'capability', label: 'Order Fulfillment', x: 510, y: 50, size: { width: 180, height: 60 } },
      { id: 'c4', type: 'capability', label: 'Financial Management', x: 50, y: 150, size: { width: 180, height: 60 } },
      { id: 'c5', type: 'capability', label: 'Supply Chain', x: 280, y: 150, size: { width: 180, height: 60 } },
      { id: 'c6', type: 'capability', label: 'Human Resources', x: 510, y: 150, size: { width: 180, height: 60 } },
    ],
    connections: [],
  },
  {
    id: 'technology-stack',
    name: 'Technology Stack',
    description: 'Infrastructure and technology view',
    thumbnail: null,
    elements: [
      { id: 'n1', type: 'node', label: 'Web Server', x: 200, y: 50, size: { width: 140, height: 70 } },
      { id: 'n2', type: 'node', label: 'App Server', x: 200, y: 160, size: { width: 140, height: 70 } },
      { id: 'n3', type: 'node', label: 'DB Server', x: 200, y: 270, size: { width: 140, height: 70 } },
      { id: 'net', type: 'communication-network', label: 'Corporate Network', x: 50, y: 380, size: { width: 340, height: 40 } },
      { id: 's1', type: 'system-software', label: 'Nginx', x: 400, y: 50, size: { width: 120, height: 50 } },
      { id: 's2', type: 'system-software', label: 'Java Runtime', x: 400, y: 160, size: { width: 120, height: 50 } },
      { id: 's3', type: 'system-software', label: 'PostgreSQL', x: 400, y: 270, size: { width: 120, height: 50 } },
    ],
    connections: [
      { id: 'c1', sourceId: 'n1', targetId: 'n2', type: 'serving' },
      { id: 'c2', sourceId: 'n2', targetId: 'n3', type: 'serving' },
      { id: 'c3', sourceId: 's1', targetId: 'n1', type: 'assignment' },
      { id: 'c4', sourceId: 's2', targetId: 'n2', type: 'assignment' },
      { id: 'c5', sourceId: 's3', targetId: 'n3', type: 'assignment' },
    ],
  },
];

// ============ NODE PROPERTIES ============

const nodeProperties = [
  { id: 'documentation', label: 'Documentation', type: 'textarea' },
  { id: 'owner', label: 'Owner', type: 'text' },
  { id: 'status', label: 'Status', type: 'select', options: [
    { value: 'current', label: 'Current' },
    { value: 'target', label: 'Target' },
    { value: 'transitional', label: 'Transitional' },
    { value: 'retired', label: 'Retired' },
  ]},
];

// ============ LAYER COLORS ============

const LAYER_COLORS = {
  business: { fill: '#fffbeb', stroke: '#fbbf24', icon: '#d97706' },
  application: { fill: '#eff6ff', stroke: '#60a5fa', icon: '#2563eb' },
  technology: { fill: '#ecfdf5', stroke: '#34d399', icon: '#059669' },
  motivation: { fill: '#faf5ff', stroke: '#c084fc', icon: '#9333ea' },
  strategy: { fill: '#fdf2f8', stroke: '#f472b6', icon: '#db2777' },
  implementation: { fill: '#fff7ed', stroke: '#fb923c', icon: '#ea580c' },
  composite: { fill: '#f8fafc', stroke: '#94a3b8', icon: '#64748b' },
};

// ============ SVG ICON COMPONENTS ============

// Actor (stick figure)
function ActorIcon({ color, size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
      <circle cx="12" cy="5" r="3" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="12" y1="16" x2="8" y2="22" />
      <line x1="12" y1="16" x2="16" y2="22" />
      <line x1="6" y1="11" x2="18" y2="11" />
    </svg>
  );
}

// Role (circle with role indicator)
function RoleIcon({ color, size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
      <circle cx="12" cy="10" r="6" />
      <path d="M8 18 Q12 22 16 18" />
    </svg>
  );
}

// Process (rounded rect with arrow)
function ProcessIcon({ color, size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
      <rect x="2" y="4" width="20" height="16" rx="3" />
      <path d="M8 12 L14 12 M12 9 L15 12 L12 15" strokeLinecap="round" />
    </svg>
  );
}

// Function (rounded rect)
function FunctionIcon({ color, size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
      <rect x="2" y="4" width="20" height="16" rx="3" />
    </svg>
  );
}

// Service (rounded rect with top cut)
function ServiceIcon({ color, size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
      <path d="M5 4 L19 4 Q22 4 22 7 L22 17 Q22 20 19 20 L5 20 Q2 20 2 17 L2 7 Q2 4 5 4" />
      <ellipse cx="12" cy="4" rx="4" ry="2" />
    </svg>
  );
}

// Object (rectangle)
function ObjectIcon({ color, size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
      <rect x="3" y="3" width="18" height="18" rx="1" />
      <line x1="3" y1="8" x2="21" y2="8" />
    </svg>
  );
}

// Component (UML component notation)
function ComponentIcon({ color, size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
      <rect x="5" y="3" width="16" height="18" rx="1" />
      <rect x="2" y="6" width="6" height="4" rx="1" fill={color} fillOpacity="0.2" />
      <rect x="2" y="14" width="6" height="4" rx="1" fill={color} fillOpacity="0.2" />
    </svg>
  );
}

// Interface (lollipop)
function InterfaceIcon({ color, size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
      <circle cx="12" cy="8" r="5" />
      <line x1="12" y1="13" x2="12" y2="22" />
    </svg>
  );
}

// Node (3D box)
function NodeIcon({ color, size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
      <path d="M4 7 L4 19 L16 19 L16 7 L4 7" />
      <path d="M4 7 L8 3 L20 3 L20 15 L16 19" />
      <path d="M16 7 L20 3" />
    </svg>
  );
}

// Device (3D box with screen)
function DeviceIcon({ color, size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
      <path d="M4 7 L4 19 L16 19 L16 7 L4 7" />
      <path d="M4 7 L8 3 L20 3 L20 15 L16 19" />
      <path d="M16 7 L20 3" />
      <rect x="6" y="9" width="8" height="6" fill={color} fillOpacity="0.3" />
    </svg>
  );
}

// Network (pipe/cylinder)
function NetworkIcon({ color, size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
      <path d="M2 8 Q2 4 12 4 Q22 4 22 8 L22 16 Q22 20 12 20 Q2 20 2 16 Z" />
      <path d="M2 8 Q2 12 12 12 Q22 12 22 8" />
    </svg>
  );
}

// Artifact (document with corner fold)
function ArtifactIcon({ color, size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
      <path d="M4 2 L16 2 L20 6 L20 22 L4 22 Z" />
      <path d="M16 2 L16 6 L20 6" />
      <line x1="7" y1="10" x2="17" y2="10" />
      <line x1="7" y1="14" x2="17" y2="14" />
      <line x1="7" y1="18" x2="13" y2="18" />
    </svg>
  );
}

// Stakeholder (person with tie)
function StakeholderIcon({ color, size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
      <circle cx="12" cy="6" r="4" />
      <path d="M5 22 Q5 14 12 14 Q19 14 19 22" />
    </svg>
  );
}

// Driver (arrow/direction)
function DriverIcon({ color, size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
      <ellipse cx="12" cy="12" rx="10" ry="8" />
      <path d="M8 12 L14 8 L14 16 Z" fill={color} fillOpacity="0.3" />
    </svg>
  );
}

// Goal (oval with crosshair)
function GoalIcon({ color, size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
      <ellipse cx="12" cy="12" rx="10" ry="8" />
      <circle cx="12" cy="12" r="3" fill={color} fillOpacity="0.3" />
    </svg>
  );
}

// Principle (scroll)
function PrincipleIcon({ color, size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
      <path d="M6 4 Q2 4 2 8 L2 16 Q2 20 6 20 L18 20 Q22 20 22 16" />
      <path d="M6 4 L18 4 Q22 4 22 8 L22 12" />
      <path d="M18 12 L22 12 L22 16 L18 16 L18 12" />
    </svg>
  );
}

// Requirement (document with check)
function RequirementIcon({ color, size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M8 12 L11 15 L16 9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Constraint (lock)
function ConstraintIcon({ color, size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="4" y1="10" x2="20" y2="10" />
      <circle cx="12" cy="15" r="2" fill={color} />
    </svg>
  );
}

// Capability (gear/cog)
function CapabilityIcon({ color, size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
      <rect x="2" y="4" width="20" height="16" rx="3" />
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="4" x2="12" y2="8" />
      <line x1="12" y1="16" x2="12" y2="20" />
    </svg>
  );
}

// Resource (diamond)
function ResourceIcon({ color, size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <polygon points="12,8 16,12 12,16 8,12" fill={color} fillOpacity="0.3" />
    </svg>
  );
}

// Value Stream (chevron/arrow)
function ValueStreamIcon({ color, size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
      <path d="M2 6 L16 6 L22 12 L16 18 L2 18 L8 12 Z" />
    </svg>
  );
}

// Work Package (box with task)
function WorkPackageIcon({ color, size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <line x1="6" y1="10" x2="18" y2="10" />
      <line x1="6" y1="14" x2="14" y2="14" />
    </svg>
  );
}

// Deliverable (output box)
function DeliverableIcon({ color, size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M8 12 L11 15 L16 9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Plateau (layered rectangles)
function PlateauIcon({ color, size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
      <rect x="4" y="8" width="16" height="12" rx="2" />
      <path d="M6 8 L6 5 Q6 3 8 3 L16 3 Q18 3 18 5 L18 8" />
    </svg>
  );
}

// Gap (warning triangle)
function GapIcon({ color, size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
      <path d="M12 3 L22 20 L2 20 Z" />
      <line x1="12" y1="9" x2="12" y2="14" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1" fill={color} />
    </svg>
  );
}

// Grouping (dotted rectangle)
function GroupingIcon({ color, size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="4 2">
      <rect x="2" y="2" width="20" height="20" rx="2" />
    </svg>
  );
}

// Location (pin marker)
function LocationIcon({ color, size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
      <rect x="2" y="2" width="20" height="20" rx="2" />
      <path d="M12 6 Q16 6 16 10 Q16 15 12 18 Q8 15 8 10 Q8 6 12 6" fill={color} fillOpacity="0.3" />
      <circle cx="12" cy="10" r="2" fill={color} />
    </svg>
  );
}

// ============ CUSTOM NODE RENDERER ============

function ArchiMateNode({ element, stencil, isSelected }) {
  const type = element.type;
  const label = element.label || element.name || '';
  const { width, height } = element.size || stencil?.defaultSize || { width: 120, height: 60 };

  // Determine layer and colors
  let layer = 'composite';
  if (['business-actor', 'business-role', 'business-process', 'business-function', 'business-service', 'business-object', 'product', 'contract'].includes(type)) layer = 'business';
  else if (['application-component', 'application-service', 'application-interface', 'application-function', 'data-object'].includes(type)) layer = 'application';
  else if (['node', 'device', 'system-software', 'technology-service', 'artifact', 'communication-network'].includes(type)) layer = 'technology';
  else if (['stakeholder', 'driver', 'assessment', 'goal', 'outcome', 'principle', 'requirement', 'constraint'].includes(type)) layer = 'motivation';
  else if (['resource', 'capability', 'value-stream', 'course-of-action'].includes(type)) layer = 'strategy';
  else if (['work-package', 'deliverable', 'plateau', 'gap'].includes(type)) layer = 'implementation';

  const colors = LAYER_COLORS[layer];

  // Get the icon for this type
  const getIcon = () => {
    const iconProps = { color: colors.icon, size: 20 };
    switch (type) {
      case 'business-actor': return <ActorIcon {...iconProps} />;
      case 'business-role': return <RoleIcon {...iconProps} />;
      case 'business-process': return <ProcessIcon {...iconProps} />;
      case 'business-function': return <FunctionIcon {...iconProps} />;
      case 'business-service': return <ServiceIcon {...iconProps} />;
      case 'business-object': return <ObjectIcon {...iconProps} />;
      case 'product': return <ObjectIcon {...iconProps} />;
      case 'contract': return <ArtifactIcon {...iconProps} />;
      case 'application-component': return <ComponentIcon {...iconProps} />;
      case 'application-service': return <ServiceIcon {...iconProps} />;
      case 'application-interface': return <InterfaceIcon {...iconProps} />;
      case 'application-function': return <FunctionIcon {...iconProps} />;
      case 'data-object': return <ObjectIcon {...iconProps} />;
      case 'node': return <NodeIcon {...iconProps} />;
      case 'device': return <DeviceIcon {...iconProps} />;
      case 'system-software': return <ComponentIcon {...iconProps} />;
      case 'technology-service': return <ServiceIcon {...iconProps} />;
      case 'artifact': return <ArtifactIcon {...iconProps} />;
      case 'communication-network': return <NetworkIcon {...iconProps} />;
      case 'stakeholder': return <StakeholderIcon {...iconProps} />;
      case 'driver': return <DriverIcon {...iconProps} />;
      case 'assessment': return <ObjectIcon {...iconProps} />;
      case 'goal': return <GoalIcon {...iconProps} />;
      case 'outcome': return <GoalIcon {...iconProps} />;
      case 'principle': return <PrincipleIcon {...iconProps} />;
      case 'requirement': return <RequirementIcon {...iconProps} />;
      case 'constraint': return <ConstraintIcon {...iconProps} />;
      case 'resource': return <ResourceIcon {...iconProps} />;
      case 'capability': return <CapabilityIcon {...iconProps} />;
      case 'value-stream': return <ValueStreamIcon {...iconProps} />;
      case 'course-of-action': return <ProcessIcon {...iconProps} />;
      case 'work-package': return <WorkPackageIcon {...iconProps} />;
      case 'deliverable': return <DeliverableIcon {...iconProps} />;
      case 'plateau': return <PlateauIcon {...iconProps} />;
      case 'gap': return <GapIcon {...iconProps} />;
      case 'grouping': return <GroupingIcon {...iconProps} />;
      case 'location': return <LocationIcon {...iconProps} />;
      default: return null;
    }
  };

  // Container types (grouping, location, plateau)
  const isContainer = stencil?.isContainer || ['grouping', 'location', 'plateau', 'product'].includes(type);

  // Special shape rendering
  const getShape = () => {
    // Service shape (rounded rect with semicircle top)
    if (['business-service', 'application-service', 'technology-service'].includes(type)) {
      return (
        <svg
          width={width}
          height={height}
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          <path
            d={`M 3 ${height * 0.2}
                Q 3 3 ${width * 0.15} 3
                L ${width * 0.35} 3
                Q ${width * 0.5} -5 ${width * 0.65} 3
                L ${width * 0.85} 3
                Q ${width - 3} 3 ${width - 3} ${height * 0.2}
                L ${width - 3} ${height - 3}
                Q ${width - 3} ${height - 3} ${width - 6} ${height - 3}
                L 6 ${height - 3}
                Q 3 ${height - 3} 3 ${height - 6}
                Z`}
            fill={colors.fill}
            stroke={colors.stroke}
            strokeWidth="2"
          />
        </svg>
      );
    }

    // Process/Function shape (rounded rectangle)
    if (['business-process', 'application-function', 'business-function'].includes(type)) {
      return (
        <svg
          width={width}
          height={height}
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          <rect
            x="2"
            y="2"
            width={width - 4}
            height={height - 4}
            rx="8"
            fill={colors.fill}
            stroke={colors.stroke}
            strokeWidth="2"
          />
        </svg>
      );
    }

    // Actor shape (figure)
    if (type === 'business-actor' || type === 'stakeholder') {
      return (
        <svg
          width={width}
          height={height}
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          <rect
            x="2"
            y="2"
            width={width - 4}
            height={height - 4}
            rx="4"
            fill={colors.fill}
            stroke={colors.stroke}
            strokeWidth="2"
          />
          {/* Stick figure */}
          <circle cx={width - 20} cy="14" r="6" fill="none" stroke={colors.icon} strokeWidth="1.5" />
          <line x1={width - 20} y1="20" x2={width - 20} y2="32" stroke={colors.icon} strokeWidth="1.5" />
          <line x1={width - 28} y1="25" x2={width - 12} y2="25" stroke={colors.icon} strokeWidth="1.5" />
          <line x1={width - 20} y1="32" x2={width - 26} y2="42" stroke={colors.icon} strokeWidth="1.5" />
          <line x1={width - 20} y1="32" x2={width - 14} y2="42" stroke={colors.icon} strokeWidth="1.5" />
        </svg>
      );
    }

    // Component shape (with notation)
    if (['application-component', 'system-software'].includes(type)) {
      return (
        <svg
          width={width}
          height={height}
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          <rect
            x="2"
            y="2"
            width={width - 4}
            height={height - 4}
            rx="2"
            fill={colors.fill}
            stroke={colors.stroke}
            strokeWidth="2"
          />
          {/* Component notation */}
          <rect x={width - 22} y="8" width="14" height="8" rx="1" fill={colors.fill} stroke={colors.icon} strokeWidth="1.5" />
          <rect x={width - 22} y="20" width="14" height="8" rx="1" fill={colors.fill} stroke={colors.icon} strokeWidth="1.5" />
        </svg>
      );
    }

    // Node/Device (3D box)
    if (['node', 'device'].includes(type)) {
      const depth = 10;
      return (
        <svg
          width={width}
          height={height}
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          {/* Top face */}
          <path
            d={`M 2 ${depth + 2} L ${depth + 2} 2 L ${width - 2} 2 L ${width - 2} ${height - depth - 2} L ${width - depth - 2} ${height - 2} L 2 ${height - 2} Z`}
            fill={colors.fill}
            stroke={colors.stroke}
            strokeWidth="2"
          />
          {/* Right face */}
          <path
            d={`M ${width - 2} 2 L ${width - 2} ${height - depth - 2} L ${width - depth - 2} ${height - 2} L ${width - depth - 2} ${depth + 2} Z`}
            fill={colors.stroke}
            fillOpacity="0.2"
            stroke={colors.stroke}
            strokeWidth="1"
          />
          {/* Top edge */}
          <line x1={depth + 2} y1="2" x2={depth + 2} y2={depth + 2} stroke={colors.stroke} strokeWidth="1" />
          <line x1="2" y1={depth + 2} x2={depth + 2} y2={depth + 2} stroke={colors.stroke} strokeWidth="1" />
          <line x1={depth + 2} y1={depth + 2} x2={width - depth - 2} y2={depth + 2} stroke={colors.stroke} strokeWidth="1" />
        </svg>
      );
    }

    // Network (pipeline)
    if (type === 'communication-network') {
      return (
        <svg
          width={width}
          height={height}
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          <path
            d={`M 15 2 L ${width - 15} 2 Q ${width - 2} 2 ${width - 2} ${height / 2} Q ${width - 2} ${height - 2} ${width - 15} ${height - 2} L 15 ${height - 2} Q 2 ${height - 2} 2 ${height / 2} Q 2 2 15 2`}
            fill={colors.fill}
            stroke={colors.stroke}
            strokeWidth="2"
          />
          <ellipse cx="15" cy={height / 2} rx="12" ry={height / 2 - 4} fill={colors.fill} stroke={colors.stroke} strokeWidth="1" />
        </svg>
      );
    }

    // Interface (exposed interface)
    if (type === 'application-interface') {
      return (
        <svg
          width={width}
          height={height}
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          <rect
            x="2"
            y="2"
            width={width - 4}
            height={height - 4}
            fill={colors.fill}
            stroke={colors.stroke}
            strokeWidth="2"
          />
          {/* Interface circle */}
          <circle cx={width - 15} cy={height / 2} r="8" fill={colors.fill} stroke={colors.icon} strokeWidth="2" />
          <line x1={width - 15} y1={height / 2 - 12} x2={width - 15} y2={height / 2 - 8} stroke={colors.icon} strokeWidth="2" />
        </svg>
      );
    }

    // Motivation elements (oval-ish)
    if (['driver', 'assessment', 'goal', 'outcome'].includes(type)) {
      return (
        <svg
          width={width}
          height={height}
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          <ellipse
            cx={width / 2}
            cy={height / 2}
            rx={width / 2 - 4}
            ry={height / 2 - 4}
            fill={colors.fill}
            stroke={colors.stroke}
            strokeWidth="2"
          />
        </svg>
      );
    }

    // Value Stream (chevron)
    if (type === 'value-stream') {
      const point = 15;
      return (
        <svg
          width={width}
          height={height}
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          <path
            d={`M 2 2 L ${width - point - 2} 2 L ${width - 2} ${height / 2} L ${width - point - 2} ${height - 2} L 2 ${height - 2} L ${point + 2} ${height / 2} Z`}
            fill={colors.fill}
            stroke={colors.stroke}
            strokeWidth="2"
          />
        </svg>
      );
    }

    // Artifact (document)
    if (type === 'artifact') {
      const fold = 12;
      return (
        <svg
          width={width}
          height={height}
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          <path
            d={`M 2 2 L ${width - fold - 2} 2 L ${width - 2} ${fold + 2} L ${width - 2} ${height - 2} L 2 ${height - 2} Z`}
            fill={colors.fill}
            stroke={colors.stroke}
            strokeWidth="2"
          />
          <path
            d={`M ${width - fold - 2} 2 L ${width - fold - 2} ${fold + 2} L ${width - 2} ${fold + 2}`}
            fill={colors.stroke}
            fillOpacity="0.2"
            stroke={colors.stroke}
            strokeWidth="1"
          />
        </svg>
      );
    }

    // Container types
    if (isContainer) {
      const isDashed = type === 'grouping';
      return (
        <svg
          width={width}
          height={height}
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          <rect
            x="2"
            y="2"
            width={width - 4}
            height={height - 4}
            rx="4"
            fill={colors.fill}
            fillOpacity="0.5"
            stroke={colors.stroke}
            strokeWidth="2"
            strokeDasharray={isDashed ? '8 4' : 'none'}
          />
          {/* Header area */}
          <rect
            x="2"
            y="2"
            width={width - 4}
            height="28"
            rx="4"
            fill={colors.stroke}
            fillOpacity="0.2"
          />
        </svg>
      );
    }

    // Default rectangle
    return (
      <svg
        width={width}
        height={height}
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        <rect
          x="2"
          y="2"
          width={width - 4}
          height={height - 4}
          rx="4"
          fill={colors.fill}
          stroke={colors.stroke}
          strokeWidth="2"
        />
      </svg>
    );
  };

  return (
    <div
      className="archimate-node"
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: isContainer ? 'flex-start' : 'center',
        padding: isContainer ? '6px 8px' : '4px',
      }}
    >
      {/* Shape background */}
      {getShape()}

      {/* Content */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        flexDirection: isContainer ? 'row' : 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        width: '100%',
        padding: isContainer ? '0 4px' : '0',
        marginTop: isContainer ? 2 : 0,
      }}>
        {/* Icon */}
        {!['business-actor', 'stakeholder', 'application-component', 'system-software'].includes(type) && (
          <div style={{ flexShrink: 0 }}>
            {getIcon()}
          </div>
        )}

        {/* Label */}
        <div style={{
          fontSize: isContainer ? 12 : 11,
          fontWeight: 600,
          color: '#1f2937',
          textAlign: 'center',
          lineHeight: 1.2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: isContainer ? 1 : 2,
          WebkitBoxOrient: 'vertical',
          wordBreak: 'break-word',
          maxWidth: '90%',
        }}>
          {label}
        </div>
      </div>
    </div>
  );
}

// Main render function exported with the pack
function renderNode(element, stencil, isSelected) {
  return <ArchiMateNode element={element} stencil={stencil} isSelected={isSelected} />;
}

// ============ PACK EXPORT ============

const TOGAFPack = {
  id: 'togaf',
  name: 'TOGAF / ArchiMate',
  description: 'Enterprise architecture with TOGAF/ArchiMate notation',
  icon: '🏛️',
  stencils,
  connectionTypes,
  validators,
  templates,
  nodeProperties,
  renderNode,
  defaultLineStyle: 'step', // TOGAF/ArchiMate uses orthogonal lines
};

export default TOGAFPack;
export { stencils, connectionTypes, validators, templates, nodeProperties, renderNode };
