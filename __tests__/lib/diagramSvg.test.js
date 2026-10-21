/**
 * @jest-environment node
 */
// Server-side SVG renderer for the diagram_show MCP App (spike AI-9): pure, self-contained, injection-safe.

import { renderDiagramSvg, safeColor, escapeXml, wrapLabel, HIGHLIGHT_COLORS } from '../../lib/render/diagramSvg';
import { COMPARE_COLORS } from '../../components/diagram-studio/ui/CompareOverlay';

const el = (id, x, y, extra = {}) => ({ id, type: 'task', packId: 'process-flow', label: id.toUpperCase(), x, y, size: { width: 120, height: 60 }, ...extra });

const CONTENT = {
  elements: [
    { id: 'fr', type: 'frame', packId: 'core', label: 'Frame title', x: -20, y: -20, size: { width: 600, height: 300 } },
    el('a', 0, 0),
    el('b', 300, 0),
    el('d', 0, 200, { type: 'decision', packId: 'process-flow' }),
    { id: 'nox', type: 'task', packId: 'process-flow', label: 'no coordinates' },
  ],
  connections: [
    { id: 'k1', sourceId: 'a', targetId: 'b', label: 'then', lineStyle: 'step', autoPorts: true },
    { id: 'k2', sourceId: 'a', targetId: 'd', lineStyle: 'curved' },
    { id: 'k3', sourceId: 'b', targetId: 'missing' },
  ],
};

describe('renderDiagramSvg', () => {
  test('one self-contained SVG: shapes in z-order, labels, connections between drawn elements only', () => {
    const r = renderDiagramSvg(CONTENT);
    expect(r.svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(r.counts).toMatchObject({ elements: 4, connections: 2 }); // nox has no coordinates; k3 has a missing endpoint
    const order = [...r.svg.matchAll(/<g data-id="([^"]+)"/g)].map((m) => m[1]);
    expect(order).toEqual(['fr', 'a', 'b', 'd', 'k1', 'k2']);
    expect(r.svg).toContain('Frame title');
    expect(r.svg).toContain('>then<');
    // no external references of any kind, and no NaN/undefined from the geometry
    expect(r.svg).not.toMatch(/href|https?:\/\/(?!www\.w3\.org\/2000\/svg)|<script|<foreignObject|NaN|undefined|Infinity/);
    expect(r.viewBox.width).toBeGreaterThan(600);
  });

  test('restricts to elementIds and keeps only connections inside', () => {
    const r = renderDiagramSvg(CONTENT, { elementIds: ['a', 'b'] });
    expect(r.counts).toMatchObject({ elements: 2, connections: 1 });
    expect(r.svg).not.toContain('data-id="d"');
  });

  test('user text is escaped and colours cannot inject attributes or external fetches', () => {
    const evil = {
      elements: [
        el('x"><script>alert(1)</script>', 0, 0, {
          size: { width: 600, height: 60 },
          label: '<img src=x onerror=alert(1)> & "quotes"',
          color: 'url(https://evil.example/x.svg#a)',
          backgroundColor: 'red" onload="alert(1)',
          textColor: 'var(--text, #123456)',
        }),
      ],
      connections: [],
    };
    const { svg } = renderDiagramSvg(evil);
    expect(svg).not.toMatch(/<script|<img|evil\.example/);
    expect(svg).not.toMatch(/<[^>]*\son\w+=/); // no tag carries an event-handler attribute
    expect(svg).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(svg).toContain('fill="#123456"');
    expect(safeColor('url(https://evil.example)', '#000000')).toBe('#000000');
    expect(safeColor('rgb(255, 0, 0)', '#000000')).toBe('#ff0000');
    expect(safeColor('#ABC', null)).toBe('#aabbcc');
    expect(escapeXml('a\u0001<b>')).toBe('a&lt;b&gt;');
  });

  test('highlight: added/changed boxes on drawn elements, removed as a dashed ghost at the old bounds, compare colours', () => {
    const r = renderDiagramSvg(CONTENT, {
      highlight: { added: ['a'], changed: ['b'], removed: [{ id: 'gone', bounds: { x: 900, y: 0, width: 100, height: 50 } }], connections: { added: ['k1'] } },
    });
    expect(r.counts.highlighted).toBe(4);
    expect(r.svg).toContain(`stroke="${HIGHLIGHT_COLORS.added}" stroke-width="3"`);
    expect(r.svg).toContain(`stroke="${HIGHLIGHT_COLORS.removed}" stroke-width="3" stroke-dasharray`);
    expect(r.viewBox.x + r.viewBox.width).toBeGreaterThan(1000); // the ghost is inside the view
    expect(HIGHLIGHT_COLORS).toEqual(COMPARE_COLORS);
  });

  test('caps element count and byte size', () => {
    const many = { elements: Array.from({ length: 50 }, (_, i) => el(`e${i}`, i * 150, 0)), connections: [] };
    const capped = renderDiagramSvg(many, { maxElements: 10 });
    expect(capped).toMatchObject({ truncated: true, omitted: { elements: 40, connections: 0 }, counts: { elements: 10 } });
    const tiny = renderDiagramSvg(many, { maxBytes: 1000 });
    expect(tiny).toMatchObject({ svg: null, tooLarge: true });
  });

  test('empty or malformed content gives a small blank picture, not an error', () => {
    for (const c of [null, {}, { elements: 'x' }, { elements: [null, 1, { id: 3 }] }]) {
      const r = renderDiagramSvg(c);
      expect(r.svg).toMatch(/^<svg/);
      expect(r.counts.elements).toBe(0);
    }
  });

  test('wrapLabel wraps, hard-breaks long words and ellipsizes overflow', () => {
    expect(wrapLabel('one two three four', 90, 200, 13)).toEqual(['one two', 'three four']);
    expect(wrapLabel('x'.repeat(30), 80, 200, 13).every((l) => l.length <= 9)).toBe(true);
    const short = wrapLabel('a b c d e f g h i j k l', 40, 20, 13);
    expect(short).toHaveLength(1);
    expect(short[0].endsWith('…')).toBe(true);
  });
});
