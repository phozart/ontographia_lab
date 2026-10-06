// Pure stencil catalog (data only, no React). Consumed by the packs (rendering) and the MCP server (lib/mcp).
// __tests__/lib/catalog.test.js asserts that this stays equal to the registered packs.

import * as core from './core';
import * as processFlow from './process-flow';
import * as stickyNotes from './sticky-notes';
import * as cld from './cld';
import * as umlClass from './uml-class';
import * as mindMap from './mind-map';
import * as productDesign from './product-design';
import * as erd from './erd';
import * as togaf from './togaf';
import * as itil from './itil';
import * as capabilityMap from './capability-map';

const pack = (id, name, description, icon, mod, sidebar = true) => ({
  id,
  name,
  description,
  icon,
  sidebar,
  stencils: mod.stencils,
  connectionTypes: mod.connectionTypes,
});

/** Every pack that can render elements. `sidebar:false` packs are reachable only through annotation tools. */
export const PACK_CATALOG = Object.freeze([
  pack('core', 'Core', 'Basic shapes and organizational elements', '⬜', core),
  pack('process-flow', 'Process Flows', 'Process flow diagrams with tasks, events, gateways, and swimlanes', '📊', processFlow),
  pack('sticky-notes', 'Sticky Notes', 'Freeform canvas with sticky notes for brainstorming', '📝', stickyNotes, false),
  pack('cld', 'Causal Loop Diagram', 'System dynamics causal loop diagrams with polarity', '🔄', cld),
  pack('uml-class', 'UML Diagrams', 'Comprehensive UML: Class, Use Case, Activity, State Machine, Sequence diagrams', '📐', umlClass),
  pack('mind-map', 'Mind Map', 'Hierarchical mind maps for idea organization', '🧠', mindMap),
  pack('product-design', 'Product Design', 'Structured canvases for product discovery, strategy, and validation', '🎨', productDesign),
  pack('erd', 'Entity Relationship Diagram', 'Database design with entities, fields, and relationships', '🗄️', erd),
  pack('togaf', 'TOGAF / ArchiMate', 'Enterprise architecture with TOGAF/ArchiMate notation', '🏛️', togaf),
  pack('itil', 'ITIL Service Management', 'ITIL 4 IT Service Management diagrams', '🔧', itil),
  pack('capability-map', 'Capability Map', 'Business capability modeling and operating model design', '🎯', capabilityMap),
]);

export function getPackCatalog(packId) {
  return PACK_CATALOG.find((p) => p.id === packId) || null;
}

/** Find a stencil by its element `type` (stencil id, optionally namespaced as `<pack>/<id>`). */
export function findStencilMeta(type, packId) {
  if (typeof type !== 'string') return null;
  let pid = packId;
  let sid = type;
  const slash = type.indexOf('/');
  if (slash > 0) {
    pid = type.slice(0, slash);
    sid = type.slice(slash + 1);
  }
  const packs = pid ? [getPackCatalog(pid)].filter(Boolean) : PACK_CATALOG;
  for (const p of packs) {
    const s = p.stencils.find((st) => st.id === sid);
    if (s) return { packId: p.id, stencil: s };
  }
  return null;
}
