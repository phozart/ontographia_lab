/**
 * ADR-0008 section 6: graphemes, script classes and break opportunities (pure, no DOM).
 */
import { graphemes, toAtoms, detectDir, scriptClass, isEmojiCluster } from '../../lib/text/segment';

const words = (t) => toAtoms(t).map((a) => a.gs.join(''));

describe('graphemes', () => {
  test('plain ASCII is one grapheme per character', () => {
    expect(graphemes('abc')).toEqual(['a', 'b', 'c']);
  });
  test('empty text has none', () => {
    expect(graphemes('')).toEqual([]);
  });
  test('a ZWJ emoji sequence, a flag and a combining mark stay whole', () => {
    expect(graphemes('\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}')).toHaveLength(1);
    expect(graphemes('\u{1F1E9}\u{1F1EA}')).toHaveLength(1);
    expect(graphemes('e\u{301}x')).toEqual(['e\u{301}', 'x']);
  });
  test('emoji clusters are recognized', () => {
    expect(isEmojiCluster('\u{1F680}')).toBe(true);
    expect(isEmojiCluster('a')).toBe(false);
  });
});

describe('script classes and direction', () => {
  test('classes', () => {
    expect(scriptClass('\u{9867}'.codePointAt(0))).toBe('cjk');
    expect(scriptClass('\u{30B5}'.codePointAt(0))).toBe('cjk');
    expect(scriptClass('\u{D55C}'.codePointAt(0))).toBe('hangul');
    expect(scriptClass('\u{062A}'.codePointAt(0))).toBe('arabic');
    expect(scriptClass('\u{05D0}'.codePointAt(0))).toBe('hebrew');
    expect(scriptClass('\u{0301}'.codePointAt(0))).toBe('zero');
    expect(scriptClass('\u{0416}'.codePointAt(0))).toBe('other');
  });
  test('direction comes from the first strong character', () => {
    expect(detectDir('Hello')).toBe('ltr');
    expect(detectDir('\u{062A}\u{062D}\u{0644}')).toBe('rtl');
    expect(detectDir('123 \u{05D0}')).toBe('rtl');
    expect(detectDir('123 abc \u{05D0}')).toBe('ltr');
    expect(detectDir('')).toBe('ltr');
  });
});

describe('break opportunities (toAtoms)', () => {
  test('spaces separate words and collapse', () => {
    const a = toAtoms('Customer   Order  Service');
    expect(a.map((x) => x.gs.join(''))).toEqual(['Customer', 'Order', 'Service']);
    expect(a[0].space).toBe(true);
    expect(a[2].space).toBe(false);
  });
  test('breaks after a hyphen or slash between letters, not at the ends', () => {
    expect(words('state-of-the-art')).toEqual(['state-', 'of-', 'the-', 'art']);
    expect(words('req/s')).toEqual(['req/', 's']);
    expect(words('a - b')).toEqual(['a', '-', 'b']);
    expect(words('-x')).toEqual(['-x']);
  });
  test('U+200B is a break opportunity and is not drawn', () => {
    expect(words('Foo\u{200B}Bar')).toEqual(['Foo', 'Bar']);
  });
  test('a soft hyphen is a break opportunity that draws a hyphen only when used', () => {
    const a = toAtoms('Kunden\u{AD}zufrieden\u{AD}heit');
    expect(a.map((x) => x.gs.join(''))).toEqual(['Kunden', 'zufrieden', 'heit']);
    expect(a[0].shy).toBe(true);
    expect(a[2].shy).toBe(false);
  });
  test('CJK breaks between ideographs and kana but not before closing punctuation or the prolonged sound mark', () => {
    expect(words('\u{9867}\u{5BA2}\u{6E80}\u{8DB3}')).toEqual(['\u{9867}', '\u{5BA2}', '\u{6E80}', '\u{8DB3}']);
    expect(words('\u{30B5}\u{30FC}\u{30D3}\u{30B9}')).toEqual(['\u{30B5}\u{30FC}', '\u{30D3}', '\u{30B9}']);
    expect(words('\u{300C}\u{9867}\u{5BA2}\u{300D}\u{3002}')).toEqual(['\u{300C}\u{9867}', '\u{5BA2}\u{300D}\u{3002}']);
  });
  test('a no-break space glues its neighbors', () => {
    expect(words('10\u{A0}ms')).toEqual(['10\u{A0}ms']);
  });
  test('never splits inside an emoji sequence', () => {
    const fam = '\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}';
    expect(words(`go ${fam} now`)).toEqual(['go', fam, 'now']);
  });
  test('Arabic breaks at spaces', () => {
    expect(words('\u{062A}\u{062D}\u{0644}\u{064A}\u{0644} \u{0631}\u{0636}\u{0627}')).toHaveLength(2);
  });
  test('empty and whitespace-only text have no drawn atoms', () => {
    expect(words('')).toEqual([]);
    expect(words('   ').every((w) => w === '')).toBe(true);
  });
});
