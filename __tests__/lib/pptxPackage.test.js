/**
 * @jest-environment node
 */
// ADR-0007 P3: the post-processing of the pptxgenjs package (one a:pPr per paragraph, first).
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { dedupeParagraphProps, fixPackage } from '../../lib/present/pptx/package';

describe('dedupeParagraphProps', () => {
  test('keeps the first pPr and removes the ones in front of later runs', () => {
    const xml = '<a:p><a:pPr algn="l"><a:buNone/></a:pPr><a:r><a:t>a</a:t></a:r><a:pPr algn="l"><a:buNone/></a:pPr><a:r><a:t>b</a:t></a:r></a:p>';
    expect(dedupeParagraphProps(xml)).toBe('<a:p><a:pPr algn="l"><a:buNone/></a:pPr><a:r><a:t>a</a:t></a:r><a:r><a:t>b</a:t></a:r></a:p>');
  });
  test('handles self-closing pPr and soft breaks', () => {
    const xml = '<a:p><a:pPr algn="l"/><a:r><a:t>a</a:t></a:r><a:br/><a:pPr algn="l"/><a:r><a:t>b</a:t></a:r></a:p>';
    expect(dedupeParagraphProps(xml)).toBe('<a:p><a:pPr algn="l"/><a:r><a:t>a</a:t></a:r><a:br/><a:r><a:t>b</a:t></a:r></a:p>');
  });
  test('a pPr that is not first (after a run) is removed even when it is the only one', () => {
    expect(dedupeParagraphProps('<a:p><a:r><a:t>a</a:t></a:r><a:pPr algn="l"/></a:p>')).toBe('<a:p><a:r><a:t>a</a:t></a:r></a:p>');
  });
  test('leaves paragraphs without pPr and other markup alone', () => {
    const xml = '<p:sp><a:p><a:r><a:t>x &amp; y</a:t></a:r></a:p></p:sp>';
    expect(dedupeParagraphProps(xml)).toBe(xml);
  });
  test('each paragraph is handled on its own', () => {
    const xml = '<a:p><a:pPr a="1"/><a:r/></a:p><a:p><a:pPr a="2"/><a:r/><a:pPr a="3"/><a:r/></a:p>';
    expect(dedupeParagraphProps(xml)).toBe('<a:p><a:pPr a="1"/><a:r/></a:p><a:p><a:pPr a="2"/><a:r/><a:r/></a:p>');
  });
});

describe('pptxgenjs 4.0.1 output shape (package.js assumes bare <a:p>)', () => {
  test('the installed version is 4.0.1 and its slide XML opens paragraphs with a bare <a:p>', async () => {
    const PptxGenJS = require('pptxgenjs');
    expect(require('fs').readFileSync(require.resolve('pptxgenjs').replace(/dist.*$/, 'package.json'), 'utf8')).toMatch(/"version": "4\.0\.1"/);
    const real = process.release;
    Object.defineProperty(process, 'release', { value: { ...real, name: 'browser-like' }, configurable: true });
    try {
      const pres = new PptxGenJS();
      pres.addSlide().addText([{ text: 'a', options: { breakLine: false } }, { text: 'b', options: {} }], { x: 1, y: 1, w: 2, h: 1 });
      const files = unzipSync(await pres.write({ outputType: 'uint8array' }));
      const xml = strFromU8(files['ppt/slides/slide1.xml']);
      expect(xml).toMatch(/<a:p><a:pPr/);
      expect(xml).not.toMatch(/<a:p [^>]*>/);
    } finally {
      Object.defineProperty(process, 'release', { value: real, configurable: true });
    }
  });
});

describe('fixPackage', () => {
  test('rewrites slide parts, keeps every other part byte for byte', () => {
    const slide = '<a:p><a:pPr a="1"/><a:r/><a:pPr a="1"/><a:r/></a:p>';
    const zip = zipSync({ '[Content_Types].xml': strToU8('<Types/>'), 'ppt/slides/slide1.xml': strToU8(slide), 'ppt/media/image1.png': new Uint8Array([1, 2, 3]) });
    const out = unzipSync(fixPackage(zip));
    expect(Object.keys(out)).toEqual(['[Content_Types].xml', 'ppt/slides/slide1.xml', 'ppt/media/image1.png']);
    expect(strFromU8(out['ppt/slides/slide1.xml'])).toBe('<a:p><a:pPr a="1"/><a:r/><a:r/></a:p>');
    expect(Array.from(out['ppt/media/image1.png'])).toEqual([1, 2, 3]);
    expect(strFromU8(out['[Content_Types].xml'])).toBe('<Types/>');
  });
});
