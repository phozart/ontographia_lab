// components/diagram-studio/packs/ITILPack.js
// ITIL 4 IT Service Management Pack

import { pickLabelColor } from './colorUtils';
import { stencils, connectionTypes } from './catalog/itil';

// ============ STENCILS ============


// ============ CONNECTION TYPES ============


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
        color: pickLabelColor(color),
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
        color: pickLabelColor(color),
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
        color: pickLabelColor(color),
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
