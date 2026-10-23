/**
 * @jest-environment node
 */
// ADR-0008 T3: the regression suite (geometry assertions, no pixel diffs). For every stencil of every pack x the ten audit label
// variants, at the stored default size (a legacy board) and at the editor's creation size, diagram_show / the thumbnail draw the
// SAME lines the canvas draws (lib/text layoutFor*, which the canvas renderers call; text-layout.test.js proves the DOM equals
// them in Chrome), at the same boxes: no re-wrapping, no em-per-char guess, no cut at 160 characters.

import { PACK_CATALOG } from '../../components/diagram-studio/packs/catalog';
import { renderDiagramSvg } from '../../lib/render/diagramSvg';
import { VARIANTS, galleryContent, expectedBlock, O } from '../helpers/textShowcase';

const { JSDOM } = require('jsdom');

const expectedFor = expectedBlock;

describe.each(PACK_CATALOG.map((p) => [p.id]))('diagram_show draws the canvas lines: %s', (packId) => {
  const pack = PACK_CATALOG.find((p) => p.id === packId);
  for (const sized of [false, true]) {
    test(`every stencil x ${VARIANTS.length} variants, ${sized ? 'editor-created sizes' : 'stored default sizes'}`, () => {
      const content = galleryContent(packId, { sized });
      const { svg } = renderDiagramSvg(content, { ids: true, pin: false, maxElements: 5000, maxConnections: 1, maxBytes: Infinity });
      const doc = new JSDOM(svg, { contentType: 'image/svg+xml' }).window.document;
      const groups = new Map([...doc.querySelectorAll('g[data-id]')].map((g) => [g.getAttribute('data-id'), g]));
      let checked = 0;
      for (const el of content.elements) {
        const stencil = pack.stencils.find((s) => s.id === el.type);
        const want = expectedFor(el, stencil);
        const g = groups.get(el.id);
        expect(g).toBeTruthy();
        const block = g.querySelector('text[data-text-block]');
        if (!want || !el.label || !want.layout.lines.length) {
          continue;
        }
        expect(block).not.toBeNull();
        const got = [...block.querySelectorAll('tspan')];
        // same lines, in the same order (nothing re-wrapped, nothing cut)
        expect(got.map((t) => t.textContent)).toEqual(want.layout.lines.map((l) => l.text));
        // same boxes: every line sits at box + line offset, to a tenth of a pixel
        got.forEach((t, i) => {
          const l = want.layout.lines[i];
          const rtl = l.dir === 'rtl';
          expect(Math.abs(Number(t.getAttribute('x')) - (el.x + want.box.x + (rtl ? l.x + l.width : l.x)))).toBeLessThan(0.11);
          expect(Math.abs(Number(t.getAttribute('y')) - (el.y + want.box.y + l.y))).toBeLessThan(0.11);
        });
        expect(Number(block.getAttribute('font-size'))).toBeCloseTo(want.layout.fontSize, 1);
        expect(block.getAttribute('data-text-block')).toBe(want.kind);
        // a clamped label is never silent: badge and full text
        expect(!!g.querySelector('[data-text-badge]')).toBe(!!want.layout.overflow && !want.box.rotate && true);
        if (want.layout.overflow) expect(block.querySelector('title').textContent).toBe(want.layout.text);
        checked += 1;
      }
      expect(checked).toBeGreaterThan(pack.stencils.length * 4);
      void O;
    });
  }
});
