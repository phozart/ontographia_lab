/**
 * @jest-environment node
 */
// ADR-0008 T3 review follow-ups: lone surrogates, hostile colours and safe pinning in everything that draws SVG text.
import { layoutText } from '../../lib/text/layout';
import { textLayoutToSvg, escapeXml, safeFill, pinnable } from '../../lib/text/svg';
import { resolveFace } from '../../lib/text/fonts';
import { renderDiagramSvg } from '../../lib/render/diagramSvg';
import { ExportManager } from '../../components/diagram-studio/export/ExportManager';

const BAD = 'a\ud800b \udc00 c 🚀 d'; // lone high, lone low, and a valid pair
const lay = (text) => layoutText({ text, font: { size: 14, weight: 500, lineHeight: 1.3 }, box: { width: 200, height: 60 }, mode: 'fixed' });

describe('lone surrogates', () => {
  test('escapeXml replaces them with U+FFFD and keeps valid pairs', () => {
    const out = escapeXml(BAD);
    expect(out).toBe('a�b � c 🚀 d');
    expect(() => encodeURIComponent(out)).not.toThrow();
  });
  test('textLayoutToSvg, diagramSvg (thumbnail, diagram_show, slide preview) and exportSVG (versions) survive encodeURIComponent', () => {
    expect(() => encodeURIComponent(textLayoutToSvg(lay(BAD), { x: 0, y: 0 }))).not.toThrow();
    const content = {
      elements: [
        { id: `a${BAD}`, type: 'task', packId: 'process-flow', label: BAD, x: 0, y: 0, size: { width: 120, height: 60 } },
        { id: 'b', type: 'frame', packId: 'core', label: BAD, x: 200, y: 0, size: { width: 200, height: 100 } },
        { id: 'd', type: 'doc', packId: 'core', x: 0, y: 200, size: { width: 300, height: 200 }, data: { doc: { title: BAD, markdown: BAD } } },
      ],
      connections: [{ id: 'k', sourceId: 'a' + BAD, targetId: 'b', label: BAD }],
    };
    for (const opts of [{}, { ids: true }, { maxElements: 80, labels: true }]) {
      const { svg } = renderDiagramSvg(content, { maxBytes: Infinity, ...opts });
      expect(() => encodeURIComponent(svg)).not.toThrow();
    }
    const { content: legacy } = new ExportManager({ includeDataAttributes: true }).exportSVG({ ...content, elements: content.elements.slice(0, 2) });
    expect(() => encodeURIComponent(legacy)).not.toThrow();
  });
});

describe('hostile colours', () => {
  const HOSTILE = 'red" onload="alert(1)';
  test('safeFill accepts hex and rgb, nothing else', () => {
    expect(safeFill('#abc')).toBe('#aabbcc');
    expect(safeFill('rgb(1, 2, 3)')).toBe('#010203');
    expect(safeFill(HOSTILE, '#111111')).toBe('#111111');
    expect(safeFill('url(https://evil.example/x)')).toBe('#334155');
    expect(safeFill(undefined)).toBe('#334155');
  });
  test('textLayoutToSvg never writes an unparsed fill', () => {
    const svg = textLayoutToSvg(lay('x'), { x: 0, y: 0 }, { fill: HOSTILE });
    expect(svg).not.toContain('onload');
    expect(svg).toContain('fill="#334155"');
  });
  test('exportSVG: element and connection colours, ids and types are parsed or escaped', () => {
    const el = { id: `a"><script>`, type: 'task"x', label: 'L', x: 0, y: 0, size: { width: 100, height: 50 }, color: HOSTILE };
    const el2 = { id: 'b', type: 'task', label: 'M', x: 300, y: 0, size: { width: 100, height: 50 } };
    const { content } = new ExportManager().exportSVG({ elements: [el, el2], connections: [{ id: 'k"', sourceId: el.id, targetId: 'b', label: 'conn', color: HOSTILE }] });
    expect(content).not.toMatch(/onload|<script/);
    expect(content).toContain('fill="#3b82f6"');
    expect(content).toContain('stroke="#374151"');
  });
});

describe('textLength pinning is safe', () => {
  const face = resolveFace(null, 500);
  test('only Latin lines whose widest fallback squeeze is within 12% are pinned, and never with lengthAdjust glyphs', () => {
    const l = lay('Customer order');
    const svg = textLayoutToSvg(l, { x: 0, y: 0 });
    expect(svg).not.toContain('spacingAndGlyphs');
    // lowercase text: widest plausible fallback is 10% wider -> squeeze 9% -> pinned
    expect(pinnable('customer order', face, 14, lay('customer order').lines[0].width)).toBe(true);
    // capitals and digits: 15% wider -> squeeze 13% -> not pinned (glyphs would touch in DejaVu)
    expect(pinnable('ORDER 2024 MW', face, 14, lay('ORDER 2024 MW').lines[0].width)).toBe(false);
    expect(textLayoutToSvg(lay('ORDER 2024 MW'), { x: 0, y: 0 })).not.toContain('textLength');
    // non-Latin, rtl and empty
    expect(pinnable('顧客', face, 14, 28)).toBe(false);
    expect(pinnable('abc', face, 14, 0)).toBe(false);
  });
});
