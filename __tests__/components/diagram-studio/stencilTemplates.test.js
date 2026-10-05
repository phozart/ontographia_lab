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

  test('default is an outlined diamond (panel fill, accent stroke, dark label); custom color keeps solid fill', () => {
    const { container } = render(<div>{ERDPack.renderNode(makeElement(stencil), stencil, false)}</div>);
    const poly = container.querySelector('svg polygon');
    expect(poly.getAttribute('fill')).toMatch(/panel|#fff/i);
    expect(poly.getAttribute('stroke')).toBe(stencil.color);
    const solid = render(<div>{ERDPack.renderNode(makeElement(stencil, 'r2', { color: '#123456' }), stencil, false)}</div>);
    expect(solid.container.querySelector('svg polygon').getAttribute('fill')).toBe('#123456');
  });

  test('entity, attribute and relationship stencils all render', () => {
    for (const id of ['entity', 'weak-entity', 'junction', 'view', 'attribute', 'relationship-chen']) {
      const s = ERDPack.stencils.find((x) => x.id === id);
      expect(ERDPack.renderNode(makeElement(s), s, false)).toBeTruthy();
    }
  });
});

describe('Mind map label contrast', () => {
  const { parseColor, contrastRatio, pickLabelColor } = require('../../../components/diagram-studio/packs/colorUtils');
  const labelFill = (id, color) => {
    const stencil = MindMapPack.stencils.find((s) => s.id === id);
    const el = makeElement(stencil, 'm1', color ? { color } : {});
    const { container } = render(<div>{MindMapPack.renderNode(el, stencil, false)}</div>);
    return container.querySelector('text').getAttribute('fill');
  };
  const DARK = '#374151';

  test.each(['image', 'link', 'callout'])('%s default has readable label', (id) => {
    const stencil = MindMapPack.stencils.find((s) => s.id === id);
    const fill = labelFill(id);
    expect(contrastRatio(parseColor(stencil.color), parseColor(fill))).toBeGreaterThanOrEqual(4.5);
  });

  test.each(['central-topic', 'main-topic', 'sub-topic', 'topic-red', 'topic-blue'])('%s: light custom color gets dark label', (id) => {
    expect(labelFill(id, '#fde68a')).toBe(DARK);
  });

  test.each(['central-topic', 'main-topic', 'sub-topic'])('%s: dark custom color gets white label', (id) => {
    expect(labelFill(id, '#1e3a8a')).toBe('#fff');
  });

  test('default amber sub-topic picks the higher-contrast label', () => {
    expect(labelFill('sub-topic')).toBe(DARK);
  });

  test.each(MindMapPack.stencils.map((s) => [s.id, s]))('%s default label is the better-contrast choice', (_id, stencil) => {
    const fill = labelFill(stencil.id);
    if (!['central-topic', 'main-topic', 'sub-topic', 'topic-red', 'topic-blue', 'topic-green', 'topic-purple', 'image', 'link'].includes(stencil.id)) return;
    const bg = parseColor(stencil.color);
    const chosen = contrastRatio(bg, parseColor(fill));
    const other = contrastRatio(bg, parseColor(fill === DARK ? '#fff' : DARK));
    expect(chosen).toBeGreaterThanOrEqual(other);
  });

  test.each([
    ['#fff', '#374151'], ['#FFF', '#374151'], ['#ffffffcc', '#374151'], ['#fffc', '#374151'],
    ['rgb(255,255,255)', '#374151'], ['RGBA(255, 255, 255, 0.5)', '#374151'], ['rgb(255 255 255)', '#374151'],
    ['#000', '#fff'], ['rgb(0,0,0)', '#fff'], ['#0000', '#fff'],
  ])('pickLabelColor(%s)', (input, expected) => {
    expect(pickLabelColor(input)).toBe(expected);
  });

  test('unknown formats keep the default', () => {
    expect(pickLabelColor('hotpink')).toBe('#fff');
    expect(pickLabelColor(undefined)).toBe('#fff');
    expect(pickLabelColor('#12')).toBe('#fff');
    expect(pickLabelColor('hotpink', '#000')).toBe('#000');
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

describe('CLD loop label fit extras', () => {
  test('"Growth" fits a 50px circle without truncation', () => {
    const r = fitLoopLabel('Growth', 46);
    expect(r.truncated).toBe(false);
    expect(r.text).toBe('Growth');
    expect(r.fontSize).toBeGreaterThanOrEqual(9);
  });
  test('CJK full-width glyphs count as ~1em', () => {
    expect(fitLoopLabel('成长循环增强', 46).truncated).toBe(true);
    expect(fitLoopLabel('成长', 46).truncated).toBe(false);
  });
  test('emoji are not split into surrogates', () => {
    const r = fitLoopLabel('🚀🚀🚀🚀🚀🚀🚀', 46);
    expect(r.truncated).toBe(true);
    expect(r.text).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
    expect(r.text.endsWith('…')).toBe(true);
  });
  test.each([[''], ['   '], [undefined], [null]])('empty label %p renders empty, not an ellipsis', (v) => {
    expect(fitLoopLabel(v, 46)).toMatchObject({ text: '', truncated: false });
  });
});

describe('Mind map template hierarchy', () => {
  const fs = require('fs');
  const path = require('path');
  const hook = fs.readFileSync(path.join(__dirname, '../../../components/diagram-studio/hooks/interaction/useQuickCreate.js'), 'utf8');
  const childOf = (parent) => {
    const m = new RegExp(`case '${parent}':\\s*childType = '([a-z-]+)'`).exec(hook);
    return m && m[1];
  };

  test('Tab/"+" hierarchy: central-topic -> main-topic -> sub-topic, all in the pack', () => {
    const ids = MindMapPack.stencils.map((s) => s.id);
    expect(childOf('central-topic')).toBe('main-topic');
    expect(childOf('main-topic')).toBe('sub-topic');
    ['central-topic', 'main-topic', 'sub-topic'].forEach((t) => expect(ids).toContain(t));
  });

  test('template children are exactly what the hierarchy creates under the central topic', () => {
    const sp = STARTER_PACKS.find((p) => p.id === 'mind-map-central');
    const children = sp.elements.slice(1).map((e) => e.type);
    expect(new Set(children)).toEqual(new Set([childOf(sp.elements[0].type)]));
  });
});

describe('CLD loop label fit', () => {
  test('short default label keeps 14px and is not truncated', () => {
    expect(fitLoopLabel('R', 46)).toEqual({ text: 'R', fontSize: 14, truncated: false });
  });

  test('medium label shrinks but stays >= 9px and untruncated', () => {
    const r = fitLoopLabel('Growth', 46);
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
