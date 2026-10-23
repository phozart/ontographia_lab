/**
 * ADR-0008 T3: canvas = diagram_show, for every stencil of every pack x the ten label variants. The canvas side is the pack's own
 * renderNode (React, rendered in jsdom: the lines come from lib/text, not from a browser, so this is the editor's line list); the
 * diagram_show side is renderDiagramSvg. Geometry assertions, no pixel diffs. The Chrome-level proof that the DOM really draws
 * these lines is __tests__/e2e/text-layout.test.js and text-parity-gallery.test.js.
 */
import React from 'react';
import { render } from '@testing-library/react';
import { PACK_CATALOG } from '../../../components/diagram-studio/packs/catalog';
import { renderDiagramSvg } from '../../../lib/render/diagramSvg';
import { VARIANTS } from '../../helpers/textShowcase';
import { sizeForStencilLabel } from '../../../lib/text/fit';

// every registered pack renderer
const PACKS = {
  core: require('../../../components/diagram-studio/packs/CorePack').default,
  'process-flow': require('../../../components/diagram-studio/packs/ProcessFlowPack').default,
  'sticky-notes': require('../../../components/diagram-studio/packs/StickyNotesPack').default,
  cld: require('../../../components/diagram-studio/packs/CLDPack').default,
  'uml-class': require('../../../components/diagram-studio/packs/UMLClassPack').default,
  'mind-map': require('../../../components/diagram-studio/packs/MindMapPack').default,
  'product-design': require('../../../components/diagram-studio/packs/ProductDesignPack').default,
  erd: require('../../../components/diagram-studio/packs/ERDPack').default,
  togaf: require('../../../components/diagram-studio/packs/TOGAFPack').default,
  itil: require('../../../components/diagram-studio/packs/ITILPack').default,
  'capability-map': require('../../../components/diagram-studio/packs/CapabilityMapPack').default,
};

let errorSpy;
beforeEach(() => { errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => errorSpy.mockRestore());

const linesOf = (block) => {
  const parts = [];
  for (const n of block.childNodes) {
    if (n.nodeType === 3) parts.push(n.nodeValue);
    else if (n.classList && n.classList.contains('ds-text-line')) parts.push(n.textContent);
  }
  return parts.join('').split('\n').map((t) => t.trim()).filter((t, i, a) => t || i < a.length - 1);
};

// stencils the editor draws with a bespoke compartment (class name, entity header, tab): their label is not the policy slot
const SHOW_KINDS = { inside: ['inside', 'name', 'title'], external: ['external'], title: ['title', 'name'] };

describe.each(PACK_CATALOG.map((p) => [p.id]))('canvas lines = diagram_show lines: %s', (packId) => {
  const pack = PACK_CATALOG.find((p) => p.id === packId);
  const renderer = PACKS[packId];
  test.each(pack.stencils.map((s) => [s.id, s]))('%s', (_id, stencil) => {
    const bad = [];
    let compared = 0;
    for (const [vid, label] of VARIANTS) {
      for (const sized of [false, true]) {
        const size = sized ? sizeForStencilLabel(packId, stencil, label) : { ...stencil.defaultSize };
        const el = { id: 'n1', type: stencil.id, packId, label, x: 0, y: 0, size, layerId: 'default', properties: {} };
        const { container, unmount } = render(<div>{renderer.renderNode(el, stencil, false)}</div>);
        const blocks = [...container.querySelectorAll('[data-text-block]')].map((b) => ({ kind: b.getAttribute('data-text-block'), size: parseFloat(b.getAttribute('data-font-size')), lines: linesOf(b), overflow: b.getAttribute('data-overflow') === 'true' }));
        unmount();
        const { svg } = renderDiagramSvg({ elements: [el], connections: [] }, { ids: true, pin: false });
        const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
        const t = doc.querySelector('g[data-id] text[data-text-block]');
        if (!t) continue; // table, doc, line: no node label
        const shown = [...t.querySelectorAll('tspan')].map((x) => x.textContent.trim());
        const kind = t.getAttribute('data-text-block');
        const canvas = blocks.find((b) => SHOW_KINDS[kind].includes(b.kind) && b.lines.join('\n') === shown.join('\n')) || blocks.find((b) => SHOW_KINDS[kind].includes(b.kind));
        if (!canvas) continue; // the pack draws no label block (decorative)
        compared += 1;
        const ok = JSON.stringify(canvas.lines) === JSON.stringify(shown) && canvas.size === parseFloat(t.getAttribute('font-size'));
        if (!ok) bad.push({ variant: vid, sized, canvas: canvas.lines, show: shown, sizes: [canvas.size, parseFloat(t.getAttribute('font-size'))] });
      }
    }
    expect(bad).toEqual([]);
    void compared;
  });
});
