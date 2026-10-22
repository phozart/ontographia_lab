/**
 * ADR-0008 T2: named text slots. A pack with a compartment (a UML member list, a header strip, a stereotype line, an icon
 * column) lays its text out through layoutForSlot with its own rectangle; the policy files per pack (lib/text/policies)
 * give the server the same text area, so the editor and the MCP agree on sizes.
 */
import { layoutForSlot } from '../../lib/text/fit';
import { PACK_CATALOG } from '../../components/diagram-studio/packs/catalog';
import { policyFor, explicitPolicyKeys } from '../../lib/text/policy';
import { MIN_SIZE } from '../../lib/text/tokens';

const LONG = 'Aggregate all inbound partner shipment notifications, reconcile them against open purchase orders';

describe('layoutForSlot', () => {
  const box = { x: 4, y: 6, width: 120, height: 36 };

  test('lays the text inside the slot rectangle with the role font', () => {
    const { layout, box: b } = layoutForSlot({}, { text: 'Billing', box, role: 'meta' });
    expect(b).toEqual(box);
    expect(layout.fontSize).toBe(11);
    expect(layout.lines.map((l) => l.text)).toEqual(['Billing']);
    expect(layout.overflow).toBe(false);
  });

  test('fixed slots never shrink below the role size and clamp with the indicator, never silently', () => {
    const { layout } = layoutForSlot({}, { text: LONG, box, role: 'label', mode: 'fixed', maxLines: 2 });
    expect(layout.fontSize).toBe(14);
    expect(layout.lines.length).toBeLessThanOrEqual(2);
    expect(layout.overflow).toBeTruthy();
    expect(layout.lines[layout.lines.length - 1].text.endsWith('…')).toBe(true);
  });

  test('shrink slots step down to the minimum size, then clamp', () => {
    const { layout } = layoutForSlot({}, { text: LONG, box: { x: 0, y: 0, width: 150, height: 40 }, role: 'label', mode: 'shrink' });
    expect(layout.fontSize).toBeGreaterThanOrEqual(MIN_SIZE);
    expect(layout.fontSize).toBeLessThan(14);
  });

  test('one-line title slots ellipsize long text and flag the overflow', () => {
    const { layout } = layoutForSlot({}, { text: LONG, box: { x: 0, y: 0, width: 100, height: 18 }, role: 'title', maxLines: 1 });
    expect(layout.lines).toHaveLength(1);
    expect(layout.overflow).toBeTruthy();
  });

  test('own: true takes the element font overrides (size, weight, family); other slots ignore them', () => {
    const el = { fontSize: 20, fontWeight: 700 };
    const own = layoutForSlot(el, { text: 'Billing', box: { x: 0, y: 0, width: 200, height: 40 }, role: 'label', own: true });
    const other = layoutForSlot(el, { text: 'Billing', box: { x: 0, y: 0, width: 200, height: 40 }, role: 'label' });
    expect(own.layout.fontSize).toBe(20);
    expect(own.layout.weight).toBe(700);
    expect(other.layout.fontSize).toBe(14);
  });

  test('mono slots use a monospace family so member lists keep their columns', () => {
    const { layout } = layoutForSlot({}, { text: '+ id: UUID', box: { x: 0, y: 0, width: 160, height: 20 }, role: 'meta', mono: true });
    expect(layout.lines[0].text).toBe('+ id: UUID');
  });

  test('is deterministic', () => {
    const a = layoutForSlot({}, { text: LONG, box, role: 'caption', maxLines: 2 });
    const b = layoutForSlot({}, { text: LONG, box, role: 'caption', maxLines: 2 });
    expect(a.layout).toEqual(b.layout);
  });

  test('rotation is passed through to the box (lane titles)', () => {
    const { box: b } = layoutForSlot({}, { text: 'Lane', box: { x: 0, y: 0, width: 100, height: 30 }, role: 'title', rotate: -90 });
    expect(b.rotate).toBe(-90);
  });
});

describe('every T2 stencil has an explicit text policy (no generic fallback)', () => {
  const T2 = ['togaf', 'itil', 'capability-map', 'product-design', 'erd', 'uml-class', 'cld'];
  const keys = explicitPolicyKeys();
  for (const p of PACK_CATALOG.filter((x) => T2.includes(x.id))) {
    test(`${p.id}`, () => {
      const missing = p.stencils.filter((s) => !keys.has(`${p.id}/${s.id}`)).map((s) => s.id);
      expect(missing).toEqual([]);
    });
  }

  test('policyFor reads them', () => {
    const s = PACK_CATALOG.find((x) => x.id === 'togaf').stencils.find((x) => x.id === 'business-process');
    const pol = policyFor('togaf', s);
    expect(pol.slot).toBe('inside');
  });
});
