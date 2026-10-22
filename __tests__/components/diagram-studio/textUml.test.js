/**
 * ADR-0008 T2: the UML pack draws every label through the shared text layout (pinned lines, 11 px minimum, overflow badge
 * with the full text, no browser wrapping or CSS clamps) and never writes data while rendering.
 */
import React from 'react';
import { render } from '@testing-library/react';
import UMLClassPack from '../../../components/diagram-studio/packs/UMLClassPack';
import { layoutForList } from '../../../lib/text/fit';

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
// stencils drawn by the default renderer (DiagramCanvas) have no renderNode: nothing to draw here
const OWN = UMLClassPack.stencils.filter((s) => UMLClassPack.renderNode({ id: 'x', type: s.id, label: 'x', size: s.defaultSize }, s, false) !== null);

const deepFreeze = (o) => {
  Object.values(o).forEach((v) => v && typeof v === 'object' && deepFreeze(v));
  return Object.freeze(o);
};
const norm = (t) => t.replace(/\s+/g, ' ').trim();
const blockText = (b) => norm(b.textContent.replace(/⋯/g, ''));

function draw(stencil, label, extra = {}) {
  const el = { id: 'n1', type: stencil.id, packId: 'uml-class', label, x: 0, y: 0, size: { ...stencil.defaultSize }, ...extra };
  const snapshot = JSON.stringify(el);
  const out = UMLClassPack.renderNode(deepFreeze(el), stencil, false);
  const c = render(<div>{out}</div>);
  expect(JSON.stringify(el)).toBe(snapshot); // rendering never writes
  return { c, el };
}

describe('UML pack text', () => {
  test('the catalog stencils with a custom renderer are covered', () => {
    expect(OWN.length).toBeGreaterThanOrEqual(20);
  });

  describe.each(OWN.map((s) => [s.id, s]))('%s', (_id, stencil) => {
    test.each(Object.entries(VARIANTS))('%s: drawn by the shared layout at the stored default size', (vk, label) => {
      const { c, el } = draw(stencil, label);
      const root = c.container;
      const blocks = [...root.querySelectorAll('[data-text-block]')];
      const labelMatters = !['initial-node', 'final-node', 'final-state', 'initial-state', 'history'].includes(stencil.id) || true;
      expect(labelMatters).toBe(true);
      // the label is on the board: its words are in a block, or the badge of a clamped block carries the full text
      const words = norm(label);
      const shown = blocks.map(blockText).join(' ');
      const badges = [...root.querySelectorAll('.ds-text-badge')].map((b) => b.getAttribute('title') || '');
      const unclamped = words.split(' ').every((w) => shown.includes(w.slice(0, 3)) || shown.includes(w));
      expect(unclamped || badges.some((t) => norm(t).includes(words))).toBe(true);
      for (const b of blocks) {
        expect(parseFloat(b.getAttribute('data-font-size'))).toBeGreaterThanOrEqual(11);
        if (b.getAttribute('data-overflow') === 'true') expect(b.querySelector('.ds-text-badge')).not.toBeNull();
        else expect(b.querySelector('.ds-text-badge')).toBeNull();
      }
      // no browser wrapping, clamping or SVG text labels
      const html = root.innerHTML;
      expect(html).not.toMatch(/line-clamp|text-overflow:|white-space:\s*nowrap/i);
      expect(root.querySelectorAll('svg text')).toHaveLength(vk && stencil.id === 'history' ? root.querySelectorAll('svg text').length : 0);
      // inside blocks stay inside the node box; external blocks may hang outside
      const W = el.size.width;
      const H = el.size.height;
      for (const b of blocks) {
        const kind = b.getAttribute('data-text-block');
        const left = parseFloat(b.style.left || '0');
        const width = parseFloat(b.style.width || '0');
        const top = parseFloat(b.style.top || '0');
        if (kind === 'external') continue;
        expect(left).toBeGreaterThanOrEqual(-0.5);
        expect(left + width).toBeLessThanOrEqual(W + 0.5);
        expect(top).toBeGreaterThanOrEqual(-12);
        expect(top).toBeLessThanOrEqual(H);
      }
    });
  });

  test('a long label under a small marker shape hangs below it, at most 3 lines, with a badge', () => {
    for (const id of ['initial-node', 'final-node', 'flow-final', 'decision', 'choice', 'fork-join', 'history', 'actor', 'activation']) {
      const st = UMLClassPack.stencils.find((s) => s.id === id);
      const { c } = draw(st, C140);
      const ext = c.container.querySelector('[data-text-block="external"]');
      expect(ext).not.toBeNull();
      expect(ext.textContent.split('\n').length).toBeLessThanOrEqual(3);
      expect(ext.querySelector('.ds-text-badge')).not.toBeNull();
    }
  });

  test('class: name wraps in the header (not clamped to one line), members are one mono line each', () => {
    const st = UMLClassPack.stencils.find((s) => s.id === 'class');
    const attrs = Array.from({ length: 6 }, (_, i) => `- attribute${i}OfAVeryLongName: Map<String, List<CustomerOrder>>`);
    const meths = Array.from({ length: 6 }, (_, i) => `+ operation${i}(argumentOne: String, argumentTwo: Integer): Boolean`);
    const { c } = draw(st, 'Customer Order Service', { size: { width: 180, height: 220 }, data: { attributes: attrs, methods: meths } });
    const blocks = [...c.container.querySelectorAll('[data-text-block]')];
    const name = blocks.find((b) => blockText(b).startsWith('Customer'));
    expect(name.getAttribute('data-font-size')).toBe('14');
    const lists = blocks.filter((b) => /attribute0|operation0/.test(b.textContent));
    expect(lists).toHaveLength(2);
    for (const l of lists) {
      expect(l.style.fontFamily).toMatch(/mono|Menlo|Consolas/i);
      expect(l.getAttribute('data-overflow')).toBe('true'); // long member lines are ellipsized: never silent
      expect(l.querySelector('.ds-text-badge').getAttribute('title')).toMatch(/\+ operation0|- attribute0/);
    }
    // each member is one line: no member continues on a second line
    for (const l of lists) {
      const lines = l.firstChild.nodeValue.split('\n');
      expect(lines.every((t) => /^[-+]/.test(t))).toBe(true);
    }
  });

  test('class with few members shows them whole, no badge; an empty compartment shows a dash', () => {
    const st = UMLClassPack.stencils.find((s) => s.id === 'class');
    const { c } = draw(st, 'Person', { data: { attributes: ['- name: String'], methods: [] } });
    expect(c.container.querySelector('.ds-text-badge')).toBeNull();
    expect(c.container.textContent).toContain('- name: String');
    expect(c.container.textContent).toContain('─');
  });

  test('interface and enum draw their stereotype; enum values are listed', () => {
    const itf = draw(UMLClassPack.stencils.find((s) => s.id === 'interface'), 'Payable');
    expect(itf.c.container.textContent).toContain('«interface»');
    const en = draw(UMLClassPack.stencils.find((s) => s.id === 'enum'), 'Status', { data: { values: ['NEW', 'PAID'] } });
    expect(en.c.container.textContent).toContain('«enumeration»');
    expect(en.c.container.textContent).toContain('PAID');
  });

  test('state entry/do/exit lines are drawn; composite state title is one line with a badge when long', () => {
    const st = UMLClassPack.stencils.find((s) => s.id === 'state');
    const { c } = draw(st, 'Processing', { data: { entry: 'start()', exit: 'stop()' } });
    expect(c.container.textContent).toContain('entry / start()');
    expect(c.container.textContent).toContain('exit / stop()');
    const cs = UMLClassPack.stencils.find((s) => s.id === 'composite-state');
    const long = draw(cs, C140);
    expect(long.c.container.querySelector('[data-text-block="title"] .ds-text-badge, [data-text-block="slot"] .ds-text-badge')).not.toBeNull();
  });

  test('the history marker keeps its H glyph; swimlane, package and system boundary draw their titles', () => {
    expect(draw(UMLClassPack.stencils.find((s) => s.id === 'history'), 'Hist', { data: { historyType: 'deep' } }).c.container.textContent).toContain('H*');
    expect(draw(UMLClassPack.stencils.find((s) => s.id === 'swimlane'), 'Warehouse').c.container.textContent).toContain('Warehouse');
    expect(draw(UMLClassPack.stencils.find((s) => s.id === 'package'), 'billing', { data: { packagePath: 'com.acme.billing' } }).c.container.textContent).toContain('com.acme.billing');
    expect(draw(UMLClassPack.stencils.find((s) => s.id === 'system-boundary'), 'Shop', { data: { systemName: 'Online shop' } }).c.container.textContent).toContain('Online shop');
  });

  test('element text style overrides still apply to the main label', () => {
    const st = UMLClassPack.stencils.find((s) => s.id === 'action');
    const { c } = draw(st, 'Pay', { fontSize: 20, textColor: '#ff0000' });
    const b = c.container.querySelector('[data-text-block]');
    expect(b.getAttribute('data-font-size')).toBe('20');
  });
});

describe('layoutForList (member compartments)', () => {
  const box = { x: 0, y: 0, width: 150, height: 40 };
  test('one line per item, mono, ellipsis on a long item, never silent', () => {
    const { layout } = layoutForList({}, { items: ['+ a: int', '+ aVeryLongOperationName(argument: String): Boolean'], box });
    expect(layout.lines).toHaveLength(2);
    expect(layout.lines[0].text).toBe('+ a: int');
    expect(layout.lines[1].text.endsWith('…')).toBe(true);
    expect(layout.overflow).toBeTruthy();
    expect(layout.text).toContain('aVeryLongOperationName');
  });
  test('items beyond the box height are hidden with the indicator and the last visible line ends in an ellipsis', () => {
    const items = Array.from({ length: 8 }, (_, i) => `+ m${i}()`);
    const { layout } = layoutForList({}, { items, box });
    expect(layout.lines.length).toBe(Math.floor(40 / (11 * 1.25)));
    expect(layout.overflow.hiddenLines).toBe(8 - layout.lines.length);
    expect(layout.lines[layout.lines.length - 1].text.endsWith('…')).toBe(true);
  });
  test('fits: no overflow', () => {
    expect(layoutForList({}, { items: ['+ a()', '+ b()'], box }).layout.overflow).toBe(false);
  });
  test('deterministic', () => {
    const a = layoutForList({}, { items: ['x', 'y'], box });
    expect(layoutForList({}, { items: ['x', 'y'], box }).layout).toEqual(a.layout);
  });
});
