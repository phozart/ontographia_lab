// lib/doc/docHtml.js
// Doc -> clipboard representations, built from the SAME safe parser AST as the on-board renderer (never from raw
// markdown). Pure; no DOM.
//
//   docToHtml       inline-styled HTML for pasting into Outlook / Word / Google Docs (those ignore classes and <style>)
//   docToPlainText  the text/plain flavor: readable text, NOT raw markdown. Decision: markdown punctuation (#, **,
//                   |---|) reads as noise in a mail body, so headings are plain lines, bullets are "- ", links read
//                   "text (url)" and tables are tab separated rows. The .md file export stays the markdown route.
//
// Security: every text node is HTML-escaped; the AST has no raw-HTML node; every href is re-checked through
// `absoluteDocLink` (docHref again + scheme allow-list), so only https / http / mailto are ever emitted. Text of a link
// that cannot be made absolute (e.g. an element link when the diagram is unknown) is written as plain text.

import { parseMarkdown } from './markdown';
import { absoluteDocLink } from './docLinks';

export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const FONT = "Calibri, Arial, 'Helvetica Neue', sans-serif";
const MONO = "Consolas, 'Courier New', monospace";
const BORDER = '1px solid #bfc5cc';
const SIZE = { 1: 22, 2: 18, 3: 15, 4: 13 };
const ST = {
  p: `margin:0 0 8px 0;font-family:${FONT};font-size:11pt;line-height:1.4;color:#1f2933;`,
  list: `margin:0 0 8px 0;padding-left:24px;font-family:${FONT};font-size:11pt;line-height:1.4;color:#1f2933;`,
  quote: `margin:0 0 8px 0;padding:2px 0 2px 12px;border-left:3px solid #9aa5b1;color:#52606d;font-family:${FONT};font-size:11pt;`,
  pre: `margin:0 0 8px 0;padding:8px 10px;background-color:#f3f4f6;border:1px solid #e1e4e8;font-family:${MONO};font-size:10pt;line-height:1.35;white-space:pre-wrap;color:#1f2933;`,
  code: `font-family:${MONO};font-size:10pt;background-color:#f3f4f6;`,
  table: `border-collapse:collapse;margin:0 0 10px 0;font-family:${FONT};font-size:10.5pt;border:${BORDER};`,
  th: `border:${BORDER};padding:4px 8px;background-color:#eef2f6;font-weight:bold;vertical-align:top;`,
  td: `border:${BORDER};padding:4px 8px;vertical-align:top;`,
  link: 'color:#0b6fa4;text-decoration:underline;',
  hr: 'border:0;border-top:1px solid #bfc5cc;margin:12px 0;',
};
const headStyle = (level) => `margin:14px 0 6px 0;font-family:${FONT};font-size:${SIZE[Math.min(level, 4)]}pt;font-weight:bold;line-height:1.25;color:#102a43;`;

function inlineHtml(nodes, ctx) {
  let out = '';
  for (const n of nodes || []) {
    switch (n.t) {
      case 'text': out += esc(n.v); break;
      case 'strong': out += `<strong>${inlineHtml(n.c, ctx)}</strong>`; break;
      case 'em': out += `<em>${inlineHtml(n.c, ctx)}</em>`; break;
      case 'del': out += `<s>${inlineHtml(n.c, ctx)}</s>`; break;
      case 'code': out += `<code style="${ST.code}">${esc(n.v)}</code>`; break;
      case 'br': out += '<br>'; break;
      case 'link': {
        const href = absoluteDocLink(n.link, ctx);
        const inner = inlineHtml(n.c, ctx);
        out += href ? `<a href="${esc(href)}" style="${ST.link}">${inner}</a>` : inner;
        break;
      }
      default: break;
    }
  }
  return out;
}

function listHtml(b, ctx) {
  const start = b.t === 'ol' && Number.isInteger(b.start) && b.start !== 1 ? ` start="${b.start}"` : '';
  const items = b.items.map((it) => {
    const box = it.checked === undefined ? '' : it.checked ? '&#9745; ' : '&#9744; ';
    const kids = it.c || [];
    const tight = kids.every((k) => k.t === 'p');
    const inner = tight ? kids.map((k) => inlineHtml(k.c, ctx)).join('<br>') : kids.map((k) => (k.t === 'p' ? inlineHtml(k.c, ctx) : blocksHtml([k], ctx))).join('');
    return `<li style="margin:0 0 3px 0;">${box}${inner}</li>`;
  });
  return `<${b.t}${start} style="${ST.list}">${items.join('')}</${b.t}>`;
}

function blocksHtml(blocks, ctx) {
  let out = '';
  for (const b of blocks || []) {
    switch (b.t) {
      case 'heading': { const lv = Math.min(Math.max(b.level, 1), 4); out += `<h${lv} style="${headStyle(b.level)}">${inlineHtml(b.c, ctx)}</h${lv}>`; break; }
      case 'p': out += `<p style="${ST.p}">${inlineHtml(b.c, ctx)}</p>`; break;
      case 'ul': case 'ol': out += listHtml(b, ctx); break;
      case 'quote': out += `<blockquote style="${ST.quote}">${blocksHtml(b.c, ctx)}</blockquote>`; break;
      case 'code': out += `<pre style="${ST.pre}">${esc(b.v)}</pre>`; break;
      case 'hr': out += `<hr style="${ST.hr}">`; break;
      case 'table': {
        const al = (i) => `text-align:${['left', 'right', 'center'].includes(b.align?.[i]) ? b.align[i] : 'left'};`;
        const head = b.head.map((c, i) => `<th style="${ST.th}${al(i)}">${inlineHtml(c, ctx)}</th>`).join('');
        const rows = b.rows.map((r) => `<tr>${r.map((c, i) => `<td style="${ST.td}${al(i)}">${inlineHtml(c, ctx)}</td>`).join('')}</tr>`).join('');
        out += `<table border="1" cellpadding="4" cellspacing="0" style="${ST.table}"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
        break;
      }
      default: break;
    }
  }
  return out;
}

const cleanTitle = (t) => String(t || '').replace(/\s+/g, ' ').trim();

/** @param {{title?: string, markdown?: string, origin?: string, diagramRef?: string}} o */
export function docToHtml({ title, markdown, origin, diagramRef } = {}) {
  const ctx = { origin, diagramRef };
  const t = cleanTitle(title);
  const head = t ? `<h1 style="${headStyle(1)}">${esc(t)}</h1>` : '';
  return `<div style="font-family:${FONT};">${head}${blocksHtml(parseMarkdown(markdown), ctx)}</div>`;
}

// ---------------------------------------------------------------- plain text

function inlineTxt(nodes, ctx) {
  let out = '';
  for (const n of nodes || []) {
    if (n.t === 'text' || n.t === 'code') out += n.v;
    else if (n.t === 'br') out += '\n';
    else if (n.t === 'link') {
      const label = inlineTxt(n.c, ctx);
      const href = absoluteDocLink(n.link, ctx);
      out += href && href.replace(/^mailto:/i, '') !== label ? `${label} (${href})` : label;
    } else if (n.c) out += inlineTxt(n.c, ctx);
  }
  return out;
}

function blocksTxt(blocks, ctx, indent = '') {
  const out = [];
  for (const b of blocks || []) {
    switch (b.t) {
      case 'heading': out.push(indent + inlineTxt(b.c, ctx)); break;
      case 'p': out.push(inlineTxt(b.c, ctx).split('\n').map((l) => indent + l).join('\n')); break;
      case 'ul': case 'ol': {
        const lines = b.items.map((it, i) => {
          const mark = it.checked !== undefined ? (it.checked ? '[x]' : '[ ]') : b.t === 'ol' ? `${(Number.isInteger(b.start) ? b.start : 1) + i}.` : '-';
          const body = blocksTxt(it.c, ctx, `${indent}  `).join('\n');
          return `${indent}${mark} ${body.slice(indent.length + 2)}`;
        });
        out.push(lines.join('\n'));
        break;
      }
      case 'quote': out.push(blocksTxt(b.c, ctx, `${indent}> `).join(`\n${indent}>\n`)); break;
      case 'code': out.push(String(b.v).split('\n').map((l) => `${indent}    ${l}`).join('\n')); break;
      case 'hr': out.push(`${indent}----`); break;
      case 'table': out.push([b.head, ...b.rows].map((r) => indent + r.map((c) => inlineTxt(c, ctx).replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\n')); break;
      default: break;
    }
  }
  return out;
}

/** The text/plain clipboard flavor (see header for the decision). */
export function docToPlainText({ title, markdown, origin, diagramRef } = {}) {
  const t = cleanTitle(title);
  const body = blocksTxt(parseMarkdown(markdown), { origin, diagramRef }).join('\n\n');
  return `${t ? `${t}\n${'='.repeat(Math.min(t.length, 60))}\n\n` : ''}${body}\n`;
}
