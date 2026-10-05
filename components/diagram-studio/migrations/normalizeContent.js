// components/diagram-studio/migrations/normalizeContent.js
// Pure, idempotent normalizer: any stored diagram `content` -> canonical shape
//   { elements, connections, layers, groups, viewport }   (docs/architecture/data-model.md)
//
// Handles legacy shapes found in existing rows:
//  - `nodes` / `edges` (init.sql samples, createDiagram default)         -> elements / connections
//  - the "double write" shape: the editor page used to PUT a second time with
//    { elements, ..., diagram: <row> }, nesting a full copy at content.diagram.content and
//    dropping `viewport`. The nested copy is discarded; its viewport (and any collection missing
//    at the top level) is recovered from it.
//
// Never mutates its input. Ids are preserved exactly.

export const DEFAULT_VIEWPORT = Object.freeze({ x: 0, y: 0, zoom: 1 });
export const DEFAULT_LAYER = Object.freeze({ id: 'default', name: 'Default', visible: true, locked: false, order: 0 });

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const asArray = (v) => (Array.isArray(v) ? v : null);

// Flatten content.diagram.content.diagram.content... into a list, outermost first
function layersOfNesting(content) {
  const chain = [];
  let cur = content;
  let guard = 0;
  while (isObj(cur) && guard++ < 20) {
    chain.push(cur);
    cur = isObj(cur.diagram) && isObj(cur.diagram.content) ? cur.diagram.content : null;
  }
  return chain;
}

function firstArray(chain, ...keys) {
  for (const layer of chain) {
    for (const k of keys) {
      const a = asArray(layer[k]);
      if (a) return a;
    }
  }
  return null;
}

function firstViewport(chain) {
  for (const layer of chain) {
    if (isObj(layer.viewport)) return layer.viewport;
  }
  return null;
}

/**
 * @param {*} content raw `diagrams.content` (or anything)
 * @returns {{elements:Array, connections:Array, layers:Array, groups:Array, viewport:Object}}
 */
export function normalizeDiagramContent(content) {
  const chain = layersOfNesting(content);
  const elements = firstArray(chain, 'elements', 'nodes') || [];
  const connections = firstArray(chain, 'connections', 'edges') || [];
  const layers = firstArray(chain, 'layers');
  const groups = firstArray(chain, 'groups') || [];
  const viewport = firstViewport(chain);

  return {
    elements: [...elements],
    connections: [...connections],
    layers: layers && layers.length > 0 ? [...layers] : [{ ...DEFAULT_LAYER }],
    groups: [...groups],
    viewport: viewport ? { ...viewport } : { ...DEFAULT_VIEWPORT },
  };
}

export default normalizeDiagramContent;
