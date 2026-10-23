import { extractFontFaces, inlineFontUrls } from '../../../components/diagram-studio/export/fontEmbed';

const css = `
/* cyrillic */
@font-face {
  font-family: 'Inter';
  font-weight: 400;
  src: url(https://fonts.gstatic.com/s/inter/cyr.woff2) format('woff2');
  unicode-range: U+0301, U+0400-045F;
}
/* latin */
@font-face {
  font-family: 'Inter';
  font-weight: 400;
  src: url(https://fonts.gstatic.com/s/inter/latin.woff2) format('woff2');
  unicode-range: U+0000-00FF;
}
`;

describe('extractFontFaces', () => {
  it('keeps only latin subsets from commented remote css', () => {
    const faces = extractFontFaces(css, 'https://fonts.googleapis.com/css2?x');
    expect(faces).toHaveLength(1);
    expect(faces[0].css).toContain('latin.woff2');
    expect(faces[0].base).toBe('https://fonts.googleapis.com/css2?x');
  });
  it('keeps uncommented font faces', () => {
    const faces = extractFontFaces('@font-face { font-family: A; src: url(a.woff2); }', 'http://x/');
    expect(faces).toHaveLength(1);
  });
});

describe('inlineFontUrls', () => {
  it('replaces urls with data urls using the provided loader and resolves relative urls', async () => {
    const load = jest.fn(async (url) => `data:font/woff2;base64,${Buffer.from(url).toString('base64')}`);
    const out = await inlineFontUrls({ css: "@font-face{src:url('../f/a.woff2') format('woff2');}", base: 'http://x/css/s.css' }, load);
    expect(load).toHaveBeenCalledWith('http://x/f/a.woff2');
    expect(out).toContain('data:font/woff2;base64,');
    expect(out).not.toContain('a.woff2');
  });
  it('leaves data urls alone', async () => {
    const load = jest.fn();
    const css = '@font-face{src:url(data:font/woff2;base64,AAAA);}';
    expect(await inlineFontUrls({ css, base: 'http://x/' }, load)).toBe(css);
    expect(load).not.toHaveBeenCalled();
  });
  it('drops the face when a font cannot be loaded', async () => {
    const out = await inlineFontUrls({ css: '@font-face{src:url(a.woff2);}', base: 'http://x/' }, async () => { throw new Error('nope'); });
    expect(out).toBe('');
  });
});

// ---- ADR-0008 T3: only the faces the text uses
const { parseFaceMeta, selectFaces } = require('../../../components/diagram-studio/export/fontEmbed');

describe('selectFaces', () => {
  const face = (family, weight, extra = '') => ({ css: `@font-face { font-family: "${family}"; font-style: normal; font-weight: ${weight}; src: url(x.woff2); ${extra} }` });
  const faces = [face('Inter', 400), face('Inter', 500), face('Inter', 600), face('Inter', 700), face('Inter', 500, 'unicode-range: U+0100-02BA, U+1E00-1E9F;'), face('Lato', 400)];
  test('parses family, weight, style and unicode ranges', () => {
    expect(parseFaceMeta(faces[4].css)).toEqual({ family: 'inter', weight: 500, style: 'normal', ranges: [[0x100, 0x2ba], [0x1e00, 0x1e9f]] });
  });
  test('takes the used weight of the used family, and nothing else', () => {
    const out = selectFaces(faces, new Set(['inter|500|normal']), 'Billing');
    expect(out).toHaveLength(1);
    expect(parseFaceMeta(out[0].css).weight).toBe(500);
  });
  test('a unicode-range face is included only when the text has a character in its range', () => {
    expect(selectFaces(faces, new Set(['inter|500|normal']), 'Łódź')).toHaveLength(2);
  });
  test('the nearest weight stands in for a missing one; unknown families are skipped; null usage means every face', () => {
    expect(parseFaceMeta(selectFaces(faces, new Set(['inter|800|normal']), 'a')[0].css).weight).toBe(700);
    expect(selectFaces(faces, new Set(['georgia|400|normal']), 'a')).toHaveLength(0);
    expect(selectFaces(faces, null)).toHaveLength(faces.length);
  });
});
