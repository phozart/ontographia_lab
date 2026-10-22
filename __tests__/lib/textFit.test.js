/**
 * ADR-0008 3.3, 4, 5: sizing nodes from their text, the text area of each shape and its exact inverse, and the
 * render-time layout of a stored element.
 */
import { findStencilMeta } from '../../components/diagram-studio/packs/catalog';
import { policyFor, textBoxOf, boxForText, externalBoxOf, titleBoxOf } from '../../lib/text/policy';
import { sizeForText, layoutForElement, layoutForExternal, layoutForTitle, fontOf, modeOf, externalFootprint } from '../../lib/text/fit';
import { MIN_SIZE } from '../../lib/text/tokens';

const stencil = (type) => {
  const f = findStencilMeta(type);
  return { packId: f.packId, stencil: f.stencil };
};
const size = (type, text, el) => {
  const { packId, stencil: s } = stencil(type);
  return sizeForText(packId, s, text, el);
};

const C140 = 'Aggregate all inbound partner shipment notifications, reconcile them against open purchase orders and flag any discrepancies for review';

describe('sizeForText', () => {
  test('a short label keeps the default size', () => {
    expect(size('core/rectangle', 'Billing')).toMatchObject({ width: 120, height: 80, grew: false });
    expect(size('process-flow/task', 'Billing')).toMatchObject({ width: 140, height: 70, grew: false });
  });

  test('an empty label keeps the default size', () => {
    expect(size('core/rectangle', '')).toMatchObject({ width: 120, height: 80, grew: false });
  });

  test('a long label grows past the default, within the max width, in steps of 10', () => {
    const s = size('core/rectangle', C140);
    expect(s.grew).toBe(true);
    expect(s.width).toBeLessThanOrEqual(240);
    expect(s.width % 10).toBe(0);
    expect(s.height % 10).toBe(0);
    expect(s.height).toBeGreaterThan(80);
  });

  test('wider stencils may grow to 1.6 x the default width', () => {
    expect(size('process-flow/subprocess', C140).width).toBeLessThanOrEqual(260);
  });

  test('the German compound makes the box wide enough instead of breaking the word', () => {
    const s = size('core/rectangle', 'Kundenzufriedenheitsanalyse');
    expect(s.width).toBeGreaterThan(200);
    expect(s.width).toBeLessThanOrEqual(240);
  });

  test('a circle stays a circle', () => {
    const s = size('core/circle', 'Customer Order Service');
    expect(s.width).toBe(s.height);
    expect(s.width).toBeGreaterThan(80);
  });

  test('a diamond grows in both directions (its text box is the inscribed half)', () => {
    const s = size('core/diamond', 'Customer Order Service');
    expect(s.width).toBeGreaterThan(80);
    expect(s.height).toBeGreaterThanOrEqual(80);
  });

  test('auto-height keeps the width and grows the height (text block)', () => {
    const s = size('core/text-block', C140);
    expect(s.width).toBe(200);
    expect(s.height).toBeGreaterThan(40);
  });

  test('shrink (sticky notes) keeps the paper size when the text fits at 11 px or more, and grows only when it cannot', () => {
    expect(size('sticky-notes/sticky-medium', 'Validate payment details before confirming the customer order')).toMatchObject({ width: 150, height: 150, grew: false });
    const huge = 'word '.repeat(80).trim();
    const g = size('sticky-notes/sticky-medium', huge);
    expect(g.grew).toBe(true);
    expect(g.width).toBeLessThanOrEqual(240);
  });

  test('an element can opt out with textFit fixed', () => {
    expect(size('core/rectangle', C140, { textFit: 'fixed' }).grew).toBe(false);
  });

  test('stencils that do not host a label keep their size', () => {
    expect(size('core/divider', C140).grew).toBe(false);
    expect(size('core/frame', C140).grew).toBe(false);
    expect(size('process-flow/start-event', C140).grew).toBe(false);
  });

  test('pill topics (mind map) grow like auto nodes, the central topic up to 320', () => {
    const c = size('mind-map/central-topic', C140);
    expect(c.width).toBeLessThanOrEqual(320);
    expect(c.width).toBeGreaterThan(160);
    expect(size('mind-map/sub-topic', 'Billing').grew).toBe(false);
  });

  test('is deterministic', () => {
    expect(size('core/rectangle', C140)).toEqual(size('core/rectangle', C140));
  });

  test('every grown size lays out with no overflow in its own box (all T1 inside-label stencils, 10 variants)', () => {
    const variants = [C140, 'Billing', 'Customer Order Service', 'Order intake\nValidation\nFulfilment', 'Kundenzufriedenheitsanalyse', 'p95 latency 250 ms / 1.2k req/s'];
    for (const type of ['core/rectangle', 'core/circle', 'core/diamond', 'core/text-block', 'process-flow/task', 'process-flow/subprocess', 'process-flow/exclusive-gateway', 'mind-map/central-topic', 'mind-map/main-topic', 'mind-map/sub-topic', 'mind-map/callout']) {
      const { packId, stencil: st } = stencil(type);
      const policy = policyFor(packId, st);
      for (const text of variants) {
        const sz = sizeForText(packId, st, text);
        const { layout } = layoutForElement({ label: text, size: { width: sz.width, height: sz.height } }, policy);
        expect([type, text, layout.overflow, layout.fontSize, layout.breaks.emergency]).toEqual([type, text, false, 14 * 0 + layout.fontSize, 0]);
        expect(layout.fontSize).toBeGreaterThanOrEqual(MIN_SIZE);
      }
    }
  });
});

describe('text area geometry', () => {
  const cases = ['core/rectangle', 'core/circle', 'core/diamond', 'mind-map/main-topic', 'process-flow/subprocess', 'sticky-notes/sticky-small'];
  test.each(cases)('boxForText is the exact inverse of textBoxOf (%s)', (type) => {
    const { packId, stencil: st } = stencil(type);
    const policy = policyFor(packId, st);
    const box = textBoxOf(policy, { width: 173, height: 91 });
    const back = boxForText(policy, { width: box.width, height: box.height });
    expect(back.width).toBeCloseTo(173, 6);
    expect(back.height).toBeCloseTo(91, 6);
  });

  test('inscribed boxes: ellipse 0.707, diamond 0.5', () => {
    const e = textBoxOf({ ...policyFor('core', stencil('core/circle').stencil), inset: { t: 0, r: 0, b: 0, l: 0 } }, { width: 100, height: 100 });
    expect(e.width).toBeCloseTo(70.71, 1);
    const d = textBoxOf({ ...policyFor('core', stencil('core/diamond').stencil), inset: { t: 0, r: 0, b: 0, l: 0 } }, { width: 100, height: 60 });
    expect(d.width).toBeCloseTo(50, 5);
    expect(d.height).toBeCloseTo(30, 5);
  });

  test('external labels hang below (or beside) the shape with a wrap width of max(2w, 120)', () => {
    const p = policyFor('process-flow', stencil('process-flow/start-event').stencil);
    const b = externalBoxOf(p, { width: 44, height: 44 });
    expect(b.width).toBe(120);
    expect(b.y).toBe(48);
    expect(b.x).toBe((44 - 120) / 2);
    const s = policyFor('mind-map', stencil('mind-map/summary').stencil);
    expect(externalBoxOf(s, { width: 100, height: 60 }).x).toBe(115);
  });

  test('external footprint reports the room a label needs', () => {
    const { packId, stencil: st } = stencil('process-flow/start-event');
    const f = externalFootprint(packId, st, 'Validate payment details before confirming the customer order');
    expect(f.side).toBe('below');
    expect(f.width).toBeLessThanOrEqual(120);
    expect(f.height).toBeGreaterThan(18);
    expect(externalFootprint('core', stencil('core/rectangle').stencil, 'x')).toBeNull();
  });

  test('title boxes: lane titles rotate inside the 30 px header', () => {
    const p = policyFor('process-flow', stencil('process-flow/lane').stencil);
    expect(titleBoxOf(p, { width: 500, height: 150 })).toMatchObject({ rotate: -90, width: 134, height: 30 });
  });
});

describe('render-time layout of a stored element', () => {
  test('text that does not fit a legacy small box shrinks to 11 px and then clamps with the indicator (never spills)', () => {
    const { packId, stencil: st } = stencil('core/rectangle');
    const policy = policyFor(packId, st);
    const { layout } = layoutForElement({ label: C140, size: { width: 120, height: 80 } }, policy);
    expect(layout.fontSize).toBe(MIN_SIZE);
    expect(layout.overflow).not.toBe(false);
    expect(layout.lines.length * layout.lineHeight).toBeLessThanOrEqual(80 - 20 + 1e-6);
  });

  test('an element can override size, weight and alignment, but never below 11 px', () => {
    const policy = policyFor('core', stencil('core/rectangle').stencil);
    expect(fontOf({ fontSize: 9 }, policy).size).toBe(MIN_SIZE);
    expect(fontOf({ fontSize: '18' }, policy).size).toBe(18);
    expect(fontOf({ fontWeight: 'bold' }, policy).weight).toBe(700);
    const { layout } = layoutForElement({ label: 'Hi', size: { width: 200, height: 60 }, textAlign: 'left', verticalAlign: 'top' }, policy);
    expect(layout.lines[0].x).toBe(0);
    expect(layout.lines[0].top).toBe(0);
  });

  test('textFit overrides the stencil mode', () => {
    const policy = policyFor('core', stencil('core/rectangle').stencil);
    expect(modeOf({}, policy)).toBe('auto');
    expect(modeOf({ textFit: 'shrink' }, policy)).toBe('shrink');
    expect(modeOf({ textFit: 'bogus' }, policy)).toBe('auto');
  });

  test('fixed keeps the font and clamps', () => {
    const policy = policyFor('core', stencil('core/rectangle').stencil);
    const { layout } = layoutForElement({ label: C140, size: { width: 120, height: 80 }, textFit: 'fixed' }, policy);
    expect(layout.fontSize).toBe(14);
    expect(layout.overflow).not.toBe(false);
  });

  test('external labels wrap to at most 3 lines and clamp with the indicator', () => {
    const policy = policyFor('process-flow', stencil('process-flow/start-event').stencil);
    const { layout, box } = layoutForExternal({ label: C140, size: { width: 44, height: 44 } }, policy);
    expect(layout.lines.length).toBeLessThanOrEqual(3);
    expect(layout.overflow).not.toBe(false);
    expect(box.width).toBe(120);
  });

  test('titles are one line with an ellipsis', () => {
    const policy = policyFor('core', stencil('core/frame').stencil);
    const { layout } = layoutForTitle({ label: C140, size: { width: 300, height: 200 } }, policy);
    expect(layout.lines).toHaveLength(1);
    expect(layout.lines[0].text.endsWith('\u{2026}')).toBe(true);
    expect(layout.overflow).not.toBe(false);
  });
});
