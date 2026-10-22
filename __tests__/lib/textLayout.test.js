/**
 * ADR-0008 3.1 and 4: layoutText, the one deterministic text-layout function, and its four fit modes.
 */
import { layoutText, clearLayoutCache, layoutCacheStats } from '../../lib/text/layout';
import { MIN_SIZE, ROLES } from '../../lib/text/tokens';

const L14 = { size: 14, weight: 500, lineHeight: 1.3 };
const lay = (text, over = {}) => layoutText({ text, font: L14, box: { width: 100, height: 40 }, mode: 'fixed', ...over });
const texts = (l) => l.lines.map((x) => x.text);

const CORPUS = {
  w1: 'Billing',
  w3: 'Customer Order Service',
  c60: 'Validate payment details before confirming the customer order',
  c140: 'Aggregate all inbound partner shipment notifications, reconcile them against open purchase orders and flag any discrepancies for review',
  ml: 'Order intake\nValidation\nFulfilment',
  num: 'p95 latency 250 ms / 1.2k req/s',
  de: 'Kundenzufriedenheitsanalyse',
  ja: '\u{9867}\u{5BA2}\u{6E80}\u{8DB3}\u{5EA6}\u{5206}\u{6790}\u{30B5}\u{30FC}\u{30D3}\u{30B9}',
  ar: '\u{062A}\u{062D}\u{0644}\u{064A}\u{0644} \u{0631}\u{0636}\u{0627} \u{0627}\u{0644}\u{0639}\u{0645}\u{0644}\u{0627}\u{0621}',
  emoji: '\u{1F680} Launch readiness \u{2705}',
};

describe('layoutText basics', () => {
  test('a short label is one line', () => {
    const l = lay('Billing', { box: { width: 100, height: 40 } });
    expect(texts(l)).toEqual(['Billing']);
    expect(l.overflow).toBe(false);
    expect(l.fontSize).toBe(14);
    expect(l.lineHeight).toBeCloseTo(18.2, 1);
  });

  test('empty text lays out to nothing', () => {
    const l = lay('');
    expect(l.lines).toEqual([]);
    expect(l.height).toBe(0);
    expect(l.overflow).toBe(false);
  });

  test('whitespace-only text draws nothing', () => {
    expect(lay('   \n  ').lines).toEqual([]);
  });

  test('hard newlines always break', () => {
    expect(texts(lay(CORPUS.ml, { box: { width: 300, height: 100 } }))).toEqual(['Order intake', 'Validation', 'Fulfilment']);
  });

  test('a blank line between paragraphs is kept as spacing, trailing blank lines are dropped', () => {
    expect(texts(lay('a\n\nb\n\n', { box: { width: 300, height: 200 } }))).toEqual(['a', '', 'b']);
  });

  test('every line fits the width (with the glyph-drift slack) for the whole corpus', () => {
    for (const [k, text] of Object.entries(CORPUS)) {
      const l = lay(text, { box: { width: 140, height: 400 } });
      for (const line of l.lines) expect([k, line.width * 1.02 + 1 <= 140 + 1e-6 || l.breaks.emergency > 0]).toEqual([k, true]);
    }
  });

  test('words are never broken mid-word for Latin text when the box is wide enough for the longest word', () => {
    const l = lay(CORPUS.c60, { box: { width: 120, height: 400 } });
    const original = new Set(CORPUS.c60.split(' '));
    for (const t of texts(l)) for (const w of t.split(' ')) expect(original.has(w)).toBe(true);
    expect(l.breaks.emergency).toBe(0);
  });

  test('a word wider than the line is broken at a grapheme with a visible hyphen and counted', () => {
    const l = lay(CORPUS.de, { box: { width: 100, height: 400 } });
    expect(l.breaks.emergency).toBeGreaterThan(0);
    expect(l.lines.length).toBeGreaterThan(1);
    expect(l.lines[0].text.endsWith('-')).toBe(true);
    expect(l.lines[0].hyphen).toBe(true);
    expect(texts(l).join('').replace(/-/g, '')).toBe(CORPUS.de);
  });

  test('a soft hyphen draws a hyphen only where the line breaks', () => {
    const t = 'Kunden\u{AD}zufriedenheit';
    const wide = lay(t, { box: { width: 400, height: 100 } });
    expect(texts(wide)).toEqual(['Kundenzufriedenheit']);
    const narrow = lay(t, { box: { width: 110, height: 100 } });
    expect(narrow.lines[0].text).toBe('Kunden-');
    expect(narrow.breaks.emergency).toBe(0);
  });

  test('CJK wraps between characters without hyphens', () => {
    const l = lay(CORPUS.ja, { box: { width: 70, height: 400 } });
    expect(l.lines.length).toBeGreaterThan(1);
    expect(l.lines.every((x) => !x.hyphen && !x.text.endsWith('-'))).toBe(true);
    expect(texts(l).join('')).toBe(CORPUS.ja);
    expect(l.breaks.emergency).toBe(0);
  });

  test('kinsoku keeps closing punctuation with the previous character', () => {
    const t = '\u{9867}\u{5BA2}\u{6E80}\u{8DB3}\u{3002}\u{5EA6}\u{5206}\u{6790}';
    for (let w = 30; w < 140; w += 7) {
      for (const line of lay(t, { box: { width: w, height: 400 } }).lines) expect(line.text.startsWith('\u{3002}')).toBe(false);
    }
  });

  test('RTL text is marked rtl per line and start alignment resolves to the right edge', () => {
    const l = lay(CORPUS.ar, { box: { width: 70, height: 400 }, align: 'start' });
    expect(l.lines.length).toBeGreaterThan(1);
    for (const line of l.lines) {
      expect(line.dir).toBe('rtl');
      expect(line.x).toBeCloseTo(70 - line.width, 1);
    }
  });

  test('LTR start alignment is the left edge, center is centered, end is the right edge', () => {
    const box = { width: 100, height: 40 };
    const s = lay('Hi', { box, align: 'start' }).lines[0];
    const c = lay('Hi', { box, align: 'center' }).lines[0];
    const e = lay('Hi', { box, align: 'end' }).lines[0];
    expect(s.x).toBe(0);
    expect(c.x).toBeCloseTo((100 - c.width) / 2, 1);
    expect(e.x).toBeCloseTo(100 - e.width, 1);
  });

  test('vertical alignment offsets the block inside the box height', () => {
    const base = { box: { width: 200, height: 100 } };
    const top = lay('Hi', { ...base, valign: 'top' }).lines[0].top;
    const mid = lay('Hi', { ...base, valign: 'middle' }).lines[0].top;
    const bot = lay('Hi', { ...base, valign: 'bottom' }).lines[0].top;
    expect(top).toBe(0);
    expect(mid).toBeCloseTo((100 - 18.2) / 2, 1);
    expect(bot).toBeCloseTo(100 - 18.2, 1);
  });

  test('emoji clusters stay whole across lines', () => {
    const fam = '\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}';
    const l = lay(`${fam} ${fam} ${fam}`, { box: { width: 40, height: 400 } });
    for (const line of l.lines) for (const piece of line.text.split(' ')) expect(piece).toBe(fam);
  });

  test('the same input gives deep-equal output, and the cache returns the same object', () => {
    clearLayoutCache();
    const a = lay(CORPUS.c140, { box: { width: 220, height: 200 } });
    const b = lay(CORPUS.c140, { box: { width: 220, height: 200 } });
    expect(b).toBe(a);
    expect(layoutCacheStats().hits).toBe(1);
    clearLayoutCache();
    const c = lay(CORPUS.c140, { box: { width: 220, height: 200 } });
    expect(c).toEqual(a);
  });

  test('layouts are frozen (callers cannot mutate a cached layout)', () => {
    const a = lay('x');
    expect(Object.isFrozen(a)).toBe(true);
    expect(Object.isFrozen(a.lines)).toBe(true);
  });
});

describe('fit modes', () => {
  test('auto: a short label keeps the minimum width and the minimum height', () => {
    const l = layoutText({ text: 'Billing', font: L14, mode: 'auto', box: { width: 100, height: 50 }, limits: { minWidth: 100, maxWidth: 240 } });
    expect(l.box).toEqual({ width: 100, height: 50 });
    expect(l.overflow).toBe(false);
  });

  test('auto: a long single-line label grows the width up to maxWidth, then wraps and grows the height', () => {
    const l = layoutText({ text: CORPUS.c60, font: L14, mode: 'auto', box: { width: 100, height: 50 }, limits: { minWidth: 100, maxWidth: 240 } });
    expect(l.box.width).toBeLessThanOrEqual(240);
    expect(l.box.width).toBeGreaterThan(100);
    expect(l.lines.length).toBeGreaterThan(1);
    expect(l.box.height).toBeGreaterThanOrEqual(l.lines.length * l.lineHeight);
    expect(l.overflow).toBe(false);
  });

  test('auto: the box grows to the longest word (the German compound stays whole)', () => {
    const l = layoutText({ text: CORPUS.de, font: L14, mode: 'auto', box: { width: 100, height: 50 }, limits: { minWidth: 100, maxWidth: 240 } });
    expect(texts(l)).toEqual([CORPUS.de]);
    expect(l.breaks.emergency).toBe(0);
    expect(l.box.width).toBeGreaterThan(190);
    expect(l.box.width).toBeLessThanOrEqual(240);
  });

  test('auto: shrink-wraps to the widest line rather than staying at maxWidth', () => {
    const l = layoutText({ text: 'one two\nthree', font: L14, mode: 'auto', box: { width: 40, height: 20 }, limits: { minWidth: 40, maxWidth: 240 } });
    const widest = Math.max(...l.lines.map((x) => x.width));
    expect(l.box.width).toBeCloseTo(Math.ceil(widest * 1.02 + 1), 0);
  });

  test('auto: past maxLines the text is clamped with an ellipsis and reported', () => {
    const l = layoutText({ text: CORPUS.c140.repeat(3), font: L14, mode: 'auto', box: { width: 100, height: 50 }, limits: { minWidth: 100, maxWidth: 200, maxLines: 4 } });
    expect(l.lines).toHaveLength(4);
    expect(l.lines[3].text.endsWith('\u{2026}')).toBe(true);
    expect(l.overflow).toEqual({ hiddenLines: expect.any(Number), hiddenChars: expect.any(Number) });
    expect(l.overflow.hiddenLines).toBeGreaterThan(0);
    expect(l.overflow.hiddenChars).toBeGreaterThan(0);
  });

  test('auto-height: the width is fixed and the height grows to the text', () => {
    const l = layoutText({ text: CORPUS.c60, font: L14, mode: 'auto-height', box: { width: 120, height: 20 } });
    expect(l.box.width).toBe(120);
    expect(l.lines.length).toBeGreaterThan(2);
    expect(l.box.height).toBeCloseTo(l.lines.length * l.lineHeight, 1);
  });

  test('shrink: the font steps down until the text fits the box', () => {
    const fits = layoutText({ text: 'Billing', font: L14, mode: 'shrink', box: { width: 120, height: 60 } });
    expect(fits.fontSize).toBe(14);
    let found = 0;
    for (let w = 110; w <= 230; w += 5) {
      const l = layoutText({ text: CORPUS.c60, font: L14, mode: 'shrink', box: { width: w, height: 56 } });
      expect(l.fontSize).toBeGreaterThanOrEqual(MIN_SIZE);
      if (l.fontSize < 14 && l.overflow === false) {
        found += 1;
        expect(l.lines.length * l.lineHeight).toBeLessThanOrEqual(56 + 1e-6);
      }
    }
    expect(found).toBeGreaterThan(0);
  });

  test('shrink: stops at 11 px, then clamps with the overflow indicator', () => {
    const l = layoutText({ text: CORPUS.c140, font: L14, mode: 'shrink', box: { width: 100, height: 50 } });
    expect(l.fontSize).toBe(MIN_SIZE);
    expect(l.overflow).not.toBe(false);
    expect(l.lines.length * l.lineHeight).toBeLessThanOrEqual(50 + 1e-6);
    expect(l.lines[l.lines.length - 1].text.endsWith('\u{2026}')).toBe(true);
  });

  test('shrink: a long word that does not fit at 14 px shrinks instead of breaking when a smaller size fits', () => {
    const wordW = layoutText({ text: 'Authentication', font: L14, mode: 'auto', box: { width: 10, height: 10 }, limits: { maxWidth: 400 } }).width;
    const l = layoutText({ text: 'Authentication', font: L14, mode: 'shrink', box: { width: Math.round(wordW * 0.9), height: 60 } });
    expect(l.breaks.emergency).toBe(0);
    expect(l.fontSize).toBeLessThan(14);
  });

  test('fixed: the font never changes, the text is clamped to the box height with an indicator', () => {
    const l = layoutText({ text: CORPUS.c140, font: L14, mode: 'fixed', box: { width: 120, height: 50 } });
    expect(l.fontSize).toBe(14);
    expect(l.lines).toHaveLength(2); // floor(50 / 18.2)
    expect(l.overflow).not.toBe(false);
    expect(l.lines[1].text.endsWith('\u{2026}')).toBe(true);
  });

  test('fixed, one line: ellipsis when the title is too long (frame and lane titles)', () => {
    const l = layoutText({ text: CORPUS.c60, font: ROLES.title, mode: 'fixed', box: { width: 160, height: 20 }, limits: { maxLines: 1 } });
    expect(l.lines).toHaveLength(1);
    expect(l.lines[0].text.endsWith('\u{2026}')).toBe(true);
    expect(l.lines[0].width * 1.02 + 1).toBeLessThanOrEqual(160);
    expect(l.overflow.hiddenLines).toBeGreaterThan(0);
    expect(l.overflow.hiddenChars).toBeGreaterThan(0);
  });

  test('no mode ever returns a font below 11 px unless asked for', () => {
    for (const mode of ['auto', 'auto-height', 'shrink', 'fixed']) {
      for (const text of Object.values(CORPUS)) {
        const l = layoutText({ text, font: L14, mode, box: { width: 90, height: 40 }, limits: { minWidth: 90, maxWidth: 200 } });
        expect(l.fontSize).toBeGreaterThanOrEqual(MIN_SIZE);
      }
    }
  });

  test('the role sizes are 14/14/12/11/18 and never below 11', () => {
    expect(Object.values(ROLES).map((r) => r.size)).toEqual([14, 14, 12, 11, 18]);
    expect(Math.min(...Object.values(ROLES).map((r) => r.size))).toBeGreaterThanOrEqual(MIN_SIZE);
  });
});

describe('performance', () => {
  test('a label lays out in well under a millisecond (median)', () => {
    const samples = [];
    for (let i = 0; i < 200; i++) {
      const t0 = process.hrtime.bigint();
      layoutText({ text: `${CORPUS.c60} ${i}`, font: L14, box: { width: 200, height: 100 }, mode: 'shrink' });
      samples.push(Number(process.hrtime.bigint() - t0) / 1e6);
    }
    samples.sort((a, b) => a - b);
    expect(samples[100]).toBeLessThan(1);
  });
});
