// Catalog data for the "capability-map" pack: plain data, no React. Shared by the pack (rendering) and the MCP server.
// Do not import UI code here (enforced by __tests__/lib/catalog.test.js).

export const CAP_MATURITY_LEVELS = [
  { id: 'initial', label: 'Initial', color: '#dc2626', description: 'Ad-hoc, inconsistent' },
  { id: 'developing', label: 'Developing', color: '#f59e0b', description: 'Emerging, partially defined' },
  { id: 'defined', label: 'Defined', color: '#eab308', description: 'Documented, standardized' },
  { id: 'managed', label: 'Managed', color: '#22c55e', description: 'Measured, controlled' },
  { id: 'optimizing', label: 'Optimizing', color: '#10b981', description: 'Continuously improving' },
];

export const CAP_STRATEGIC_IMPORTANCE = [
  { id: 'low', label: 'Low', description: 'Supporting, non-core' },
  { id: 'medium', label: 'Medium', description: 'Important, enables core' },
  { id: 'high', label: 'High', description: 'Critical, competitive differentiator' },
  { id: 'strategic', label: 'Strategic', description: 'Core to strategy' },
];

export const CAP_INVESTMENT_LEVEL = [
  { id: 'divest', label: 'Divest', description: 'Reduce or eliminate' },
  { id: 'maintain', label: 'Maintain', description: 'Keep current level' },
  { id: 'invest', label: 'Invest', description: 'Increase investment' },
  { id: 'transform', label: 'Transform', description: 'Major transformation' },
];

export const COLORS = {
  capability: '#0e74a3',      // --accent-blue
  capabilityGroup: '#7c3aed', // --module-violet
  valueStream: '#0d9488',     // --module-teal
  assessment: '#f59e0b',      // --warning
  gap: '#dc2626',             // --danger
  resource: '#0284c7',        // --module-sky
  initiative: '#10b981',      // --success
  operatingModel: '#0284c7',  // --module-sky
  accountability: '#7c3aed',  // --module-violet
};

export const stencils = [
  // ============ CAPABILITY ELEMENTS ============
  {
    id: 'cap-capability',
    name: 'Capability',
    description: 'An organizational ability - WHAT the organization can do',
    group: 'Capabilities',
    shape: 'rect',
    icon: '🎯',
    color: COLORS.capability,
    defaultSize: { width: 160, height: 80 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: true,
    properties: [
      {
        id: 'maturity',
        label: 'Maturity Level',
        type: 'select',
        options: CAP_MATURITY_LEVELS.map(l => ({ value: l.id, label: l.label }))
      },
      {
        id: 'strategicImportance',
        label: 'Strategic Importance',
        type: 'select',
        options: CAP_STRATEGIC_IMPORTANCE.map(l => ({ value: l.id, label: l.label }))
      },
      {
        id: 'investmentLevel',
        label: 'Investment Level',
        type: 'select',
        options: CAP_INVESTMENT_LEVEL.map(l => ({ value: l.id, label: l.label }))
      },
      { id: 'definition', label: 'Definition', type: 'textarea' },
      { id: 'businessOutcome', label: 'Business Outcome', type: 'textarea' },
      { id: 'artefactId', label: 'Linked Artefact', type: 'hidden' },
    ],
  },
  {
    id: 'cap-capability-group',
    name: 'Capability Group',
    description: 'A logical grouping of related capabilities',
    group: 'Capabilities',
    shape: 'rect',
    icon: '📁',
    color: COLORS.capabilityGroup,
    defaultSize: { width: 280, height: 200 },
    ports: [],
    isContainer: true,
    properties: [
      {
        id: 'level',
        label: 'Hierarchy Level',
        type: 'select',
        options: [
          { value: 'l0', label: 'L0 - Enterprise' },
          { value: 'l1', label: 'L1 - Domain' },
          { value: 'l2', label: 'L2 - Sub-domain' },
          { value: 'l3', label: 'L3 - Detailed' },
        ]
      },
      { id: 'purpose', label: 'Purpose', type: 'textarea' },
      { id: 'artefactId', label: 'Linked Artefact', type: 'hidden' },
    ],
  },

  // ============ VALUE STREAM ELEMENTS ============
  {
    id: 'cap-value-stream',
    name: 'Value Stream',
    description: 'End-to-end flow that delivers value to customers',
    group: 'Value Streams',
    shape: 'chevron',
    icon: '➡️',
    color: COLORS.valueStream,
    defaultSize: { width: 180, height: 60 },
    ports: [
      { id: 'left', position: 'left' },
      { id: 'right', position: 'right' },
    ],
    properties: [
      { id: 'trigger', label: 'Trigger', type: 'text' },
      { id: 'outcome', label: 'Outcome', type: 'text' },
      { id: 'customer', label: 'Customer', type: 'text' },
      { id: 'cycleTime', label: 'Cycle Time', type: 'text' },
      { id: 'artefactId', label: 'Linked Artefact', type: 'hidden' },
    ],
  },
  {
    id: 'cap-value-stage',
    name: 'Value Stage',
    description: 'A stage within a value stream',
    group: 'Value Streams',
    shape: 'chevron',
    icon: '▶️',
    color: COLORS.valueStream,
    defaultSize: { width: 140, height: 50 },
    ports: [
      { id: 'left', position: 'left' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
    ],
    properties: [
      { id: 'sequence', label: 'Sequence', type: 'number' },
      { id: 'owner', label: 'Owner', type: 'text' },
    ],
  },

  // ============ ASSESSMENT ELEMENTS ============
  {
    id: 'cap-assessment',
    name: 'Assessment',
    description: 'Evaluation of a capability against criteria',
    group: 'Assessment',
    shape: 'rect',
    icon: '📊',
    color: COLORS.assessment,
    defaultSize: { width: 140, height: 70 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    properties: [
      {
        id: 'currentScore',
        label: 'Current Score',
        type: 'select',
        options: CAP_MATURITY_LEVELS.map(l => ({ value: l.id, label: l.label }))
      },
      {
        id: 'targetScore',
        label: 'Target Score',
        type: 'select',
        options: CAP_MATURITY_LEVELS.map(l => ({ value: l.id, label: l.label }))
      },
      { id: 'evidence', label: 'Evidence', type: 'textarea' },
      { id: 'artefactId', label: 'Linked Artefact', type: 'hidden' },
    ],
  },
  {
    id: 'cap-gap',
    name: 'Gap',
    description: 'Identified gap between current and required state',
    group: 'Assessment',
    shape: 'rect',
    icon: '⚠️',
    color: COLORS.gap,
    defaultSize: { width: 140, height: 70 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    properties: [
      {
        id: 'severity',
        label: 'Severity',
        type: 'select',
        options: [
          { value: 'low', label: 'Low' },
          { value: 'medium', label: 'Medium' },
          { value: 'high', label: 'High' },
          { value: 'critical', label: 'Critical' },
        ]
      },
      { id: 'gapType', label: 'Gap Type', type: 'text' },
      { id: 'businessImpact', label: 'Business Impact', type: 'textarea' },
      { id: 'artefactId', label: 'Linked Artefact', type: 'hidden' },
    ],
  },

  // ============ OPERATING MODEL ELEMENTS ============
  {
    id: 'cap-operating-model',
    name: 'Operating Model',
    description: 'How the organization delivers capabilities',
    group: 'Operating Model',
    shape: 'rect',
    icon: '🏗️',
    color: COLORS.operatingModel,
    defaultSize: { width: 200, height: 120 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: true,
    properties: [
      {
        id: 'pattern',
        label: 'Operating Pattern',
        type: 'select',
        options: [
          { value: 'centralized', label: 'Centralized' },
          { value: 'decentralized', label: 'Decentralized' },
          { value: 'federated', label: 'Federated' },
          { value: 'shared_services', label: 'Shared Services' },
          { value: 'outsourced', label: 'Outsourced' },
          { value: 'hybrid', label: 'Hybrid' },
        ]
      },
      { id: 'governance', label: 'Governance', type: 'textarea' },
      { id: 'artefactId', label: 'Linked Artefact', type: 'hidden' },
    ],
  },
  {
    id: 'cap-resource',
    name: 'Resource',
    description: 'Resource required to deliver a capability',
    group: 'Operating Model',
    shape: 'rect',
    icon: '💎',
    color: COLORS.resource,
    defaultSize: { width: 120, height: 60 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    properties: [
      {
        id: 'resourceType',
        label: 'Resource Type',
        type: 'select',
        options: [
          { value: 'people', label: 'People' },
          { value: 'process', label: 'Process' },
          { value: 'technology', label: 'Technology' },
          { value: 'information', label: 'Information' },
          { value: 'partner', label: 'Partner' },
        ]
      },
      {
        id: 'criticality',
        label: 'Criticality',
        type: 'select',
        options: [
          { value: 'low', label: 'Low' },
          { value: 'medium', label: 'Medium' },
          { value: 'high', label: 'High' },
          { value: 'critical', label: 'Critical' },
        ]
      },
      { id: 'artefactId', label: 'Linked Artefact', type: 'hidden' },
    ],
  },
  {
    id: 'cap-accountability',
    name: 'Accountability',
    description: 'Who is responsible/accountable',
    group: 'Operating Model',
    shape: 'rect',
    icon: '👤',
    color: COLORS.accountability,
    defaultSize: { width: 120, height: 60 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    properties: [
      { id: 'role', label: 'Role', type: 'text' },
      {
        id: 'accountabilityType',
        label: 'Type (RACI)',
        type: 'select',
        options: [
          { value: 'responsible', label: 'Responsible (R)' },
          { value: 'accountable', label: 'Accountable (A)' },
          { value: 'consulted', label: 'Consulted (C)' },
          { value: 'informed', label: 'Informed (I)' },
        ]
      },
      { id: 'artefactId', label: 'Linked Artefact', type: 'hidden' },
    ],
  },

  // ============ ROADMAP ELEMENTS ============
  {
    id: 'cap-initiative',
    name: 'Initiative',
    description: 'Planned work to develop or improve capabilities',
    group: 'Roadmap',
    shape: 'rect',
    icon: '🚀',
    color: COLORS.initiative,
    defaultSize: { width: 160, height: 70 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    properties: [
      {
        id: 'priority',
        label: 'Priority',
        type: 'select',
        options: [
          { value: 'low', label: 'Low' },
          { value: 'medium', label: 'Medium' },
          { value: 'high', label: 'High' },
          { value: 'critical', label: 'Critical' },
        ]
      },
      {
        id: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'proposed', label: 'Proposed' },
          { value: 'approved', label: 'Approved' },
          { value: 'in_progress', label: 'In Progress' },
          { value: 'completed', label: 'Completed' },
        ]
      },
      { id: 'objective', label: 'Objective', type: 'textarea' },
      { id: 'artefactId', label: 'Linked Artefact', type: 'hidden' },
    ],
  },

  // ============ UTILITY ELEMENTS ============
  {
    id: 'cap-swimlane',
    name: 'Swimlane',
    description: 'Container for organizing by owner or domain',
    group: 'Layout',
    shape: 'rect',
    icon: '▭',
    color: '#94a3b8',
    defaultSize: { width: 300, height: 400 },
    ports: [],
    isContainer: true,
    properties: [
      { id: 'owner', label: 'Owner/Domain', type: 'text' },
    ],
  },
  {
    id: 'cap-annotation',
    name: 'Annotation',
    description: 'Text annotation or note',
    group: 'Layout',
    shape: 'sticky',
    icon: '📝',
    color: '#fef3c7',
    defaultSize: { width: 160, height: 100 },
    ports: [],
    properties: [
      { id: 'content', label: 'Content', type: 'textarea' },
    ],
  },
];

export const connectionTypes = [
  // Hierarchy relationships
  {
    id: 'decomposes',
    name: 'Decomposes To',
    description: 'Parent capability decomposes into children',
    style: 'solid',
    arrowStart: 'diamond-filled',
    arrowEnd: 'none',
    color: '#374151',
  },
  {
    id: 'groups',
    name: 'Groups',
    description: 'Capability group contains capabilities',
    style: 'dashed',
    arrowStart: 'none',
    arrowEnd: 'none',
    color: '#6b7280',
  },

  // Dependency relationships
  {
    id: 'depends-on',
    name: 'Depends On',
    description: 'Capability depends on another capability',
    style: 'dashed',
    arrowStart: 'none',
    arrowEnd: 'arrow',
    color: '#374151',
  },
  {
    id: 'enables',
    name: 'Enables',
    description: 'Capability enables another capability or value stream',
    style: 'solid',
    arrowStart: 'none',
    arrowEnd: 'arrow',
    color: '#10b981',
  },

  // Value stream relationships
  {
    id: 'supports',
    name: 'Supports',
    description: 'Capability supports value stream stage',
    style: 'dashed',
    arrowStart: 'none',
    arrowEnd: 'arrow',
    color: '#0d9488',
  },
  {
    id: 'flows-to',
    name: 'Flows To',
    description: 'Value flows from one stage to another',
    style: 'solid',
    arrowStart: 'none',
    arrowEnd: 'arrow',
    color: '#0d9488',
  },

  // Assessment relationships
  {
    id: 'assesses',
    name: 'Assesses',
    description: 'Assessment evaluates a capability',
    style: 'dashed',
    arrowStart: 'none',
    arrowEnd: 'arrow',
    color: '#f59e0b',
  },
  {
    id: 'identifies-gap',
    name: 'Identifies Gap',
    description: 'Assessment or analysis identifies a gap',
    style: 'dashed',
    arrowStart: 'none',
    arrowEnd: 'arrow',
    color: '#dc2626',
  },

  // Operating model relationships
  {
    id: 'requires',
    name: 'Requires',
    description: 'Capability requires a resource',
    style: 'dashed',
    arrowStart: 'none',
    arrowEnd: 'arrow',
    color: '#0284c7',
  },
  {
    id: 'accountable-for',
    name: 'Accountable For',
    description: 'Role is accountable for capability',
    style: 'solid',
    arrowStart: 'none',
    arrowEnd: 'arrow',
    color: '#7c3aed',
  },

  // Roadmap relationships
  {
    id: 'addresses',
    name: 'Addresses',
    description: 'Initiative addresses a gap',
    style: 'dashed',
    arrowStart: 'none',
    arrowEnd: 'arrow',
    color: '#10b981',
  },
  {
    id: 'develops',
    name: 'Develops',
    description: 'Initiative develops a capability',
    style: 'solid',
    arrowStart: 'none',
    arrowEnd: 'arrow',
    color: '#10b981',
  },

  // Generic
  {
    id: 'association',
    name: 'Association',
    description: 'General association between elements',
    style: 'solid',
    arrowStart: 'none',
    arrowEnd: 'none',
    color: '#6b7280',
  },
];
