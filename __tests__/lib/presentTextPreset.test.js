/**
 * @jest-environment node
 */
// ADR-0007 P2: text presets on core/text-block (data.text = {preset, markdown, ...}); safe Markdown subset; caps.
import {
  TEXT_PRESETS, PRESET_SPECS, materializedFontSize, textOf, isPresetText, cleanTextData, validateTextElements, plainLabelOf,
  estimateTextHeight, newPresetTextElement, MAX_TEXT_BYTES, presetStyle,
} from '../../lib/present/textPreset';
import { themeFromPreset, FONT_STACKS } from '../../lib/present/themes';
import { validateDiagramContent } from '../../lib/diagramContent';
import { parseMarkdown } from '../../lib/doc/markdown';

const text = (data, extra = {}) => ({ id: 't1', type: 'text-block', packId: 'core', x: 0, y: 0, size: { width: 400, height: 80 }, label: '', layerId: 'default', properties: {}, data: { text: data }, ...extra });

describe('presets', () => {
  test('the seven presets and their sizes at the 1080 board-unit scale (ADR 5.2)', () => {
    expect(TEXT_PRESETS).toEqual(['title', 'subtitle', 'heading', 'body', 'caption', 'quote', 'number']);
    expect(PRESET_SPECS.title.size).toBe(72);
    expect(PRESET_SPECS.subtitle.size).toBe(40);
    expect(PRESET_SPECS.heading.size).toBe(48);
    expect(PRESET_SPECS.body.size).toBe(32); // ADR sketch: 28; raised after the first visual check at 1379 x 985
    expect(PRESET_SPECS.caption.size).toBe(22);
    expect(PRESET_SPECS.quote.size).toBe(40);
    expect(PRESET_SPECS.quote.italic).toBe(true);
    expect(PRESET_SPECS.number.size).toBe(120);
    expect(PRESET_SPECS.number.weight).toBe(600);
  });
  test('font size is materialized as size x (frame height / 1080)', () => {
    expect(materializedFontSize('title', 1080)).toBe(72);
    expect(materializedFontSize('title', 540)).toBe(36);
    expect(materializedFontSize('body', 400)).toBe(Math.round(32 * 400 / 1080));
    expect(materializedFontSize('body')).toBe(32);
    expect(materializedFontSize('body', 5)).toBeGreaterThanOrEqual(6); // never unreadably small
  });
  test('presetStyle resolves colour and font through the theme, so a theme switch restyles the text', () => {
    const el = text({ preset: 'title', markdown: 'Hi' }, { fontSize: 72 });
    const eth = presetStyle(el, themeFromPreset('ethereal-sky'));
    const dark = presetStyle(el, themeFromPreset('slate-dark'));
    expect(eth.color).toBe(themeFromPreset('ethereal-sky').palette.text);
    expect(dark.color).toBe(themeFromPreset('slate-dark').palette.text);
    expect(eth.fontFamily).toBe(FONT_STACKS.inter);
    expect(presetStyle(el, themeFromPreset('paper')).fontFamily).toBe(FONT_STACKS['source-serif-4']);
    expect(eth.fontSize).toBe(72);
    expect(eth.fontWeight).toBe(700);
  });
  test('an explicit hex override is not restyled; a token override follows the theme', () => {
    const hex = presetStyle(text({ preset: 'body', markdown: 'x', color: '#112233' }), themeFromPreset('paper'));
    expect(hex.color).toBe('#112233');
    const tok = presetStyle(text({ preset: 'body', markdown: 'x', color: '@accentText' }), themeFromPreset('paper'));
    expect(tok.color).toBe(themeFromPreset('paper').palette.accentText);
  });
  test('number uses the heading font, caption and subtitle the muted colour', () => {
    const t = themeFromPreset('ethereal-sky');
    expect(presetStyle(text({ preset: 'caption', markdown: 'x' }), t).color).toBe(t.palette.muted);
    expect(presetStyle(text({ preset: 'subtitle', markdown: 'x' }), t).color).toBe(t.palette.muted);
    expect(presetStyle(text({ preset: 'number', markdown: '42' }), t).color).toBe(t.palette.accentText);
  });
});

describe('element helpers', () => {
  test('textOf / isPresetText', () => {
    expect(isPresetText(text({ preset: 'body', markdown: 'a' }))).toBe(true);
    expect(textOf({ id: 'x', type: 'text-block', label: 'legacy' })).toBeNull();
    expect(isPresetText({ id: 'x', type: 'rectangle', data: { text: { preset: 'body', markdown: '' } } })).toBe(false);
  });
  test('plainLabelOf flattens markdown to a label for outlines and search', () => {
    expect(plainLabelOf('# Hi **there**\n\n- one\n- two')).toBe('Hi there one two');
    expect(plainLabelOf('x'.repeat(900)).length).toBeLessThanOrEqual(500);
  });
  test('newPresetTextElement builds a valid text-block with a materialized size and a synced label', () => {
    const el = newPresetTextElement({ id: 'el-1', x: 10, y: 20, preset: 'heading', markdown: 'Findings', width: 600, frameHeight: 540 });
    expect(el).toMatchObject({ id: 'el-1', type: 'text-block', packId: 'core', x: 10, y: 20, label: 'Findings', fontSize: 24 });
    expect(el.data.text).toEqual({ preset: 'heading', markdown: 'Findings' });
    expect(el.size.width).toBe(600);
    expect(el.size.height).toBeGreaterThan(0);
    expect(validateDiagramContent({ elements: [el] }).ok).toBe(true);
  });
});

describe('cleanTextData', () => {
  test('unknown keys are rejected, caps hold', () => {
    expect(cleanTextData({ preset: 'body', markdown: 'a', evil: 1 }).ok).toBe(false);
    expect(cleanTextData({ preset: 'huge', markdown: 'a' }).ok).toBe(false);
    expect(cleanTextData({ preset: 'body' }).ok).toBe(false);
    expect(cleanTextData({ preset: 'body', markdown: 1 }).ok).toBe(false);
    const big = cleanTextData({ preset: 'body', markdown: 'x'.repeat(MAX_TEXT_BYTES + 1) });
    expect(big.ok).toBe(false);
    expect(big.status).toBe(413);
  });
  test.each([
    ['color', 'red'], ['color', 'url(http://x)'], ['color', '#12'], ['color', '@nope'], ['color', 5],
    ['align', 'justify'], ['verticalAlign', 'baseline'], ['fontWeight', 'heavy'], ['fontWeight', 950],
  ])('rejects %s=%p', (k, v) => {
    expect(cleanTextData({ preset: 'body', markdown: 'a', [k]: v }).ok).toBe(false);
  });
  test('accepts hex, tokens and the closed overrides', () => {
    const r = cleanTextData({ preset: 'body', markdown: 'a', color: '#ABC', align: 'center', verticalAlign: 'middle', fontWeight: 600 });
    expect(r.ok).toBe(true);
    expect(r.text).toEqual({ preset: 'body', markdown: 'a', color: '#ABC', align: 'center', verticalAlign: 'middle', fontWeight: 600 });
    expect(cleanTextData({ preset: 'body', markdown: 'a', color: '@accent' }).ok).toBe(true);
  });
  test('hostile markdown is neutralized by the same sanitizer as docs (no HTML, no javascript: links, no images)', () => {
    const r = cleanTextData({ preset: 'body', markdown: '<script>alert(1)</script> [x](javascript:alert(1)) ![i](http://evil/x.png) <img src=x onerror=alert(1)>' });
    expect(r.ok).toBe(true);
    expect(r.text.markdown).not.toMatch(/(^|[^\\])<(script|img)/i); // every < is escaped, so it renders as text
    expect(r.text.markdown).not.toMatch(/\]\(javascript:/i);
    const ast = JSON.stringify(parseMarkdown(r.text.markdown));
    expect(ast).not.toMatch(/"t":"html"|"t":"img"/);
  });
});

describe('validateTextElements / validateDiagramContent', () => {
  test('text data is only allowed on core/text-block', () => {
    const r = validateDiagramContent({ elements: [text({ preset: 'body', markdown: 'a' }, { type: 'rectangle' })] });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/text-block/);
  });
  test('stored text is rewritten through the sanitizer and the label stays in sync', () => {
    const r = validateDiagramContent({ elements: [text({ preset: 'body', markdown: 'Hello <b>x</b> [bad](javascript:1)' })] });
    expect(r.ok).toBe(true);
    const el = r.content.elements[0];
    expect(el.data.text.markdown).not.toMatch(/(^|[^\\])<b>/);
    expect(el.label).toBe('Hello <b>x</b> bad');
    expect(r.warnings.join(' ')).toMatch(/unsafe link|HTML/i);
  });
  test('a legacy text-block without data.text is untouched', () => {
    const legacy = { id: 'l', type: 'text-block', packId: 'core', x: 0, y: 0, label: 'Old', fontSize: 14 };
    const r = validateDiagramContent({ elements: [legacy] });
    expect(r.ok).toBe(true);
    expect(r.content.elements[0]).toEqual(legacy);
  });
  test('validateTextElements returns the list unchanged when there is no preset text', () => {
    const content = { elements: [{ id: 'a', type: 'rectangle' }] };
    expect(validateTextElements(content)).toEqual({ ok: true, content, warnings: [] });
  });
});

describe('estimateTextHeight', () => {
  test('grows with text and shrinks with width; deterministic', () => {
    const short = estimateTextHeight('Hello', 'body', 800, 28);
    const long = estimateTextHeight('word '.repeat(120), 'body', 800, 28);
    const narrow = estimateTextHeight('word '.repeat(120), 'body', 400, 28);
    expect(long).toBeGreaterThan(short);
    expect(narrow).toBeGreaterThan(long);
    expect(estimateTextHeight('word '.repeat(120), 'body', 800, 28)).toBe(long);
  });
  test('lists count one line group per item', () => {
    const one = estimateTextHeight('- a', 'body', 800, 28);
    const three = estimateTextHeight('- a\n- b\n- c', 'body', 800, 28);
    expect(three).toBeGreaterThan(one * 2);
  });
});
