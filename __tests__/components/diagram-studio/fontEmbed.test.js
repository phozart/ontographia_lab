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
