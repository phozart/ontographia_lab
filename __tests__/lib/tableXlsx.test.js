/**
 * @jest-environment node
 */
import JSZip from 'jszip';
import { tableToXlsx, sheetName, tableFileName } from '../../lib/table/tableXlsx';

const table = {
  headerRow: true,
  columns: [{ id: 'a', name: 'Name', type: 'text' }, { id: 'b', name: 'Qty', type: 'number' }, { id: 'c', name: 'Done', type: 'boolean' }, { id: 'd', name: 'Status', type: 'select' }],
  rows: [
    { id: 'r1', cells: { a: 'Alpha <b>&"x"', b: 3.5, c: true, d: 'Open' }, elementId: 'el-1' },
    { id: 'r2', cells: { a: "=cmd|' /C calc'!A0", b: -5, c: false, d: '=1+1' } },
    { id: 'r3', cells: { a: '@SUM(1)', d: '+HYPERLINK("http://evil")' }, elementId: '"><x>' },
  ],
};
const CTX = { origin: 'https://lab.example.com', diagramRef: 'LAB-9' };
const open = async (t, o) => {
  const zip = await JSZip.loadAsync(await tableToXlsx(t, { ...CTX, ...o }));
  const read = (p) => zip.file(p)?.async('string');
  return { files: Object.keys(zip.files), sheet: await read('xl/worksheets/sheet1.xml'), wb: await read('xl/workbook.xml'), rels: await read('xl/worksheets/_rels/sheet1.xml.rels'), styles: await read('xl/styles.xml') };
};

describe('tableToXlsx', () => {
  test('a valid package with workbook, styles and one sheet', async () => {
    const x = await open(table, { title: 'Risks' });
    expect(x.files).toEqual(expect.arrayContaining(['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/styles.xml', 'xl/worksheets/sheet1.xml']));
    expect(x.wb).toContain('name="Risks"');
  });
  test('typed cells: number, boolean and literal strings', async () => {
    const { sheet } = await open(table);
    expect(sheet).toContain('<c r="B2"><v>3.5</v></c>');
    expect(sheet).toContain('<c r="B3"><v>-5</v></c>');
    expect(sheet).toContain('<c r="C2" t="b"><v>1</v></c>');
    expect(sheet).toContain('<c r="C3" t="b"><v>0</v></c>');
    expect(sheet).toContain('<c r="A2" t="inlineStr"><is><t xml:space="preserve">Alpha &lt;b&gt;&amp;&quot;x&quot;</t></is></c>');
    expect(sheet).not.toContain('<c r="B4"'); // empty cell is absent
  });
  test('header row is bold and frozen; widths come from content', async () => {
    const x = await open(table);
    expect(x.sheet).toContain('<c r="A1" t="inlineStr" s="1">');
    expect(x.sheet).toContain('state="frozen"');
    expect(x.styles).toContain('<b/>');
    const widths = [...x.sheet.matchAll(/<col min="\d+" max="\d+" width="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(widths[0]).toBeGreaterThan(widths[1]);
  });
  test('NO formulas: no <f> element anywhere and injection strings are literal text', async () => {
    const { sheet } = await open(table);
    expect(sheet).not.toMatch(/<f[ >/]/);
    expect(sheet).toContain("t=\"inlineStr\"><is><t xml:space=\"preserve\">=cmd|' /C calc'!A0</t>");
    expect(sheet).toContain('>=1+1</t>');
    expect(sheet).toContain('>@SUM(1)</t>');
    expect(sheet).toContain('>+HYPERLINK(&quot;http://evil&quot;)</t>');
  });
  test('row links are hyperlink cells to absolute lab URLs; forged ids are dropped', async () => {
    const x = await open(table);
    expect(x.sheet).toContain('<hyperlink ref="E2" r:id="rId1"/>');
    expect(x.rels).toContain('Target="https://lab.example.com/diagram/LAB-9?focus=el-1" TargetMode="External"');
    expect((x.sheet.match(/<hyperlink /g) || []).length).toBe(1);
    expect(x.rels).not.toMatch(/javascript|<x>/);
  });
  test('no links without an origin, and no link column', async () => {
    const x = await open(table, { origin: '' });
    expect(x.rels).toBeUndefined();
    expect(x.sheet).not.toContain('Element link');
  });
  test('a non-http origin never becomes a hyperlink (xlsx and clipboard html)', async () => {
    for (const origin of ['javascript:alert(1)//', 'data:text/html,x', 'file:///x', '//evil.com', 'ftp://x.com']) {
      const x = await open(table, { origin });
      expect(x.rels).toBeUndefined();
      expect(x.sheet).not.toContain('<hyperlink');
    }
  });
  test('the reserved sheet name History gets a suffix; no columns means no <cols>', async () => {
    expect(sheetName('history')).toBe('History_');
    expect(sheetName('HISTORY')).toBe('History_');
    expect(sheetName('History of x')).toBe('History of x');
    const x = await open({ headerRow: false, columns: [], rows: [] });
    expect(x.sheet).not.toContain('<cols>');
  });
  test('header-less table and control characters', async () => {
    const x = await open({ ...table, headerRow: false, rows: [{ id: 'r', cells: { a: 'a\u0000b\u0007c' } }] });
    expect(x.sheet).not.toContain('state="frozen"');
    expect(x.sheet).toContain('>abc</t>');
    expect(x.sheet).toContain('<c r="A1"');
  });
  test('sheet names follow Excel rules (<= 31 chars, no : \\ / ? * [ ])', () => {
    expect(sheetName('Q3: risks/issues [draft]?*')).toBe('Q3 risks issues draft');
    expect(sheetName('x'.repeat(50))).toHaveLength(31);
    expect(sheetName("'quoted'")).toBe('quoted');
    expect(sheetName('')).toBe('Table');
    expect(sheetName('😀'.repeat(40))).toHaveLength(62); // 31 code points, no split surrogate
    expect(tableFileName('Risk / list')).toBe('Risk-list.xlsx');
  });
});
