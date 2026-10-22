/**
 * ADR-0008 T2: server-side sizing for the remaining packs (TOGAF, ITIL, CapabilityMap, ProductDesign, ERD, UML, CLD).
 * For every stencil of those packs and each of the audit's label variants, the size the server (and the editor) gives a new
 * element must hold the label: no overflow, no broken word, nothing under 11 px, an external label bounded and inside its
 * footprint. The same inputs always give the same sizes (determinism).
 */
import { PACK_CATALOG } from '../../components/diagram-studio/packs/catalog';
import { policyFor } from '../../lib/text/policy';
import { sizeForNewElement, sizeForStencilLabel, layoutForElement, layoutForExternal, layoutForTitle, externalFootprint } from '../../lib/text/fit';
import { applyOps } from '../../lib/mcp/ops';
import { MIN_SIZE } from '../../lib/text/tokens';

const T2 = ['togaf', 'itil', 'capability-map', 'product-design', 'erd', 'uml-class', 'cld'];
const C140 = 'Aggregate all inbound partner shipment notifications, reconcile them against open purchase orders and flag any discrepancies for review';
const VARIANTS = {
  w1: 'Billing',
  w3: 'Customer Order Service',
  c60: 'Validate payment details before confirming the customer order',
  c140: C140,
  ml: 'Order intake\nValidation\nFulfilment',
  num: 'p95 latency 250 ms / 1.2k req/s',
  de: 'Kundenzufriedenheitsanalyse',
  ja: '\u{9867}\u{5BA2}\u{6E80}\u{8DB3}\u{5EA6}\u{5206}\u{6790}\u{30B5}\u{30FC}\u{30D3}\u{30B9}',
  ar: '\u{062A}\u{062D}\u{0644}\u{064A}\u{0644} \u{0631}\u{0636}\u{0627} \u{0627}\u{0644}\u{0639}\u{0645}\u{0644}\u{0627}\u{0621}',
  emoji: '\u{1F680} Launch readiness \u{2705}',
};

const packs = PACK_CATALOG.filter((p) => T2.includes(p.id));

describe.each(packs.map((p) => [p.id, p]))('%s: a new element is sized from its label', (_id, pack) => {
  test.each(pack.stencils.map((s) => [s.id, s]))('%s', (_sid, stencil) => {
    const policy = policyFor(pack.id, stencil);
    for (const [vk, text] of Object.entries(VARIANTS)) {
      const size = sizeForNewElement(pack.id, stencil, text, {});
      const again = sizeForNewElement(pack.id, stencil, text, {});
      expect(again).toEqual(size); // deterministic
      expect(sizeForStencilLabel(pack.id, stencil, text)).toEqual(size); // the editor and the agent agree
      const el = { label: text, size };
      const tag = `${pack.id}/${stencil.id} ${vk}`;
      if (policy.slot === 'inside') {
        const { layout } = layoutForElement(el, policy);
        expect([tag, layout.overflow]).toEqual([tag, false]);
        expect([tag, layout.breaks.emergency]).toEqual([tag, 0]);
        expect(layout.fontSize).toBeGreaterThanOrEqual(MIN_SIZE);
      } else if (policy.slot === 'external') {
        const { layout, box } = layoutForExternal(el, policy);
        expect(layout.fontSize).toBeGreaterThanOrEqual(MIN_SIZE);
        expect(layout.lines.length).toBeLessThanOrEqual(policy.external.maxLines);
        expect(box.width).toBeLessThanOrEqual(240);
        const fp = externalFootprint(pack.id, stencil, text, { size });
        expect(fp).not.toBeNull();
      } else if (policy.slot === 'title') {
        const { layout } = layoutForTitle(el, policy);
        expect(layout.fontSize).toBeGreaterThanOrEqual(MIN_SIZE);
        expect(layout.lines.length).toBeLessThanOrEqual(1);
      }
      // a size never goes below the stencil default: a legacy default-sized board is the floor
      expect(size.width).toBeGreaterThanOrEqual(stencil.defaultSize.width);
      expect(size.height).toBeGreaterThanOrEqual(stencil.defaultSize.height);
    }
  });
});

describe('add_element for the T2 packs through the MCP applier', () => {
  const empty = () => ({ elements: [], connections: [], layers: [], groups: [], viewport: { x: 0, y: 0, zoom: 1 } });
  let seq = 0;
  const newId = () => `t2-${++seq}`;

  test('a long label gives a bigger box than the default for a node stencil of every T2 pack, and the same box twice', () => {
    const types = ['togaf/business-process', 'itil/incident', 'capability-map/cap-assessment', 'product-design/solution-node', 'cld/variable', 'uml-class/action'];
    const ops = types.map((type) => ({ op: 'add_element', type, label: C140 }));
    const a = applyOps(empty(), ops, { newId });
    const b = applyOps(empty(), ops, { newId });
    expect(a.ok).toBe(true);
    a.content.elements.forEach((e, i) => {
      const meta = packs.flatMap((p) => p.stencils.map((s) => ({ p, s }))).find((x) => `${x.p.id}/${x.s.id}` === types[i]);
      expect(e.size.width * e.size.height).toBeGreaterThan(meta.s.defaultSize.width * meta.s.defaultSize.height);
      expect(e.size).toEqual(b.content.elements[i].size);
    });
  });
});
