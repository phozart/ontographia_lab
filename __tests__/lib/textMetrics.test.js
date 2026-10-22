/**
 * ADR-0008 3.2 and 7: the committed metric tables are in step with the font files, the font resolver behaves, and the
 * JS type tokens equal the CSS custom properties.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import metrics from '../../lib/text/metrics/inter.json';
import { snapWeight, familyClass, resolveFace, measureText, graphemeAdvance, FALLBACK_CLASSES } from '../../lib/text/fonts';
import { ROLES, PAD, MIN_SIZE } from '../../lib/text/tokens';

const ROOT = path.join(__dirname, '..', '..');

describe('metric tables', () => {
  test.each([400, 500, 600, 700])('Inter %s tables match the sha1 of the font files (regenerate with scripts/build-font-metrics.js)', (w) => {
    const h = crypto.createHash('sha1');
    for (const s of ['latin', 'latin-ext']) h.update(fs.readFileSync(path.join(ROOT, 'public', 'fonts', `inter-${s}-${w}-normal.woff2`)));
    expect(metrics.faces[w].sha1).toBe(h.digest('hex'));
  });

  test('tables cover Latin and Latin Extended (Polish, Czech, Turkish)', () => {
    const face = resolveFace('Inter', 500);
    for (const ch of 'Za\u{17C}\u{F3}\u{142}\u{107} \u{159}\u{161}\u{11F}\u{131}\u{130}\u{DF}\u{FC}') {
      expect(face.table.adv.has(ch.codePointAt(0))).toBe(true);
    }
  });

  test('the table has no system-fallback glyphs: an arrow outside Inter latin is measured by class, not by table', () => {
    expect(resolveFace('Inter', 500).table.adv.has(0x2192)).toBe(false);
  });

  test('weights get wider as they get bolder', () => {
    const s = 'Customer Order Service';
    const w = [400, 500, 600, 700].map((x) => measureText(s, resolveFace('Inter', x), 14));
    expect(w[0]).toBeLessThan(w[1]);
    expect(w[1]).toBeLessThan(w[2]);
    expect(w[2]).toBeLessThan(w[3]);
  });
});

describe('font resolver', () => {
  test('weights snap to the table', () => {
    expect([snapWeight('normal'), snapWeight('bold'), snapWeight(300), snapWeight(500), snapWeight(800), snapWeight(undefined), snapWeight('x')]).toEqual([400, 700, 400, 500, 700, 400, 500]);
  });
  test('families map to Inter, or to the nearest metric class', () => {
    expect(familyClass(null)).toBe('inter');
    expect(familyClass("'Inter', -apple-system, sans-serif")).toBe('inter');
    expect(familyClass('Georgia, serif')).toBe('serif');
    expect(familyClass("'Roboto Mono', monospace")).toBe('mono');
    expect(familyClass('Lato, sans-serif')).toBe('sans');
  });
  test('legacy families get 4% slack over Inter; monospace is 0.6 em per glyph', () => {
    const inter = measureText('Hello world', resolveFace('Inter', 500), 14);
    expect(measureText('Hello world', resolveFace('Lato', 500), 14)).toBeCloseTo(inter * 1.04, 5);
    expect(measureText('abcd', resolveFace('Consolas', 400), 10)).toBeCloseTo(24, 5);
  });
  test('fallback classes: CJK is one em, emoji clusters are one fallback width, marks are free', () => {
    const f = resolveFace('Inter', 500);
    expect(graphemeAdvance('\u{9867}', f)).toBe(FALLBACK_CLASSES.cjk);
    expect(graphemeAdvance('\u{1F680}', f)).toBe(FALLBACK_CLASSES.emoji);
    expect(graphemeAdvance('\u{1F468}\u{200D}\u{1F469}', f)).toBe(FALLBACK_CLASSES.emoji);
    expect(graphemeAdvance('e\u{301}', f)).toBe(graphemeAdvance('e', f));
    expect(graphemeAdvance('\u{200B}', f)).toBe(0);
    expect(FALLBACK_CLASSES.cjk).toBeGreaterThanOrEqual(1000);
  });
});

describe('type tokens', () => {
  const css = fs.readFileSync(path.join(ROOT, 'styles', 'diagram-studio-tokens.css'), 'utf8');
  const cssVar = (name) => {
    const m = new RegExp(`--ds-text-${name}:\\s*([0-9.]+)`).exec(css);
    return m ? Number(m[1]) : null;
  };
  test('five roles, none below 11 px, default label 14 px', () => {
    expect(Object.keys(ROLES)).toEqual(['label', 'title', 'caption', 'meta', 'emphasis']);
    expect(MIN_SIZE).toBe(11);
    expect(ROLES.label.size).toBe(14);
    for (const r of Object.values(ROLES)) expect(r.size).toBeGreaterThanOrEqual(11);
  });
  test('the CSS custom properties equal the JS tokens', () => {
    for (const [name, r] of Object.entries(ROLES)) {
      expect([name, cssVar(`${name}-size`), cssVar(`${name}-weight`), cssVar(`${name}-line`)]).toEqual([name, r.size, r.weight, r.lineHeight]);
    }
    expect(cssVar('min-size')).toBe(MIN_SIZE);
    expect([cssVar('pad-s'), cssVar('pad-m'), cssVar('pad-l')]).toEqual([PAD.s, PAD.m, PAD.l]);
  });
});
