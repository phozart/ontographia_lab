/**
 * @jest-environment node
 */
// ADR-0009 (spike): the server draws every stencil with its pack's own renderer (lib/render/packArt.js). Guards:
//  - coverage: every stencil of every pack converts with nothing left over (an unknown class, style or SVG feature fails here,
//    so a pack change that the converter does not understand is caught before it silently drops a decoration);
//  - safety: the output is strict XML with drawing elements only; hostile colours, labels and data cannot inject markup, script,
//    external references or event handlers;
//  - text: the label lines are the shared layout's (the T3 drawer), never HTML.
import { JSDOM } from 'jsdom';
import { PACK_CATALOG } from '../../components/diagram-studio/packs/catalog';
import { packArt, newShared, sharedDefsSvg, parseMarkup, parsePaint } from '../../lib/render/packArt';
import { renderShowSvg } from '../../lib/render/showSvg';
import { PACK_ART } from '../../lib/render/packArt';
import { layoutForElement } from '../../lib/text/fit';
import { policyFor } from '../../lib/text/policy';
import { VARIANTS } from '../helpers/textShowcase';
import { checkoutBoard } from '../helpers/showFidelityBoard';

const ALLOWED = new Set(['svg', 'defs', 'g', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path', 'text', 'tspan', 'title', 'use', 'marker', 'lineargradient', 'radialgradient', 'stop']);
const parse = (svg) => new JSDOM('').window.document.implementation && new (new JSDOM('').window.DOMParser)().parseFromString(svg, 'image/svg+xml');

function drawingOf(el, stencil) {
  const shared = newShared();
  const r = packArt(el, stencil, shared);
  return r && { ...r, defs: sharedDefsSvg(shared) };
}

const DATA = {
  'uml-class': { attributes: ['- id: UUID', '+ total: Money'], methods: ['+ place(): void'] },
  erd: { fields: [{ name: 'id', dataType: 'uuid', isPrimaryKey: true }, { name: 'customer_id', dataType: 'uuid', isForeignKey: true }, { name: 'total', dataType: 'numeric' }] },
};

describe('packArt: every stencil converts completely', () => {
  let errorSpy;
  beforeEach(() => { errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => errorSpy.mockRestore());
  for (const pack of PACK_CATALOG) {
    test(`${pack.id}: no unhandled markup, strict XML`, () => {
      const problems = [];
      for (const stencil of pack.stencils) {
        for (const [vid, label] of VARIANTS.slice(0, 4)) {
          const el = { id: 'n1', type: stencil.id, packId: pack.id, label, x: 0, y: 0, size: { ...(stencil.defaultSize || { width: 120, height: 80 }) }, color: stencil.color, layerId: 'default', properties: {}, data: { ...(stencil.defaultData || {}), ...(DATA[pack.id] || {}) } };
          const r = drawingOf(el, stencil);
          if (!r) continue; // drawn by the server itself (frames, tables, docs) or by the generic renderer
          if (r.unhandled.length) problems.push(`${stencil.id}/${vid}: ${r.unhandled.join(', ')}`);
          const doc = parse(`<svg xmlns="http://www.w3.org/2000/svg"><defs>${r.defs}</defs>${r.art}${r.text}</svg>`);
          if (doc.getElementsByTagName('parsererror').length) problems.push(`${stencil.id}/${vid}: not XML`);
        }
      }
      expect(problems).toEqual([]);
    });
  }
});

describe('packArt: safety', () => {
  const hostile = '"><script>alert(1)</script><foreignObject><img src=x onerror=alert(1)></foreignObject>';
  const evil = 'url(https://evil.example/x.png)';
  test('hostile colours, labels and data never reach the output as markup or references', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    for (const pack of PACK_CATALOG) {
      for (const stencil of pack.stencils) {
        const el = { id: `"><x ${hostile}`, type: stencil.id, packId: pack.id, label: hostile, x: 0, y: 0, size: { ...(stencil.defaultSize || { width: 120, height: 80 }) }, color: evil, backgroundColor: `red;background:${evil}`, borderColor: 'expression(alert(1))', textColor: evil, layerId: 'default', properties: {}, data: { attributes: [hostile], methods: [hostile], fields: [{ name: hostile, dataType: hostile }], priority: hostile, taskType: hostile } };
        const r = drawingOf(el, stencil);
        if (!r) continue;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg"><defs>${r.defs}</defs>${r.art}${r.text}</svg>`;
        const doc = parse(svg);
        expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
        for (const node of doc.getElementsByTagName('*')) {
          expect(ALLOWED.has(node.tagName.toLowerCase())).toBe(true);
          for (const a of node.attributes) {
            expect(a.name.startsWith('on')).toBe(false);
            expect(['href', 'xlink:href', 'src', 'style', 'class'].includes(a.name)).toBe(false);
            expect(/url\((?!#[gk]\d+\))/i.test(a.value)).toBe(false);
            expect(/javascript:|expression\(/i.test(a.value)).toBe(false);
          }
        }
      }
    }
    errorSpy.mockRestore();
  });

  test('paint parsing: only hex, rgb(a), a few names and tokens', () => {
    expect(parsePaint('#abc')).toEqual({ hex: '#aabbcc', alpha: 1 });
    expect(parsePaint('rgba(59, 130, 246, 0.1)')).toEqual({ hex: '#3b82f6', alpha: 0.1 });
    expect(parsePaint('var(--text-muted)')).toEqual({ hex: '#475569', alpha: 1 });
    expect(parsePaint('var(--unknown, #ff0000)')).toEqual({ hex: '#ff0000', alpha: 1 });
    expect(parsePaint('white')).toEqual({ hex: '#ffffff', alpha: 1 });
    expect(parsePaint(evil)).toBeNull();
    expect(parsePaint('expression(alert(1))')).toBeNull();
  });

  test('the markup parser keeps text as text', () => {
    const t = parseMarkup('<div style="left:1px">a &lt;b&gt; &amp; &#x27;c&#x27;<span>d</span></div>');
    expect(t.children[0].children[0].text).toBe("a <b> & 'c'");
    expect(t.children[0].children[1].tag).toBe('span');
  });
});

describe('packArt: text is the shared layout', () => {
  test('a TOGAF component label: the same lines and positions as lib/text, drawn as SVG text', () => {
    const stencil = PACK_CATALOG.find((p) => p.id === 'togaf').stencils.find((s) => s.id === 'application-component');
    const el = { id: 'n1', type: stencil.id, packId: 'togaf', label: 'Customer Order Service', x: 0, y: 0, size: { width: 140, height: 70 }, layerId: 'default', properties: {} };
    const r = drawingOf(el, stencil);
    const { layout, box } = layoutForElement(el, policyFor('togaf', stencil), el.label);
    const doc = parse(`<svg xmlns="http://www.w3.org/2000/svg">${r.text}</svg>`);
    const spans = [...doc.getElementsByTagName('tspan')];
    expect(spans.map((s) => s.textContent)).toEqual(layout.lines.map((l) => l.text));
    spans.forEach((s, i) => {
      expect(parseFloat(s.getAttribute('y'))).toBeCloseTo(box.y + layout.lines[i].y, 0);
    });
    expect(r.art).not.toMatch(/Customer/); // the drawing carries no label text
  });
});

describe('renderShowSvg with pack art (diagram_show)', () => {
  test('the checkout board: every element drawn, nothing unhandled, strict XML, single-quoted', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const content = checkoutBoard();
    const r = renderShowSvg(content, { art: PACK_ART });
    errorSpy.mockRestore();
    expect(r.counts.elements).toBe(content.elements.length);
    expect(r.counts.connections).toBe(content.connections.length);
    expect(r.stats.unhandled).toEqual([]);
    expect(r.svg).not.toMatch(/"/);
    const doc = parse(r.svg);
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
    // connection labels and endpoint labels drawn
    const texts = [...doc.getElementsByTagName('tspan')].map((t) => t.textContent);
    for (const t of ['yes', 'no', 'persisted as', '1..*', 'orders', 'Order', 'Cart', 'Orders DB']) expect(texts).toContain(t);
  });
});
