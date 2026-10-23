/**
 * @jest-environment node
 */
// ADR-0007 P3 / ADR-0008 section 8: PPTX text boxes carry the line breaks the shared engine computed.
import { buildParagraphs } from '../../lib/present/pptx/textRuns';
import { layoutText } from '../../lib/present/textLayout';
import { resolveTheme } from '../../lib/present/themes';

const theme = resolveTheme(undefined);
const lineTexts = (paragraphs) => paragraphs.flatMap((p) => {
  const lines = [];
  let cur = '';
  for (const r of p.runs) {
    if (r.breakBefore && cur !== '') { lines.push(cur); cur = ''; }
    cur += r.text;
  }
  lines.push(cur);
  return lines;
});
const build = (markdown, extra = {}) => buildParagraphs({ markdown, fontSize: 32, width: 900, weight: 400, lineHeight: 1.4, family: theme.fonts.body, explicitBreaks: true, ...extra });

describe('buildParagraphs: explicit line breaks equal the canvas lines', () => {
  const samples = [
    'A short line',
    'The quick brown fox jumps over the lazy dog and keeps running through the long meadow until the sun goes down behind the hills, and then some more words to wrap.',
    '# Heading\n\nSome **bold text** and *italic text* in a paragraph that is long enough to need a second line on this width of box.',
    '- first item\n- second item with a much longer sentence that has to wrap onto another line to prove the indent\n- third',
    '1. one\n2. two\n3. three',
    '> A quote that is long enough to wrap around the box edge when indented by one em of the font size.',
    'Supercalifragilisticexpialidocious_supercalifragilisticexpialidocious_supercalifragilisticexpialidocious',
    'Ünïcödé text with accénts and emoji 🙂 and a [link](https://example.com/x) inside.',
  ];
  test.each(samples)('%#: same lines as lib/present/textLayout', (md) => {
    const mine = lineTexts(build(md).paragraphs);
    const canvas = layoutText({ text: md, preset: 'body', theme, box: { width: 900 }, fontSize: 32 }).lines.map((l) => l.text);
    expect(mine).toEqual(canvas);
  });
  test('the height equals the canvas height', () => {
    for (const md of samples) {
      const mine = build(md);
      const canvas = layoutText({ text: md, preset: 'body', theme, box: { width: 900 }, fontSize: 32 });
      expect(mine.height).toBe(canvas.height);
    }
  });
  test('headings use the bold metrics, titles keep their weight and size', () => {
    const r = buildParagraphs({ markdown: 'A fairly long title that has to wrap somewhere here', fontSize: 72, width: 700, weight: 700, lineHeight: 1.1, family: theme.fonts.heading, explicitBreaks: true });
    const canvas = layoutText({ text: 'A fairly long title that has to wrap somewhere here', preset: 'title', theme, box: { width: 700 }, fontSize: 72 });
    expect(lineTexts(r.paragraphs)).toEqual(canvas.lines.map((l) => l.text));
  });
});

describe('buildParagraphs: runs and structure', () => {
  test('bold, italic, strike, code and links become runs; the line text is unchanged', () => {
    const { paragraphs } = build('Plain **bold** and *italic* and ~~gone~~ and `code` and [site](https://example.com/a).');
    const runs = paragraphs[0].runs;
    expect(runs.find((r) => r.text === 'bold').bold).toBe(true);
    expect(runs.find((r) => r.text === 'italic').italic).toBe(true);
    expect(runs.find((r) => r.text === 'gone').strike).toBe(true);
    expect(runs.find((r) => r.text === 'code').code).toBe(true);
    expect(runs.find((r) => r.text === 'site').link).toBe('https://example.com/a');
  });
  test('styles survive a line break in the middle of a run', () => {
    const long = `**${'bold words '.repeat(30).trim()}**`;
    const { paragraphs } = build(long, { width: 500 });
    const runs = paragraphs[0].runs;
    expect(runs.length).toBeGreaterThan(1);
    expect(runs.every((r) => r.bold)).toBe(true);
    expect(runs.filter((r) => r.breakBefore).length).toBe(runs.length - 1);
  });
  test('unsafe links are dropped but the text stays; lab links become absolute', () => {
    const a = build('[x](javascript:alert(1)) and [y](https://ok.example/)').paragraphs[0].runs;
    expect(a.some((r) => r.link && r.link.startsWith('javascript'))).toBe(false);
    expect(a.map((r) => r.text).join('')).toBe('x and y');
    const b = build('[board](/diagram/LAB-9)', { ctx: { boardUrl: 'https://lab.example.com/diagram/LAB-1' } }).paragraphs[0].runs;
    expect(b[0].link).toBe('https://lab.example.com/diagram/LAB-9');
    const c = build('[board](/diagram/LAB-9)').paragraphs[0].runs;
    expect(c[0].link).toBeUndefined();
  });
  test('lists: bullets, numbers with a start, indentation by 1.4 em, one paragraph per item', () => {
    const { paragraphs } = build('- a\n- b\n\n3. c\n4. d');
    expect(paragraphs.map((p) => p.bullet && p.bullet.kind)).toEqual(['bullet', 'bullet', 'number', 'number']);
    expect(paragraphs[2].bullet.start).toBe(3);
    expect(paragraphs[3].bullet.start).toBeUndefined();
    expect(paragraphs[0].indent).toBeCloseTo(32 * 1.4, 5);
  });
  test('html is just text (never interpreted) and keeps its angle brackets', () => {
    const { paragraphs } = build('<script>alert(1)</script> & <b>x</b>');
    expect(paragraphs[0].runs.map((r) => r.text).join('')).toContain('<script>');
  });
  test('an empty markdown yields one empty paragraph', () => {
    const r = build('');
    expect(r.paragraphs).toHaveLength(1);
    expect(r.paragraphs[0].runs[0].text).toBe('');
  });
  test('GFM tables become plain lines, code keeps its source lines', () => {
    const t = build('| a | b |\n|---|---|\n| 1 | 2 |').paragraphs;
    expect(t.map((p) => p.runs.map((r) => r.text).join(''))).toEqual(['a | b', '1 | 2']);
    expect(t[0].runs[0].bold).toBe(true);
    const c = build('```\nline one\nline two\n```').paragraphs[0];
    expect(c.runs.map((r) => r.text)).toEqual(['line one', 'line two']);
    expect(c.runs.every((r) => r.code)).toBe(true);
    expect(c.runs[1].breakBefore).toBe(true);
  });
});

describe('buildParagraphs: doc overflow (maxHeight)', () => {
  const doc = Array.from({ length: 40 }, (_, i) => `Paragraph number ${i} with a few words in it.`).join('\n\n');
  test('stops before the paragraph that does not fit and says so', () => {
    const r = buildParagraphs({ markdown: doc, fontSize: 20, width: 600, lineHeight: 1.5, family: theme.fonts.body, explicitBreaks: false, maxHeight: 300 });
    expect(r.truncated).toBe(true);
    expect(r.height).toBeLessThanOrEqual(301);
    expect(r.paragraphs.length).toBeGreaterThan(2);
    expect(r.paragraphs.length).toBeLessThan(40);
    expect(r.paragraphs[r.paragraphs.length - 1].runs.map((x) => x.text).join('')).toMatch(/…$|\.$/);
  });
  test('a doc that fits is complete and not marked as cut', () => {
    const r = buildParagraphs({ markdown: 'Short doc.', fontSize: 20, width: 600, lineHeight: 1.5, family: theme.fonts.body, explicitBreaks: false, maxHeight: 300 });
    expect(r.truncated).toBe(false);
  });
  test('doc headings are bold and scaled up', () => {
    const r = buildParagraphs({ markdown: '# Big\n\ntext', fontSize: 20, width: 600, lineHeight: 1.5, family: theme.fonts.body, explicitBreaks: false, headingScales: true });
    expect(r.paragraphs[0].scale).toBeGreaterThan(1);
    expect(r.paragraphs[0].runs[0].bold).toBe(true);
  });
});
