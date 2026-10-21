/**
 * @jest-environment node
 */
// AI-5: doc cards in the server-drawn SVG used by diagram_show (and any export built on lib/render/diagramSvg).
// The card is the title plus the first lines as escaped plain text. Nothing from the markdown can become markup,
// a link, an image or an external load.

import { renderDiagramSvg } from '../../lib/render/diagramSvg';

const docEl = (id, doc, over = {}) => ({ id, type: 'doc', packId: 'core', x: 100, y: 100, size: { width: 320, height: 220 }, label: doc.title, data: { doc }, ...over });
const render = (elements) => renderDiagramSvg({ elements, connections: [] });

describe('doc card in SVG', () => {
  test('draws the title and the first lines of the rendered text', () => {
    const { svg, counts } = render([docEl('d', { title: 'Findings', markdown: '## Summary\n\n- first point\n- second point\n\nPlain **bold** text with a [link](https://example.com).' })]);
    expect(counts.elements).toBe(1);
    expect(svg).toContain('>Findings<');
    expect(svg).toContain('>Summary<');
    expect(svg).toContain('• first point');
    expect(svg).toContain('Plain bold text with a link.');
    expect(svg).not.toMatch(/\*\*|\]\(|href/);
  });

  test('a collapsed card is the title bar only; an empty doc says so', () => {
    const collapsed = render([docEl('d', { title: 'Hidden', markdown: 'secret body', collapsed: true }, { size: { width: 320, height: 40 } })]).svg;
    expect(collapsed).toContain('>Hidden<');
    expect(collapsed).not.toContain('secret body');
    expect(render([docEl('d', { title: 'E', markdown: '' })]).svg).toContain('Empty doc');
  });

  test('long text is cut with an ellipsis at the card height', () => {
    const md = Array.from({ length: 40 }, (_, i) => `Line number ${i} of the document`).join('\n\n');
    const { svg } = render([docEl('d', { title: 'Long', markdown: md })]);
    expect(svg).toContain('…');
    expect(svg).not.toContain('Line number 30');
  });

  test('hostile markdown and titles are escaped text: no markup, links, images or scripts in the SVG', () => {
    const md = '<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[a](javascript:alert(1)) ![i](https://t.example.com/p.png)\n\n&lt;svg onload=alert(1)&gt;';
    const { svg } = render([docEl('d', { title: '<svg onload=alert(1)>"\'&', markdown: md })]);
    expect(svg).not.toMatch(/<script|<img|<image|<foreignObject|<a[ >]|xlink:href/i);
    expect(svg).toContain('&lt;script&gt;');
    // the only < characters left are our own tags
    const body = svg.replace(/<\/?(svg|g|rect|path|line|text|tspan|defs|marker|polygon|ellipse|title|desc|style)(\s[^<>]*)?\/?>/g, '');
    expect(body).not.toMatch(/<[A-Za-z]/);
  });

  test('stays inside the SVG size budget: big docs are cut per card, and a huge board degrades gracefully', () => {
    const mk = (n) => Array.from({ length: n }, (_, i) => docEl(`d${i}`, { title: `Doc ${i}`, markdown: `# H\n\n${'word '.repeat(5000)}` }, { x: (i % 15) * 360, y: Math.floor(i / 15) * 260 }));
    const small = render(mk(30));
    expect(Buffer.byteLength(small.svg, 'utf8')).toBeLessThanOrEqual(96 * 1024);
    const huge = render(mk(300));
    if (huge.svg) expect(Buffer.byteLength(huge.svg, 'utf8')).toBeLessThanOrEqual(96 * 1024);
    else expect(huge.tooLarge).toBe(true);
  });
});
