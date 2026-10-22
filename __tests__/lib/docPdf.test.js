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
  test('typographic extras map to equivalents, the rest still becomes ?', () => {
    expect(pdfSafeText('a→b ≥ − x​y ✓ “q” … € •')).toBe('a->b >= - xy v “q” … € •');
    expect(pdfSafeText('Ж 中')).toBe('? ?');
  });
  test('a link keeps a normal space gap after the preceding word', async () => {
    const pdf = await docToPdf({ ...CTX, markdown: 'reads the [Auth service](https://e.com) notes.' });
    const xs = [...pdf.output().matchAll(/([\d.]+) [\d.]+ Td\n\(([^)]*)\) Tj/g)].map((m) => ({ x: parseFloat(m[1]), t: m[2] }));
    const before = xs.find((s) => s.t.startsWith('reads the'));
    const link = xs.find((s) => s.t === 'Auth service');
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10.5);
    const gap = link.x - (before.x + pdf.getTextWidth('reads the'));
    expect(gap).toBeGreaterThan(pdf.getTextWidth(' ') * 0.9);
    expect(gap).toBeLessThan(pdf.getTextWidth(' ') * 1.5);
  });
  test('a huge unbroken word is split in linear time (few measurements per character)', async () => {
    const t0 = Date.now();
    const pdf = await docToPdf({ ...CTX, markdown: 'y'.repeat(60000) });
    expect(Date.now() - t0).toBeLessThan(4000);
    expect(pdf.getNumberOfPages()).toBeGreaterThan(1);
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
