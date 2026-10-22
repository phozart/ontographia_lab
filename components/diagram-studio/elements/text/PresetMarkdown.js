// components/diagram-studio/elements/text/PresetMarkdown.js
// Renders a text preset's markdown (ADR-0007 D5) as React elements from the SAME safe parser as docs (lib/doc/markdown.js):
// no raw HTML, no images, every link already went through docHref, so there is no dangerouslySetInnerHTML. Only the inline
// subset plus lists is drawn; headings, quotes, code and tables degrade to plain paragraphs (a preset is the typography).
// Sizes are inherited from the box (em based), so the preset's font size is the only size knob.

import React, { useMemo } from 'react';
import { parseMarkdown } from '../../../../lib/doc/markdown';

function Inline({ nodes, linkColor }) {
  return nodes.map((n, i) => {
    switch (n.t) {
      case 'text': return <React.Fragment key={i}>{n.v}</React.Fragment>;
      case 'strong': return <strong key={i}><Inline nodes={n.c} linkColor={linkColor} /></strong>;
      case 'em': return <em key={i}><Inline nodes={n.c} linkColor={linkColor} /></em>;
      case 'del': return <del key={i}><Inline nodes={n.c} linkColor={linkColor} /></del>;
      case 'code': return <code key={i} style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.9em' }}>{n.v}</code>;
      case 'br': return <br key={i} />;
      case 'link': {
        const href = n.link && n.link.kind !== 'element' ? n.link.href : null;
        if (!href) return <span key={i}><Inline nodes={n.c} linkColor={linkColor} /></span>;
        return (
          <a key={i} href={href} target="_blank" rel="noopener noreferrer" style={{ color: linkColor, textDecoration: 'underline' }} onMouseDown={(e) => e.stopPropagation()}>
            <Inline nodes={n.c} linkColor={linkColor} />
          </a>
        );
      }
      default: return null;
    }
  });
}

function Blocks({ blocks, linkColor, tight }) {
  return blocks.map((b, i) => {
    switch (b.t) {
      case 'p':
      case 'heading':
        return <p key={i} style={{ margin: tight ? 0 : '0 0 0.45em', fontWeight: b.t === 'heading' ? 'bold' : undefined }}><Inline nodes={b.c} linkColor={linkColor} /></p>;
      case 'ul':
      case 'ol': {
        const Tag = b.t;
        return (
          <Tag key={i} style={{ margin: '0 0 0.45em', paddingLeft: '1.2em' }} start={b.t === 'ol' && b.start && b.start !== 1 ? b.start : undefined}>
            {b.items.map((it, j) => <li key={j} style={{ margin: '0 0 0.2em' }}><Blocks blocks={it.c} linkColor={linkColor} tight /></li>)}
          </Tag>
        );
      }
      case 'quote':
        return <Blocks key={i} blocks={b.c} linkColor={linkColor} />;
      case 'code':
        return <p key={i} style={{ margin: '0 0 0.45em', whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.9em' }}>{b.v}</p>;
      case 'table':
        return <p key={i} style={{ margin: '0 0 0.45em' }}>{b.head.map((h, j) => <React.Fragment key={j}>{j > 0 ? ' | ' : ''}<Inline nodes={h} linkColor={linkColor} /></React.Fragment>)}</p>;
      default:
        return null;
    }
  });
}

function PresetMarkdown({ markdown, linkColor }) {
  const blocks = useMemo(() => parseMarkdown(typeof markdown === 'string' ? markdown.slice(0, 20 * 1024) : ''), [markdown]);
  return <Blocks blocks={blocks} linkColor={linkColor} />;
}

export default React.memo(PresetMarkdown);
