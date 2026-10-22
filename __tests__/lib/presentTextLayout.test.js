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
});
