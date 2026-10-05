// components/diagram-studio/migrations/migrateDiagram.js
// Pure, idempotent migration of saved diagram content to current element types.

const MIND_MAP_PACK_ID = 'mind-map';

// Legacy element types (old Mind Map starter template) -> current Mind Map stencil ids
const LEGACY_TYPE_MAP = {
  'central-idea': 'central-topic',
  branch: 'main-topic',
};

function migrateElements(list) {
  if (!Array.isArray(list)) return list;
  let changed = false;
  const next = list.map((el) => {
    const target = el && LEGACY_TYPE_MAP[el.type];
    if (!target) return el;
    changed = true;
    return { ...el, type: target, packId: MIND_MAP_PACK_ID };
  });
  return changed ? next : list;
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
