/**
 * ADR-0008 T2 review M2: a CLD loop marker is a circle of the shorter side, so its text box is the square inscribed in the
 * ring (not in the stored ellipse): a 120x80 loop never lets a label run wider than the ring.
 */
import { PACK_CATALOG } from '../../components/diagram-studio/packs/catalog';
import { policyFor, textBoxOf, boxForText } from '../../lib/text/policy';
import { layoutForElement, sizeForNewElement } from '../../lib/text/fit';
import { MIN_SIZE } from '../../lib/text/tokens';

const stencil = PACK_CATALOG.find((p) => p.id === 'cld').stencils.find((s) => s.id === 'reinforcing-loop');
const policy = policyFor('cld', stencil);
const LONG = 'R1 Escalating late deliveries and customer complaints';

describe('ring text box', () => {
  test('is a square centered in the box, inside the circle of the shorter side', () => {
    const size = { width: 120, height: 80 };
    const b = textBoxOf(policy, size);
    expect(b.width).toBeCloseTo(b.height, 6);
    expect(b.x + b.width / 2).toBeCloseTo(60, 6);
    expect(b.y + b.height / 2).toBeCloseTo(40, 6);
    const r = 40 - 2; // the drawn ring radius
    const corner = Math.hypot(b.width / 2, b.height / 2);
    expect(corner).toBeLessThan(r - 4); // inside the arrow that runs at r - 4 // clear of the arrow that runs at r - 4
  });

  test('boxForText is the inverse of textBoxOf (a circle)', () => {
    const b = textBoxOf(policy, { width: 90, height: 90 });
    const back = boxForText(policy, { width: b.width, height: b.height });
    expect(back.width).toBeCloseTo(90, 6);
    expect(back.height).toBeCloseTo(90, 6);
  });

  test('a long label in a 120x80 loop shrinks and ends with the badge, every line inside the ring square', () => {
    const el = { label: LONG, size: { width: 120, height: 80 } };
    const { layout, box } = layoutForElement(el, policy);
    expect(layout.fontSize).toBeGreaterThanOrEqual(MIN_SIZE);
    for (const l of layout.lines) expect(l.width).toBeLessThanOrEqual(box.width + 0.5);
    expect(layout.overflow || layout.fontSize <= 14).toBeTruthy();
    expect(layout.breaks.emergency === 0 || layout.overflow).toBeTruthy();
  });

  test('a new loop with a long label grows as a circle', () => {
    const s = sizeForNewElement('cld', stencil, LONG, {});
    expect(s.width).toBe(s.height);
    expect(s.width).toBeGreaterThan(50);
    expect(sizeForNewElement('cld', stencil, 'R', {})).toEqual({ width: 50, height: 50 });
  });
});
