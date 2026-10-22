/**
 * @jest-environment node
 */
import { docToHtml, docToPlainText } from '../../lib/doc/docHtml';
import { absoluteDocLink } from '../../lib/doc/docLinks';
import { HOSTILE } from '../helpers/docHostile';
import { parseMarkdown } from '../../lib/doc/markdown';

const CTX = { origin: 'https://lab.example.com', diagramRef: 'LAB-7' };


describe('docToHtml structure and inline styles', () => {
  const html = docToHtml({
    title: 'My Title',
    markdown: '# Head\n\nPara **bold** *it* `code` ~~gone~~\n\n- a\n  - nested\n- b\n\n1. one\n2. two\n\n> quoted\n\n```\nlet x = 1 < 2;\n```\n\n| H1 | H2 |\n|---|---|\n| c1 | c2 |\n\n- [x] done\n- [ ] todo\n\n---',
    ...CTX,
  });
  test('title is the first h1 and tags are simple', () => {
    expect(html).toMatch(/^<div[^>]*><h1 [^>]*>My Title<\/h1>/);
    for (const tag of ['<h1 ', '<p ', '<strong>', '<em>', '<code ', '<s>', '<ul ', '<ol ', '<li ', '<blockquote ', '<pre ', '<table ', '<th ', '<td ', '<hr ']) expect(html).toContain(tag);
  });
  test('nested list is inside the outer li; code is escaped', () => {
    expect(html).toMatch(/<li[^>]*>a<ul [^>]*><li[^>]*>nested<\/li><\/ul><\/li>/);
    expect(html).toContain('let x = 1 &lt; 2;');
  });
  test('uses inline styles only (no class, no style element)', () => {
    expect(html).not.toMatch(/\sclass=/);
    expect(html).not.toMatch(/<style/i);
    expect(html).toMatch(/<td style="[^"]*border:1px solid/);
    expect(html).toMatch(/<th style="[^"]*background-color/);
  });
  test('task items carry a check glyph', () => {
    expect(html).toContain('&#9745; done');
    expect(html).toContain('&#9744; todo');
  });
  test('text nodes are escaped, including the title', () => {
    const h = docToHtml({ title: '<b>"T"</b>', markdown: 'a <b>x</b> & "q"', ...CTX });
    expect(h).toContain('&lt;b&gt;&quot;T&quot;&lt;/b&gt;');
    expect(h).toContain('a &lt;b&gt;x&lt;/b&gt; &amp; &quot;q&quot;');
    expect(h).not.toContain('<b>');
  });
});

describe('links become absolute', () => {
  const md = '[ext](https://example.com/a?b=1&c=2) [el](#el=node-1) [dg](/diagram/LAB-3?focus=a1) [m](mailto:a@b.co)';
  test('element and diagram links resolve against the lab origin', () => {
    const h = docToHtml({ markdown: md, ...CTX });
    expect(h).toContain('href="https://example.com/a?b=1&amp;c=2"');
    expect(h).toContain('href="https://lab.example.com/diagram/LAB-7?focus=node-1"');
    expect(h).toContain('href="https://lab.example.com/diagram/LAB-3?focus=a1"');
    expect(h).toContain('href="mailto:a@b.co"');
  });
  test('without an origin, board-relative links degrade to plain text', () => {
    const h = docToHtml({ markdown: md });
    expect(h).not.toContain('#el=');
    expect(h).not.toContain('href="/diagram');
    expect(h).toContain('>el<'.replace('>', '').replace('<', '')); // text kept
    expect(h).toContain('href="https://example.com/a?b=1&amp;c=2"');
  });
  test('absoluteDocLink refuses forged link objects', () => {
    for (const href of ['javascript:alert(1)', 'data:text/html,x', '//evil.com', 'file:///x', '#el=a b']) {
      expect(absoluteDocLink({ kind: 'external', href }, CTX)).toBeNull();
    }
    expect(absoluteDocLink(null, CTX)).toBeNull();
  });
});

describe('plain text flavor', () => {
  test('is readable text, not markdown', () => {
    const t = docToPlainText({ title: 'T', markdown: '## Head\n\n**b** [lab](#el=n1)\n\n- a\n- b\n\n1. x\n\n| A | B |\n|---|---|\n| 1 | 2 |', ...CTX });
    expect(t).toContain('T\n=\n');
    expect(t).toContain('Head\n');
    expect(t).not.toMatch(/\*\*|##|\|---/);
    expect(t).toContain('lab (https://lab.example.com/diagram/LAB-7?focus=n1)');
    expect(t).toContain('- a\n- b');
    expect(t).toContain('1. x');
    expect(t).toContain('A\tB\n1\t2');
  });
});

describe('hostile corpus', () => {
  test.each(HOSTILE)('html is inert: %j', (md) => {
    const h = docToHtml({ title: md, markdown: md, ...CTX });
    // Strip our own known-safe tags; whatever remains must contain no markup from the input.
    const hrefs = [...h.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
    for (const href of hrefs) expect(href).toMatch(/^(https?:\/\/|mailto:)/);
    expect(h).not.toMatch(/<(script|iframe|svg|img|style|object|embed|link|meta)\b/i);
    for (const tag of h.match(/<[^>]*>/g) || []) expect(tag).not.toMatch(/\son[a-z]+\s*=/i);
    expect(h).not.toMatch(/href="\s*(javascript|data|vbscript|file):/i);
    expect(h).not.toMatch(/<[a-z0-9]+\b[^>]*\bsrc=/i);
    // every tag emitted is from the fixed allow-list
    const tags = new Set([...h.matchAll(/<\/?([a-z0-9]+)/gi)].map((m) => m[1].toLowerCase()));
    for (const t of tags) expect(['div', 'h1', 'h2', 'h3', 'h4', 'p', 'strong', 'em', 's', 'code', 'br', 'a', 'ul', 'ol', 'li', 'blockquote', 'pre', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td']).toContain(t);
  });
  test.each(HOSTILE)('plain text never has a javascript: link: %j', (md) => {
    expect(docToPlainText({ markdown: md, ...CTX })).not.toMatch(/[^\]]\s\((javascript|data|vbscript|file):/i);
  });
  test('corpus parses (sanity)', () => {
    expect(parseMarkdown(HOSTILE[0]).length).toBeGreaterThan(0);
  });
});
