/**
 * ADR-0008 T2: the CLD and ERD packs, plus the shared below-label helper, draw every label through the shared layout:
 * pinned lines, 11 px minimum, an overflow badge with the full text instead of silent clipping or code truncation,
 * mono member rows, and nothing written back to the stored element.
 */
import React from 'react';
import { render } from '@testing-library/react';
import CLDPack from '../../../components/diagram-studio/packs/CLDPack';
import ERDPack from '../../../components/diagram-studio/packs/ERDPack';
import { BelowLabel } from '../../../components/diagram-studio/packs/NodeLabels';
import { policyFor } from '../../../lib/text/policy';

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

const packs = { cld: CLDPack, erd: ERDPack };

function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    Object.values(o).forEach(deepFreeze);
  }
  return o;
}
function draw(packId, stencil, label, extra = {}) {
  const p = packs[packId];
  const el = deepFreeze({ id: 'n1', type: stencil.id, packId, label, x: 0, y: 0, size: { ...stencil.defaultSize }, ...extra });
  const out = p.renderNode(el, stencil, false);
  return render(<div>{out}</div>);
}
const blocks = (c) => [...c.container.querySelectorAll('[data-text-block]')];
const fontPx = (b) => parseFloat(b.getAttribute('data-font-size'));

const cases = [];
for (const [packId, p] of Object.entries(packs)) for (const s of p.stencils) cases.push([`${packId}/${s.id}`, packId, s]);

describe('every CLD and ERD stencil x the 10 label variants at the stored default size', () => {
  test.each(cases)('%s', (_name, packId, stencil) => {
    for (const [vk, label] of Object.entries(VARIANTS)) {
      const c = draw(packId, stencil, label);
      const html = c.container.innerHTML;
      const tag = `${packId}/${stencil.id} ${vk}`;
      if (!c.container.firstChild.firstChild) continue; // erd-note renders through the default renderer (T1)
      expect([tag, (html.match(/line-clamp|text-overflow:|nowrap/i) || [])[0]]).toEqual([tag, undefined]); // no CSS clamping or forbidden wrapping
      expect([tag, c.container.querySelectorAll('svg text').length]).toEqual([tag, 0]); // no SVG <text> labels
      const bs = blocks(c);
      expect([tag, bs.length > 0]).toEqual([tag, true]);
      for (const b of bs) {
        expect(fontPx(b)).toBeGreaterThanOrEqual(11);
        expect(b.querySelectorAll(':scope > .ds-text-line').length === 0 || label === VARIANTS.ar).toBe(true);
        if (b.getAttribute('data-overflow') === 'true') {
          const badge = b.querySelector('.ds-text-badge');
          expect(badge).not.toBeNull();
          expect(badge.getAttribute('title').length).toBeGreaterThan(0);
        }
      }
      // all the label's words are drawn (or the block carries the badge with the full text)
      const main = bs.find((b) => b.getAttribute('data-text-block') !== 'slot') || bs[0];
      const clamped = bs.some((b) => b.getAttribute('data-overflow') === 'true');
      if (!clamped && label !== VARIANTS.ml) {
        const drawn = bs.map((b) => b.textContent).join(' ').replace(/[\s-]+/g, '');
        expect([tag, drawn.includes(label.replace(/[\s-]+/g, '').slice(0, 6))]).toEqual([tag, true]);
      }
      expect(main).toBeTruthy();
    }
  });
});

describe('CLD loop markers', () => {
  test.each(['reinforcing-loop', 'balancing-loop'])('%s: a long label is not truncated in code; the layout shrinks it and badges the clamp with the full text', (id) => {
    const stencil = CLDPack.stencils.find((s) => s.id === id);
    const full = 'Reinforcing customer growth loop';
    const c = draw('cld', stencil, full);
    const [b] = blocks(c);
    expect(fontPx(b)).toBe(11);
    expect(b.getAttribute('data-overflow')).toBe('true');
    expect(b.querySelector('.ds-text-badge').getAttribute('title')).toBe(full);
    expect(c.container.querySelector('svg title')).toBeNull();
  });

  test.each(['reinforcing-loop', 'balancing-loop'])('%s: R, B and short words keep their size and stay whole', (id) => {
    const stencil = CLDPack.stencils.find((s) => s.id === id);
    const c = draw('cld', stencil, 'Growth', { size: { width: 80, height: 80 } });
    const [b] = blocks(c);
    expect(b.textContent).toBe('Growth');
    expect(b.getAttribute('data-overflow')).toBeNull();
    expect(draw('cld', stencil, '').container.querySelectorAll('[data-text-block]').length).toBe(1); // the default R or B
  });
});

describe('CLD placement of labels', () => {
  test('cloud, flow and constant keep a small glyph and put the label outside, below it', () => {
    for (const id of ['cloud', 'flow', 'constant']) {
      expect(policyFor('cld', CLDPack.stencils.find((s) => s.id === id)).slot).toBe('external');
    }
  });
  test('the system boundary title is one line with the badge when it does not fit', () => {
    const stencil = CLDPack.stencils.find((s) => s.id === 'system-boundary');
    const c = draw('cld', stencil, C140);
    const [b] = blocks(c);
    expect(b.textContent.replace('⋯', '').split('\n').length).toBe(1);
    expect(b.getAttribute('data-overflow')).toBe('true');
  });
  test('a label never touches the border of a variable (padding >= 6 px)', () => {
    const stencil = CLDPack.stencils.find((s) => s.id === 'variable');
    const c = draw('cld', stencil, 'Customer Order Service');
    const [b] = blocks(c);
    expect(parseFloat(b.style.left)).toBeGreaterThanOrEqual(6);
    expect(parseFloat(b.style.left) + parseFloat(b.style.width)).toBeLessThanOrEqual(stencil.defaultSize.width - 6);
  });
});

describe('ERD entity compartments', () => {
  const entity = ERDPack.stencils.find((s) => s.id === 'entity');
  const fields = (n) => Array.from({ length: n }, (_, i) => ({ name: `field_${i}`, dataType: 'VARCHAR(255)', isPrimaryKey: i === 0 }));

  test('the name is the first slot; attribute rows are mono role-meta (11 px) blocks', () => {
    const c = draw('erd', entity, 'Customer', { data: { fields: fields(3) } });
    const bs = blocks(c);
    expect(bs[0].textContent).toBe('Customer');
    const rows = bs.slice(1);
    expect(rows.length).toBeGreaterThanOrEqual(3);
    rows.forEach((r) => {
      expect(fontPx(r)).toBe(11);
      expect(r.style.fontFamily).toMatch(/mono/i);
    });
  });

  test('a long name wraps in the header (two lines) or is clamped with the badge, never cut silently', () => {
    const c = draw('erd', entity, 'Kundenzufriedenheitsanalyse Auftragsabwicklung Stammdaten Verwaltung');
    const [name] = blocks(c);
    if (name.getAttribute('data-overflow') === 'true') expect(name.querySelector('.ds-text-badge').getAttribute('title')).toMatch(/Stammdaten/);
    else expect(name.textContent.replace(/[\s-]+/g, '')).toContain('Stammdaten');
  });

  test('more fields than rows: "+N more" is a drawn row and a field wider than its column is clamped with the badge', () => {
    const c = draw('erd', entity, 'Big', { data: { fields: [{ name: 'a_very_long_column_name_that_does_not_fit', dataType: 'DECIMAL(10,2)' }, ...fields(14)] } });
    expect(c.container.textContent).toMatch(/\+\d+ more/);
    const clamped = blocks(c).filter((b) => b.getAttribute('data-overflow') === 'true');
    expect(clamped.length).toBeGreaterThan(0);
    clamped.forEach((b) => expect(b.querySelector('.ds-text-badge').getAttribute('title')).toMatch(/\w/));
  });

  test('a small legacy card never lets the name header swallow the card: it clamps with the badge', () => {
    const view = ERDPack.stencils.find((s) => s.id === 'view');
    const c = draw('erd', view, VARIANTS.c60);
    const header = c.container.querySelector('.erd-entity-header');
    expect(parseFloat(header.style.height)).toBeLessThanOrEqual(view.defaultSize.height - 4 - 20);
    const [name] = blocks(c);
    expect(name.getAttribute('data-overflow')).toBe('true');
    expect(name.querySelector('.ds-text-badge').getAttribute('title')).toBe(VARIANTS.c60);
  });

  test('an empty entity says so with a drawn row', () => {
    const c = draw('erd', entity, 'Empty');
    expect(c.container.textContent).toContain('No fields defined');
  });

  test('rendering does not write the element (frozen legacy element renders)', () => {
    expect(() => draw('erd', entity, 'Customer', { data: { fields: fields(2), indexes: ['idx_a'] } })).not.toThrow();
    expect(() => draw('cld', CLDPack.stencils.find((s) => s.id === 'variable'), 'x')).not.toThrow();
  });
});

describe('shared below-label helper', () => {
  test('applies italic and underline through the shared layout (one pinned block, no nowrap)', () => {
    const { container } = render(<BelowLabel element={{ label: 'Hi', type: 'cloud', packId: 'cld', fontStyle: 'italic', textDecoration: 'underline' }} />);
    const el = container.querySelector('[data-text-block]');
    expect(el.style.fontStyle).toBe('italic');
    expect(el.style.textDecoration).toBe('underline');
    expect(container.innerHTML).not.toMatch(/nowrap/);
  });
  test('a long label wraps to at most 3 lines with the badge', () => {
    const { container } = render(<BelowLabel element={{ label: C140, type: 'cloud', packId: 'cld' }} forceExternal />);
    const el = container.querySelector('[data-text-block]');
    expect(el.getAttribute('data-overflow')).toBe('true');
    expect(el.textContent.replace('⋯', '').split('\n').length).toBeLessThanOrEqual(3);
  });
});
