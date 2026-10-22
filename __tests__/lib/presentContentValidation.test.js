/**
 * @jest-environment node
 */
// ADR-0007 P2: server validation of content.theme, token / hex colours, shape radius and opacity.
import { validateDiagramContent } from '../../lib/diagramContent';
import { CONTENT_KEYS } from '../../lib/diagramLimits';
import { cleanElementStyles } from '../../lib/present/styleFields';
import { themeFromPreset } from '../../lib/present/themes';

const rect = (extra = {}) => ({ id: 'r1', type: 'rectangle', packId: 'core', x: 0, y: 0, size: { width: 100, height: 60 }, label: 'A', ...extra });

describe('content.theme', () => {
  test('theme is a content key', () => {
    expect(CONTENT_KEYS).toContain('theme');
  });
  test('a valid theme is stored expanded; no theme key appears when absent', () => {
    const r = validateDiagramContent({ elements: [], theme: { preset: 'paper' } });
    expect(r.ok).toBe(true);
    expect(r.content.theme).toEqual(themeFromPreset('paper'));
    const none = validateDiagramContent({ elements: [] });
    expect(none.ok).toBe(true);
    expect('theme' in none.content).toBe(false);
  });
  test.each([
    ['unknown key', { preset: 'paper', evil: 1 }],
    ['unknown preset', { preset: 'x' }],
    ['css colour', { preset: 'paper', palette: { bg: 'url(javascript:alert(1))' } }],
    ['css injection in colour', { preset: 'paper', palette: { bg: '#ffffff;background:url(x)' } }],
    ['font outside the list', { preset: 'paper', fonts: { heading: 'Papyrus' } }],
    ['array', []],
    ['string', 'paper'],
  ])('rejects %s', (_n, theme) => {
    const r = validateDiagramContent({ elements: [], theme });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });
  test('palette values are not touched by URL stripping, and low contrast is only a warning', () => {
    const r = validateDiagramContent({ elements: [], theme: { preset: 'paper', palette: { text: '#eeeeee' } } });
    expect(r.ok).toBe(true);
    expect(r.warnings.join(' ')).toMatch(/contrast/i);
  });
  test('theme survives alongside presentations', () => {
    const r = validateDiagramContent({ elements: [], presentations: [{ id: 'p', title: 'T', aspect: '16:9', slides: [] }], theme: { preset: 'contrast' } });
    expect(r.ok).toBe(true);
    expect(r.content.presentations).toHaveLength(1);
    expect(r.content.theme.preset).toBe('contrast');
  });
});

describe('colour fields (tokens or hex, no CSS injection)', () => {
  const colors = (el) => validateDiagramContent({ elements: [el] });
  test('tokens, hex, named and rgb colours are kept', () => {
    const r = colors(rect({ color: '@accent', backgroundColor: '#112233', borderColor: 'red', textColor: 'rgb(1, 2, 3)', fillColor: '@bg' }));
    expect(r.ok).toBe(true);
    expect(r.content.elements[0]).toMatchObject({ color: '@accent', backgroundColor: '#112233', borderColor: 'red', textColor: 'rgb(1, 2, 3)', fillColor: '@bg' });
    expect(r.warnings.filter((w) => /colour|color/i.test(w))).toEqual([]);
  });
  test.each([
    '@nope', 'url(https://evil/x)', 'red; background: url(x)', 'expression(alert(1))', '#12345', '</style><script>', 'javascript:alert(1)', 'var(--x); color: red', '@accent2x', 'a'.repeat(200),
  ])('strips %p and warns', (bad) => {
    const r = colors(rect({ color: bad }));
    expect(r.ok).toBe(true);
    expect('color' in r.content.elements[0]).toBe(false);
    expect(r.warnings.join(' ')).toMatch(/colou?r/i);
  });
  test('a frame background in data may be a token; an unsafe one is stripped', () => {
    const f = (bg) => ({ id: 'f1', type: 'frame', packId: 'core', isFrame: true, x: 0, y: 0, size: { width: 1920, height: 1080 }, data: { backgroundColor: bg, aspect: '16:9' } });
    expect(colors(f('@bg')).content.elements[0].data.backgroundColor).toBe('@bg');
    const bad = colors(f('url(x)'));
    expect(bad.ok).toBe(true);
    expect(bad.content.elements[0].data.backgroundColor).toBeUndefined();
  });
  test('non-string colour values are stripped, not stored', () => {
    const r = colors(rect({ color: { toString: 'x' }, backgroundColor: 5 }));
    expect(r.ok).toBe(true);
    expect(r.content.elements[0].color).toBeUndefined();
    expect(r.content.elements[0].backgroundColor).toBeUndefined();
  });
});

describe('shape radius and opacity', () => {
  test('valid values are kept', () => {
    const r = validateDiagramContent({ elements: [rect({ borderRadius: 24, opacity: 0.4 })] });
    expect(r.content.elements[0]).toMatchObject({ borderRadius: 24, opacity: 0.4 });
  });
  test.each([[{ borderRadius: -1 }], [{ borderRadius: 1000 }], [{ borderRadius: 'big' }], [{ opacity: 2 }], [{ opacity: -0.1 }], [{ opacity: '0.5' }], [{ opacity: NaN }]])('strips %j with a warning', (bad) => {
    const r = validateDiagramContent({ elements: [rect(bad)] });
    expect(r.ok).toBe(true);
    for (const k of Object.keys(bad)) expect(k in r.content.elements[0]).toBe(false);
    expect(r.warnings.join(' ')).toMatch(/radius|opacity/i);
  });
  test('999 is the full-round magic value and stays valid', () => {
    expect(validateDiagramContent({ elements: [rect({ borderRadius: 999 })] }).content.elements[0].borderRadius).toBe(999);
  });
});

describe('cleanElementStyles', () => {
  test('returns the same content object when nothing changes', () => {
    const content = { elements: [rect({ color: '#fff' })] };
    const r = cleanElementStyles(content);
    expect(r.content).toBe(content);
    expect(r.warnings).toEqual([]);
  });
  test('never mutates its input', () => {
    const el = rect({ color: 'url(x)' });
    const content = { elements: [el] };
    cleanElementStyles(content);
    expect(el.color).toBe('url(x)');
  });
});

describe('provenance, layout and label flags', () => {
  const clean = (extra, data) => validateDiagramContent({ elements: [rect({ ...extra, ...(data ? { data } : {}) })] });
  test('a valid origin, showLabel and frame layout are kept', () => {
    const r = clean({ origin: { copiedFrom: { elementId: 'a', revision: 3 }, slot: 'left' }, showLabel: false }, { layout: 'two-column' });
    expect(r.content.elements[0]).toMatchObject({ origin: { copiedFrom: { elementId: 'a', revision: 3 }, slot: 'left' }, showLabel: false, data: { layout: 'two-column' } });
  });
  test.each([
    [{ origin: 'x' }], [{ origin: { evil: 1 } }], [{ origin: { slot: 'Not Valid!' } }], [{ origin: { copiedFrom: { elementId: 'a' } } }],
    [{ origin: { copiedFrom: { elementId: 'a', revision: -1 } } }], [{ origin: { copiedFrom: { elementId: 'a', revision: 1, extra: 1 } } }], [{ showLabel: 'no' }],
  ])('strips %j with a warning', (bad) => {
    const r = clean(bad);
    expect(r.ok).toBe(true);
    for (const k of Object.keys(bad)) expect(k in r.content.elements[0]).toBe(false);
    expect(r.warnings.join(' ')).toMatch(/invalid slide field/);
  });
  test('an unknown layout name is stripped', () => {
    const r = clean({}, { layout: 'carousel' });
    expect(r.content.elements[0].data.layout).toBeUndefined();
  });
});

describe('font size and element size clamps', () => {
  const run = (extra) => validateDiagramContent({ elements: [rect(extra)] });
  test('out-of-range values are clamped with a warning, in-range ones untouched', () => {
    const r = run({ fontSize: 99999, size: { width: 1e9, height: -5 } });
    expect(r.ok).toBe(true);
    expect(r.content.elements[0].fontSize).toBe(2000);
    expect(r.content.elements[0].size).toEqual({ width: 100000, height: 0 });
    expect(r.warnings.join(' ')).toMatch(/clamped/);
    expect(run({ fontSize: 0 }).content.elements[0].fontSize).toBe(1);
    const ok = run({ fontSize: 24, size: { width: 100, height: 60 } });
    expect(ok.content.elements[0]).toMatchObject({ fontSize: 24, size: { width: 100, height: 60 } });
    expect(ok.warnings.join(' ')).not.toMatch(/clamped/);
  });
  test('non-numbers are stripped', () => {
    const r = run({ fontSize: 'big', size: { width: 'x', height: 10 } });
    expect(r.content.elements[0].fontSize).toBeUndefined();
    expect(r.content.elements[0].size).toEqual({ height: 10 });
  });
});
