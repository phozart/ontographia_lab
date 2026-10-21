/**
 * @jest-environment node
 */
// AI-5: the safe markdown parser, the link allow-list and the server-side sanitizer. Security first: nothing in any
// hostile input may become an executable construct (no raw HTML node, no image node, no unsafe link).

import { docHref, elementLink } from '../../lib/doc/docHref';
import { parseMarkdown, docHeadings, docExcerptLines, MAX_DOC_BYTES } from '../../lib/doc/markdown';
import { sanitizeDocMarkdown } from '../../lib/doc/sanitize';

const walk = (nodes, fn) => {
  for (const n of Array.isArray(nodes) ? nodes : []) {
    fn(n);
    if (n.c) walk(n.c, fn);
    if (n.items) n.items.forEach((it) => walk(it.c, fn));
    if (n.head) n.head.forEach((c) => walk(c, fn));
    if (n.rows) n.rows.forEach((r) => r.forEach((c) => walk(c, fn)));
  }
};
const all = (md) => {
  const found = [];
  walk(parseMarkdown(md), (n) => found.push(n));
  return found;
};
const links = (md) => all(md).filter((n) => n.t === 'link');
const KNOWN = new Set(['heading', 'p', 'ul', 'ol', 'quote', 'code', 'table', 'hr', 'text', 'strong', 'em', 'del', 'br', 'link']);

describe('docHref (the one allow-list)', () => {
  test.each([
    ['https://example.com/a?b=1#c', 'external'],
    ['http://example.com', 'external'],
    ['HTTPS://EXAMPLE.COM', 'external'],
    ['mailto:a@b.co', 'mailto'],
    ['#el=el-123e4567', 'element'],
    ['/diagram/LAB-12', 'diagram'],
    ['/diagram/123e4567-e89b-12d3-a456-426614174000?focus=el-1,el-2', 'diagram'],
  ])('allows %s', (url, kind) => {
    expect(docHref(url)?.kind).toBe(kind);
  });

  test.each([
    'javascript:alert(1)', 'JaVaScRiPt:alert(1)', ' javascript:alert(1)', 'java\tscript:alert(1)', 'java\nscript:alert(1)',
    'vbscript:msgbox(1)', 'data:text/html,<script>alert(1)</script>', 'data:image/svg+xml;base64,AAAA', 'file:///etc/passwd',
    '//evil.example.com', '/etc/passwd', 'relative/path', '', '   ', 'https://', 'https:///x', 'ftp://example.com',
    '#el=', '#el=bad id', '#el=a/b', '#other', 'mailto:', 'mailto:nobody', '/diagram/', '/diagram/../admin', '/diagram/LAB-1/extra',
    'https://exa mple.com', 'https://example.com\u0000', 'blob:https://x', 'about:blank', '\u202ejavascript:1',
  ])('rejects %j', (url) => {
    expect(docHref(url)).toBeNull();
  });

  test('normalizes external hrefs and bounds length', () => {
    expect(docHref('https://Example.com').href).toBe('https://example.com/');
    expect(docHref(`https://example.com/${'a'.repeat(2100)}`)).toBeNull();
    expect(docHref(42)).toBeNull();
  });

  test('elementLink builds only addressable links', () => {
    expect(elementLink('el-abc')).toBe('#el=el-abc');
    expect(elementLink('bad id')).toBeNull();
    expect(elementLink('')).toBeNull();
  });
});

describe('parseMarkdown: supported subset', () => {
  test('headings, paragraphs and inline marks', () => {
    const ast = parseMarkdown('# Title\n\nSome **bold**, *italic*, ~~gone~~ and `code`.\n\n### Third');
    expect(ast.map((b) => b.t)).toEqual(['heading', 'p', 'heading']);
    expect(ast[0].level).toBe(1);
    expect(ast[2].level).toBe(3);
    const kinds = ast[1].c.map((n) => n.t);
    expect(kinds).toEqual(expect.arrayContaining(['strong', 'em', 'del', 'code']));
  });

  test('bullet, numbered, task and nested lists', () => {
    const ast = parseMarkdown('- a\n- b\n  - nested\n\n1. one\n2. two\n\n- [ ] todo\n- [x] done');
    expect(ast.map((b) => b.t)).toEqual(['ul', 'ol', 'ul']);
    expect(ast[0].items).toHaveLength(2);
    expect(ast[0].items[1].c.map((b) => b.t)).toEqual(['p', 'ul']);
    expect(ast[1].start).toBe(1);
    expect(ast[2].items.map((i) => i.checked)).toEqual([false, true]);
  });

  test('blockquote, fenced code (kept literally), hr and table', () => {
    const ast = parseMarkdown('> quoted *text*\n\n```js\nconst a = "<b>**x**</b>";\n```\n\n---\n\n| A | B |\n|---|:-:|\n| 1 | 2 |\n| 3 | 4 |');
    expect(ast.map((b) => b.t)).toEqual(['quote', 'code', 'hr', 'table']);
    expect(ast[1].v).toBe('const a = "<b>**x**</b>";');
    expect(ast[1].lang).toBe('js');
    expect(ast[3].align).toEqual([null, 'center']);
    expect(ast[3].rows).toHaveLength(2);
  });

  test('links: inline, reference, shortcut, autolink, element and diagram links', () => {
    const md = [
      '[web](https://example.com) [el](#el=el-1) [d](/diagram/LAB-2) <https://auto.example.com> <me@x.co>',
      '[ref][r1] and [r1] and [r2][]',
      '',
      '[r1]: https://ref.example.com "Title"',
      '[r2]: #el=el-9',
    ].join('\n');
    const found = links(md);
    expect(found.map((l) => l.link.kind)).toEqual(['external', 'element', 'diagram', 'external', 'mailto', 'external', 'external', 'element']);
    expect(found[1].link.elementId).toBe('el-1');
    expect(found[7].link.elementId).toBe('el-9');
  });

  test('nested brackets and escaped characters', () => {
    expect(links('[a [b] c](https://example.com)')[0].c.map((n) => n.v).join('')).toBe('a [b] c');
    expect(links('[a \\[b](https://example.com)')).toHaveLength(1);
    expect(links('\\[a](https://example.com)')).toHaveLength(0);
    expect(links('[x](https://example.com/a_(b))')[0].link.href).toBe('https://example.com/a_(b)');
  });

  test('HTML entities are decoded to text only', () => {
    const ast = parseMarkdown('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &#60;b&#62; &#x3C;i&#x3E; &bogus; &#0;');
    const text = ast[0].c.map((n) => n.v).join('');
    expect(text).toContain('<script>alert(1)</script> & <b> <i>');
    expect(text).toContain('&bogus;');
    expect(ast[0].c.every((n) => n.t === 'text')).toBe(true);
  });

  test('headings(), excerpt lines and the cap constant', () => {
    expect(docHeadings('# A\ntext\n## B *x*')).toEqual([{ level: 1, text: 'A' }, { level: 2, text: 'B x' }]);
    const lines = docExcerptLines('# Head\n\n- one\n- two\n\nPara [link](https://example.com).', 5, 30);
    expect(lines[0]).toEqual({ text: 'Head', bold: true });
    expect(lines.map((l) => l.text)).toEqual(['Head', '\u2022 one', '\u2022 two', 'Para link.']);
    expect(MAX_DOC_BYTES).toBe(100 * 1024);
  });
});

const HOSTILE = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<a href="javascript:alert(1)">x</a>',
  '<iframe src="javascript:alert(1)"></iframe>',
  '<svg onload=alert(1)>',
  '<!-- comment --><b>x</b>',
  '[click](javascript:alert(1))',
  '[click](JaVaScRiPt:alert(1))',
  '[click](  javascript:alert(1)  )',
  '[click](<javascript:alert(1)>)',
  '[click](java&#115;cript:alert(1))',
  '[click](&#106;avascript:alert(1))',
  '[click](jav\\ascript:alert(1))',
  '[click](data:text/html,<script>alert(1)</script>)',
  '[click](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)',
  '[click](vbscript:msgbox(1))',
  '[click](file:///etc/passwd)',
  '[click](//evil.example.com)',
  '[click](\njavascript:alert(1))',
  '<javascript:alert(1)>',
  '<data:text/html,x>',
  '[ref]: javascript:alert(1)\n\n[click][ref] [ref]',
  '[ref]: <data:text/html,x>\n\n[click][ref]',
  '> [ref]: javascript:alert(1)\n\n[click][ref]',
  '- [ref]: javascript:alert(1)\n\n[click][ref]',
  '![x](javascript:alert(1))',
  '![x](https://tracker.example.com/pixel.png)',
  '![x][ref]\n\n[ref]: https://tracker.example.com/p.png',
  '[[nested](javascript:alert(1))](javascript:alert(2))',
  '[a](b)](javascript:alert(1))',
  '`<script>` and ```<img onerror=1>```',
];

describe('hostile input: parser output never contains an executable construct', () => {
  test.each(HOSTILE)('%j', (md) => {
    for (const n of all(md)) {
      expect(KNOWN.has(n.t)).toBe(true); // no raw html / image node type exists
      if (n.t === 'link') {
        expect(['external', 'mailto', 'element', 'diagram']).toContain(n.link.kind);
        expect(n.link.href).not.toMatch(/^\s*(javascript|vbscript|data|file):/i);
        if (n.link.kind === 'external') expect(n.link.href).toMatch(/^https?:\/\//);
      }
    }
  });

  test('raw HTML survives only as text', () => {
    const ast = parseMarkdown('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>');
    const text = [];
    walk(ast, (n) => n.t === 'text' && text.push(n.v));
    expect(text.join('')).toContain('<script>alert(1)</script>');
    expect(all('<script>alert(1)</script>').some((n) => n.t === 'link')).toBe(false);
  });

  test('unsafe links render only their text; images render their alt text', () => {
    const ast = parseMarkdown('[click me](javascript:alert(1)) ![the alt](https://t.example.com/p.png)');
    expect(links('[click me](javascript:alert(1))')).toHaveLength(0);
    const text = [];
    walk(ast, (n) => n.t === 'text' && text.push(n.v));
    expect(text.join('')).toContain('click me');
    expect(text.join('')).toContain('the alt');
  });
});

describe('hostile input: resource limits', () => {
  const time = (fn) => {
    const t0 = Date.now();
    const r = fn();
    return [Date.now() - t0, r];
  };

  test('huge input (200 KB) parses quickly and is bounded', () => {
    const md = 'word *a* **b** [l](https://example.com) `c` '.repeat(5000) + '\n\n' + '- item\n'.repeat(5000);
    const [ms] = time(() => parseMarkdown(md));
    expect(ms).toBeLessThan(2500);
  });

  test('pathological delimiter and bracket runs stay linear', () => {
    for (const md of ['*'.repeat(50000), '_a'.repeat(30000), '[' .repeat(30000), '[a]('.repeat(10000), '`'.repeat(30000), '`a '.repeat(20000), '~~a'.repeat(20000), '*a _b '.repeat(10000), '<'.repeat(30000), '!['.repeat(20000), '\\'.repeat(30000)]) {
      const [ms] = time(() => parseMarkdown(md));
      expect(ms).toBeLessThan(2500);
    }
  });

  test('deeply nested lists and quotes are capped (no stack overflow)', () => {
    const lists = '- '.repeat(5000) + 'x';
    const quotes = '> '.repeat(5000) + 'x';
    const indented = Array.from({ length: 400 }, (_, i) => `${' '.repeat(i * 2)}- item ${i}`).join('\n');
    for (const md of [lists, quotes, indented, '*a '.repeat(4000) + 'b' + ' a*'.repeat(4000)]) {
      const [ms, ast] = time(() => parseMarkdown(md));
      expect(ms).toBeLessThan(2500);
      let depth = 0;
      const measure = (nodes, d) => {
        depth = Math.max(depth, d);
        for (const n of nodes) {
          if (n.c) measure(n.c, d + 1);
          if (n.items) n.items.forEach((it) => measure(it.c, d + 1));
        }
      };
      measure(ast, 1);
      expect(depth).toBeLessThan(60);
    }
  });
});

describe('sanitizeDocMarkdown', () => {
  const clean = (md) => sanitizeDocMarkdown(md).markdown;

  test('safe markdown is returned unchanged', () => {
    const md = '# Title\n\nText with **bold**, `a < b` and <https://example.com> and [x](https://example.com/a?b=1) [e](#el=el-1) [d](/diagram/LAB-1).\n\n```html\n<script>kept in code</script> [x](javascript:alert(1))\n```\n\n- [ ] task\n\n| a | b |\n|---|---|\n| 1 | 2 |\n';
    const r = sanitizeDocMarkdown(md);
    expect(r.markdown).toBe(md);
    expect(r).toMatchObject({ links: 0, html: 0, images: 0 });
  });

  test.each(HOSTILE)('hostile %j is neutralized', (md) => {
    const out = clean(md);
    const t = out.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
    // no unescaped `<` that could start a tag, and no unsafe scheme left as a link destination
    expect(t).not.toMatch(/(^|[^\\])<[A-Za-z/!?]/);
    expect(t).not.toMatch(/\]\(\s*<?\s*(javascript|vbscript|data|file):/i);
    expect(t).not.toMatch(/(^|[^\\])!\[/);
    expect(t).not.toMatch(/^\s*[>\-* ]*\[[^\]]+\]:\s*<?(javascript|vbscript|data|file):/im);
    // the parser agrees: nothing unsafe in the AST of the cleaned text either
    for (const n of all(out)) if (n.t === 'link') expect(['external', 'mailto', 'element', 'diagram']).toContain(n.link.kind);
  });

  test('is idempotent', () => {
    for (const md of HOSTILE) {
      const once = clean(md);
      expect(clean(once)).toBe(once);
    }
  });

  test('counts what it changed', () => {
    const r = sanitizeDocMarkdown('<b>x</b> [a](javascript:1) ![i](https://x.co/p.png)\n[r]: javascript:2');
    expect(r.html).toBeGreaterThanOrEqual(1);
    expect(r.links).toBe(2);
    expect(r.images).toBe(1);
  });

  test('removes control characters and bidi overrides, normalizes newlines', () => {
    expect(clean('a\u0000b\u202ec\r\nd\re\u0007')).toBe('abc\nd\ne');
    expect(clean('keep\ttab')).toBe('keep\ttab');
  });

  test('image becomes an allow-listed link, never an image', () => {
    const out = clean('![alt](https://example.com/p.png)');
    expect(out).toBe('\\![alt](https://example.com/p.png)');
    expect(links(out)).toHaveLength(1);
  });

  test('stays linear on hostile input', () => {
    const t0 = Date.now();
    for (const md of ['<'.repeat(100000), '[a]('.repeat(20000), '`'.repeat(100000), '![['.repeat(30000), '[x]: a\n'.repeat(20000)]) clean(md);
    expect(Date.now() - t0).toBeLessThan(4000);
  });
});
