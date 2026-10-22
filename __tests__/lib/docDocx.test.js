/**
 * @jest-environment node
 */
import JSZip from 'jszip';
import { docToDocx } from '../../lib/doc/docDocx';
import { HOSTILE } from '../helpers/docHostile';

const CTX = { origin: 'https://lab.example.com', diagramRef: 'LAB-7' };

async function unpack(opts) {
  const buf = await docToDocx({ ...CTX, ...opts });
  const zip = await JSZip.loadAsync(buf);
  return {
    buf,
    files: Object.keys(zip.files),
    doc: await zip.file('word/document.xml').async('string'),
    rels: await zip.file('word/_rels/document.xml.rels').async('string'),
    numbering: zip.file('word/numbering.xml') ? await zip.file('word/numbering.xml').async('string') : '',
  };
}
const targets = (rels) => [...rels.matchAll(/Target="([^"]*)"[^>]*TargetMode="External"|TargetMode="External"[^>]*Target="([^"]*)"/g)].map((m) => m[1] || m[2]);

describe('docToDocx', () => {
  const md = '# Head\n\nPara **bold** *it* `code` [ext](https://example.com/a?b=1&c=2) [el](#el=node-1)\n\n- a\n  - nested\n- b\n\n1. one\n2. two\n\n> quoted\n\n```\nlet x = 1 < 2;\n```\n\n| H1 | H2 |\n|---|---|\n| c1 | c2 |';
  test('produces a valid zip with text, headings, lists, tables, code and absolute links', async () => {
    const r = await unpack({ title: 'My Title', markdown: md });
    expect(r.files).toEqual(expect.arrayContaining(['[Content_Types].xml', 'word/document.xml', 'word/numbering.xml']));
    expect(r.doc).toContain('My Title');
    expect(r.doc).toContain('Head');
    expect(r.doc).toContain('Para');
    expect(r.doc).toMatch(/<w:b\/>|<w:b /);
    expect(r.doc).toMatch(/<w:i\/>|<w:i /);
    expect(r.doc).toContain('let x = 1 &lt; 2;');
    expect(r.doc).toContain('Courier New');
    expect(r.doc).toContain('<w:tbl>');
    expect(r.doc).toContain('c2');
    expect(r.doc).toMatch(/<w:ilvl w:val="1"\/>/); // nested bullet
    expect(r.doc).toContain('<w:hyperlink');
    expect(targets(r.rels)).toEqual(expect.arrayContaining(['https://example.com/a?b=1&amp;c=2', 'https://lab.example.com/diagram/LAB-7?focus=node-1']));
    expect(r.buf.length).toBeGreaterThan(1000);
  });
  test('numbered lists restart per list', async () => {
    const r = await unpack({ markdown: '1. a\n2. b\n\ntext\n\n1. c' });
    const nums = new Set([...r.doc.matchAll(/<w:numId w:val="(\d+)"\/>/g)].map((m) => m[1]));
    expect(nums.size).toBe(2);
  });
  test('empty doc still opens', async () => {
    const r = await unpack({ title: '', markdown: '' });
    expect(r.doc).toContain('<w:body>');
  });
  test.each(HOSTILE)('link targets are allow-listed: %j', async (md2) => {
    const r = await unpack({ title: md2, markdown: md2 });
    for (const t of targets(r.rels)) expect(t).toMatch(/^(https?:\/\/|mailto:)/);
    expect(r.doc).not.toMatch(/<w:hyperlink[^>]*w:anchor="(javascript|data)/i);
    expect(r.rels).not.toMatch(/Target="(javascript|data|vbscript|file):/i);
  });
});
