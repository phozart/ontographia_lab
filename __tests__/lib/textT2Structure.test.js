/**
 * ADR-0008 T2: MCP placement for the remaining packs. map_structure sizes every T2 node from its label BEFORE layout (the
 * layout engines get the true box, external labels included), so boxes and their external label footprints never overlap,
 * every stencil of every T2 pack compiles with all ten audit label variants, and the result is deterministic.
 */
import { PACK_CATALOG } from '../../components/diagram-studio/packs/catalog';
import { compileMapStructure } from '../../lib/mcp/structure';
import { externalFootprint } from '../../lib/text/fit';

const T2 = ['togaf', 'itil', 'capability-map', 'product-design', 'erd', 'uml-class', 'cld'];
const C140 = 'Aggregate all inbound partner shipment notifications, reconcile them against open purchase orders and flag any discrepancies for review';
const VARIANTS = {
  w1: 'Billing', w3: 'Customer Order Service', c60: 'Validate payment details before confirming the customer order', c140: C140,
  ml: 'Order intake\nValidation\nFulfilment', num: 'p95 latency 250 ms / 1.2k req/s', de: 'Kundenzufriedenheitsanalyse',
  ja: '\u{9867}\u{5BA2}\u{6E80}\u{8DB3}\u{5EA6}\u{5206}\u{6790}\u{30B5}\u{30FC}\u{30D3}\u{30B9}',
  ar: '\u{062A}\u{062D}\u{0644}\u{064A}\u{0644} \u{0631}\u{0636}\u{0627} \u{0627}\u{0644}\u{0639}\u{0645}\u{0644}\u{0627}\u{0621}',
  emoji: '\u{1F680} Launch readiness \u{2705}',
};
let seq = 0;
const newId = (p) => `${p}-t2-${++seq}`;
const empty = () => ({ elements: [], connections: [], layers: [], groups: [], viewport: { x: 0, y: 0, zoom: 1 } });
const run = (nodes, layout = 'grid', edges = []) => compileMapStructure(empty(), { structure: { nodes, edges }, layout }, { newId });
const stencilOf = (packId, id) => PACK_CATALOG.find((p) => p.id === packId).stencils.find((s) => s.id === id);

/** Every element's layout footprint: its box plus the external label below or beside it. */
function footprints(content) {
  return content.elements.map((e) => {
    const type = e.type;
    const st = stencilOf(e.packId, type);
    const fp = st ? externalFootprint(e.packId, st, e.label, { size: e.size }) : null;
    let x0 = e.x;
    let y0 = e.y;
    let x1 = e.x + e.size.width;
    let y1 = e.y + e.size.height;
    if (fp) {
      if (fp.side === 'right') {
        x1 = Math.max(x1, e.x + e.size.width + fp.gap + fp.width);
      } else {
        y1 = Math.max(y1, e.y + e.size.height + fp.gap + fp.height);
        x0 = Math.min(x0, e.x + e.size.width / 2 - fp.width / 2);
        x1 = Math.max(x1, e.x + e.size.width / 2 + fp.width / 2);
      }
    }
    return { id: e.id, type, x0, y0, x1, y1 };
  });
}
const overlap = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

describe.each(T2)('map_structure on the %s pack', (packId) => {
  const pack = PACK_CATALOG.find((p) => p.id === packId);
  const nodes = [];
  for (const st of pack.stencils) for (const [k, label] of Object.entries(VARIANTS)) nodes.push({ key: `${st.id}__${k}`, label, stencil: `${packId}/${st.id}` });

  test('every stencil compiles with all ten label variants, no sizes given', () => {
    for (let i = 0; i < nodes.length; i += 100) {
      const r = run(nodes.slice(i, i + 100), 'grid');
      expect([packId, i, r.ok ? 'ok' : JSON.stringify(r.errors).slice(0, 300)]).toEqual([packId, i, 'ok']);
    }
  });

  test('boxes and their external label footprints never overlap in a grid', () => {
    const sample = nodes.filter((_, i) => i % 3 === 0).slice(0, 100);
    const r = run(sample, 'grid');
    expect(r.ok).toBe(true);
    const fps = footprints(r.content);
    for (let i = 0; i < fps.length; i++) {
      for (let j = i + 1; j < fps.length; j++) expect([fps[i].type, fps[j].type, overlap(fps[i], fps[j])]).toEqual([fps[i].type, fps[j].type, false]);
    }
  });

  test('a long label never gets a smaller box than a short one of the same stencil, and sizes are deterministic', () => {
    const st = pack.stencils.find((s) => !s.isContainer) || pack.stencils[0];
    const a = run([{ key: 'a', label: 'Billing', stencil: `${packId}/${st.id}` }]).content.elements[0].size;
    const b = run([{ key: 'a', label: C140, stencil: `${packId}/${st.id}` }]).content.elements[0].size;
    expect(b.width * b.height).toBeGreaterThanOrEqual(a.width * a.height);
    const geo = () => JSON.stringify(run([{ key: 'a', label: C140, stencil: `${packId}/${st.id}` }]).content.elements.map((e) => [e.x, e.y, e.size]));
    expect(geo()).toBe(geo());
  });

  test('tree layout with edges keeps boxes apart', () => {
    const st = pack.stencils.filter((s) => !s.isContainer).slice(0, 4);
    const ns = st.flatMap((s) => ['w3', 'c60', 'c140'].map((k) => ({ key: `${s.id}_${k}`, label: VARIANTS[k], stencil: `${packId}/${s.id}` })));
    const edges = ns.slice(1).map((n) => ({ from: ns[0].key, to: n.key }));
    const r = run(ns, 'tree', edges);
    expect(r.ok).toBe(true);
    const fps = footprints(r.content);
    for (let i = 0; i < fps.length; i++) for (let j = i + 1; j < fps.length; j++) expect(overlap(fps[i], fps[j])).toBe(false);
  });
});
