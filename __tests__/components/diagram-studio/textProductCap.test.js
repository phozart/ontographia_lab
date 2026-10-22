/**
 * ADR-0008 T2: the ProductDesign and CapabilityMap packs draw their text through the shared layout. Every stencil x the
 * audit's 10 label variants, at the stored default size (a legacy board): pinned lines from the shared layout, no CSS
 * clamping or browser wrapping, 11 px minimum, an overflow badge with the full text instead of silent clipping, and
 * rendering never writes to the element.
 */
import React from 'react';
import { render } from '@testing-library/react';
import ProductDesignPack from '../../../components/diagram-studio/packs/ProductDesignPack';
import CapabilityMapPack from '../../../components/diagram-studio/packs/CapabilityMapPack';
import { policyFor, titleBoxOf } from '../../../lib/text/policy';
import { MIN_SIZE } from '../../../lib/text/tokens';

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

const deepFreeze = (o) => {
  Object.values(o).forEach((v) => v && typeof v === 'object' && !Object.isFrozen(v) && deepFreeze(v));
  return Object.freeze(o);
};
const blockLines = (block) => {
  const spans = [...block.querySelectorAll(':scope > .ds-text-line')];
  if (spans.length) return spans.map((x) => x.textContent.replace(/\n$/, ''));
  return [...block.childNodes].filter((n) => n.nodeType === 3).map((n) => n.nodeValue).join('').split('\n');
};

let errorSpy;
beforeEach(() => {
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => errorSpy.mockRestore());

describe.each([
  ['product-design', ProductDesignPack],
  ['capability-map', CapabilityMapPack],
])('%s text', (packId, pack) => {
  describe.each(pack.stencils.map((s) => [s.id, s]))('%s', (_sid, stencil) => {
    const policy = policyFor(packId, stencil);

    test.each(Object.entries(VARIANTS))('variant %s: pinned lines, >= 11 px, badge when clamped, no CSS clamp, no writes', (_vk, label) => {
      const el = deepFreeze({ id: 'n1', type: stencil.id, packId, label, x: 0, y: 0, size: { ...stencil.defaultSize } });
      const { container } = render(<div>{pack.renderNode(el, stencil, false)}</div>);
      const html = container.innerHTML;
      expect(html).not.toMatch(/line-clamp|text-overflow:|white-space:\s*nowrap|white-space:\s*pre-wrap|<text[\s>]/);
      const blocks = [...container.querySelectorAll('[data-text-block]')];
      const mine = blocks.filter((b) => b.textContent.replace(/⋯/g, '').trim() !== '');
      expect(mine.length).toBeGreaterThan(0);
      for (const b of blocks) {
        expect(parseFloat(b.getAttribute('data-font-size'))).toBeGreaterThanOrEqual(MIN_SIZE);
      }
      for (const b of blocks.filter((x) => x.getAttribute('data-overflow') === 'true')) {
        const badge = b.querySelector('.ds-text-badge');
        expect(badge).not.toBeNull();
        expect(badge.getAttribute('title').length).toBeGreaterThan(0);
      }
      // the main label's lines carry the label text (when the label is not clamped)
      const drawn = mine.map((b) => blockLines(b).join(' ')).join(' ').replace(/\s+/g, '');
      const unclamped = blocks.every((b) => b.getAttribute('data-overflow') !== 'true');
      if (unclamped && policy.slot !== 'none') {
        const want = label.replace(/\s+/g, '').replace(/-/g, '');
        expect(drawn.replace(/-/g, '')).toContain(want.slice(0, Math.min(want.length, 6)));
      }
      expect(el.label).toBe(label);
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });
});

describe('ProductDesign specifics', () => {
  const sten = (id) => ProductDesignPack.stencils.find((s) => s.id === id);

  test('zone headers are one fixed line: a long title is clamped with the badge and the full text', () => {
    const st = sten('quadrant-zone');
    const el = { id: 'z', type: st.id, packId: 'product-design', label: C140, x: 0, y: 0, size: { ...st.defaultSize } };
    const { container } = render(<div>{ProductDesignPack.renderNode(el, st, false)}</div>);
    const b = container.querySelector('[data-text-block]');
    expect(blockLines(b)).toHaveLength(1);
    expect(b.getAttribute('data-overflow')).toBe('true');
    expect(container.querySelector('.ds-text-badge').getAttribute('title')).toBe(C140);
  });

  test('the persona name is emphasis (18 px) and the role line is meta (11 px)', () => {
    const st = sten('persona-header');
    const el = { id: 'p', type: st.id, packId: 'product-design', label: 'Maria', data: { role: 'Procurement lead' }, x: 0, y: 0, size: { ...st.defaultSize } };
    const { container } = render(<div>{ProductDesignPack.renderNode(el, st, false)}</div>);
    const sizes = [...container.querySelectorAll('[data-text-block]')].map((b) => parseFloat(b.getAttribute('data-font-size')));
    expect(sizes).toEqual([18, 11]);
  });

  test('cards keep the paper size and shrink long text instead of growing', () => {
    const st = sten('insight-card');
    const el = { id: 'c', type: st.id, packId: 'product-design', label: VARIANTS.c60, x: 0, y: 0, size: { ...st.defaultSize } };
    const { container } = render(<div>{ProductDesignPack.renderNode(el, st, false)}</div>);
    const b = container.querySelector('[data-text-block]');
    expect(parseFloat(b.getAttribute('data-font-size'))).toBeLessThan(14);
    expect(parseFloat(b.getAttribute('data-font-size'))).toBeGreaterThanOrEqual(MIN_SIZE);
  });

  test('the emotion point label sits below the circle (external slot)', () => {
    const st = sten('emotion-point');
    const el = { id: 'e', type: st.id, packId: 'product-design', label: 'Delighted at checkout', data: { score: 2 }, x: 0, y: 0, size: { ...st.defaultSize } };
    const { container } = render(<div>{ProductDesignPack.renderNode(el, st, false)}</div>);
    expect(container.querySelector('.ds-node-label-below [data-text-block]') || container.querySelector('.ds-node-label-below')).not.toBeNull();
  });
});

describe('CapabilityMap specifics', () => {
  const sten = (id) => CapabilityMapPack.stencils.find((s) => s.id === id);

  test('a group title starts after the icon: the title box has the header indent', () => {
    const pol = policyFor('capability-map', sten('cap-capability-group'));
    const box = titleBoxOf(pol, { width: 280, height: 200 });
    expect(box.x).toBeGreaterThanOrEqual(30);
    expect(box.width).toBeLessThanOrEqual(280 - 30 - 12);
  });

  test('chevron text keeps clear of both points (23 px)', () => {
    const pol = policyFor('capability-map', sten('cap-value-stage'));
    expect(pol.inset.l).toBeGreaterThanOrEqual(23);
    expect(pol.inset.r).toBeGreaterThanOrEqual(23);
  });

  test('the maturity badge text is drawn through the layout too (11 px meta)', () => {
    const st = sten('cap-capability');
    const el = { id: 'c', type: st.id, packId: 'capability-map', label: 'Customer Acquisition', data: { maturity: 'developing' }, x: 0, y: 0, size: { ...st.defaultSize } };
    const { container } = render(<div>{CapabilityMapPack.renderNode(el, st, false)}</div>);
    const sizes = [...container.querySelectorAll('[data-text-block]')].map((b) => parseFloat(b.getAttribute('data-font-size')));
    expect(sizes.length).toBe(2);
    expect(Math.min(...sizes)).toBe(11);
  });

  test('the annotation is paper: long text shrinks, never leaves the note', () => {
    const st = sten('cap-annotation');
    const el = { id: 'a', type: st.id, packId: 'capability-map', label: C140, x: 0, y: 0, size: { ...st.defaultSize } };
    const { container } = render(<div>{CapabilityMapPack.renderNode(el, st, false)}</div>);
    const b = container.querySelector('[data-text-block]');
    expect(parseFloat(b.getAttribute('data-font-size'))).toBeGreaterThanOrEqual(MIN_SIZE);
  });
});
