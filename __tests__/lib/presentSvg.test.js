/**
 * @jest-environment node
 */
// ADR-0007 P2: the server SVG renderer (diagram_show) draws text presets, theme tokens, slide frames, radius and opacity.
import { renderDiagramSvg } from '../../lib/render/diagramSvg';
import { themeFromPreset } from '../../lib/present/themes';

const frame = (extra = {}) => ({ id: 'f', type: 'frame', packId: 'core', isFrame: true, x: 0, y: 0, size: { width: 960, height: 540 }, label: 'S', data: { backgroundColor: '@bg', aspect: '16:9' }, ...extra });
const text = (md, preset = 'body', extra = {}) => ({ id: 't', type: 'text-block', packId: 'core', x: 40, y: 40, size: { width: 400, height: 120 }, label: md, fontSize: 28, parentFrameId: 'f', data: { text: { preset, markdown: md } }, ...extra });
const render = (elements, theme) => renderDiagramSvg({ elements, connections: [], ...(theme ? { theme } : {}) }).svg;

describe('frames and tokens', () => {
  test('a slide frame fills with the theme background and has a solid hairline instead of dashes', () => {
    const svg = render([frame()], themeFromPreset('slate-dark'));
    expect(svg).toContain('fill="#18212b"');
    expect(svg).not.toMatch(/stroke-dasharray="8 4"/);
    expect(render([frame()])).toContain('fill="#ffffff"');
  });
  test('an ordinary frame keeps the dashed outline', () => {
    expect(render([frame({ data: {} })])).toMatch(/stroke-dasharray="8 4"/);
  });
  test('token fills resolve through the theme; hex is untouched; unknown tokens fall back', () => {
    const rect = (id, bg) => ({ id, type: 'rectangle', packId: 'core', x: 0, y: 0, size: { width: 100, height: 60 }, label: 'K', backgroundColor: bg });
    expect(render([rect('a', '@accent')], themeFromPreset('paper'))).toContain('fill="#cc7a5e"');
    expect(render([rect('a', '#112233')], themeFromPreset('paper'))).toContain('fill="#112233"');
    expect(render([rect('a', '@zzz')])).not.toContain('@zzz');
  });
  test('corner radius and opacity are drawn', () => {
    const rect = { id: 'a', type: 'rectangle', packId: 'core', x: 0, y: 0, size: { width: 100, height: 60 }, label: 'K', backgroundColor: '#112233', borderRadius: 24, opacity: 0.5 };
    const svg = render([rect]);
    expect(svg).toContain('rx="24"');
    expect(svg).toContain('fill-opacity="0.5"');
    expect(render([{ ...rect, borderRadius: 999 }])).toContain('rx="30"'); // fully round: half the short side
  });
});

describe('text presets', () => {
  test('draws the preset with theme colour, theme font and its font size; no card chrome', () => {
    const svg = render([frame(), text('Hello world', 'title', { fontSize: 36 })], themeFromPreset('paper'));
    expect(svg).toContain('Hello world');
    expect(svg).toContain('font-size="36"');
    expect(svg).toContain('fill="#2a2622"');
    expect(svg).toMatch(/font-family="[^"]*Source Serif 4/);
    expect(svg).toContain('font-weight="700"');
  });
  test('wraps inside the box width and draws list bullets', () => {
    const svg = render([text('- one\n- two', 'body'), text('word '.repeat(60), 'body', { id: 't2', size: { width: 300, height: 200 } })]);
    expect((svg.match(/•/g) || []).length).toBeGreaterThanOrEqual(2);
    expect((svg.match(/<tspan/g) || []).length + (svg.match(/<text/g) || []).length).toBeGreaterThan(6);
  });
  test('alignment and italic are honoured', () => {
    const svg = render([text('x', 'quote', { fontSize: 40, data: { text: { preset: 'quote', markdown: 'x', align: 'center' } } })]);
    expect(svg).toContain('font-style="italic"');
    expect(svg).toContain('text-anchor="middle"');
  });
  test('hostile text and colours are escaped and never reach attributes', () => {
    const svg = render([text('<script>alert(1)</script> "quoted"', 'body', { data: { text: { preset: 'body', markdown: '\\<script>alert(1)\\</script> "quoted"', color: '#ff0000' } } })]);
    expect(svg).not.toMatch(/<script/);
    expect(svg).toContain('&quot;quoted&quot;');
    expect(svg).toContain('fill="#ff0000"');
  });
  test('a theme switch restyles the same element', () => {
    const els = [text('Hi', 'body')];
    expect(render(els, themeFromPreset('ethereal-sky'))).not.toEqual(render(els, themeFromPreset('slate-dark')));
  });
});
