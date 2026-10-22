// components/diagram-studio/packs/UMLClassPack.js
// UML Comprehensive Pack - Class, Use Case, Activity, State Machine, Sequence diagrams

import { pickLabelColor } from './colorUtils';

import { stencils, connectionTypes } from './catalog/uml-class';
import { useMemo } from 'react';
import { ElementText, ListText } from '../text/useTextLayout';
import TextBlock from '../text/TextBlock';
import { policyFor } from '../../../lib/text/policy';
import { layoutForSlot } from '../../../lib/text/fit';

// ============ STENCILS ============


// ============ CONNECTION TYPES ============


// ============ VALIDATORS ============

const validators = [
  {
    id: 'class-has-name',
    name: 'Classes Have Names',
    description: 'All classes should have a name',
    level: 'error',
    validate: (elements) => {
      const unnamed = elements.filter(
        el => (el.type === 'class' || el.type === 'abstract-class' || el.type === 'interface') &&
              !el.label?.trim()
      );
      if (unnamed.length > 0) {
        return unnamed.map(el => ({
          elementId: el.id,
          message: `${el.type} must have a name`,
        }));
      }
      return null;
    },
  },
  {
    id: 'interface-no-attributes',
    name: 'Interfaces Have No Attributes',
    description: 'Interfaces typically should not have attributes',
    level: 'info',
    validate: (elements) => {
      const withAttrs = elements.filter(
        el => el.type === 'interface' && el.data?.attributes?.length > 0
      );
      if (withAttrs.length > 0) {
        return withAttrs.map(el => ({
          elementId: el.id,
          message: `Interface "${el.label}" has attributes (unusual for interfaces)`,
        }));
      }
      return null;
    },
  },
  {
    id: 'circular-inheritance',
    name: 'No Circular Inheritance',
    description: 'Inheritance hierarchy should not be circular',
    level: 'error',
    validate: (elements, connections) => {
      const inheritanceLinks = connections.filter(c => c.type === 'inheritance');
      const graph = {};
      elements.forEach(el => { graph[el.id] = []; });
      inheritanceLinks.forEach(c => {
        if (graph[c.sourceId]) {
          graph[c.sourceId].push(c.targetId);
        }
      });

      // DFS to detect cycle
      const visited = new Set();
      const recStack = new Set();

      function hasCycle(node) {
        if (recStack.has(node)) return true;
        if (visited.has(node)) return false;
        visited.add(node);
        recStack.add(node);
        for (const parent of (graph[node] || [])) {
          if (hasCycle(parent)) return true;
        }
        recStack.delete(node);
        return false;
      }

      for (const node of Object.keys(graph)) {
        if (hasCycle(node)) {
          return { message: 'Circular inheritance detected in class hierarchy' };
        }
      }
      return null;
    },
  },
];

// ============ TEMPLATES ============

const templates = [
  {
    id: 'blank',
    name: 'Blank Class Diagram',
    description: 'Empty class diagram',
    thumbnail: null,
    elements: [],
    connections: [],
  },
  {
    id: 'simple-class',
    name: 'Simple Class',
    description: 'Single class example',
    thumbnail: null,
    elements: [
      {
        id: 'c1',
        type: 'class',
        label: 'Person',
        x: 200,
        y: 100,
        size: { width: 180, height: 140 },
        data: {
          attributes: ['- name: String', '- age: int', '- email: String'],
          methods: ['+ getName(): String', '+ setName(name: String): void', '+ getAge(): int'],
        },
      },
    ],
    connections: [],
  },
  {
    id: 'inheritance',
    name: 'Inheritance Example',
    description: 'Class hierarchy with inheritance',
    thumbnail: null,
    elements: [
      {
        id: 'c1',
        type: 'class',
        label: 'Animal',
        x: 250,
        y: 50,
        size: { width: 160, height: 100 },
        data: {
          attributes: ['# name: String'],
          methods: ['+ makeSound(): void'],
        },
      },
      {
        id: 'c2',
        type: 'class',
        label: 'Dog',
        x: 100,
        y: 220,
        size: { width: 160, height: 100 },
        data: {
          attributes: ['- breed: String'],
          methods: ['+ bark(): void'],
        },
      },
      {
        id: 'c3',
        type: 'class',
        label: 'Cat',
        x: 350,
        y: 220,
        size: { width: 160, height: 100 },
        data: {
          attributes: ['- indoor: boolean'],
          methods: ['+ meow(): void'],
        },
      },
    ],
    connections: [
      { id: 'i1', sourceId: 'c2', targetId: 'c1', type: 'inheritance' },
      { id: 'i2', sourceId: 'c3', targetId: 'c1', type: 'inheritance' },
    ],
  },
  {
    id: 'domain-model',
    name: 'Domain Model',
    description: 'Simple domain model with associations',
    thumbnail: null,
    elements: [
      {
        id: 'c1',
        type: 'class',
        label: 'Customer',
        x: 50,
        y: 100,
        size: { width: 160, height: 100 },
        data: {
          attributes: ['- id: Long', '- name: String'],
          methods: ['+ placeOrder(): Order'],
        },
      },
      {
        id: 'c2',
        type: 'class',
        label: 'Order',
        x: 300,
        y: 100,
        size: { width: 160, height: 100 },
        data: {
          attributes: ['- orderId: Long', '- date: Date', '- total: Money'],
          methods: ['+ addItem(item): void'],
        },
      },
      {
        id: 'c3',
        type: 'class',
        label: 'OrderItem',
        x: 550,
        y: 100,
        size: { width: 160, height: 100 },
        data: {
          attributes: ['- quantity: int', '- price: Money'],
        },
      },
      {
        id: 'c4',
        type: 'class',
        label: 'Product',
        x: 550,
        y: 280,
        size: { width: 160, height: 100 },
        data: {
          attributes: ['- sku: String', '- name: String', '- price: Money'],
        },
      },
    ],
    connections: [
      { id: 'a1', sourceId: 'c1', targetId: 'c2', type: 'directed-association', label: '1..*' },
      { id: 'a2', sourceId: 'c2', targetId: 'c3', type: 'composition', label: '1..*' },
      { id: 'a3', sourceId: 'c3', targetId: 'c4', type: 'association', label: '1' },
    ],
  },
  {
    id: 'interface-impl',
    name: 'Interface Implementation',
    description: 'Interface with implementing classes',
    thumbnail: null,
    elements: [
      {
        id: 'i1',
        type: 'interface',
        label: 'Repository',
        x: 200,
        y: 50,
        size: { width: 180, height: 80 },
        data: {
          methods: ['+ save(entity): void', '+ findById(id): Entity', '+ delete(entity): void'],
        },
      },
      {
        id: 'c1',
        type: 'class',
        label: 'JpaRepository',
        x: 50,
        y: 200,
        size: { width: 180, height: 100 },
        data: {
          attributes: ['- entityManager: EntityManager'],
        },
      },
      {
        id: 'c2',
        type: 'class',
        label: 'InMemoryRepository',
        x: 300,
        y: 200,
        size: { width: 180, height: 100 },
        data: {
          attributes: ['- storage: Map'],
        },
      },
    ],
    connections: [
      { id: 'r1', sourceId: 'c1', targetId: 'i1', type: 'realization' },
      { id: 'r2', sourceId: 'c2', targetId: 'i1', type: 'realization' },
    ],
  },
];

// ============ NODE PROPERTIES ============

const nodeProperties = [
  { id: 'documentation', label: 'Documentation', type: 'textarea' },
  { id: 'author', label: 'Author', type: 'text' },
  { id: 'version', label: 'Version', type: 'text' },
];

// ============ CUSTOM RENDERERS ============
// Text (ADR-0008 T2): every label is laid out by the shared module (lib/text) inside the STORED box and drawn as pinned
// lines (TextBlock): an inside label through ElementText, a compartment, header or tab through layoutForSlot, a member
// list through ListText, and the label of a small marker shape hangs below it (external slot). Rendering never writes data.
// Frames with a border are positioned from the padding box, so text boxes (node coordinates) are shifted by the border.


const sizeOf = (element, stencil) => element.size || stencil?.defaultSize || { width: 120, height: 60 };
const shift = (box, d) => ({ ...box, x: box.x - d, y: box.y - d });
const MUTED = 'var(--text-muted)';
const DARK = '#1f2937';

/** One layoutForSlot result, memoized on its parts (a hook for the renderers below). */
function useSlot(element, spec) {
  const b = spec.box;
  return useMemo(
    () => layoutForSlot(element, spec),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [element, spec.text, b.x, b.y, b.width, b.height, spec.role, spec.mode, spec.maxLines, spec.align, spec.valign, spec.own, spec.mono, spec.size, spec.weight],
  );
}

function Slot({ r, d = 0, color, className, testId = 'title', fontFamily }) {
  if (!r.layout.lines.length) return null;
  return <TextBlock layout={r.layout} box={d ? shift(r.box, d) : r.box} color={color} className={className} testId={testId} fontFamily={fontFamily} />;
}

// The label of a small marker shape hangs below it (external slot, wrapped, at most 3 lines, badge on clamp).
function Marker({ node, element, stencil }) {
  const label = element.label || element.name || '';
  return (
    <div className="uml-marker">
      {node}
      {label ? (
        <ElementText packId="uml-class" element={element} stencil={stencil} kind="external" className="ds-node-label-below" color={element.textColor || 'var(--text, #1f2937)'} />
      ) : null}
    </div>
  );
}

// UML Class Renderer with compartments
function UMLClassRenderer({ element, stencil }) {
  const { data } = element;
  const { width: W, height: H } = sizeOf(element, stencil);
  const stereotype = data?.stereotype;
  const isAbstract = data?.isAbstract || element.type === 'abstract-class';
  const attributes = Array.isArray(data?.attributes) ? data.attributes : [];
  const methods = Array.isArray(data?.methods) ? data.methods : [];
  const values = Array.isArray(data?.values) ? data.values : []; // For enums
  const isInterface = element.type === 'interface';
  const isEnum = element.type === 'enum';
  const stereoText = stereotype || (isInterface ? 'interface' : isEnum ? 'enumeration' : '');
  const stereoH = stereoText ? 16 : 0;

  const color = element.color || stencil?.color || '#3b82f6';
  const fg = pickLabelColor(color);

  // name compartment: wraps (auto-height), capped so the member compartments keep at least 45% of the node
  const lh = 17.5;
  // (the same rule the policy sizes by: the node grew by the extra lines, the member room stays the default)
  const defH = stencil?.defaultSize?.height || H;
  const maxNameLines = Math.max(1, Math.floor((H * 0.55 - 16 - stereoH) / lh), Math.floor((H - defH + 24 + 1) / lh));
  const name = useSlot(element, { text: element.label || 'Unnamed', box: { x: 10, y: 8 + stereoH, width: Math.max(20, W - 20), height: maxNameLines * lh }, role: 'title', maxLines: maxNameLines, align: 'center', valign: 'top', own: true });
  const stereo = useSlot(element, { text: stereoText ? `«${stereoText}»` : '', box: { x: 10, y: 6, width: Math.max(20, W - 20), height: 14 }, role: 'meta', maxLines: 1, align: 'center' });
  const headerH = Math.ceil(8 + stereoH + Math.max(1, name.layout.lines.length) * name.layout.lineHeight + 8);

  const rest = Math.max(20, H - 2 - headerH);
  const sections = isEnum ? [values] : [attributes, methods];
  const secH = rest / sections.length;

  return (
    <div className="uml-class-node" style={{ borderColor: color }}>
      <div className="uml-class-header" style={{ backgroundColor: color, height: headerH - 2 }} />
      {stereoText ? <Slot r={stereo} d={2} color={fg} className="uml-italic" testId="stereotype" /> : null}
      <Slot r={name} d={2} color={fg} className={isAbstract ? 'uml-italic' : undefined} testId="name" />
      {sections.map((items, i) => {
        const top = headerH + i * secH;
        return (
          <div key={i}>
            {i > 0 ? <div className="uml-class-rule" style={{ top: top - 2 }} /> : null}
            <ListText
              element={element}
              items={items.length ? items : ['─']}
              box={{ x: 8, y: top - 2 + 4, width: Math.max(20, W - 20), height: Math.max(14, secH - 10) }}
              align={isEnum || !items.length ? 'center' : 'start'}
              color={items.length ? 'var(--text)' : MUTED}
              testId={isEnum ? 'values' : i === 0 ? 'attributes' : 'methods'}
            />
          </div>
        );
      })}
    </div>
  );
}

// UML Package Renderer
function UMLPackageRenderer({ element, stencil }) {
  const { width: W } = sizeOf(element, stencil);
  const color = element.color || stencil?.color || '#64748b';
  const packagePath = element.data?.packagePath || '';
  // the tab is 60% of the width, and widens to hold a longer name (up to the full width); only then does it ellipsize
  const tab = useSlot(element, { text: element.label || 'Package', box: { x: 12, y: 4, width: Math.max(20, W - 24), height: 20 }, role: 'title', maxLines: 1, align: 'start', own: true });
  const tabW = Math.min(W, Math.max(Math.round(W * 0.6), Math.ceil(tab.layout.width) + 24));
  const path = useSlot(element, { text: packagePath, box: { x: 12, y: 36, width: Math.max(20, W - 24), height: 16 }, role: 'meta', maxLines: 1, align: 'center', mono: true });
  return (
    <div className="uml-package-node" style={{ borderColor: color }}>
      <div className="uml-package-tab" style={{ backgroundColor: color, width: tabW - 2 }} />
      <Slot r={tab} d={2} color={pickLabelColor(color)} />
      <Slot r={path} d={2} color={MUTED} testId="path" fontFamily={undefined} />
    </div>
  );
}

// UML Note Renderer
function UMLNoteRenderer({ element, stencil }) {
  return (
    <div className="uml-note-node">
      <div className="uml-note-corner"></div>
      <ElementText packId="uml-class" element={element} stencil={stencil} text={element.label || 'Note...'} color="#92400e" offsetX={-1} offsetY={-1} />
    </div>
  );
}

// ============ USE CASE DIAGRAM RENDERERS ============

// Actor Renderer (stick figure); the label hangs below the figure
function ActorRenderer({ element, stencil }) {
  const color = element.color || stencil?.color || '#3b82f6';
  const actorType = element.data?.actorType || 'person';

  return (
    <Marker
      element={element}
      stencil={stencil}
      node={
        <svg width="100%" height="100%" viewBox="0 0 60 100" style={{ overflow: 'visible' }}>
          {actorType === 'person' ? (
            <>
              {/* Head */}
              <circle cx="30" cy="15" r="12" fill="none" stroke={color} strokeWidth="2" />
              {/* Body */}
              <line x1="30" y1="27" x2="30" y2="55" stroke={color} strokeWidth="2" />
              {/* Arms */}
              <line x1="10" y1="40" x2="50" y2="40" stroke={color} strokeWidth="2" />
              {/* Left leg */}
              <line x1="30" y1="55" x2="15" y2="80" stroke={color} strokeWidth="2" />
              {/* Right leg */}
              <line x1="30" y1="55" x2="45" y2="80" stroke={color} strokeWidth="2" />
            </>
          ) : actorType === 'system' ? (
            <>
              {/* System box */}
              <rect x="5" y="5" width="50" height="60" rx="4" fill="none" stroke={color} strokeWidth="2" />
              {/* Monitor screen */}
              <rect x="10" y="10" width="40" height="30" fill={color} opacity="0.2" />
              {/* Stand */}
              <line x1="30" y1="65" x2="30" y2="75" stroke={color} strokeWidth="2" />
              <line x1="15" y1="75" x2="45" y2="75" stroke={color} strokeWidth="2" />
            </>
          ) : (
            <>
              {/* Clock face */}
              <circle cx="30" cy="35" r="25" fill="none" stroke={color} strokeWidth="2" />
              {/* Clock hands */}
              <line x1="30" y1="35" x2="30" y2="18" stroke={color} strokeWidth="2" />
              <line x1="30" y1="35" x2="42" y2="35" stroke={color} strokeWidth="2" />
            </>
          )}
        </svg>
      }
    />
  );
}

// Use Case Renderer (ellipse)
function UseCaseRenderer({ element, stencil }) {
  const color = element.color || stencil?.color || '#22c55e';

  return (
    <div className="uml-marker">
      <svg width="100%" height="100%" viewBox="0 0 140 70" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
        <ellipse cx="70" cy="35" rx="68" ry="33" fill="white" stroke={color} strokeWidth="2" />
      </svg>
      <ElementText packId="uml-class" element={element} stencil={stencil} text={element.label || 'Use Case'} color={DARK} />
    </div>
  );
}

// System Boundary Renderer
function SystemBoundaryRenderer({ element, stencil }) {
  const { width: W } = sizeOf(element, stencil);
  const color = element.color || stencil?.color || '#64748b';
  const systemName = element.data?.systemName || element.label || 'System';
  const title = useSlot(element, { text: systemName, box: { x: 10, y: 6, width: Math.max(20, W - 20), height: 20 }, role: 'title', maxLines: 1, align: 'start', own: true });

  return (
    <div className="uml-frame" style={{ borderColor: color }}>
      <Slot r={title} d={2} color={color} />
    </div>
  );
}

// ============ ACTIVITY DIAGRAM RENDERERS ============

// Initial Node Renderer (filled circle)
function InitialNodeRenderer() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 30 30">
      <circle cx="15" cy="15" r="12" fill="#1f2937" />
    </svg>
  );
}

// Final Node Renderer (bullseye)
function FinalNodeRenderer() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 30 30">
      <circle cx="15" cy="15" r="13" fill="none" stroke="#1f2937" strokeWidth="2" />
      <circle cx="15" cy="15" r="8" fill="#1f2937" />
    </svg>
  );
}

// Flow Final Renderer (circle with X)
function FlowFinalRenderer() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 30 30">
      <circle cx="15" cy="15" r="12" fill="none" stroke="#6b7280" strokeWidth="2" />
      <line x1="8" y1="8" x2="22" y2="22" stroke="#6b7280" strokeWidth="2" />
      <line x1="22" y1="8" x2="8" y2="22" stroke="#6b7280" strokeWidth="2" />
    </svg>
  );
}

// Action Renderer (rounded rectangle)
function ActionRenderer({ element, stencil }) {
  const color = element.color || stencil?.color || '#3b82f6';
  const actionType = element.data?.actionType || 'call';

  const icon = actionType === 'send' ? '▶' : actionType === 'accept' ? '◀' : actionType === 'time' ? '⏱' : null;
  // the icon takes a column on the left; the label is laid out in the rest
  const base = policyFor('uml-class', stencil || { id: 'action' });
  const policy = useMemo(() => (icon ? { ...base, inset: { ...base.inset, l: 30 } } : base), [base, icon]);

  return (
    <div className="uml-action" style={{ borderColor: color }}>
      {icon && <span className="uml-action-icon">{icon}</span>}
      <ElementText packId="uml-class" element={element} stencil={stencil} policy={policy} text={element.label || 'Action'} color={DARK} offsetX={-2} offsetY={-2} />
    </div>
  );
}

// Decision/Merge Renderer (diamond)
function DecisionRenderer({ element, stencil }) {
  const color = element.color || stencil?.color || '#f59e0b';

  return (
    <svg width="100%" height="100%" viewBox="0 0 50 50">
      <polygon points="25,2 48,25 25,48 2,25" fill="white" stroke={color} strokeWidth="2" />
    </svg>
  );
}

// Fork/Join Renderer (thick bar)
function ForkJoinRenderer() {
  return <div className="uml-fork-join" />;
}

// Swimlane Renderer
function SwimlaneRenderer({ element, stencil }) {
  const { width: W } = sizeOf(element, stencil);
  const color = element.color || stencil?.color || '#e5e7eb';
  const responsible = element.data?.responsible || element.label || 'Lane';
  const title = useSlot(element, { text: responsible, box: { x: 8, y: 2, width: Math.max(20, W - 16), height: 24 }, role: 'title', maxLines: 1, align: 'center', own: true });

  return (
    <div className="uml-frame" style={{ borderColor: color }}>
      <div className="uml-lane-header" style={{ background: color }} />
      <Slot r={title} d={2} color={pickLabelColor(color)} />
    </div>
  );
}

// ============ STATE MACHINE RENDERERS ============

// State Renderer (rounded rectangle with compartments)
function StateRenderer({ element, stencil }) {
  const { width: W, height: H } = sizeOf(element, stencil);
  const color = element.color || stencil?.color || '#22c55e';
  const entry = element.data?.entry;
  const exit = element.data?.exit;
  const doActivity = element.data?.doActivity;
  const actions = [entry && `entry / ${entry}`, doActivity && `do / ${doActivity}`, exit && `exit / ${exit}`].filter(Boolean);
  const composite = element.type === 'composite-state';
  const headed = composite || actions.length > 0;
  const nameLines = composite ? 1 : 2;
  const title = useSlot(element, { text: element.label || 'State', box: { x: 10, y: 6, width: Math.max(20, W - 20), height: nameLines * 17.5 }, role: 'title', maxLines: nameLines, align: 'center', valign: 'top', own: true });
  const nameH = Math.ceil(Math.max(1, title.layout.lines.length) * title.layout.lineHeight);
  const ruleY = 6 + nameH + 4;

  return (
    <div className="uml-state" style={{ borderColor: color }}>
      {headed ? (
        <>
          <Slot r={title} d={2} color={DARK} />
          {actions.length > 0 && (
            <>
              <div className="uml-state-rule" style={{ top: ruleY - 2, borderColor: color }} />
              <ListText element={element} items={actions} mono={false} box={{ x: 10, y: ruleY + 2, width: Math.max(20, W - 20), height: Math.max(14, H - ruleY - 12) }} color={MUTED} testId="actions" />
            </>
          )}
        </>
      ) : (
        <ElementText packId="uml-class" element={element} stencil={stencil} color={DARK} offsetX={-2} offsetY={-2} />
      )}
    </div>
  );
}

// History Renderer
function HistoryRenderer({ element, stencil }) {
  const color = element.color || stencil?.color || '#6b7280';
  const isDeep = element.data?.historyType === 'deep';

  return (
    <svg width="100%" height="100%" viewBox="0 0 30 30">
      <circle cx="15" cy="15" r="12" fill="none" stroke={color} strokeWidth="2" />
      {/* ds-allow-text-style: the H / H* glyph of the history pseudo-state is part of the symbol, not a label */}
      <text x="15" y="19" textAnchor="middle" fontSize="12" fontWeight="bold" fill={color}>
        {isDeep ? 'H*' : 'H'}
      </text>
    </svg>
  );
}

// ============ SEQUENCE DIAGRAM RENDERERS ============

// Lifeline Renderer
function LifelineRenderer({ element, stencil }) {
  const { width: W } = sizeOf(element, stencil);
  const color = element.color || stencil?.color || '#3b82f6';
  const objectName = element.data?.objectName || element.label || 'object';
  const className = element.data?.className || '';
  const head = useSlot(element, { text: `${objectName}${className ? `:${className}` : ''}`, box: { x: 10, y: 8, width: Math.max(20, W - 20), height: 3 * 17.5 }, role: 'label', maxLines: 3, align: 'center', valign: 'top', own: true });
  const headH = Math.ceil(8 + Math.max(1, head.layout.lines.length) * head.layout.lineHeight + 8);

  return (
    <div className="uml-lifeline">
      {/* Header box */}
      <div className="uml-lifeline-head" style={{ borderColor: color, height: headH }} />
      <Slot r={head} color={DARK} />
      {/* Dashed lifeline */}
      <div className="uml-lifeline-line" style={{ borderColor: color, left: W / 2 - 1, top: headH + 4 }} />
    </div>
  );
}

// Activation Renderer (narrow bar on a lifeline)
function ActivationRenderer({ element, stencil }) {
  const color = element.color || stencil?.color || '#22c55e';
  return <div className="uml-activation" style={{ background: element.backgroundColor || color, borderColor: element.borderColor || color }} />;
}

// Combined Fragment Renderer
function CombinedFragmentRenderer({ element, stencil }) {
  const { width: W } = sizeOf(element, stencil);
  const color = element.color || stencil?.color || '#64748b';
  const fragmentType = element.data?.fragmentType || 'alt';
  const guard = element.data?.guard || element.label || element.name || '';
  const tab = useSlot(element, { text: fragmentType, box: { x: 8, y: 3, width: 52, height: 16 }, role: 'meta', maxLines: 1, align: 'start', weight: 600 });
  const g = useSlot(element, { text: guard, box: { x: 8, y: 26, width: Math.max(20, W - 16), height: 28 }, role: 'meta', maxLines: 2, align: 'start', valign: 'top', own: true });

  return (
    <div className="uml-frame" style={{ borderColor: color }}>
      {/* Fragment type label */}
      <div className="uml-fragment-tab" style={{ background: color }} />
      <Slot r={tab} d={2} color={pickLabelColor(color)} testId="fragment-type" />
      {/* Guard condition */}
      {guard && <Slot r={g} d={2} color={MUTED} testId="guard" />}
    </div>
  );
}

// Main render function that delegates to specific renderers
function renderNode(element, stencil, isSelected) {
  const marker = (node) => <Marker node={node} element={element} stencil={stencil} />;
  switch (element.type) {
    // Class Diagram
    case 'class':
    case 'abstract-class':
    case 'interface':
    case 'enum':
      return <UMLClassRenderer element={element} stencil={stencil} isSelected={isSelected} />;
    case 'package':
      return <UMLPackageRenderer element={element} stencil={stencil} isSelected={isSelected} />;
    case 'note':
      return <UMLNoteRenderer element={element} stencil={stencil} />;

    // Use Case Diagram
    case 'actor':
      return <ActorRenderer element={element} stencil={stencil} />;
    case 'use-case':
      return <UseCaseRenderer element={element} stencil={stencil} />;
    case 'system-boundary':
      return <SystemBoundaryRenderer element={element} stencil={stencil} />;

    // Activity Diagram
    case 'initial-node':
      return marker(<InitialNodeRenderer />);
    case 'final-node':
    case 'final-state':
      return marker(<FinalNodeRenderer />);
    case 'flow-final':
      return marker(<FlowFinalRenderer />);
    case 'action':
      return <ActionRenderer element={element} stencil={stencil} />;
    case 'decision':
    case 'choice':
      return marker(<DecisionRenderer element={element} stencil={stencil} />);
    case 'fork-join':
      return marker(<ForkJoinRenderer />);
    case 'swimlane':
      return <SwimlaneRenderer element={element} stencil={stencil} />;

    // State Machine
    case 'initial-state':
      return marker(<InitialNodeRenderer />);
    case 'state':
    case 'composite-state':
      return <StateRenderer element={element} stencil={stencil} />;
    case 'history':
      return marker(<HistoryRenderer element={element} stencil={stencil} />);

    // Sequence Diagram
    case 'activation':
      return marker(<ActivationRenderer element={element} stencil={stencil} />);
    case 'lifeline':
      return <LifelineRenderer element={element} stencil={stencil} />;
    case 'combined-fragment':
      return <CombinedFragmentRenderer element={element} stencil={stencil} />;

    default:
      return null; // Use default rendering
  }
}

// ============ PACK EXPORT ============

const UMLClassPack = {
  id: 'uml-class',
  name: 'UML Diagrams',
  description: 'Comprehensive UML: Class, Use Case, Activity, State Machine, Sequence diagrams',
  icon: '📐',
  stencils,
  connectionTypes,
  validators,
  templates,
  nodeProperties,
  renderNode, // Custom renderer for all UML elements
  defaultLineStyle: 'step', // UML uses orthogonal lines
};

export default UMLClassPack;
export { stencils, connectionTypes, validators, templates, nodeProperties };
