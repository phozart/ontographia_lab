// lib/doc/docDocx.js
// Doc -> .docx. The `docx` library is imported dynamically INSIDE the function, so it is never part of the canvas
// bundle; it is only fetched when someone exports. Input is the SAME safe parser AST as the board renderer, and every
// hyperlink goes through `absoluteDocLink` (docHref again + http/https/mailto allow-list); a link that fails stays plain
// text. Fonts are the Word defaults (Calibri / Courier New), so non-Latin text works.

import { parseMarkdown } from './markdown';
import { absoluteDocLink } from './docLinks';

const MONO = 'Courier New';
const SIZES = { 1: 40, 2: 32, 3: 28, 4: 24, 5: 22, 6: 22 }; // half points
const LEVELS = 9;

export async function buildDocxDocument({ title, markdown, origin, diagramRef } = {}) {
  const X = await import('docx');
  const { Document, Paragraph, TextRun, ExternalHyperlink, Table, TableRow, TableCell, WidthType, BorderStyle, LevelFormat, AlignmentType, ShadingType } = X;
  const ctx = { origin, diagramRef };
  let instance = 0;

  const runs = (nodes, st = {}) => {
    const out = [];
    for (const n of nodes || []) {
      switch (n.t) {
        case 'text': out.push(new TextRun({ text: n.v, bold: st.bold, italics: st.italics, strike: st.strike, ...(st.link ? { style: 'Hyperlink' } : {}) })); break;
        case 'code': out.push(new TextRun({ text: n.v, font: MONO, size: 20, bold: st.bold, italics: st.italics, shading: { type: ShadingType.CLEAR, fill: 'F3F4F6', color: 'auto' } })); break;
        case 'br': out.push(new TextRun({ break: 1 })); break;
        case 'strong': out.push(...runs(n.c, { ...st, bold: true })); break;
        case 'em': out.push(...runs(n.c, { ...st, italics: true })); break;
        case 'del': out.push(...runs(n.c, { ...st, strike: true })); break;
        case 'link': {
          const href = absoluteDocLink(n.link, ctx);
          if (href) out.push(new ExternalHyperlink({ link: href, children: runs(n.c, { ...st, link: true }) }));
          else out.push(...runs(n.c, st));
          break;
        }
        default: break;
      }
    }
    return out;
  };

  const border = { style: BorderStyle.SINGLE, size: 4, color: 'BFC5CC' };
  const cellBorders = { top: border, bottom: border, left: border, right: border };

  const blocks = (list, o = {}) => {
    const out = [];
    for (const b of list || []) {
      switch (b.t) {
        case 'heading':
          out.push(new Paragraph({ heading: X.HeadingLevel[`HEADING_${Math.min(b.level, 6)}`], children: runs(b.c), spacing: { before: 240, after: 80 }, indent: o.indent ? { left: o.indent } : undefined }));
          break;
        case 'p':
          out.push(new Paragraph({ children: runs(b.c), spacing: { after: 120 }, indent: o.indent ? { left: o.indent } : undefined, border: o.quote ? { left: { style: BorderStyle.SINGLE, size: 12, color: '9AA5B1', space: 8 } } : undefined }));
          break;
        case 'quote':
          out.push(...blocks(b.c, { ...o, indent: (o.indent || 0) + 360, quote: true }));
          break;
        case 'code':
          String(b.v).split('\n').forEach((line, i, all) => out.push(new Paragraph({
            children: [new TextRun({ text: line, font: MONO, size: 19 })],
            shading: { type: ShadingType.CLEAR, fill: 'F3F4F6', color: 'auto' },
            spacing: { after: i === all.length - 1 ? 120 : 0 },
            indent: o.indent ? { left: o.indent } : undefined,
          })));
          break;
        case 'hr':
          out.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'BFC5CC', space: 1 } }, spacing: { after: 120 } }));
          break;
        case 'ul':
        case 'ol': {
          const level = Math.min(o.level ?? 0, LEVELS - 1);
          const ref = b.t === 'ul' ? 'bullets' : 'numbers';
          const inst = b.t === 'ol' ? ++instance : 0;
          for (const it of b.items) {
            const kids = it.c || [];
            const first = kids[0] && kids[0].t === 'p' ? kids[0] : null;
            const box = it.checked === undefined ? [] : [new TextRun({ text: it.checked ? '☑ ' : '☐ ' })];
            out.push(new Paragraph({ numbering: { reference: ref, level, ...(inst ? { instance: inst } : {}) }, children: [...box, ...(first ? runs(first.c) : [])], spacing: { after: 40 } }));
            out.push(...blocks(first ? kids.slice(1) : kids, { ...o, level: level + 1, indent: (o.indent || 0) + 720 * (level + 1) }));
          }
          break;
        }
        case 'table': {
          const cell = (c, head, i) => new TableCell({
            borders: cellBorders,
            shading: head ? { type: ShadingType.CLEAR, fill: 'EEF2F6', color: 'auto' } : undefined,
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [new Paragraph({ alignment: { right: AlignmentType.RIGHT, center: AlignmentType.CENTER }[b.align?.[i]] || AlignmentType.LEFT, children: runs(c, head ? { bold: true } : {}) })],
          });
          const rows = [new TableRow({ tableHeader: true, children: b.head.map((c, i) => cell(c, true, i)) }), ...b.rows.map((r) => new TableRow({ children: r.map((c, i) => cell(c, false, i)) }))];
          out.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }));
          out.push(new Paragraph({ spacing: { after: 120 } }));
          break;
        }
        default: break;
      }
    }
    return out;
  };

  const levelsFor = (fmt, text) => Array.from({ length: LEVELS }, (_, level) => ({
    level,
    format: fmt,
    text: fmt === LevelFormat.BULLET ? ['•', '◦', '▪'][level % 3] : `%${level + 1}.`,
    alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
  }));

  const t = String(title || '').replace(/\s+/g, ' ').trim();
  const body = blocks(parseMarkdown(markdown));
  const children = [...(t ? [new Paragraph({ heading: X.HeadingLevel.TITLE, children: [new TextRun({ text: t })], spacing: { after: 200 } })] : []), ...body];
  if (!children.length) children.push(new Paragraph({ children: [] }));

  return new Document({
    creator: 'Ontographia Lab',
    title: t || 'Doc',
    styles: {
      default: { document: { run: { font: 'Calibri', size: 22 } } },
      characterStyles: [{ id: 'Hyperlink', name: 'Hyperlink', basedOn: 'DefaultParagraphFont', run: { color: '0B6FA4', underline: { type: 'single' } } }],
    },
    numbering: {
      config: [
        { reference: 'bullets', levels: levelsFor(LevelFormat.BULLET) },
        { reference: 'numbers', levels: levelsFor(LevelFormat.DECIMAL) },
      ],
    },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } }, children }],
  });
}

/** @returns {Promise<Blob | Buffer>} a Blob in the browser, a Buffer in Node */
export async function docToDocx(opts) {
  const X = await import('docx');
  const d = await buildDocxDocument(opts);
  return typeof Blob !== 'undefined' && typeof window !== 'undefined' ? X.Packer.toBlob(d) : X.Packer.toBuffer(d);
}
