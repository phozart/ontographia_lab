// components/diagram-studio/elements/doc/DocMarkdown.js
// Renders doc markdown as React elements (AI-5). The parser output only has known node types (lib/doc/markdown.js:
// no raw HTML, no images) and every link already went through docHref, so there is no dangerouslySetInnerHTML and
// no string-built markup anywhere here. Element links are buttons-as-anchors handled in script (select + zoom);
// a link to an element that no longer exists renders as struck-through plain text.

import React, { useMemo } from 'react';
import { parseMarkdown } from '../../../../lib/doc/markdown';

const C = {
  text: 'var(--text, #0f172a)',
  muted: 'var(--text-muted, #475569)',
  border: 'var(--border, #e2e8f0)',
  accent: 'var(--accent, #4FB3CE)',
  soft: 'var(--accent-soft, rgba(79,179,206,0.12))',
};

const S = {
  root: { fontSize: 13, lineHeight: 1.5, color: C.text, overflowWrap: 'anywhere', wordBreak: 'break-word' },
  h: { margin: '0.6em 0 0.25em', fontWeight: 650, lineHeight: 1.25 },
  p: { margin: '0 0 0.55em' },
  list: { margin: '0 0 0.55em', paddingLeft: '1.35em' },
  task: { listStyle: 'none', marginLeft: '-1.2em' },
  quote: { margin: '0 0 0.55em', padding: '0 0 0 10px', borderLeft: `3px solid ${C.border}`, color: C.muted },
  pre: { margin: '0 0 0.55em', padding: '8px 10px', background: 'rgba(15,23,42,0.05)', borderRadius: 6, overflow: 'hidden', whiteSpace: 'pre-wrap', fontSize: 12 },
  code: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.92em', background: 'rgba(15,23,42,0.06)', padding: '0 3px', borderRadius: 3 },
  table: { borderCollapse: 'collapse', margin: '0 0 0.55em', fontSize: 12, width: '100%' },
  cell: { border: `1px solid ${C.border}`, padding: '3px 6px', textAlign: 'left', verticalAlign: 'top' },
  link: { color: C.accent, textDecoration: 'underline', cursor: 'pointer', background: 'none', border: 0, padding: 0, font: 'inherit' },
  dangling: { textDecoration: 'line-through', color: C.muted },
  hr: { border: 0, borderTop: `1px solid ${C.border}`, margin: '0.7em 0' },
};

const HEADING_SIZE = { 1: 18, 2: 15, 3: 13.5, 4: 13, 5: 13, 6: 13 };

const stop = (e) => e.stopPropagation();

function Inline({ nodes, ctx }) {
  return nodes.map((n, i) => {
    switch (n.t) {
      case 'text':
        return <React.Fragment key={i}>{n.v}</React.Fragment>;
      case 'strong':
        return <strong key={i}><Inline nodes={n.c} ctx={ctx} /></strong>;
      case 'em':
        return <em key={i}><Inline nodes={n.c} ctx={ctx} /></em>;
      case 'del':
        return <del key={i}><Inline nodes={n.c} ctx={ctx} /></del>;
      case 'code':
        return <code key={i} style={S.code}>{n.v}</code>;
      case 'br':
        return <br key={i} />;
      case 'link':
        return <Link key={i} link={n.link} ctx={ctx}><Inline nodes={n.c} ctx={ctx} /></Link>;
      default:
        return null;
    }
  });
}

function Link({ link, ctx, children }) {
  if (link.kind === 'element') {
    const known = ctx.knownIds ? ctx.knownIds.has(link.elementId) : true;
    if (!known) {
      return (
        <span style={S.dangling} data-doc-link="dangling" title="This element no longer exists on the board">
          {children}
        </span>
      );
    }
    return (
      <a
        href={link.href}
        style={S.link}
        data-doc-link="element"
        data-element-id={link.elementId}
        onMouseDown={stop}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          ctx.onElementLink?.(link.elementId);
        }}
      >
        {children}
      </a>
    );
  }
  return (
    <a
      href={link.href}
      style={S.link}
      data-doc-link={link.kind}
      target="_blank"
      rel="noopener noreferrer"
      onMouseDown={stop}
      onClick={stop}
    >
      {children}
    </a>
  );
}

function Blocks({ blocks, ctx }) {
  return blocks.map((b, i) => {
    switch (b.t) {
      case 'heading': {
        const Tag = `h${Math.min(b.level, 6)}`;
        return <Tag key={i} style={{ ...S.h, fontSize: HEADING_SIZE[b.level] }}><Inline nodes={b.c} ctx={ctx} /></Tag>;
      }
      case 'p':
        return <p key={i} style={S.p}><Inline nodes={b.c} ctx={ctx} /></p>;
      case 'ul':
      case 'ol': {
        const Tag = b.t;
        return (
          <Tag key={i} style={S.list} start={b.t === 'ol' && b.start && b.start !== 1 ? b.start : undefined}>
            {b.items.map((it, j) => (
              <li key={j} style={it.checked === undefined ? undefined : S.task}>
                {it.checked !== undefined && <input type="checkbox" checked={it.checked} disabled readOnly aria-label={it.checked ? 'done' : 'not done'} style={{ marginRight: 6 }} />}
                <Blocks blocks={it.c} ctx={{ ...ctx, tight: true }} />
              </li>
            ))}
          </Tag>
        );
      }
      case 'quote':
        return <blockquote key={i} style={S.quote}><Blocks blocks={b.c} ctx={ctx} /></blockquote>;
      case 'code':
        return <pre key={i} style={S.pre}><code>{b.v}</code></pre>;
      case 'hr':
        return <hr key={i} style={S.hr} />;
      case 'table':
        return (
          <table key={i} style={S.table}>
            <thead>
              <tr>{b.head.map((c, j) => <th key={j} style={{ ...S.cell, textAlign: b.align[j] || 'left', fontWeight: 650 }}><Inline nodes={c} ctx={ctx} /></th>)}</tr>
            </thead>
            <tbody>
              {b.rows.map((r, j) => (
                <tr key={j}>{r.map((c, k) => <td key={k} style={{ ...S.cell, textAlign: b.align[k] || 'left' }}><Inline nodes={c} ctx={ctx} /></td>)}</tr>
              ))}
            </tbody>
          </table>
        );
      default:
        return null;
    }
  });
}

/**
 * @param {{markdown: string, knownIds?: Set<string>, onElementLink?: (id: string) => void, maxBlocks?: number, maxChars?: number}} props
 */
export default function DocMarkdown({ markdown, knownIds, onElementLink, maxBlocks, maxChars }) {
  const blocks = useMemo(() => {
    const src = typeof markdown === 'string' ? (maxChars ? markdown.slice(0, maxChars) : markdown) : '';
    const all = parseMarkdown(src);
    return maxBlocks ? all.slice(0, maxBlocks) : all;
  }, [markdown, maxBlocks, maxChars]);
  const ctx = useMemo(() => ({ knownIds, onElementLink }), [knownIds, onElementLink]);
  return (
    <div style={S.root} data-doc-markdown>
      <Blocks blocks={blocks} ctx={ctx} />
    </div>
  );
}
