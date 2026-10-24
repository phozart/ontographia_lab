// Fixtures for the diagram_show fidelity spike (ADR-0009): a representative "Checkout" board (core shapes, sticky notes, process
// flow, a UML class, an ERD entity, TOGAF elements, labelled connections with endpoint labels, a frame, a table and a doc card) and
// a generator for large boards (frames of mixed stencils with labelled connections) for the budget tests. Plain content objects.

const { PACK_CATALOG } = require('../../components/diagram-studio/packs/catalog');

const stencilOf = (packId, id) => PACK_CATALOG.find((p) => p.id === packId)?.stencils.find((s) => s.id === id);

/** An element as the editor creates it (color = the stencil colour, the stencil's default size unless given). */
function el(packId, type, id, x, y, label, extra = {}) {
  const st = stencilOf(packId, type);
  if (!st) throw new Error(`unknown stencil ${packId}/${type}`);
  const size = extra.size || { ...(st.defaultSize || { width: 120, height: 80 }) };
  return { id, type, packId, name: st.name, label, x, y, size, color: st.color, layerId: 'default', properties: {}, ...extra, ...(extra.size ? {} : { size }) };
}

const conn = (id, sourceId, targetId, extra = {}) => ({ id, sourceId, targetId, lineStyle: 'step', autoPorts: true, ...extra });

const TABLE = {
  headerRow: true,
  headerColumn: false,
  columns: [{ id: 'col-m', name: 'Method', type: 'text' }, { id: 'col-s', name: 'Share %', type: 'number' }, { id: 'col-st', name: 'Status', type: 'select', options: [{ value: 'Live', color: '#4FB3CE' }, { value: 'Pilot', color: '#F0D98A' }] }],
  rows: [
    { id: 'row-1', cells: { 'col-m': 'Saved card', 'col-s': 54, 'col-st': 'Live' } },
    { id: 'row-2', cells: { 'col-m': 'PayPal', 'col-s': 31, 'col-st': 'Live' } },
    { id: 'row-3', cells: { 'col-m': 'Apple Pay', 'col-s': 15, 'col-st': 'Pilot' } },
  ],
};

const DOC_MD = '## Findings\n\nGuests drop at the address step (40%). Signed-in users pay with a saved card in two clicks.\n\n- Add Apple Pay to the pilot\n- Prefill the address from the last order';

function checkoutBoard() {
  const elements = [
    { id: 'fr-checkout', type: 'frame', packId: 'core', name: 'Frame', label: 'Checkout process', x: 0, y: 0, size: { width: 1010, height: 310 }, color: '#64748b', layerId: 'default', properties: {}, data: { backgroundColor: '#ffffff', showTitle: true } },
    el('process-flow', 'start-event', 'pf-start', 40, 128, 'Cart'),
    el('process-flow', 'task', 'pf-address', 130, 115, 'Enter shipping address'),
    el('process-flow', 'exclusive-gateway', 'pf-signed', 335, 115, 'Signed in?'),
    el('process-flow', 'task', 'pf-pay', 520, 115, 'Pay with saved card', { data: { taskType: 'user' } }),
    el('process-flow', 'task', 'pf-signin', 520, 220, 'Offer sign-in'),
    el('process-flow', 'data-store', 'pf-db', 735, 20, 'Orders DB'),
    el('process-flow', 'end-event', 'pf-end', 900, 128, 'Done'),
    el('sticky-notes', 'sticky-medium', 'st-drop', 1050, 0, '40% drop at the address step'),
    el('sticky-notes', 'sticky-medium', 'st-apple', 1220, 0, 'Users ask for Apple Pay', { color: '#93c5fd' }),
    el('core', 'rectangle', 'co-fraud', 1050, 200, 'Fraud check'),
    el('core', 'circle', 'co-sla', 1205, 200, 'SLA 2s'),
    el('core', 'diamond', 'co-risk', 1320, 200, 'Risk?'),
    el('uml-class', 'class', 'uml-order', 0, 380, 'Order', { size: { width: 200, height: 150 }, data: { attributes: ['- id: UUID', '- total: Money', '- status: OrderStatus'], methods: ['+ place(): void', '+ cancel(): void'] } }),
    el('erd', 'entity', 'erd-orders', 300, 380, 'orders', { size: { width: 200, height: 150 }, data: { fields: [{ name: 'id', dataType: 'uuid', isPrimaryKey: true }, { name: 'customer_id', dataType: 'uuid', isForeignKey: true }, { name: 'total', dataType: 'numeric(10,2)' }, { name: 'status', dataType: 'text' }] } }),
    el('togaf', 'application-component', 'tg-checkout', 600, 380, 'Checkout Service'),
    el('togaf', 'business-actor', 'tg-customer', 600, 500, 'Customer'),
    el('togaf', 'node', 'tg-k8s', 800, 380, 'Kubernetes cluster'),
    { id: 'tbl-pay', type: 'table', packId: 'core', name: 'Table', label: 'Payment methods', x: 1000, y: 380, size: { width: 380, height: 130 }, color: '#4FB3CE', layerId: 'default', properties: {}, data: { table: TABLE } },
    { id: 'doc-findings', type: 'doc', packId: 'core', name: 'Doc', label: 'Checkout findings', x: 1000, y: 560, size: { width: 380, height: 200 }, color: '#4FB3CE', layerId: 'default', properties: {}, data: { doc: { title: 'Checkout findings', markdown: DOC_MD } } },
  ];
  const connections = [
    conn('c1', 'pf-start', 'pf-address'),
    conn('c2', 'pf-address', 'pf-signed'),
    conn('c3', 'pf-signed', 'pf-pay', { label: 'yes' }),
    conn('c4', 'pf-signed', 'pf-signin', { label: 'no' }),
    conn('c5', 'pf-pay', 'pf-db', { label: 'writes order' }),
    conn('c6', 'pf-pay', 'pf-end', { label: 'confirmed' }),
    conn('c7', 'uml-order', 'erd-orders', { label: 'persisted as', lineStyle: 'straight', sourceLabel: '1', targetLabel: '1..*' }),
    conn('c8', 'tg-checkout', 'tg-k8s', { label: 'runs on', lineStyle: 'straight' }),
    conn('c9', 'tg-customer', 'tg-checkout', { label: 'uses', lineStyle: 'curved' }),
    conn('c10', 'st-drop', 'pf-address', { label: 'evidence', lineStyle: 'curved', dashed: true }),
  ];
  return { elements, connections, layers: [], groups: [], viewport: { x: 0, y: 0, zoom: 1 } };
}

// Stencils used to fill the large boards: the common ones from every pack, as people use them.
const MIX = [
  ['process-flow', 'task'], ['process-flow', 'task'], ['process-flow', 'exclusive-gateway'], ['process-flow', 'start-event'], ['process-flow', 'data-store'],
  ['sticky-notes', 'sticky-medium'], ['sticky-notes', 'sticky-medium'], ['core', 'rectangle'], ['core', 'circle'],
  ['togaf', 'application-component'], ['togaf', 'business-actor'], ['togaf', 'node'], ['togaf', 'capability'],
  ['uml-class', 'class'], ['erd', 'entity'], ['mind-map', 'main-topic'], ['capability-map', 'cap-capability'], ['itil', 'incident'], ['cld', 'variable'], ['product-design', 'insight-card'],
];
const WORDS = ['Order', 'Payment', 'Customer', 'Invoice', 'Shipment', 'Refund', 'Catalog', 'Pricing', 'Identity', 'Ledger', 'Fraud', 'Search', 'Basket', 'Loyalty', 'Returns', 'Warehouse'];
const VERBS = ['Validate', 'Create', 'Approve', 'Notify', 'Reconcile', 'Archive', 'Score', 'Route'];

/** A board of `n` elements in frames of 12 x 10 cells (180 x 130), every third pair connected, a third of those labelled. */
function largeBoard(n = 2000, { framesOf = 120 } = {}) {
  const elements = [];
  const connections = [];
  const CW = 200;
  const CH = 150;
  const COLS = 12;
  const frameW = COLS * CW + 40;
  const frameH = Math.ceil(framesOf / COLS) * CH + 40;
  const framesPerRow = 4;
  let i = 0;
  let f = 0;
  while (i < n) {
    const fx = (f % framesPerRow) * (frameW + 200);
    const fy = Math.floor(f / framesPerRow) * (frameH + 260);
    elements.push({ id: `fr${f}`, type: 'frame', packId: 'core', name: 'Frame', label: `${WORDS[f % WORDS.length]} domain ${f + 1}`, x: fx, y: fy, size: { width: frameW, height: frameH }, color: '#64748b', layerId: 'default', properties: {}, data: { backgroundColor: '#ffffff', showTitle: true } });
    for (let k = 0; k < framesOf && i < n; k += 1, i += 1) {
      const [p, t] = MIX[i % MIX.length];
      const st = stencilOf(p, t);
      const w = Math.min(st.defaultSize?.width || 120, 170);
      const h = Math.min(st.defaultSize?.height || 80, 120);
      const label = `${VERBS[i % VERBS.length]} ${WORDS[(i * 7) % WORDS.length]} ${i}`;
      elements.push(el(p, t, `e${i}`, fx + 20 + (k % COLS) * CW, fy + 30 + Math.floor(k / COLS) * CH, label, { size: { width: w, height: h } }));
      if (k > 0 && i % 3 === 0) connections.push(conn(`k${i}`, `e${i - 1}`, `e${i}`, i % 9 === 0 ? { label: VERBS[(i / 9) % VERBS.length] } : {}));
    }
    f += 1;
  }
  return { elements, connections, layers: [], groups: [], viewport: { x: 0, y: 0, zoom: 1 } };
}

module.exports = { checkoutBoard, largeBoard, stencilOf };
