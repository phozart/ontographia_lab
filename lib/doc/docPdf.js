// lib/doc/docPdf.js
// Doc -> .pdf with a small text layout engine on top of jsPDF (imported dynamically, so it only loads on export).
// Same safe AST as the board renderer; link annotations (`textWithLink`) only for URLs that pass `absoluteDocLink`.
//
// Fonts: jsPDF's built-in Helvetica / Courier (no font embedding, keeps the file tiny). They only cover Latin-1 plus
// the Windows-1252 punctuation (curly quotes, dashes, bullet, euro...). Any other character (CJK, Cyrillic, emoji, ...)
// is printed as "?" -- documented limitation; use the .docx export for such text.

import { parseMarkdown } from './markdown';
import { absoluteDocLink } from './docLinks';

const PAGE = { w: 595.28, h: 841.89, margin: 56 };
const CP1252 = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'.split(''));
const HEAD = { 1: 20, 2: 16, 3: 13.5, 4: 12, 5: 11, 6: 11 };
const BODY = 10.5;

// Typographic / symbol characters outside Windows-1252 that have a faithful ASCII or Latin-1 equivalent.
// (Curly quotes, en / em dashes, ellipsis, bullet, euro and trademark are already in Windows-1252 and print as they are.)
const EQUIV = {
  '‐': '-', '‑': '-', '‒': '-', '―': '—', '−': '-',
  ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ', '​': '', '‌': '', '‍': '', '﻿': '', '⁠': '',
  '←': '<-', '→': '->', '↔': '<->', '⇒': '=>',
  '≤': '<=', '≥': '>=', '≠': '!=', '≈': '~', '✓': 'v', '✔': 'v', '✗': 'x', '✘': 'x',
  '☐': '[ ]', '☑': '[x]', '●': '•', '◦': 'o', '▪': '•', '‣': '•',
  '′': "'", '″': '"', '‟': '"', '‛': "'", '‹': '<', '›': '>',
  'ł': 'l', 'Ł': 'L', 'ı': 'i',
};

/** Replace characters the built-in PDF fonts cannot draw (by code point, so an emoji becomes one "?"). */
export function pdfSafeText(s) {
  let out = '';
  for (const ch of String(s ?? '')) {
    const c = ch.codePointAt(0);
    if (c > 0xff && Object.prototype.hasOwnProperty.call(EQUIV, ch)) { out += EQUIV[ch]; continue; }
    if (c === 9) out += '    ';
    else if (c < 32 || c === 127) out += ' ';
    else if (c <= 0xff || CP1252.has(ch)) out += ch;
    else out += '?';
  }
  return out;
}

const fontOf = (st) => (st.code ? ['courier', 'normal'] : ['helvetica', st.bold && st.italic ? 'bolditalic' : st.bold ? 'bold' : st.italic ? 'italic' : 'normal']);

export async function docToPdf({ title, markdown, origin, diagramRef, compress = true } = {}) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress });
  const t = String(title || '').replace(/\s+/g, ' ').trim();
  pdf.setProperties({ title: pdfSafeText(t) || 'Doc', creator: 'Ontographia Lab' });
  const ctx = { origin, diagramRef };
  const bottom = PAGE.h - PAGE.margin;
  const left = PAGE.margin;
  const width = PAGE.w - 2 * PAGE.margin;
  let y = PAGE.margin;

  const newPage = () => { pdf.addPage(); y = PAGE.margin; };
  const need = (h) => { if (y + h > bottom) newPage(); };

  // ---- inline layout: flatten to styled words, wrap greedily -> lines of positioned segments
  const flatten = (nodes, st, out) => {
    for (const n of nodes || []) {
      if (n.t === 'text') out.push({ text: n.v, st });
      else if (n.t === 'code') out.push({ text: n.v, st: { ...st, code: true } });
      else if (n.t === 'br') out.push({ br: true });
      else if (n.t === 'strong') flatten(n.c, { ...st, bold: true }, out);
      else if (n.t === 'em') flatten(n.c, { ...st, italic: true }, out);
      else if (n.t === 'del') flatten(n.c, { ...st, del: true }, out);
      else if (n.t === 'link') flatten(n.c, { ...st, href: absoluteDocLink(n.link, ctx) || undefined }, out);
    }
    return out;
  };
  const measure = (text, st, size) => {
    const [f, s] = fontOf(st);
    pdf.setFont(f, s);
    pdf.setFontSize(size);
    return pdf.getTextWidth(text);
  };
  const layout = (nodes, maxW, size, base = {}) => {
    const lines = [];
    let cur = { segs: [], w: 0 };
    const push = () => { lines.push(cur); cur = { segs: [], w: 0 }; };
    const add = (text, st) => {
      const w = measure(text, st, size);
      const last = cur.segs[cur.segs.length - 1];
      if (last && last.st === st) { last.text += text; last.w += w; } else cur.segs.push({ text, st, w });
      cur.w += w;
    };
    for (const piece of flatten(nodes, base, [])) {
      if (piece.br) { push(); continue; }
      for (const tok of pdfSafeText(piece.text).split(/( +)/)) {
        if (!tok) continue;
        const w = measure(tok, piece.st, size);
        if (cur.w + w <= maxW) { add(tok, piece.st); continue; }
        if (/^ +$/.test(tok)) { if (cur.segs.length) push(); continue; } // wrap at a space
        if (cur.segs.length) push();
        if (w <= maxW) { add(tok, piece.st); continue; }
        // A word wider than the line: split it with ONE measurement per character (linear; the old
        // measure(chunk + ch) was quadratic in the word length). Advances are summed, so kerning is ignored here.
        let chunk = '';
        let cw = 0;
        for (const ch of tok) {
          const w1 = measure(ch, piece.st, size);
          if (cw + w1 > maxW && chunk) { add(chunk, piece.st); push(); chunk = ''; cw = 0; }
          chunk += ch;
          cw += w1;
        }
        if (chunk) add(chunk, piece.st);
      }
    }
    if (cur.segs.length || !lines.length) push();
    // trailing spaces never count
    for (const l of lines) { const s = l.segs[l.segs.length - 1]; if (s) { const trimmed = s.text.replace(/ +$/, ''); if (trimmed !== s.text) { s.w = measure(trimmed, s.st, size); s.text = trimmed; } } }
    return lines;
  };
  const LH = (size) => size * 1.35;
  const drawLine = (line, x, baseline, size, color = [31, 41, 51]) => {
    let cx = x;
    for (const s of line.segs) {
      const [f, st] = fontOf(s.st);
      pdf.setFont(f, st);
      pdf.setFontSize(size);
      if (s.st.code) { pdf.setFillColor(243, 244, 246); pdf.rect(cx, baseline - size * 0.85, s.w, size * 1.15, 'F'); }
      if (s.st.href) {
        pdf.setTextColor(11, 111, 164);
        pdf.textWithLink(s.text, cx, baseline, { url: s.st.href });
        pdf.setDrawColor(11, 111, 164); pdf.setLineWidth(0.5); pdf.line(cx, baseline + 1.5, cx + s.w, baseline + 1.5);
      } else {
        pdf.setTextColor(...color);
        pdf.text(s.text, cx, baseline);
      }
      if (s.st.del) { pdf.setDrawColor(...color); pdf.setLineWidth(0.5); pdf.line(cx, baseline - size * 0.3, cx + s.w, baseline - size * 0.3); }
      cx += s.w;
    }
  };
  const para = (nodes, o = {}) => {
    const size = o.size || BODY;
    const x = left + (o.indent || 0);
    const lines = layout(nodes, width - (o.indent || 0), size, o.base || {});
    if (o.keepNext) need(LH(size) * 2 + (o.before || 0));
    y += o.before || 0;
    for (const l of lines) {
      need(LH(size));
      if (o.bar) { pdf.setDrawColor(154, 165, 177); pdf.setLineWidth(2); pdf.line(left + o.bar, y, left + o.bar, y + LH(size)); }
      drawLine(l, x, y + size, size, o.color);
      y += LH(size);
    }
    y += o.after ?? 5;
  };

  const blocks = (list, o = {}) => {
    for (const b of list || []) {
      if (b.t === 'heading') para(b.c, { size: HEAD[b.level] || 11, base: { bold: true }, before: 8, after: 4, keepNext: true, indent: o.indent, color: [16, 42, 67] });
      else if (b.t === 'p') para(b.c, { indent: o.indent, bar: o.bar, color: o.quote ? [82, 96, 109] : undefined });
      else if (b.t === 'quote') blocks(b.c, { ...o, indent: (o.indent || 0) + 14, bar: (o.indent || 0) + 4, quote: true });
      else if (b.t === 'hr') { need(10); pdf.setDrawColor(191, 197, 204); pdf.setLineWidth(0.7); pdf.line(left, y + 4, left + width, y + 4); y += 12; }
      else if (b.t === 'code') {
        const size = 9;
        const x = left + (o.indent || 0);
        const maxW = width - (o.indent || 0) - 12;
        const rows = [];
        for (const raw of String(b.v).split('\n')) {
          const text = pdfSafeText(raw);
          const lines = layout([{ t: 'code', v: text }], maxW, size, {});
          rows.push(...lines.map((l) => ({ segs: l.segs.map((s) => ({ ...s, st: { code: true } })), w: l.w })));
        }
        y += 2;
        for (const r of rows) {
          need(LH(size));
          pdf.setFillColor(243, 244, 246);
          pdf.rect(x, y, width - (o.indent || 0), LH(size), 'F');
          drawLine({ segs: r.segs.map((s) => ({ ...s, st: { code: true, plain: true } })) }, x + 6, y + size + 1, size);
          y += LH(size);
        }
        y += 7;
      } else if (b.t === 'ul' || b.t === 'ol') {
        const ind = (o.indent || 0);
        b.items.forEach((it, i) => {
          const mark = it.checked !== undefined ? (it.checked ? '[x]' : '[ ]') : b.t === 'ol' ? `${(Number.isInteger(b.start) ? b.start : 1) + i}.` : '•';
          const kids = it.c || [];
          need(LH(BODY));
          const markY = y;
          const first = kids[0] && kids[0].t === 'p' ? kids[0] : null;
          // marker on the first line of the item, then the item's content indented
          const [f, s] = fontOf({});
          pdf.setFont(f, s); pdf.setFontSize(BODY); pdf.setTextColor(31, 41, 51);
          pdf.text(mark, left + ind, markY + BODY);
          if (first) para(first.c, { indent: ind + 18, after: 2 });
          blocks(first ? kids.slice(1) : kids, { ...o, indent: ind + 18 });
        });
        y += 3;
      } else if (b.t === 'table') table(b, o);
    }
  };

  const table = (b, o) => {
    const cols = b.head.length || 1;
    const size = 9.5;
    const x0 = left + (o.indent || 0);
    const total = width - (o.indent || 0);
    const lens = Array.from({ length: cols }, (_, i) => Math.max(6, ...[b.head, ...b.rows].map((r) => (r[i] ? flatten(r[i], {}, []).reduce((n, p) => n + (p.text || '').length, 0) : 0))));
    const sum = lens.reduce((a, c) => a + Math.min(c, 40), 0);
    const widths = lens.map((l) => Math.max(40, (Math.min(l, 40) / sum) * total));
    const scale = total / widths.reduce((a, c) => a + c, 0);
    const colW = widths.map((w) => w * scale);
    const pad = 4;
    const drawRow = (cells, head) => {
      const laid = colW.map((w, i) => layout(cells[i] || [], w - 2 * pad, size, head ? { bold: true } : {}));
      const nLines = Math.max(...laid.map((l) => l.length));
      let li = 0;
      while (li < nLines) {
        const room = Math.floor((bottom - y - 2 * pad) / LH(size));
        if (room < 1) { newPage(); continue; }
        const take = Math.min(room, nLines - li);
        const h = take * LH(size) + 2 * pad;
        if (head) { pdf.setFillColor(238, 242, 246); pdf.rect(x0, y, total, h, 'F'); }
        pdf.setDrawColor(191, 197, 204); pdf.setLineWidth(0.6);
        let cx = x0;
        colW.forEach((w, i) => {
          pdf.rect(cx, y, w, h, 'S');
          laid[i].slice(li, li + take).forEach((l, k) => drawLine(l, cx + pad, y + pad + k * LH(size) + size, size));
          cx += w;
        });
        y += h;
        li += take;
      }
    };
    drawRow(b.head, true);
    b.rows.forEach((r) => drawRow(r, false));
    y += 8;
  };

  if (t) para([{ t: 'text', v: t }], { size: 24, base: { bold: true }, after: 10, color: [16, 42, 67] });
  blocks(parseMarkdown(markdown));
  return pdf;
}

/** @returns {Promise<Blob | ArrayBuffer>} */
export async function docToPdfFile(opts) {
  const pdf = await docToPdf(opts);
  return typeof Blob !== 'undefined' && typeof window !== 'undefined' ? pdf.output('blob') : pdf.output('arraybuffer');
}
