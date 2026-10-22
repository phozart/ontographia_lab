// lib/table/tableClipboard.js
// Table -> clipboard flavors. Pure.
//   tableToHtml  text/html: an inline-styled <table> (borders, header shading) that pastes as a real table into Word,
//                Outlook and Google Docs. Every cell is HTML-escaped; a row linked to a board element gets an absolute
//                lab link (focusLink) on its first cell.
//   tableToTsv   text/plain: tab separated rows that paste as cells into Excel / Sheets. Same formula-injection guard
//                as the CSV export: text starting with = + - @ (or TAB / CR) is prefixed with a single quote, because a
//                spreadsheet would evaluate it on paste. Numbers are real numbers and stay untouched.

import { cellText } from './tableModel';
import { esc } from '../doc/docHtml';
import { buildFocusLink, isValidElementId } from '../focusLink';

const FONT = "Calibri, Arial, 'Helvetica Neue', sans-serif";
const BORDER = '1px solid #bfc5cc';
const FORMULA_START = /^[=+\-@\t\r]/;

const isNum = (col, v) => col.type === 'number' && typeof v === 'number';

export function tableToTsv(table) {
  const flat = (s) => String(s).replace(/[\t\r\n]+/g, ' ');
  const guard = (s, numeric) => (!numeric && FORMULA_START.test(s) ? `'${s}` : s);
  const lines = [];
  if (table.headerRow !== false) lines.push(table.columns.map((c) => flat(guard(cellText(c.name), false))).join('\t'));
  for (const r of table.rows) {
    lines.push(table.columns.map((c) => {
      const v = r.cells?.[c.id];
      // the guard looks at the original text (a leading TAB/CR would be flattened away otherwise)
      return flat(guard(cellText(v), isNum(c, v)));
    }).join('\t'));
  }
  return lines.join('\n');
}

export function tableToHtml(table, { origin, diagramRef } = {}) {
  const linkFor = (row) => {
    if (!row.elementId || !isValidElementId(row.elementId) || !origin || !diagramRef) return null;
    try { return buildFocusLink({ origin, diagramRef, ids: [row.elementId] }); } catch { return null; }
  };
  const cellStyle = (c, v) => `border:${BORDER};padding:4px 8px;vertical-align:top;text-align:${c.type === 'number' ? 'right' : 'left'};${typeof v === 'boolean' ? 'text-align:center;' : ''}`;
  const head = table.headerRow !== false
    ? `<thead><tr>${table.columns.map((c) => `<th style="border:${BORDER};padding:4px 8px;background-color:#eef2f6;font-weight:bold;text-align:left;vertical-align:top;">${esc(cellText(c.name))}</th>`).join('')}</tr></thead>`
    : '';
  const body = table.rows.map((r) => {
    const href = linkFor(r);
    return `<tr>${table.columns.map((c, i) => {
      const v = r.cells?.[c.id];
      const text = esc(typeof v === 'boolean' ? (v ? '☑' : '☐') : cellText(v));
      const inner = i === 0 && href ? `<a href="${esc(href)}" style="color:#0b6fa4;text-decoration:underline;">${text || 'open'}</a>` : text;
      return `<td style="${cellStyle(c, v)}">${inner}</td>`;
    }).join('')}</tr>`;
  }).join('');
  return `<table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;font-family:${FONT};font-size:10.5pt;border:${BORDER};">${head}<tbody>${body}</tbody></table>`;
}
