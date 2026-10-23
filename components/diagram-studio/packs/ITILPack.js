// components/diagram-studio/packs/ITILPack.js
// ITIL 4 IT Service Management Pack

import { itilCmdbSpec } from './labelSlots';
import { pickLabelColor } from './colorUtils';
import { stencils, connectionTypes } from './catalog/itil';
import { ElementText, SlotText } from '../text/useTextLayout';
import { layoutForSlot } from '../../../lib/text/fit';

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
// Labels go through the shared text layout (ADR-0008 T2): the stencil policy (lib/text/policies/itil.js) reserves the
// text area, the renderer draws the card and the icon. Header texts (service type, priority, status) are meta slots.

const CARD = { width: '100%', height: '100%', borderRadius: 8, boxSizing: 'border-box' };
const ICON_CENTER = (height, size) => Math.max(2, (height - size) / 2);
const sizeOfElement = (element, stencil, fallback) => element.size || stencil?.defaultSize || fallback;

// Header strip of a card (status, priority, type): a colored band with a meta text and an optional badge at the right
function HeaderStrip({ element, width, band, color, text, badge, badgeColor }) {
  const badgeText = badge || '';
  // the badge is as wide as its text plus padding (measured with the shared tables, not guessed)
  const bw = badgeText ? Math.ceil(layoutForSlot(element, { text: badgeText, box: { x: 0, y: 0, width: 200, height: 16 }, role: 'meta', weight: 600 }).layout.width) + 12 : 0;
  const textW = Math.max(20, width - 20 - (bw ? bw + 6 : 0));
  return (
    <>
      <SlotText element={element} text={text} box={{ x: 10, y: 2 + (band - 14) / 2, width: textW, height: 14 }} role="meta" weight={600} align="start" maxLines={1} color={color} testId="meta" />
      {bw > 0 && (
        <div style={{ position: 'absolute', left: width - 8 - bw, top: 2 + (band - 16) / 2, width: bw, height: 16, borderRadius: 4, background: badgeColor }}>
          <SlotText element={element} text={badgeText} box={{ x: 0, y: 1, width: bw, height: 14 }} role="meta" weight={600} maxLines={1} color={pickLabelColor(badgeColor)} testId="meta" />
        </div>
      )}
    </>
  );
}

// Service Value Chain Activity Renderer
function SVCActivityRenderer({ element, stencil }) {
  const color = element.color || stencil?.color || '#3b82f6';
  const icon = stencil?.icon || '⚙️';
  const { height } = sizeOfElement(element, stencil, { height: 70 });

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div style={{ ...CARD, background: `linear-gradient(135deg, ${color}15, ${color}30)`, border: `2px solid ${color}` }} />
      {/* ds-allow-text-style: icon glyph, not text */}
      <span style={{ position: 'absolute', left: 8, top: ICON_CENTER(height, 24), fontSize: 20, lineHeight: '24px' }}>{icon}</span>
      <ElementText packId="itil" element={element} stencil={stencil} text={element.label || stencil?.name || ''} color={element.textColor || 'var(--text)'} />
    </div>
  );
}

// Service Renderer
function ServiceRenderer({ element, stencil }) {
  const color = element.color || stencil?.color || '#3b82f6';
  const serviceType = element.data?.serviceType || 'business';
  const criticality = element.data?.criticality;
  const { width } = sizeOfElement(element, stencil, { width: 160 });
  const critColors = { critical: '#ef4444', high: '#f59e0b', medium: '#22c55e', low: '#6b7280' };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div style={{ ...CARD, background: 'white', border: `2px solid ${color}`, overflow: 'hidden' }}>
        <div style={{ background: color, height: 24 }} />
      </div>
      <HeaderStrip
        element={element}
        width={width}
        band={24}
        color={pickLabelColor(color)}
        text={`⚙️ ${serviceType.toUpperCase()}`}
        badge={criticality ? criticality.toUpperCase() : ''}
        badgeColor={critColors[criticality]}
      />
      <ElementText packId="itil" element={element} stencil={stencil} text={element.label || 'Service'} color={element.textColor || undefined} />
    </div>
  );
}

// Incident Renderer
function IncidentRenderer({ element, stencil }) {
  const priority = element.data?.priority || 'p3';
  const colors = { p1: '#ef4444', p2: '#f59e0b', p3: '#3b82f6', p4: '#6b7280' };
  const color = colors[priority];
  const { width } = sizeOfElement(element, stencil, { width: 140 });

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div style={{ ...CARD, background: `linear-gradient(135deg, ${color}15, ${color}30)`, border: `2px solid ${color}`, overflow: 'hidden' }}>
        <div style={{ background: color, height: 20 }} />
      </div>
      <HeaderStrip element={element} width={width} band={20} color={pickLabelColor(color)} text={`⚠️ ${priority.toUpperCase()}`} />
      <ElementText packId="itil" element={element} stencil={stencil} text={element.label || 'Incident'} color={element.textColor || undefined} />
    </div>
  );
}

// Problem Renderer
function ProblemRenderer({ element, stencil }) {
  const status = element.data?.status || 'open';
  const statusColors = { open: '#ef4444', investigating: '#f59e0b', 'known-error': '#6b7280', resolved: '#22c55e' };
  const color = statusColors[status];
  const { width } = sizeOfElement(element, stencil, { width: 140 });

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div style={{ ...CARD, background: 'white', border: `2px solid ${color}`, overflow: 'hidden' }}>
        <div style={{ background: color, height: 20 }} />
      </div>
      <HeaderStrip element={element} width={width} band={20} color={pickLabelColor(color)} text={`🔍 ${status.replace('-', ' ').toUpperCase()}`} />
      <ElementText packId="itil" element={element} stencil={stencil} text={element.label || 'Problem'} color={element.textColor || undefined} />
    </div>
  );
}

// CI Renderer
function CIRenderer({ element, stencil }) {
  const ciType = element.data?.ciType || 'hardware';
  const color = element.color || stencil?.color || '#8b5cf6';
  const icons = { hardware: '🖥️', software: '💿', network: '🌐', document: '📄', service: '⚙️' };
  const { width, height } = sizeOfElement(element, stencil, { width: 140, height: 70 });

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div style={{ ...CARD, background: `linear-gradient(135deg, ${color}10, ${color}25)`, border: `2px solid ${color}` }} />
      {/* ds-allow-text-style: icon glyph, not text */}
      <span style={{ position: 'absolute', left: 8, top: ICON_CENTER(height - 14, 22), fontSize: 18, lineHeight: '22px' }}>{icons[ciType]}</span>
      <ElementText packId="itil" element={element} stencil={stencil} text={element.label || 'CI'} color={element.textColor || 'var(--text)'} />
      <SlotText element={element} text={ciType.toUpperCase()} box={{ x: 8, y: height - 20, width: width - 16, height: 14 }} role="meta" maxLines={1} color="var(--text-muted)" testId="meta" />
    </div>
  );
}

// CMDB container: a one-line title in the header band (ellipsis and badge when it does not fit); the members sit below
function CMDBRenderer({ element, stencil }) {
  const color = element.color || stencil?.color || '#06b6d4';
  const { width } = sizeOfElement(element, stencil, { width: 200 });
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div style={{ ...CARD, background: `${color}12`, border: `2px solid ${color}`, overflow: 'hidden' }}>
        <div style={{ background: `${color}30`, height: 28 }} />
      </div>
      {/* ds-allow-text-style: icon glyph, not text */}
      <span style={{ position: 'absolute', left: 8, top: 5, fontSize: 16, lineHeight: '20px' }}>{stencil?.icon || '🗄️'}</span>
      <SlotText element={element} text={element.label || 'CMDB'} box={itilCmdbSpec(element, stencil).box} role="title" maxLines={1} align="start" own color={element.textColor || 'var(--text)'} testId="title" />
    </div>
  );
}

// Stakeholder Renderer (stick figure with the label under it)
function StakeholderRenderer({ element, stencil }) {
  const color = element.color || stencil?.color || '#3b82f6';

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <svg width="100%" height={58} viewBox="0 0 80 85" preserveAspectRatio="xMidYMid meet" style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
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
      </svg>
      <ElementText packId="itil" element={element} stencil={stencil} text={element.label || 'Stakeholder'} color={element.textColor || 'var(--text)'} />
    </div>
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
    case 'cmdb':
      return <CMDBRenderer element={element} stencil={stencil} />;
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
