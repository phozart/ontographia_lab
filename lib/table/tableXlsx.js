// lib/table/tableXlsx.js
// Table -> .xlsx (Excel / Sheets / Numbers), written directly as SpreadsheetML and zipped with fflate (MIT, already in
// the bundle through jspdf; imported dynamically so it only loads on export). No spreadsheet library is used on purpose:
// the needed subset is small, and writing the XML ourselves makes the security property structural.
//
// NO FORMULAS, EVER: a cell is written as a number (`t="n"`), a boolean (`t="b"`) or an inline literal string
// (`t="inlineStr"`). There is no `<f>` element anywhere in the writer, so `=cmd|' /C calc'!A0` is stored (and shown) as
// text, not evaluated. Hyperlinks use the ONLY allowed targets: absolute https/http lab URLs built by buildFocusLink.
//
// Features: typed cells (number column + numeric value -> number, boolean -> TRUE/FALSE, everything else -> string),
// bold + frozen header row, column widths from content, sheet name = sanitized table title (<= 31 chars), an
// "Element link" column when rows are linked to board elements.

import { cellText } from './tableModel';
import { isValidElementId } from '../focusLink';
import { labElementLink } from '../doc/docLinks';

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

// XML 1.0 forbids most control characters; strip them, then escape the markup characters.
const xml = (s) => String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Excel sheet name rules: no : \ / ? * [ ], not empty, not starting/ending with an apostrophe, at most 31 characters. */
export function sheetName(title) {
  const n = String(title || '').replace(/[:\\/?*[\]\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^'+|'+$/g, '').trim();
  const out = Array.from(n || 'Table').slice(0, 31).join('').replace(/'+$/, '') || 'Table';
  return out.toLowerCase() === 'history' ? 'History_' : out; // "History" is reserved by Excel
}

export const tableFileName = (title) => `${String(title || 'table').normalize('NFKD').replace(/[^\w\s.-]+/g, '').trim().replace(/\s+/g, '-').replace(/^[.-]+|[.-]+$/g, '').slice(0, 80) || 'table'}.xlsx`;

const colLetter = (i) => { let s = ''; let n = i + 1; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; };

/**
 * @param {object} table element.data.table
 * @param {{title?: string, origin?: string, diagramRef?: string}} o
 * @returns {Promise<Uint8Array>} the .xlsx bytes
 */
export async function tableToXlsx(table, { title, origin, diagramRef } = {}) {
  const { zipSync, strToU8 } = await import('fflate');
  const cols = table.columns;
  const header = table.headerRow !== false;
  const linkFor = (row) => {
    if (!row.elementId || !isValidElementId(row.elementId)) return null;
    return labElementLink({ origin, diagramRef, elementId: row.elementId });
  };
  const links = table.rows.map(linkFor);
  const withLinks = links.some(Boolean);

  const widths = cols.map((c) => Math.min(60, Math.max(8, ...[header ? cellText(c.name) : '', ...table.rows.map((r) => cellText(r.cells?.[c.id]))].map((s) => Array.from(s.split('\n').sort((a, b) => b.length - a.length)[0] || '').length + 2))));
  if (withLinks) widths.push(16);

  const rels = [];
  const rows = [];
  let r = 0;
  const str = (ref, text, style) => `<c r="${ref}" t="inlineStr"${style ? ` s="${style}"` : ''}><is><t xml:space="preserve">${xml(text)}</t></is></c>`;
  const push = (cells) => { r += 1; rows.push(`<row r="${r}">${cells.join('')}</row>`); };

  if (header) push([...cols.map((c, i) => str(`${colLetter(i)}${r + 1}`, cellText(c.name), 1)), ...(withLinks ? [str(`${colLetter(cols.length)}${r + 1}`, 'Element link', 1)] : [])]);
  table.rows.forEach((row, ri) => {
    const rn = r + 1;
    const cells = cols.map((c, i) => {
      const ref = `${colLetter(i)}${rn}`;
      const v = row.cells?.[c.id];
      if (v === undefined || v === null || v === '') return '';
      if (typeof v === 'boolean') return `<c r="${ref}" t="b"><v>${v ? 1 : 0}</v></c>`;
      if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"><v>${v}</v></c>`;
      return str(ref, cellText(v));
    });
    if (links[ri]) {
      const ref = `${colLetter(cols.length)}${rn}`;
      rels.push({ ref, target: links[ri], id: `rId${rels.length + 1}` });
      cells.push(str(ref, 'Open on board', 2));
    }
    push(cells);
  });

  const lastCol = colLetter(Math.max(0, cols.length - 1 + (withLinks ? 1 : 0)));
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${NS}" xmlns:r="${REL}">`
    + `<dimension ref="A1:${lastCol}${Math.max(1, r)}"/>`
    + `<sheetViews><sheetView workbookViewId="0">${header ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft"/>' : ''}</sheetView></sheetViews>`
    + '<sheetFormatPr defaultRowHeight="15"/>'
    + (widths.length ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '')
    + `<sheetData>${rows.join('')}</sheetData>`
    + (rels.length ? `<hyperlinks>${rels.map((l) => `<hyperlink ref="${l.ref}" r:id="${l.id}"/>`).join('')}</hyperlinks>` : '')
    + '</worksheet>';

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="${NS}">`
    + '<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><u/><sz val="11"/><color rgb="FF0B6FA4"/><name val="Calibri"/></font></fonts>'
    + '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
    + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
    + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    + '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>'
    + '</styleSheet>';

  const files = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${NS}" xmlns:r="${REL}"><sheets><sheet name="${xml(sheetName(title))}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${REL}/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml': styles,
    'xl/worksheets/sheet1.xml': sheet,
  };
  if (rels.length) {
    files['xl/worksheets/_rels/sheet1.xml.rels'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.map((l) => `<Relationship Id="${l.id}" Type="${REL}/hyperlink" Target="${xml(l.target)}" TargetMode="External"/>`).join('')}</Relationships>`;
  }
  const entries = {};
  for (const [k, v] of Object.entries(files)) entries[k] = strToU8(v);
  return zipSync(entries, { level: 6 });
}
