/**
 * @jest-environment node
 */
// AI-5: doc element model (caps, validation through validateDiagramContent), section/append/paging text ops and the
// `.md` import/export helpers.

import { validateDiagramContent } from '../../lib/diagramContent';
import { cleanDoc, newDocElement, MAX_DOCS_PER_DIAGRAM, isDocElement, docOf } from '../../lib/doc/docElement';
import { appendMarkdown, replaceSection, pageDoc, scanHeadings, docToMarkdownFile, markdownFileToDoc, docFileName } from '../../lib/doc/docText';
import { MAX_DOC_BYTES } from '../../lib/doc/markdown';

const docEl = (id, doc, over = {}) => ({ id, type: 'doc', packId: 'core', x: 0, y: 0, size: { width: 320, height: 220 }, layerId: 'default', properties: {}, data: { doc }, ...over });
const content = (elements) => ({ elements, connections: [], layers: [], viewport: { x: 0, y: 0, zoom: 1 } });

describe('validateDiagramContent: doc elements', () => {
  test('a clean doc passes through unchanged with no warnings', () => {
    const doc = { title: 'Findings', markdown: '## Summary\n\nSee [the map](#el=el-1).', collapsed: false, excerptLines: 6 };
    const r = validateDiagramContent(content([docEl('d1', doc)]));
    expect(r.ok).toBe(true);
    expect(r.warnings).toEqual([]);
    expect(r.content.elements[0].data.doc).toEqual(doc);
  });

  test('hostile markdown is rewritten (stored clean) and reported as warnings', () => {
    const r = validateDiagramContent(content([docEl('d1', { title: 'T', markdown: '<script>alert(1)</script>\n\n[x](javascript:alert(1)) ![i](https://t.example.com/p.png) [d](data:text/html,x)' })]));
    expect(r.ok).toBe(true);
    const md = r.content.elements[0].data.doc.markdown;
    expect(md).not.toMatch(/(^|[^\\])<script/);
    expect(md).not.toMatch(/\]\(javascript:/i);
    expect(md).not.toMatch(/\]\(data:/i);
    expect(r.warnings.join(' ')).toMatch(/unsafe link/);
    expect(r.warnings.join(' ')).toMatch(/HTML tag/);
    expect(r.warnings.join(' ')).toMatch(/image/);
  });

  test('title is plain text: control characters and bidi marks removed, length capped', () => {
    const r = validateDiagramContent(content([docEl('d1', { title: `A\u0000B‮C\n${'x'.repeat(500)}`, markdown: '' })]));
    expect(r.content.elements[0].data.doc.title).toMatch(/^A B C x+$/);
    expect(r.content.elements[0].data.doc.title.length).toBeLessThanOrEqual(200);
  });

  test('unknown doc keys are dropped with a warning; bad types are 400 with the path', () => {
    const ok = validateDiagramContent(content([docEl('d1', { title: 'T', markdown: 'x', html: '<b>x</b>', onclick: 'alert(1)' })]));
    expect(ok.ok).toBe(true);
    expect(Object.keys(ok.content.elements[0].data.doc).sort()).toEqual(['markdown', 'title']);
    expect(ok.warnings.join(' ')).toMatch(/unknown doc field/);
    for (const bad of [{ markdown: 42 }, { title: {} }, { collapsed: 'yes' }, { excerptLines: 0 }, { excerptLines: 2.5 }, 'text']) {
      const r = validateDiagramContent(content([docEl('d1', bad)]));
      expect(r).toMatchObject({ ok: false, status: 400, code: 'VALIDATION_FAILED' });
      expect(r.error).toMatch(/content\.elements\[0\]\.data\.doc/);
    }
  });

  test('100 KB cap on the markdown: over it is 413, exactly at it is accepted', () => {
    const ok = validateDiagramContent(content([docEl('d1', { title: 'T', markdown: 'a'.repeat(MAX_DOC_BYTES) })]));
    expect(ok.ok).toBe(true);
    const big = validateDiagramContent(content([docEl('d1', { title: 'T', markdown: 'a'.repeat(MAX_DOC_BYTES + 1) })]));
    expect(big).toMatchObject({ ok: false, status: 413, code: 'PAYLOAD_TOO_LARGE' });
    const multibyte = validateDiagramContent(content([docEl('d1', { title: 'T', markdown: 'é'.repeat(MAX_DOC_BYTES / 2 + 1) })]));
    expect(multibyte).toMatchObject({ ok: false, status: 413 });
  });

  test('at most 200 docs per diagram', () => {
    const many = (n) => content(Array.from({ length: n }, (_, i) => docEl(`d${i}`, { title: 'T', markdown: '' })));
    expect(validateDiagramContent(many(MAX_DOCS_PER_DIAGRAM)).ok).toBe(true);
    const r = validateDiagramContent(many(MAX_DOCS_PER_DIAGRAM + 1));
    expect(r).toMatchObject({ ok: false, status: 400 });
    expect(r.error).toMatch(/too many docs/);
  });

  test('an element without a doc payload is untouched', () => {
    const r = validateDiagramContent(content([{ id: 'n1', type: 'rectangle', packId: 'core', x: 0, y: 0, data: { note: 'hi' } }]));
    expect(r.ok).toBe(true);
    expect(r.content.elements[0].data).toEqual({ note: 'hi' });
  });
});

describe('doc element helpers', () => {
  test('newDocElement builds a valid element', () => {
    const el = newDocElement({ id: 'el-1', x: 10, y: 20, title: 'Hello', markdown: '# x' });
    expect(isDocElement(el)).toBe(true);
    expect(docOf(el)).toEqual({ title: 'Hello', markdown: '# x' });
    expect(el.label).toBe('Hello');
    expect(validateDiagramContent(content([el])).ok).toBe(true);
  });

  test('cleanDoc reports what it changed', () => {
    const r = cleanDoc({ markdown: '[a](javascript:1)' });
    expect(r.ok).toBe(true);
    expect(r.stats.links).toBe(1);
  });
});

describe('text operations', () => {
  const DOC = '# Report\n\nIntro.\n\n## Findings\n\nOld finding.\n\n### Detail\n\nMore.\n\n## Next steps\n\n- a\n';

  test('scanHeadings ignores fenced code', () => {
    const h = scanHeadings('# A\n```\n# not a heading\n```\n## B');
    expect(h.map((x) => x.text)).toEqual(['A', 'B']);
  });

  test('appendMarkdown adds a block separated by a blank line', () => {
    expect(appendMarkdown('# A\n\ntext', '## B\n\nmore')).toBe('# A\n\ntext\n\n## B\n\nmore\n');
    expect(appendMarkdown('', 'x')).toBe('x\n');
    expect(appendMarkdown('x', '  ')).toBe('x\n');
  });

  test('replaceSection replaces the body up to the next heading of the same or higher level', () => {
    const r = replaceSection(DOC, 'Findings', 'New finding.');
    expect(r.ok).toBe(true);
    expect(r.markdown).toBe('# Report\n\nIntro.\n\n## Findings\n\nNew finding.\n\n## Next steps\n\n- a\n');
  });

  test('replaceSection matches with hashes, case and emphasis ignored; last section runs to the end', () => {
    const r = replaceSection(DOC, '## next STEPS', 'Done.');
    expect(r.markdown.endsWith('## Next steps\n\nDone.\n')).toBe(true);
    expect(replaceSection('## *Bold* title\n\nx', 'bold title', 'y').markdown).toBe('## *Bold* title\n\ny\n');
  });

  test('replaceSection errors list the headings; ambiguous headings are refused', () => {
    const miss = replaceSection(DOC, 'Nope', 'x');
    expect(miss.ok).toBe(false);
    expect(miss.headings).toContain('## Findings');
    const dup = replaceSection('## A\n\n1\n\n## A\n\n2', 'A', 'x');
    expect(dup).toMatchObject({ ok: false });
    expect(dup.error).toMatch(/2 times/);
  });

  test('pageDoc cuts on heading boundaries and the pages reassemble', () => {
    const md = Array.from({ length: 30 }, (_, i) => `## Section ${i}\n\n${'text '.repeat(60)}\n`).join('\n');
    let off = 0;
    let rebuilt = '';
    let pages = 0;
    for (;;) {
      const p = pageDoc(md, off, 2000);
      rebuilt += p.text;
      pages += 1;
      if (p.next === undefined) break;
      expect(p.text.length).toBeLessThanOrEqual(2000);
      if (pages < 40) expect(md.slice(p.next).startsWith('## Section')).toBe(true);
      off = p.next;
    }
    expect(rebuilt).toBe(md);
    expect(pages).toBeGreaterThan(3);
  });

  test('pageDoc falls back to line and hard cuts and never splits a surrogate pair', () => {
    expect(pageDoc('a\n'.repeat(500), 0, 300).text.endsWith('\n')).toBe(true);
    const p = pageDoc('😀'.repeat(400), 0, 301);
    expect(p.text).toBe('😀'.repeat(p.text.length / 2));
  });
});

describe('.md export and import', () => {
  test('export is the title as a heading plus the stored text', () => {
    expect(docToMarkdownFile({ title: 'My Doc', markdown: 'Body' })).toBe('# My Doc\n\nBody\n');
    expect(docToMarkdownFile({ title: 'My Doc', markdown: '# My Doc\n\nBody' })).toBe('# My Doc\n\nBody\n');
    expect(docToMarkdownFile({ title: '', markdown: 'Body' })).toBe('Body\n');
  });

  test('import takes the title from a leading heading, else from the file name', () => {
    expect(markdownFileToDoc('# Notes\n\nbody', 'x.md')).toEqual({ title: 'Notes', markdown: 'body' });
    expect(markdownFileToDoc('no heading here', 'meeting-notes.md')).toEqual({ title: 'meeting notes', markdown: 'no heading here' });
    expect(markdownFileToDoc('﻿# T\r\nline\r\n', '').markdown).toBe('line\n');
  });

  test('export then import round-trips', () => {
    const md = '## A\n\n- x\n- y\n\n```js\ncode\n```\n';
    const file = docToMarkdownFile({ title: 'Round trip', markdown: md });
    const back = markdownFileToDoc(file, 'round-trip.md');
    expect(back.title).toBe('Round trip');
    expect(back.markdown.trimEnd()).toBe(md.trimEnd());
  });

  test('file names are safe', () => {
    expect(docFileName('Findings: round 2 / draft')).toBe('Findings-round-2-draft.md');
    expect(docFileName('../../etc/passwd')).toBe('etcpasswd.md');
    expect(docFileName('')).toBe('doc.md');
    expect(docFileName('‮\u0000')).toBe('doc.md');
  });
});
