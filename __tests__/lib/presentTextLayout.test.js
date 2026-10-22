/**
 * @jest-environment node
 */
// The single text-layout boundary for preset text (swappable for the ADR-0008 engine).
import { layoutText, MIN_READABLE } from '../../lib/present/textLayout';

describe('layoutText', () => {
  test('returns lines, font size, height and no overflow for auto-height boxes', () => {
    const r = layoutText({ text: 'Hello world', preset: 'body', box: { width: 800 } });
    expect(r.fontSize).toBe(32);
    expect(r.lines[0].text).toBe('Hello world');
    expect(r.autoHeight).toBe(true);
    expect(r.overflow).toBe(false);
    expect(r.height).toBeGreaterThan(0);
  });
  test('wraps within the width and reports overflow instead of clipping silently', () => {
    const text = 'word '.repeat(200);
    const r = layoutText({ text, preset: 'body', box: { width: 600, height: 100 } });
    expect(r.lines.length).toBeGreaterThan(5);
    expect(r.overflow).toBe(true);
    expect(layoutText({ text, preset: 'body', box: { width: 600, height: r.height } }).overflow).toBe(false);
  });
  test('bullets and positions are monotonic', () => {
    const r = layoutText({ text: '- a\n- b', preset: 'body', box: { width: 800 } });
    expect(r.lines.map((l) => l.bullet)).toEqual(['•', '•']);
    expect(r.lines[1].y).toBeGreaterThan(r.lines[0].y);
  });
  test('exposes a minimum readable size per preset', () => {
    expect(layoutText({ text: 'x', preset: 'caption', box: { width: 500 } }).minReadable).toBe(MIN_READABLE.caption);
  });
  test('deterministic', () => {
    const a = layoutText({ text: 'a b c d e', preset: 'title', box: { width: 300 } });
    expect(layoutText({ text: 'a b c d e', preset: 'title', box: { width: 300 } })).toEqual(a);
  });
  // ADR-0008 T1: the wrapping is the shared lib/text engine, not a characters-per-line estimate
  test('delegates to the shared engine: glyph widths matter (wide letters wrap earlier than narrow ones)', () => {
    const narrow = layoutText({ text: 'i'.repeat(40), preset: 'body', box: { width: 400 } });
    const wide = layoutText({ text: 'W'.repeat(40), preset: 'body', box: { width: 400 } });
    expect(wide.lines.length).toBeGreaterThan(narrow.lines.length);
  });
  test('words stay whole and CJK wraps per character', () => {
    const r = layoutText({ text: 'Customer Order Service review', preset: 'body', box: { width: 300 } });
    for (const l of r.lines) for (const w of l.text.split(' ')) expect(['Customer', 'Order', 'Service', 'review']).toContain(w);
    const ja = layoutText({ text: '\u{9867}\u{5BA2}\u{6E80}\u{8DB3}\u{5EA6}\u{5206}\u{6790}\u{30B5}\u{30FC}\u{30D3}\u{30B9}'.repeat(3), preset: 'body', box: { width: 200 } });
    expect(ja.lines.length).toBeGreaterThan(2);
  });
  test('the theme font id picks the metric class: a serif theme measures wider than Inter', () => {
    const inter = layoutText({ text: 'x '.repeat(200), preset: 'body', box: { width: 800 }, theme: { fonts: { heading: 'inter', body: 'inter' } } });
    const serif = layoutText({ text: 'x '.repeat(200), preset: 'body', box: { width: 800 }, theme: { fonts: { heading: 'source-serif-4', body: 'source-serif-4' } } });
    expect(serif.lines.length).toBeGreaterThanOrEqual(inter.lines.length);
  });
});
