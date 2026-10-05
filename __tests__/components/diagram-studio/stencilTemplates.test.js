/**
 * Stencil/template fixes: ERD Chen diamond, Mind Map starter template,
 * light-fill mind map labels, CLD loop label fitting.
 */
import React from 'react';
import { render } from '@testing-library/react';
import CLDPack, { fitLoopLabel } from '../../../components/diagram-studio/packs/CLDPack';
import MindMapPack from '../../../components/diagram-studio/packs/MindMapPack';
import ERDPack from '../../../components/diagram-studio/packs/ERDPack';
import { createDefaultRegistry } from '../../../components/diagram-studio/packs';
import { STARTER_PACKS } from '../../../components/diagram-studio/StarterPackModal';

function makeElement(stencil, id = 'n1', extra = {}) {
  return { id, type: stencil.id, label: `Label ${stencil.id}`, x: 0, y: 0, size: { ...stencil.defaultSize }, ...extra };
}

describe('ERD relationship-chen', () => {
  const stencil = ERDPack.stencils.find((s) => s.id === 'relationship-chen');

  test.each([[100, 80], [160, 60]])('renders SVG diamond polygon and label for %ix%i', (w, h) => {
    const el = makeElement(stencil, 'r1', { label: 'Enrolls', size: { width: w, height: h } });
    const { container } = render(<div>{ERDPack.renderNode(el, stencil, false)}</div>);
    const poly = container.querySelector('svg polygon');
    expect(poly).not.toBeNull();
    const pts = poly.getAttribute('points').trim().split(/\s+/).map((p) => p.split(',').map(Number));
    [[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]].forEach(([ex, ey], i) => {
      expect(Math.abs(pts[i][0] - ex)).toBeLessThanOrEqual(2);
      expect(Math.abs(pts[i][1] - ey)).toBeLessThanOrEqual(2);
    });
    expect(container.textContent).toContain('Enrolls');
    expect(container.innerHTML).not.toMatch(/rotate\(/);
  });

  test('entity, attribute and relationship stencils all render', () => {
    for (const id of ['entity', 'weak-entity', 'junction', 'view', 'attribute', 'relationship-chen']) {
      const s = ERDPack.stencils.find((x) => x.id === id);
      expect(ERDPack.renderNode(makeElement(s), s, false)).toBeTruthy();
    }
  });
});

describe('Mind map light-fill topics', () => {
  test.each(['image', 'link'])('%s topic uses a dark label color', (id) => {
    const stencil = MindMapPack.stencils.find((s) => s.id === id);
    const { container } = render(<div>{MindMapPack.renderNode(makeElement(stencil), stencil, false)}</div>);
    expect(container.querySelector('text').getAttribute('fill')).not.toMatch(/^(#fff|#ffffff|white)$/i);
  });

  test('dark-fill topics keep white label', () => {
    const stencil = MindMapPack.stencils.find((s) => s.id === 'sub-topic');
    const { container } = render(<div>{MindMapPack.renderNode(makeElement(stencil), stencil, false)}</div>);
    expect(container.querySelector('text').getAttribute('fill')).toBe('#fff');
  });
});

describe('Starter pack templates', () => {
  const registry = createDefaultRegistry();

  test.each(STARTER_PACKS.map((p) => [p.id, p]))('%s: pack exists and every element type resolves', (_id, sp) => {
    expect(registry.has(sp.packId)).toBe(true);
    const missing = sp.elements.map((e) => e.type).filter((t) => !registry.findStencil(t, sp.packId));
    expect(missing).toEqual([]);
  });

  test('Mind Map template follows central/main hierarchy', () => {
    const sp = STARTER_PACKS.find((p) => p.id === 'mind-map-central');
    expect(sp.elements[0].type).toBe('central-topic');
    expect(sp.elements.slice(1).every((e) => e.type === 'main-topic')).toBe(true);
  });
});

describe('CLD loop label fit', () => {
  test('short default label keeps 14px and is not truncated', () => {
    expect(fitLoopLabel('R', 46)).toEqual({ text: 'R', fontSize: 14, truncated: false });
  });

  test('medium label shrinks but stays >= 9px and untruncated', () => {
    const r = fitLoopLabel('Grow', 46);
    expect(r.fontSize).toBeLessThan(14);
    expect(r.fontSize).toBeGreaterThanOrEqual(9);
    expect(r.truncated).toBe(false);
  });

  test('long label truncates with ellipsis at min size', () => {
    const full = 'Reinforcing customer growth loop';
    const r = fitLoopLabel(full, 46);
    expect(r.fontSize).toBe(9);
    expect(r.truncated).toBe(true);
    expect(r.text.endsWith('…')).toBe(true);
    expect(r.text.length).toBeLessThan(full.length);
  });

  test.each(['reinforcing-loop', 'balancing-loop'])('%s renders full text in <title> when truncated', (id) => {
    const stencil = CLDPack.stencils.find((s) => s.id === id);
    const el = makeElement(stencil, 'l1', { label: 'Reinforcing customer growth loop' });
    const { container } = render(<div>{CLDPack.renderNode(el, stencil, false)}</div>);
    expect(container.querySelector('title').textContent).toBe('Reinforcing customer growth loop');
  });
});
