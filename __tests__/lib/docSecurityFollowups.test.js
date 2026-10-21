/**
 * @jest-environment node
 */
// PR #55 security review follow-ups L1-L5 (L6 is in components/diagram-studio/docCard.test.js).

import { docToMarkdownFile, replaceSection, confineSectionBody, scanHeadings } from '../../lib/doc/docText';
import { sanitizeDocMarkdown } from '../../lib/doc/sanitize';
import { cleanDoc, applyDocPatch } from '../../lib/doc/docElement';
import { validateDiagramContent } from '../../lib/diagramContent';
import { MAX_DOC_BYTES } from '../../lib/doc/markdown';

const clean = (md) => sanitizeDocMarkdown(md).markdown;

describe('L1: the exported .md is sanitized, title included', () => {
  test('a hostile title cannot carry markup or links into the file', () => {
    const f = docToMarkdownFile({ title: '<script>alert(1)</script> [x](javascript:alert(1)) <img src=x onerror=1>', markdown: 'body' });
    expect(f).not.toMatch(/(^|[^\\])<(script|img)/);
    expect(f).not.toMatch(/\]\(javascript:/);
    expect(f.startsWith('# ')).toBe(true);
    expect(f).toContain('body');
  });
  test('clean files are unchanged', () => {
    expect(docToMarkdownFile({ title: 'Plain', markdown: 'Body [a](https://example.com)' })).toBe('# Plain\n\nBody [a](https://example.com)\n');
  });
});

describe('L2: the 100 KB cap applies to the stored (sanitized) text', () => {
  const grows = '<a'.repeat(MAX_DOC_BYTES / 2 - 100); // 2 bytes in, 3 bytes out per pair
  test('cleanDoc and the server validator refuse text that only exceeds the cap after escaping (413)', () => {
    const r = cleanDoc({ title: 'T', markdown: grows });
    expect(r).toMatchObject({ ok: false, status: 413 });
    expect(r.error).toMatch(/after escaping/);
    const v = validateDiagramContent({ elements: [{ id: 'd', type: 'doc', packId: 'core', x: 0, y: 0, data: { doc: { title: 'T', markdown: grows } } }] });
    expect(v).toMatchObject({ ok: false, status: 413 });
  });
  test('applyDocPatch (agent path) refuses it too', () => {
    const r = applyDocPatch({ title: 'T', markdown: '' }, { markdown: grows });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/limit is 102400/);
    expect(applyDocPatch({ title: 'T', markdown: '' }, { append: grows }).ok).toBe(false);
  });
});

describe('L3: reference definitions with a Unicode-space gap are neutralized', () => {
  const gaps = [' ', ' ', ' ', ' ', '　', '﻿', ' ', '   '];
  test.each(gaps)('gap %j', (gap) => {
    const out = clean(`[r]:${gap}javascript:alert(1)\n\n[click][r]`);
    expect(out).not.toMatch(/^\[r\]:/m);
    expect(out).toMatch(/^\\\[r\]:/m);
  });
  test('allowed definitions survive, also with odd gaps', () => {
    expect(clean('[r]: https://example.com\n')).toBe('[r]: https://example.com\n');
  });
});

describe('L4: replaceSection cannot swallow following sections', () => {
  const DOC = '# Report\n\nIntro.\n\n## Findings\n\nOld.\n\n## Next steps\n\n- a\n';
  const names = (md) => scanHeadings(md).map((h) => `${h.level}:${h.text}`);
  test('headings at the same or a higher level in the body are demoted below the section level', () => {
    const r = replaceSection(DOC, 'Findings', '# Top\n\n## Same\n\n### Deeper\n\ntext');
    expect(r.ok).toBe(true);
    expect(names(r.markdown)).toEqual(['1:Report', '2:Findings', '3:Top', '3:Same', '3:Deeper', '2:Next steps']);
  });
  test('an unterminated code fence is closed', () => {
    const r = replaceSection(DOC, 'Findings', 'before\n\n```js\nconst a = 1;\n## not a heading\n');
    expect(r.ok).toBe(true);
    expect(names(r.markdown)).toEqual(['1:Report', '2:Findings', '2:Next steps']);
    expect(r.markdown).toMatch(/```\n\n## Next steps/);
  });
  test('headings inside closed fences are left alone; h6 sections cap at h6', () => {
    expect(confineSectionBody('```\n# keep\n```', 2)).toBe('```\n# keep\n```');
    expect(confineSectionBody('###### x', 6)).toBe('###### x');
  });
});

describe('L5: sanitize is idempotent (fixed point)', () => {
  const corpus = [
    '[x](<data:text/html,<script>alert(1)</script>>)', '[x](<javascript:alert(1)>)', '<<script>script>alert(1)<</script>/script>',
    '[[x](javascript:1)](javascript:2)', '![[a](b)](c)', '<<a href=x>>', '\\<script>', '[a](<b>c)', '<<<a', '[r]: javascript:1',
    '`<script>` ``` <b> ```', '[x]( <javascript:1> )', '<http://a.b><javascript:1>', '[x](<>)', '[x](<<>>)', '](<](<javascript:1>)>)',
    '[a](\njavascript:1)', '> [r]: javascript:1\n- [r]: data:x', '&lt;script&gt; <b>&amp;</b>', '![x](a) ![y](<b>)',
  ];
  test.each(corpus)('%j', (md) => {
    const once = clean(md);
    expect(clean(once)).toBe(once);
  });
  test('random fuzz over hostile fragments', () => {
    const frags = ['<', '>', '[', ']', '(', ')', '!', '`', '\\', '<script>', 'javascript:', 'data:', '[x](', '<a ', '\n', ' ', '[r]: ', '&lt;', '](<', '>)', '```\n', ' '];
    let seed = 12345;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (let n = 0; n < 400; n++) {
      let md = '';
      const len = 1 + Math.floor(rnd() * 14);
      for (let i = 0; i < len; i++) md += frags[Math.floor(rnd() * frags.length)];
      const once = clean(md);
      expect(clean(once)).toBe(once);
      expect(once).not.toMatch(/(^|[^\\])\]\(\s*(javascript|data|vbscript):[^)]*\)|(^|[^\\])\]\(\s*<\s*(javascript|data|vbscript):[^>\n]*>\s*\)/i); // only complete links count (an unclosed tail is not a link)
    }
  });
});
