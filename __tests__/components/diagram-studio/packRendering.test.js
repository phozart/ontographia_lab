/**
 * Pack renderNode contract: custom node content is mounted inside an HTML div,
 * so SVG content must be wrapped in an <svg> root.
 */
import React from 'react';
import { render } from '@testing-library/react';
import CLDPack from '../../../components/diagram-studio/packs/CLDPack';
import MindMapPack from '../../../components/diagram-studio/packs/MindMapPack';
import CorePack from '../../../components/diagram-studio/packs/CorePack';
import { createDefaultRegistry } from '../../../components/diagram-studio/packs';

const SHAPE_SELECTOR = 'rect, circle, path, polygon, ellipse, line, polyline';

function makeElement(stencil, id = 'n1', extra = {}) {
  return {
    id,
    type: stencil.id,
    label: `Label ${stencil.id}`,
    x: 0,
    y: 0,
    size: { ...stencil.defaultSize },
    ...extra,
  };
}

let errorSpy;
beforeEach(() => {
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => errorSpy.mockRestore());

describe.each([
  ['CLD', CLDPack],
  ['MindMap', MindMapPack],
])('%s pack renderNode', (_name, pack) => {
  test.each(pack.stencils.map((s) => [s.id, s]))('%s renders an svg root with shapes', (_id, stencil) => {
    const { container } = render(<div>{pack.renderNode(makeElement(stencil), stencil, false)}</div>);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg.querySelectorAll(SHAPE_SELECTOR).length).toBeGreaterThan(0);
    expect(svg.getAttribute('overflow')).toBe('visible');
    expect(svg.getAttribute('width')).toBe(String(stencil.defaultSize.width));
    expect(svg.getAttribute('height')).toBe(String(stencil.defaultSize.height));
    expect(container.firstChild.firstChild.tagName.toLowerCase()).toBe('svg');
    const msgs = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(msgs).not.toMatch(/unrecognized in this browser|incorrect casing/);
  });

  test('label is rendered exactly once', () => {
    const stencil = pack.stencils.find((s) => !/loop/.test(s.id));
    const el = makeElement(stencil, 'n1', { label: 'UniqueLabelXYZ' });
    const { container } = render(<div>{pack.renderNode(el, stencil, false)}</div>);
    expect((container.textContent.match(/UniqueLabelXYZ/g) || []).length).toBe(1);
  });

  test('selected styling uses accent color', () => {
    const stencil = pack.stencils[0];
    const { container } = render(<div>{pack.renderNode(makeElement(stencil), stencil, true)}</div>);
    expect(container.innerHTML).toMatch(/--accent/);
  });

  test('ids are unique across several nodes', () => {
    const { container } = render(
      <div>
        {pack.stencils.flatMap((s) => [
          <React.Fragment key={`${s.id}a`}>{pack.renderNode(makeElement(s, `a-${s.id}`), s, false)}</React.Fragment>,
          <React.Fragment key={`${s.id}b`}>{pack.renderNode(makeElement(s, `b-${s.id}`), s, false)}</React.Fragment>,
        ])}
      </div>
    );
    const ids = [...container.querySelectorAll('[id]')].map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('Core diamond', () => {
  const stencil = CorePack.stencils.find((s) => s.id === 'diamond');

  test.each([[80, 80], [200, 60], [60, 200]])('renders polygon spanning %ix%i box', (w, h) => {
    const el = makeElement(stencil, 'd1', { size: { width: w, height: h } });
    const { container } = render(<div>{CorePack.renderNode(el, stencil, false)}</div>);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    const poly = svg.querySelector('polygon');
    expect(poly).not.toBeNull();
    const pts = poly.getAttribute('points').trim().split(/\s+/).map((p) => p.split(',').map(Number));
    // points sit at top/right/bottom/left midpoints (within the stroke inset)
    const expected = [[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]];
    expected.forEach(([ex, ey], i) => {
      expect(Math.abs(pts[i][0] - ex)).toBeLessThanOrEqual(2);
      expect(Math.abs(pts[i][1] - ey)).toBeLessThanOrEqual(2);
    });
    expect(container.textContent).toContain('Label diamond');
  });
});

describe('all registered packs', () => {
  const packs = createDefaultRegistry().getAll();

  test('registry yields packs', () => {
    expect(packs.length).toBeGreaterThan(5);
  });

  test('no pack returns bare SVG fragments or React tag errors', () => {
    const offenders = [];
    for (const pack of packs) {
      for (const stencil of pack.stencils || []) {
        errorSpy.mockClear();
        const out = pack.renderNode?.(makeElement(stencil), stencil, false);
        if (out === undefined || out === null) continue;
        const { container, unmount } = render(<div>{out}</div>);
        const msgs = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
        const svgEls = container.querySelectorAll('rect, g, path, circle, polygon, linearGradient, defs');
        const bare = [...svgEls].some((n) => !n.closest('svg'));
        if (/unrecognized in this browser|incorrect casing/.test(msgs) || bare) {
          offenders.push(`${pack.id}/${stencil.id}`);
        }
        unmount();
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('Core diamond has no rotation wrapper', () => {
  const stencil = CorePack.stencils.find((s) => s.id === 'diamond');
  const fs = require('fs');
  const path = require('path');

  test('custom diamond DOM contains no transform/rotate styles', () => {
    const el = makeElement(stencil, 'd1');
    const { container } = render(<div>{CorePack.renderNode(el, stencil, false)}</div>);
    expect(container.innerHTML).not.toMatch(/rotate\(/);
    expect(container.querySelector('[style*="transform"]')).toBeNull();
  });

  test('diamond CSS rotation is scoped away from custom-rendered nodes', () => {
    const css = fs.readFileSync(path.join(__dirname, '../../../styles/diagram-studio.css'), 'utf8');
    expect(css).toMatch(/\.ds-node-diamond:not\(\.ds-node-custom-render\) \.ds-node-content\s*\{[^}]*rotate\(45deg\)/);
    expect(css).not.toMatch(/\.ds-node-diamond \.ds-node-content\s*\{/);
    expect(css).toMatch(/\.ds-node-diamond:not\(\.ds-node-custom-render\) \.ds-node-inner\s*\{[^}]*rotate\(-45deg\)/);
  });

  test('label box is wide and breaks at word boundaries', () => {
    const el = makeElement(stencil, 'd1', { label: 'Diamond' });
    const { container } = render(<div>{CorePack.renderNode(el, stencil, false)}</div>);
    const label = [...container.querySelectorAll('div')].find((d) => d.textContent === 'Diamond' && d.style.overflowWrap);
    expect(label.style.overflowWrap).toBe('break-word');
    expect(parseInt(label.style.width, 10)).toBeGreaterThanOrEqual(70);
  });
});
