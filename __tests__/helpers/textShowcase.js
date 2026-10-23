// Fixtures for the ADR-0008 T3 parity suites: the audit's ten label variants, a mixed "showcase" board (every pack, labelled
// connections, frames, a table, a doc, text presets, long / CJK / Arabic / emoji labels) and one gallery board per pack
// (every stencil x every variant). Plain content objects, no I/O: the unit suite renders them in Node and the e2e suite
// puts the same content on a board.

const { PACK_CATALOG } = require('../../components/diagram-studio/packs/catalog');
const { sizeForStencilLabel, layoutForElement, layoutForExternal, layoutForTitle } = require('../../lib/text/fit');
const { policyFor, externalPolicy, forcesExternalLabel } = require('../../lib/text/policy');
const { labelSlotFor } = require('../../components/diagram-studio/packs/labelSlots');
const { layoutForSlot } = require('../../lib/text/fit');

const O = 50000;
const C140 = 'Aggregate all inbound partner shipment notifications, reconcile them against open purchase orders and flag any discrepancies for review';

/** The audit's ten label variants (w = words, c = characters). */
const VARIANTS = [
  ['w1', 'Billing'],
  ['w3', 'Customer Order Service'],
  ['c60', 'Validate payment details before confirming the customer order'],
  ['c140', C140],
  ['ml', 'Order intake\nValidation\nFulfilment'],
  ['num', 'p95 latency 250 ms / 1.2k req/s'],
  ['de', 'Kundenzufriedenheitsanalyse'],
  ['ja', '顧客満足度分析サービス'],
  ['ar', 'تحليل رضا العملاء'],
  ['emoji', '🚀 Launch readiness ✅'],
];
const V = Object.fromEntries(VARIANTS);

const content = (elements, connections = [], extra = {}) => ({
  elements, connections, layers: [], groups: [], viewport: { x: 0, y: 0, zoom: 1 }, ...extra,
});

const stencilOf = (packId, id) => {
  const pack = PACK_CATALOG.find((p) => p.id === packId);
  return pack && pack.stencils.find((s) => s.id === id);
};

const node = (packId, type, id, x, y, label, extra = {}) => {
  const st = stencilOf(packId, type);
  const def = (st && st.defaultSize) || { width: 120, height: 80 };
  return { id, type, packId, x: O + x, y: O + y, size: { width: def.width, height: def.height }, label, color: st?.color, layerId: 'default', properties: {}, ...extra };
};

const TABLE = {
  headerRow: true,
  headerColumn: false,
  columns: [{ id: 'col-1', name: 'Capability', type: 'text' }, { id: 'col-2', name: 'Score', type: 'number' }, { id: 'col-3', name: 'Status', type: 'select', options: [{ value: 'Ready', color: '#4FB3CE' }, { value: 'Blocked', color: '#E8A99A' }] }],
  rows: [
    { id: 'row-1', cells: { 'col-1': 'Customer onboarding and identity verification journey', 'col-2': 8, 'col-3': 'Ready' } },
    { id: 'row-2', cells: { 'col-1': '顧客満足度分析サービス', 'col-2': 5, 'col-3': 'Blocked' } },
    { id: 'row-3', cells: { 'col-1': 'Kundenzufriedenheitsanalyse', 'col-2': 3 } },
  ],
};

const DOC_MD = '## Findings\n\nThe order service is the hub: it validates payment details before confirming the customer order and flags any discrepancies for review.\n\n- Latency p95 250 ms\n- Backlog grows on Mondays\n\nA last paragraph with a long word Kundenzufriedenheitsanalyse inside it.';

/**
 * One board with a bit of everything. `cols` x rows of 250 x 170 cells for the nodes, a frame with a long title, a table, a doc,
 * three text presets and labelled connections on the right.
 */
function showcaseContent() {
  const picks = [
    ['core', 'rectangle', V.c140], ['core', 'circle', V.w1], ['core', 'diamond', V.w3], ['core', 'text-block', V.ml],
    ['process-flow', 'task', V.c60], ['process-flow', 'start-event', V.w3], ['process-flow', 'exclusive-gateway', V.w3], ['process-flow', 'subprocess', V.c140], ['process-flow', 'data-store', V.de],
    ['sticky-notes', 'sticky-medium', V.c140], ['sticky-notes', 'link-card', V.c60], ['sticky-notes', 'circle-marker', V.w3],
    ['cld', 'variable', V.w3], ['cld', 'stock', V.de], ['cld', 'reinforcing-loop', V.w1],
    ['uml-class', 'class', V.w3], ['uml-class', 'use-case', V.c60], ['uml-class', 'note', V.c140], ['uml-class', 'actor', V.w3],
    ['mind-map', 'central-topic', V.w3], ['mind-map', 'main-topic', V.c60], ['mind-map', 'callout', V.ja],
    ['product-design', 'insight-card', V.c140], ['product-design', 'outcome-node', V.ar], ['product-design', 'touchpoint', V.emoji],
    ['erd', 'entity', V.w3], ['erd', 'attribute', V.num], ['erd', 'relationship-chen', V.w3],
    ['togaf', 'business-actor', V.ja], ['togaf', 'application-component', V.c60], ['togaf', 'capability', V.ar],
    ['itil', 'incident', V.c60], ['itil', 'service', V.emoji],
    ['capability-map', 'cap-capability', V.c140], ['capability-map', 'cap-value-stream', V.w3],
  ];
  const COLS = 7;
  const CW = 190;
  const CH = 140;
  const elements = [];
  const frame = { id: 'fr1', type: 'frame', packId: 'core', x: O - 30, y: O - 70, size: { width: COLS * CW + 20, height: Math.ceil(picks.length / COLS) * CH + 60 }, label: 'Order to cash: Kundenzufriedenheitsanalyse 顧客満足度分析', layerId: 'default', properties: {} };
  elements.push(frame);
  picks.forEach(([packId, type, label], i) => {
    elements.push(node(packId, type, `n${i}`, (i % COLS) * CW, Math.floor(i / COLS) * CH, label));
  });
  const rows = Math.ceil(picks.length / COLS);
  const ry = rows * CH + 40;
  elements.push({ id: 'tbl1', type: 'table', packId: 'core', x: O, y: O + ry, size: { width: 520, height: 190 }, label: 'Capabilities', layerId: 'default', properties: {}, data: { table: TABLE } });
  elements.push({ id: 'doc1', type: 'doc', packId: 'core', x: O + 540, y: O + ry, size: { width: 360, height: 220 }, label: 'Architecture summary', layerId: 'default', properties: {}, data: { doc: { title: 'Architecture summary', markdown: DOC_MD } } });
  const preset = (id, x, y, w, h, p, md, fontSize) => ({ id, type: 'text-block', packId: 'core', x: O + x, y: O + y, size: { width: w, height: h }, label: md.replace(/\*|#/g, ''), fontSize, layerId: 'default', properties: {}, data: { text: { preset: p, markdown: md } } });
  elements.push(preset('p1', 940, ry, 420, 60, 'heading', 'Quarterly review', 32));
  elements.push(preset('p2', 940, ry + 70, 420, 110, 'body', 'The order service validates payment details, then confirms the customer order and flags discrepancies.', 16));
  elements.push(preset('p3', 940, ry + 190, 200, 80, 'number', '42%', 48));
  const conn = (id, s, t, label, extra = {}) => ({ id, sourceId: s, targetId: t, label, type: 'sequence-flow', lineStyle: 'curved', ...extra });
  const connections = [
    conn('k1', 'n0', 'n1', 'approved'), conn('k2', 'n1', 'n2', V.c60, { lineStyle: 'straight' }), conn('k3', 'n4', 'n5', 'then'),
    conn('k4', 'n7', 'n8', V.num, { lineStyle: 'step' }), conn('k5', 'n12', 'n13', 'reinforces'), conn('k6', 'n15', 'n16', C140.slice(0, 80), { lineStyle: 'straight' }),
  ];
  return content(elements, connections);
}

/** Stencils [from, to) of one pack (a board of up to 11 stencils stays under the culling threshold of 120 elements): every stencil x the ten variants at the stored default size (the "legacy board" path), in a grid. */
function galleryContent(packId, { sized = false, from = 0, to = Infinity } = {}) {
  const pack = PACK_CATALOG.find((p) => p.id === packId);
  const elements = [];
  let y = 0;
  // a table and a doc need their own data (and draw no node label): the showcase board has one of each
  pack.stencils.slice(from, to).filter((st) => st.shape !== 'table' && st.shape !== 'doc').forEach((st, si) => {
    const def = st.defaultSize || { width: 120, height: 80 };
    let rowH = 0;
    let x = 0;
    VARIANTS.forEach(([vid, label]) => {
      const size = sized ? sizeForStencilLabel(packId, st, label) : { width: def.width, height: def.height };
      // external labels, titles above a frame and rotated lane titles need room: generous gaps
      elements.push({ id: `${packId}-${st.id}-${vid}`, type: st.id, packId, x: O + x, y: O + y, size, label, color: st.color, layerId: 'default', properties: {} });
      x += size.width + 150;
      rowH = Math.max(rowH, size.height);
    });
    void si;
    y += rowH + 150;
  });
  return content(elements);
}

const NONE_SHAPES = new Set(['table', 'doc', 'line']);

/**
 * The main label block the canvas draws for `el` (a stencil's text slot), from the shared layout: { kind, layout, box } or null
 * when the stencil draws no node label (table, doc, line without an external label).
 */
function expectedBlock(el, stencil) {
  const policy = forcesExternalLabel(el.packId, el.type) ? externalPolicy(stencil) : policyFor(el.packId, stencil);
  if (NONE_SHAPES.has(stencil.shape) && !(stencil.shape === 'line' && policy.slot === 'external')) return null;
  if (policy.slot === 'none') return null;
  const bespoke = labelSlotFor(el.packId, el, stencil, policy);
  if (bespoke) {
    const r = layoutForSlot(el, { text: el.label, ...bespoke.spec });
    return { kind: 'inside', layout: r.layout, box: { ...r.box, x: bespoke.origin.x + r.box.x - bespoke.delta, y: bespoke.origin.y + r.box.y - bespoke.delta } };
  }
  const frameLike = stencil.shape === 'frame' || stencil.shape === 'section';
  if (frameLike || policy.slot === 'title') return { kind: 'title', ...layoutForTitle(el, policy, el.label) };
  if (policy.slot === 'external') return { kind: 'external', ...layoutForExternal(el, policy, el.label) };
  return { kind: 'inside', ...layoutForElement(el, policy, el.label) };
}

module.exports = { expectedBlock, O, C140, VARIANTS, V, content, node, showcaseContent, galleryContent, stencilOf };
