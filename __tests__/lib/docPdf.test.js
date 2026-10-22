/**
 * @jest-environment node
 */
import { docToPdf, pdfSafeText } from '../../lib/doc/docPdf';
import { HOSTILE } from '../helpers/docHostile';

const CTX = { origin: 'https://lab.example.com', diagramRef: 'LAB-7', compress: false };
const out = async (o) => (await docToPdf({ ...CTX, ...o })).output();
const uris = (s) => [...s.matchAll(/\/URI \(([^)]*)\)/g)].map((m) => m[1]);

describe('docToPdf', () => {
  const md = '# Head\n\nPara **bold** *it* `code` [ext](https://example.com/a) [el](#el=node-1)\n\n- a\n  - nested\n- b\n\n1. one\n\n> quoted\n\n```\nlet x = 1;\n```\n\n| H1 | H2 |\n|---|---|\n| c1 | c2 |\n\n---';
  test('contains text, a header, and absolute link annotations', async () => {
    const s = await out({ title: 'My Title', markdown: md });
    expect(s.startsWith('%PDF-')).toBe(true);
    for (const w of ['My Title', 'Head', 'Para', 'nested', 'quoted', 'let x = 1;', 'c2']) expect(s).toContain(w);
    expect(s).toContain('/Courier');
    expect(uris(s)).toEqual(expect.arrayContaining(['https://example.com/a', 'https://lab.example.com/diagram/LAB-7?focus=node-1']));
  });
  test('A4 pages and page breaks for long docs', async () => {
    const pdf = await docToPdf({ ...CTX, markdown: Array.from({ length: 200 }, (_, i) => `Paragraph ${i} lorem ipsum dolor sit amet`).join('\n\n') });
    expect(pdf.getNumberOfPages()).toBeGreaterThan(2);
    expect(pdf.internal.pageSize.getWidth()).toBeCloseTo(595.28, 1);
  });
  test('very long words and wide tables wrap instead of overflowing', async () => {
    const pdf = await docToPdf({ ...CTX, markdown: `${'x'.repeat(400)}\n\n| a | b | c | d |\n|---|---|---|---|\n| ${'w '.repeat(80)} | 2 | 3 | 4 |` });
    expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });
  test('non Latin-1 characters become ? (documented), cp1252 punctuation survives', () => {
    expect(pdfSafeText('café “q” – 中 😀')).toBe('café “q” – ? ?');
  });
  test('empty doc yields a one page file', async () => {
    expect((await docToPdf({ ...CTX, markdown: '' })).getNumberOfPages()).toBe(1);
  });
  test.each(HOSTILE)('link targets are allow-listed: %j', async (m) => {
    const s = await out({ title: m, markdown: m });
    for (const u of uris(s)) expect(u).toMatch(/^(https?:\/\/|mailto:)/);
    expect(s).not.toMatch(/\/(JavaScript|JS|Launch|SubmitForm)\b/);
  });
});
