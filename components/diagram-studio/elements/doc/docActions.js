// components/diagram-studio/elements/doc/docActions.js
// Copy-with-formatting and .docx / .pdf export for doc cards (and rich copy for tables). Shared by the side panel, the
// card context menu and the keyboard shortcut. The heavy libraries (docx, jspdf) are imported dynamically, so none of
// them is part of the canvas bundle. All text comes from the safe parser AST (lib/doc/docHtml etc.).

import { docToHtml, docToPlainText } from '../../../../lib/doc/docHtml';
import { docFileName } from '../../../../lib/doc/docText';
import { docOf } from '../../../../lib/doc/docElement';
import { copyRich } from '../../../../lib/clipboard/richCopy';
import { tableToHtml, tableToTsv } from '../../../../lib/table/tableClipboard';
import { tableOf } from '../../../../lib/table/tableModel';
import { postDocNotice } from './docStore';

const cleanTitle = (t) => String(t || '').replace(/\s+/g, ' ').trim();

/** Lab origin + diagram reference for absolute links. */
export function linkContext(diagram) {
  return {
    origin: typeof window !== 'undefined' ? window.location.origin : '',
    diagramRef: diagram?.short_id || diagram?.id || '',
  };
}

export const docExportName = (title, ext) => docFileName(title).replace(/\.md$/, `.${ext}`);

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Copy a doc as formatted HTML + readable plain text. Posts a toast. */
export async function copyDocRich({ title, markdown, diagram }) {
  const o = { title: cleanTitle(title), markdown, ...linkContext(diagram) };
  const r = await copyRich({ html: docToHtml(o), text: docToPlainText(o) });
  if (!r.ok) postDocNotice('Copy was blocked by the browser. Try again from the doc panel.', 'error');
  else postDocNotice(r.rich ? 'Copied with formatting. Paste into Outlook or Word.' : 'Copied as plain text (this browser blocked formatted copy).', r.rich ? 'success' : 'info');
  return r;
}

/** Download a doc as .docx or .pdf. Posts a toast. */
export async function exportDocFile(kind, { title, markdown, diagram }) {
  const o = { title: cleanTitle(title), markdown, ...linkContext(diagram) };
  try {
    postDocNotice(`Preparing ${kind.toUpperCase()}...`);
    let blob;
    if (kind === 'docx') {
      const { docToDocx } = await import('../../../../lib/doc/docDocx');
      blob = await docToDocx(o);
    } else {
      const { docToPdfFile } = await import('../../../../lib/doc/docPdf');
      blob = await docToPdfFile(o);
    }
    saveBlob(blob, docExportName(title, kind));
    postDocNotice(`Downloaded ${docExportName(title, kind)}`, 'success');
    return true;
  } catch {
    postDocNotice(`Could not create the ${kind.toUpperCase()} file.`, 'error');
    return false;
  }
}

/** Board-side entry points (context menu). */
export function copyDocElement(element, diagram) {
  const d = docOf(element) || {};
  return copyDocRich({ title: d.title || element?.label || '', markdown: d.markdown || '', diagram });
}
export function exportDocElement(kind, element, diagram) {
  const d = docOf(element) || {};
  return exportDocFile(kind, { title: d.title || element?.label || '', markdown: d.markdown || '', diagram });
}

/** Download a table as .xlsx (typed cells, no formulas, lab links as hyperlinks). The writer is imported on demand. */
export async function exportTableXlsx(table, { title, diagram } = {}) {
  try {
    const { tableToXlsx, tableFileName } = await import('../../../../lib/table/tableXlsx');
    const bytes = await tableToXlsx(table, { title, ...linkContext(diagram) });
    const name = tableFileName(title);
    saveBlob(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), name);
    postDocNotice(`Downloaded ${name}`, 'success');
    return true;
  } catch {
    postDocNotice('Could not create the Excel file.', 'error');
    return false;
  }
}

/** Copy a table as a formatted table (HTML) + TSV. */
export async function copyTableRich(table, diagram) {
  const r = await copyRich({ html: tableToHtml(table, linkContext(diagram)), text: tableToTsv(table) });
  if (!r.ok) postDocNotice('Copy was blocked by the browser.', 'error');
  else postDocNotice(r.rich ? 'Table copied. Paste into Excel, Sheets, Word or Outlook.' : 'Table copied as tab separated text.', r.rich ? 'success' : 'info');
  return r;
}
export const copyTableElement = (element, diagram) => {
  const t = tableOf(element);
  return t ? copyTableRich(t, diagram) : Promise.resolve({ ok: false });
};
