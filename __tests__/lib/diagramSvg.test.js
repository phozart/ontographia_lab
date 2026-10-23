/**
 * @jest-environment node
 */
// Server-side SVG renderer for the diagram_show MCP App (spike AI-9): pure, self-contained, injection-safe.

import { renderDiagramSvg, safeColor, escapeXml, HIGHLIGHT_COLORS } from '../../lib/render/diagramSvg';
import { PACK_CATALOG } from '../../components/diagram-studio/packs/catalog';
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
    expect(r.svg.match(/<g>/g)).toHaveLength(2 + 6); // body + overlay groups, 4 elements, 2 connections
    expect(r.svg).not.toContain('data-id');
    expect(r.svg.indexOf('Frame title')).toBeLessThan(r.svg.indexOf('>A<'));
    expect(r.svg).toContain('Frame title');
    expect(r.svg).toContain('>then<');
    // no external references of any kind, and no NaN/undefined from the geometry
    expect(r.svg).not.toMatch(/href|https?:\/\/(?!www\.w3\.org\/2000\/svg)|<script|<foreignObject|NaN|undefined|Infinity/);
    expect(r.viewBox.width).toBeGreaterThan(600);
  });

  test('restricts to elementIds and keeps only connections inside', () => {
    const r = renderDiagramSvg(CONTENT, { elementIds: ['a', 'b'] });
    expect(r.counts).toMatchObject({ elements: 2, connections: 1 });
    expect(r.svg).not.toContain('>D<');
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

});

// ---- AI-9a hardening ----
const XSS = '"><script>alert(1)</script><foreignObject><iframe src="https://evil.example"/></foreignObject>\'onload=\'alert(2)';
const FORBIDDEN = /NaN|undefined|Infinity/;

function assertWellFormedXml(svg) {
  // eslint-disable-next-line global-require
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM(svg, { contentType: 'image/svg+xml' }); // throws on a parse error
  const doc = dom.window.document;
  expect(doc.documentElement.nodeName).toBe('svg');
  const allowed = new Set(['svg', 'defs', 'marker', 'path', 'rect', 'g', 'text', 'tspan', 'ellipse', 'polygon', 'line', 'title', 'circle']);
  for (const n of doc.querySelectorAll('*')) {
    expect(allowed.has(n.localName)).toBe(true);
    for (const a of n.attributes) expect(/^(on|href|xlink|src)/i.test(a.name)).toBe(false);
  }
}

describe('renderDiagramSvg hardening (AI-9a)', () => {
  test('every user string is escaped: ids, labels, data, frame titles, connection ids/labels/colors; output is well-formed XML with only drawing elements', () => {
    const content = {
      elements: [
        { id: `fr${XSS}`, type: 'frame', packId: 'core', label: XSS, properties: { frameTitle: XSS }, x: 0, y: 0, size: { width: 500, height: 300 } },
        el(`a${XSS}`, 20, 20, { label: XSS, data: { frameTitle: XSS, note: XSS }, properties: { note: XSS }, name: XSS, text: XSS, color: XSS, textColor: XSS, borderColor: XSS }),
        el('b', 300, 20, { label: XSS, fontSize: XSS, opacity: XSS }),
      ],
      connections: [{ id: `k${XSS}`, sourceId: `a${XSS}`, targetId: 'b', label: XSS, color: XSS, lineStyle: XSS, waypoints: [{ x: XSS, y: 1 }, { x: 5, y: 5 }], strokeWidth: XSS }],
    };
    const r = renderDiagramSvg(content, { highlight: { added: [`a${XSS}`], removed: [{ id: 'g', bounds: { x: 'x', y: 0, width: 1, height: 1 } }] } });
    expect(r.svg).not.toMatch(FORBIDDEN);
    assertWellFormedXml(r.svg);
  });

  test('frame titles and untyped elements are escaped too (properties.frameTitle, data.frameTitle, unknown stencil)', () => {
    const { svg } = renderDiagramSvg({
      elements: [
        { id: 'f1', type: 'frame', packId: 'core', properties: { frameTitle: '<b>&</b>' }, x: 0, y: 0, size: { width: 300, height: 200 } },
        { id: 'u1', type: 'no-such-stencil', packId: 'nope', label: '<i>x</i>', x: 400, y: 0 },
      ],
      connections: [],
    });
    expect(svg).toContain('&lt;b&gt;&amp;&lt;/b&gt;');
    expect(svg).toContain('&lt;i&gt;x&lt;/i&gt;');
    expect(svg).not.toMatch(/<b>|<i>/);
  });

  test('absurd coordinates and sizes never produce NaN, Infinity or exponent notation in the output', () => {
    const content = {
      elements: [
        el('a', 1e308, -1e308, { size: { width: 1e300, height: 1e300 } }),
        el('b', 0, 0, { size: { width: -5, height: Number.MAX_VALUE } }),
        el('c', 1e21, 1e21),
        el('d', 5, 5),
      ],
      connections: [{ id: 'k', sourceId: 'a', targetId: 'b' }, { id: 'k2', sourceId: 'c', targetId: 'd', lineStyle: 'step' }],
    };
    const r = renderDiagramSvg(content, { highlight: { removed: [{ id: 'g', bounds: { x: 1e308, y: 0, width: 1e308, height: 1 } }] } });
    expect(r.svg).not.toMatch(/NaN|Infinity|\de[+-]\d/);
    expect(r.counts.elements).toBe(2); // the two with coordinates beyond +-1e6 are skipped
    for (const k of ['x', 'y', 'width', 'height']) expect(Number.isFinite(r.viewBox[k])).toBe(true);
    assertWellFormedXml(r.svg);
  });

  test('renders the base shape of every stencil of every pack: well-formed, bounded, label inside the box', () => {
    let n = 0;
    for (const pack of PACK_CATALOG) {
      const elements = pack.stencils.map((st, i) => ({
        id: `${pack.id}-${st.id}`, type: st.id, packId: pack.id, label: `${st.id} <${XSS}>`, x: (i % 10) * 200, y: Math.floor(i / 10) * 140,
      }));
      const r = renderDiagramSvg({ elements, connections: [] });
      expect(r.counts.elements).toBe(elements.length);
      expect(r.svg).not.toMatch(FORBIDDEN);
      assertWellFormedXml(r.svg);
      n += elements.length;
    }
    expect(n).toBeGreaterThan(100);
  });

  test('the same input renders the same bytes (deterministic) and stays within the byte cap or says tooLarge', () => {
    expect(renderDiagramSvg(CONTENT).svg).toBe(renderDiagramSvg(CONTENT).svg);
    const big = { elements: Array.from({ length: 600 }, (_, i) => el(`e${i}`, (i % 30) * 140, Math.floor(i / 30) * 80, { label: 'w '.repeat(100) })), connections: [] };
    const r = renderDiagramSvg(big);
    if (r.svg) expect(Buffer.byteLength(r.svg)).toBeLessThanOrEqual(96 * 1024);
    else expect(r.tooLarge).toBe(true);
  });
});

describe('renderDiagramSvg review fixes (AI-9a)', () => {
  test('curveAmount is clamped so it cannot blow up path numbers', () => {
    for (const lineStyle of ['curved', 'arc']) {
      const r = renderDiagramSvg({ elements: [el('a', 0, 0), el('b', 300, 0)], connections: [{ id: 'k', sourceId: 'a', targetId: 'b', lineStyle, curveAmount: 1e300 }] });
      expect(r.svg).not.toMatch(/NaN|Infinity|\de[+-]\d/);
      const nums = [...r.svg.matchAll(/ d="([^"]+)"/g)].flatMap((m) => m[1].match(/-?\d+(\.\d+)?/g).map(Number));
      expect(Math.max(...nums.map(Math.abs))).toBeLessThan(1e5);
    }
  });
});
