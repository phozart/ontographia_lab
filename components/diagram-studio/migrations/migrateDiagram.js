// components/diagram-studio/migrations/migrateDiagram.js
// Pure, idempotent migration of saved diagram content to current element types.
// Also derives explicit frame membership (parentFrameId) once for legacy frames.
import { deriveLegacyFrameMembership } from '../utils/frameMembership';

// Legacy element types (old starter templates) -> current stencil id + pack
const LEGACY_TYPE_MAP = {
  'central-idea': { type: 'central-topic', packId: 'mind-map' },
  branch: { type: 'main-topic', packId: 'mind-map' },
  'sticky-yellow': { type: 'sticky-medium', packId: 'sticky-notes' },
};

function migrateElements(list) {
  if (!Array.isArray(list)) return list;
  let changed = false;
  const next = list.map((el) => {
    const target = el && LEGACY_TYPE_MAP[el.type];
    if (!target) return el;
    changed = true;
    return { ...el, type: target.type, packId: target.packId };
  });
  const result = changed ? next : list;
  // Legacy frames (no `membershipExplicit`) adopt the shapes they geometrically
  // contain, exactly once; afterwards membership is explicit and persisted.
  return deriveLegacyFrameMembership(result);
}

/**
 * Migrate diagram content. Returns the same reference if nothing changed.
 * @param {object|null|undefined} content
 */
export function migrateDiagram(content) {
  if (!content || typeof content !== 'object') return content;
  const elements = migrateElements(content.elements);
  const nodes = migrateElements(content.nodes);
  if (elements === content.elements && nodes === content.nodes) return content;
  const out = { ...content };
  if (elements !== content.elements) out.elements = elements;
  if (nodes !== content.nodes) out.nodes = nodes;
  return out;
}

export default migrateDiagram;
