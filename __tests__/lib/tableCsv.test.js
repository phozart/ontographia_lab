import { parseDelimited, tableToCsv, tableToJson, csvCell, looksTabular, tableFromText } from '../../lib/table/tableCsv';

const T = {
  headerRow: true,
  columns: [{ id: 'col-a', name: 'Name', type: 'text' }, { id: 'col-b', name: 'Count', type: 'number' }],
  rows: [
    { id: 'row-1', cells: { 'col-a': 'alpha', 'col-b': 3 }, elementId: 'el-1' },
    { id: 'row-2', cells: { 'col-a': '=HYPERLINK("http://evil","x")', 'col-b': -4 } },
  ],
};

describe('parseDelimited', () => {
  test('tab separated (Sheets/Excel clipboard)', () => expect(parseDelimited('a\tb\r\n1\t2\r\n')).toEqual([['a', 'b'], ['1', '2']]));
  test('CSV with quotes, doubled quotes, commas and newlines inside quotes', () => {
    expect(parseDelimited('a,b\n"x, y","he said ""hi""\nbye"\n')).toEqual([['a', 'b'], ['x, y', 'he said "hi"\nbye']]);
  });
  test('empty fields, trailing delimiter, BOM, no trailing newline', () => {
    expect(parseDelimited('﻿a,,c\n1,2,')).toEqual([['a', '', 'c'], ['1', '2', '']]);
  });
  test('a quote in the middle of a field is literal', () => expect(parseDelimited('5" pipe,x')).toEqual([['5" pipe', 'x']]));
  test('tab wins over commas on the first line', () => expect(parseDelimited('a,b\tc\n1\t2')).toEqual([['a,b', 'c'], ['1', '2']]));
  test('empty input', () => expect(parseDelimited('')).toEqual([]));
});

describe('looksTabular', () => {
  test.each([['a\tb', true], ['a,b\n1,2', true], ['hello world', false], ['one line, with comma', false], ['', false]])('%p', (t, v) => expect(looksTabular(t)).toBe(v));
});

describe('CSV export and the formula-injection guard', () => {
  test.each(['=1+1', '+1', '-1+2', '@SUM(A1)', '\tx', '\rx'])('text cell %p is prefixed with a quote', (s) => {
    expect(csvCell(s).replace(/^"|"$/g, '').startsWith("'")).toBe(true);
  });
  test('safe text is untouched; quoting follows RFC 4180', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "x"')).toBe('"say ""x"""');
  });
  test('a real negative number is not prefixed, a text cell starting with - is', () => {
    const csv = tableToCsv(T);
    expect(csv).toContain(',-4\r\n');
    expect(csvCell('-4')).toBe("'-4");
  });
  test('the HYPERLINK cell is neutralized in the output', () => {
    const csv = tableToCsv(T);
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"",""x"")"`);
    expect(csv.split('\r\n')[0]).toBe('Name,Count');
  });
  test('header names are guarded too; headerRow false omits the header; links optional', () => {
    const t = { ...T, columns: [{ id: 'col-a', name: '=bad', type: 'text' }, T.columns[1]] };
    expect(tableToCsv(t).split('\r\n')[0]).toBe("'=bad,Count");
    expect(tableToCsv({ ...T, headerRow: false }).split('\r\n')[0]).toBe("alpha,3");
    expect(tableToCsv(T, { includeLinks: true }).split('\r\n')[1]).toBe('alpha,3,el-1');
  });
});

describe('JSON export and import round trip', () => {
  test('json has rows keyed by column name, ids and links', () => {
    const j = JSON.parse(tableToJson(T));
    expect(j.rows[0]).toEqual({ id: 'row-1', elementId: 'el-1', values: { Name: 'alpha', Count: 3 } });
  });
  test('duplicate column names stay distinguishable', () => {
    const t = { ...T, columns: [T.columns[0], { ...T.columns[1], name: 'Name' }] };
    expect(Object.keys(JSON.parse(tableToJson(t)).rows[0].values)).toEqual(['Name', 'Name (2)']);
  });
  test('csv round trip through tableFromText', () => {
    const back = tableFromText(tableToCsv({ ...T, rows: [T.rows[0]] }));
    expect(back.columns.map((c) => [c.name, c.type])).toEqual([['Name', 'text'], ['Count', 'number']]);
    expect(Object.values(back.rows[0].cells)).toEqual(['alpha', 3]);
  });
});
