/**
 * @jest-environment node
 */
// ADR-0007 P3: the pure mapping layer of the PPTX export (units, colours, fonts, links, notes, file name).
import {
  slideInches, unitScale, toInch, toPt, hex6, fontFaceFor, OFFICE_FONTS, safeLink, safeNotes, xmlSafe, pptxFilename, lineSpacing,
} from '../../lib/present/pptx/mapping';

describe('slide size and units', () => {
  test('16:9 is LAYOUT_WIDE 13.333 x 7.5, 4:3 is 10 x 7.5, 1:1 is 7.5 x 7.5', () => {
    expect(slideInches(1920, 1080)).toEqual({ width: 13.333, height: 7.5 });
    expect(slideInches(1440, 1080)).toEqual({ width: 10, height: 7.5 });
    expect(slideInches(1080, 1080)).toEqual({ width: 7.5, height: 7.5 });
  });
  test('a free-form frame keeps its ratio and fits 13.333 x 7.5', () => {
    const s = slideInches(1000, 1000 * 3);
    expect(s.height).toBeLessThanOrEqual(7.5);
    expect(s.width / s.height).toBeCloseTo(1 / 3, 2);
    const wide = slideInches(4000, 1000);
    expect(wide.width).toBeLessThanOrEqual(13.333);
    expect(wide.width / wide.height).toBeCloseTo(4, 2);
  });
  test('positions follow inch = unit x slide width / frame width; sizes follow the ADR pt formula', () => {
    const k = unitScale(1920, slideInches(1920, 1080));
    expect(toInch(960, k)).toBeCloseTo(6.6665, 3);
    expect(toPt(32, k)).toBeCloseTo(16, 1);
    expect(toPt(72, k)).toBeCloseTo(36, 1);
    // ADR: pt = px x 0.75 x (1920 / frame.width) x (13.333 x 96 / 1920), with the slide width of that layout
    const k2 = unitScale(1440, slideInches(1440, 1080));
    const adr = 32 * 0.75 * (1920 / 1440) * ((10 * 96) / 1920);
    expect(toPt(32, k2)).toBeCloseTo(adr, 1);
  });
  test('line spacing: the canvas line height as a multiple of the 1.2 single spacing', () => {
    expect(lineSpacing(1.2)).toBeCloseTo(1, 2);
    expect(lineSpacing(1.4)).toBeCloseTo(1.167, 2);
  });
});

describe('colours', () => {
  test('hex6 gives RRGGBB without a hash, from hex, short hex and rgb(); null otherwise', () => {
    expect(hex6('#4FB3CE')).toBe('4FB3CE');
    expect(hex6('#abc')).toBe('AABBCC');
    expect(hex6('rgb(255, 0, 16)')).toBe('FF0010');
    expect(hex6('url(https://x)')).toBeNull();
    expect(hex6('red')).toBeNull();
    expect(hex6(undefined)).toBeNull();
    expect(hex6('#fff;} </a:solidFill>')).toBeNull();
  });
});

describe('fonts', () => {
  test('Office-safe maps every theme font to a font every recipient has', () => {
    expect(fontFaceFor('inter', { officeSafe: true })).toBe('Arial');
    expect(fontFaceFor('work-sans', { officeSafe: true })).toBe('Arial');
    expect(fontFaceFor('ibm-plex-sans', { officeSafe: true })).toBe('Arial');
    expect(fontFaceFor('montserrat', { officeSafe: true })).toBe('Arial');
    expect(fontFaceFor('source-serif-4', { officeSafe: true })).toBe('Georgia');
    expect(fontFaceFor('ibm-plex-mono', { officeSafe: true })).toBe('Courier New');
    for (const v of Object.values(OFFICE_FONTS)) expect(['Arial', 'Georgia', 'Courier New']).toContain(v);
  });
  test('keeping the theme fonts uses the real family name; unknown ids fall back to Arial', () => {
    expect(fontFaceFor('inter', { officeSafe: false })).toBe('Inter');
    expect(fontFaceFor('source-serif-4', { officeSafe: false })).toBe('Source Serif 4');
    expect(fontFaceFor('ibm-plex-mono', { officeSafe: false })).toBe('IBM Plex Mono');
    expect(fontFaceFor('"; drop', { officeSafe: false })).toBe('Arial');
    expect(fontFaceFor(undefined, { officeSafe: true })).toBe('Arial');
  });
});

describe('hyperlinks', () => {
  const ctx = { boardUrl: 'https://lab.example.com/diagram/LAB-12' };
  test('https and http links and mailto are kept', () => {
    expect(safeLink('https://example.com/a?b=1', ctx)).toBe('https://example.com/a?b=1');
    expect(safeLink('http://example.com/', ctx)).toBe('http://example.com/');
    expect(safeLink('mailto:a@b.co', ctx)).toBe('mailto:a@b.co');
  });
  test('external links with a user name or password are dropped', () => {
    expect(safeLink('https://user:pw@example.com/', ctx)).toBeNull();
    expect(safeLink('http://user@example.com/', ctx)).toBeNull();
    expect(safeLink('https://example.com/@x', ctx)).toBe('https://example.com/@x');
  });
  test('lab links become absolute lab URLs', () => {
    expect(safeLink('/diagram/LAB-7', ctx)).toBe('https://lab.example.com/diagram/LAB-7');
    expect(safeLink('/diagram/LAB-7?focus=a,b', ctx)).toBe('https://lab.example.com/diagram/LAB-7?focus=a,b');
    expect(safeLink('#el=node-1', ctx)).toBe('https://lab.example.com/diagram/LAB-12#el=node-1');
  });
  test('without a lab URL, lab links are dropped (never relative)', () => {
    expect(safeLink('/diagram/LAB-7', {})).toBeNull();
    expect(safeLink('#el=x', {})).toBeNull();
  });
  test('everything else is dropped', () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', '//evil.com', 'ftp://x.y', 'vbscript:x', 'java\tscript:alert(1)', '/etc/passwd', 'relative/path', '', null, undefined, 42, 'https:///x']) {
      expect(safeLink(bad, ctx)).toBeNull();
    }
  });
  test('a hostile lab URL in the context never yields a link', () => {
    expect(safeLink('#el=x', { boardUrl: 'javascript:alert(1)' })).toBeNull();
    expect(safeLink('/diagram/LAB-1', { boardUrl: 'https://user:pw@evil.com/x' })).toBeNull();
  });
});

describe('text safety, notes and file name', () => {
  test('xmlSafe removes characters that are invalid in XML 1.0 and keeps normal text, tabs and newlines', () => {
    expect(xmlSafe('a\u0000b\u0008c\u000bd￾e')).toBe('abcde');
    expect(xmlSafe('Tab\tand\nline <b>not html</b> & "quotes"')).toBe('Tab\tand\nline <b>not html</b> & "quotes"');
    expect(xmlSafe(undefined)).toBe('');
  });
  test('xmlSafe turns lone surrogates into U+FFFD and keeps real pairs', () => {
    expect(xmlSafe('a\ud800b')).toBe('a\ufffdb');
    expect(xmlSafe('a\udc00b')).toBe('a\ufffdb');
    expect(xmlSafe('x\ud83d')).toBe('x\ufffd');
    expect(xmlSafe('ok \ud83d\ude42')).toBe('ok \ud83d\ude42');
  });
  test('notes are plain text, control and bidi characters stripped, capped at 10 KB', () => {
    expect(safeNotes('Say hi‮ now\u0000')).toBe('Say hi now');
    expect(safeNotes('  line1\r\nline2  ')).toBe('line1\nline2');
    expect(safeNotes(undefined)).toBe('');
    expect(safeNotes('x'.repeat(20000)).length).toBeLessThanOrEqual(10240);
  });
  test('file names: sanitized, .pptx, never empty, no path parts', () => {
    expect(pptxFilename('Checkout review - Oct')).toBe('Checkout review - Oct.pptx');
    expect(pptxFilename('../../etc/passwd')).toBe('etc-passwd.pptx');
    expect(pptxFilename('a:b*c?d"e<f>g|h')).toBe('a-b-c-d-e-f-g-h.pptx');
    expect(pptxFilename('')).toBe('presentation.pptx');
    expect(pptxFilename('   ...  ')).toBe('presentation.pptx');
    expect(pptxFilename(undefined)).toBe('presentation.pptx');
    expect(pptxFilename('x'.repeat(300)).length).toBeLessThanOrEqual(130);
    expect(pptxFilename('Plan.pptx')).toBe('Plan.pptx');
  });
});
