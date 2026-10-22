/**
 * ADR-0008 T2: the TOGAF and ITIL packs draw every label through the shared text layout (pinned lines, 11 px minimum,
 * overflow badge with the full text), the icon sits in its own column beside the label, and rendering never writes data.
 */
import React from 'react';
import { render } from '@testing-library/react';
import TOGAFPack from '../../../components/diagram-studio/packs/TOGAFPack';
import ITILPack from '../../../components/diagram-studio/packs/ITILPack';
import { policyFor } from '../../../lib/text/policy';
import { sizeForStencilLabel } from '../../../lib/text/fit';
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

let errorSpy;
beforeEach(() => {
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => errorSpy.mockRestore());

function draw(pack, stencil, label, size) {
  const el = { id: 'n1', type: stencil.id, packId: pack.id, label, x: 0, y: 0, size: size || { ...stencil.defaultSize } };
  const frozen = JSON.stringify(el);
  const out = render(<div>{pack.renderNode(el, stencil, false)}</div>);
  expect(JSON.stringify(el)).toBe(frozen); // rendering never writes
  return out;
}
const blocks = (c) => [...c.container.querySelectorAll('[data-text-block]')];
const lines = (b) => b.textContent.replace(/⋯.*$/s, '').split('\n');

describe.each([['TOGAF', TOGAFPack], ['ITIL', ITILPack]])('%s labels go through the shared layout', (_n, pack) => {
  test.each(pack.stencils.filter((s) => pack.id !== 'itil' || ['svc-plan', 'service', 'incident', 'problem', 'known-error', 'ci', 'stakeholder', 'cmdb'].includes(s.id)).map((s) => [s.id, s]))('%s', (_id, stencil) => {
    for (const [vk, text] of Object.entries(VARIANTS)) {
      for (const size of [undefined, sizeForStencilLabel(pack.id, stencil, text)]) {
        const c = draw(pack, stencil, text, size);
        const bs = blocks(c);
        const label = bs.find((b) => b.getAttribute('data-text-block') !== 'meta');
        const tag = `${pack.id}/${stencil.id} ${vk}`;
        // not browser-wrapped, nothing under 11 px, no CSS clamp, no SVG text label
        expect([tag, !!label]).toEqual([tag, true]);
        for (const b of bs) expect(parseFloat(b.getAttribute('data-font-size'))).toBeGreaterThanOrEqual(MIN_SIZE);
        expect(c.container.querySelector('text')).toBeNull();
        expect(c.container.innerHTML).not.toMatch(/-webkit-line-clamp|text-overflow:|nowrap/);
        // a clamped label says so and keeps the full text as its tooltip
        const badge = label.querySelector('[data-text-overflow]');
        if (label.getAttribute('data-overflow') === 'true') {
          expect(badge).not.toBeNull();
          expect(badge.getAttribute('title')).toBe(text);
        } else {
          expect(lines(label).join(' ').replace(/\s+/g, '')).toContain(text.replace(/\s+/g, '').replace(/-/g, '').slice(0, 3));
        }
      }
    }
  });
});

describe('TOGAF: the icon is its own column, not stacked over the label', () => {
  const iconStencils = TOGAFPack.stencils.filter((s) => !['business-actor', 'stakeholder', 'application-component', 'system-software'].includes(s.id) && !s.isContainer);
  test.each(iconStencils.map((s) => [s.id, s]))('%s: the text area starts right of the icon and keeps the padding', (_id, stencil) => {
    const policy = policyFor('togaf', stencil);
    expect(policy.slot).toBe('inside');
    expect(policy.inset.l).toBeGreaterThanOrEqual(34);
    expect(Math.min(policy.inset.t, policy.inset.b, policy.inset.r)).toBeGreaterThanOrEqual(6);
  });

  test('a default-size label block sits right of the icon and clear of the bottom border', () => {
    const stencil = TOGAFPack.stencils.find((s) => s.id === 'business-process');
    const c = draw(TOGAFPack, stencil, 'Order handling');
    const b = blocks(c)[0];
    const left = parseFloat(b.style.left);
    const top = parseFloat(b.style.top);
    const height = parseFloat(b.style.paddingTop || '0') + 18.2 * lines(b).length;
    expect(left).toBeGreaterThanOrEqual(34);
    expect(stencil.defaultSize.height - (top + height)).toBeGreaterThanOrEqual(6);
  });

  test('containers draw a one-line title in the header with the icon indent and an ellipsis badge when it is too long', () => {
    const stencil = TOGAFPack.stencils.find((s) => s.id === 'grouping');
    const c = draw(TOGAFPack, stencil, C140);
    const b = blocks(c)[0];
    expect(b.getAttribute('data-overflow')).toBe('true');
    expect(parseFloat(b.style.left)).toBeGreaterThanOrEqual(28);
    expect(lines(b)).toHaveLength(1);
  });
});

describe('ITIL', () => {
  test('incident and problem keep their status header as a meta-size slot and the label below it', () => {
    for (const id of ['incident', 'problem']) {
      const stencil = ITILPack.stencils.find((s) => s.id === id);
      const c = draw(ITILPack, stencil, 'Disk full');
      const bs = blocks(c);
      expect(bs.length).toBeGreaterThanOrEqual(2);
      const header = bs.find((b) => b.getAttribute('data-text-block') === 'meta');
      const label = bs.find((b) => b.getAttribute('data-text-block') !== 'meta');
      expect(parseFloat(header.getAttribute('data-font-size'))).toBe(11);
      expect(parseFloat(label.style.top)).toBeGreaterThanOrEqual(parseFloat(header.style.top) + 14);
    }
  });

  test('the stakeholder label is a text block below the figure, not SVG text hugging the bottom', () => {
    const stencil = ITILPack.stencils.find((s) => s.id === 'stakeholder');
    const c = draw(ITILPack, stencil, 'Customer representative');
    expect(c.container.querySelector('text')).toBeNull();
    const b = blocks(c)[0];
    expect(parseFloat(b.style.top)).toBeGreaterThanOrEqual(56);
  });
});
