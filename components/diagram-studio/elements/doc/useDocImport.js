// components/diagram-studio/elements/doc/useDocImport.js
// Drop a .md file on the canvas to get a doc card (AI-5). The canvas hands the file over with a window event (same
// pattern as the JSON import) so it needs no knowledge of the doc editor. The text is read as UTF-8, sanitized
// exactly like server content, and capped at the doc size limit.

import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useDiagram } from '../../DiagramContext';
import { canWrite } from '../../sharing/accessMode';
import { markdownFileToDoc } from '../../../../lib/doc/docText';
import { sanitizeDocMarkdown } from '../../../../lib/doc/sanitize';
import { newDocElement, cleanTitle } from '../../../../lib/doc/docElement';
import { MAX_DOC_BYTES, utf8Length } from '../../../../lib/doc/markdown';
import { openDoc } from './docStore';

export const IMPORT_MD_EVENT = 'ds:import-md-file';
const isMarkdownFile = (f) => !!f && (/\.(md|markdown)$/i.test(f.name || '') || f.type === 'text/markdown');

/**
 * Canvas drop hook-up: true (and the import is requested) when the drop carries a .md file.
 * Usage in a drop handler: `if (requestDocImportFromDrop(e.dataTransfer, {x, y})) return;`
 */
export function requestDocImportFromDrop(dataTransfer, point) {
  const files = dataTransfer?.files ? Array.from(dataTransfer.files) : [];
  const file = files.find(isMarkdownFile);
  if (!file || typeof window === 'undefined') return false;
  window.dispatchEvent(new CustomEvent(IMPORT_MD_EVENT, { detail: { file, x: point?.x ?? 0, y: point?.y ?? 0 } }));
  return true;
}

export const readFileText = (file) =>
  typeof file.text === 'function'
    ? file.text()
    : new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result || ''));
        r.onerror = reject;
        r.readAsText(file);
      });

/** Pure: file text + name -> a doc element (or an error message). */
export function docElementFromMarkdownFile(text, fileName, point, id) {
  const bytes = utf8Length(text);
  if (bytes > MAX_DOC_BYTES) return { error: `That file is ${(bytes / 1024).toFixed(0)} KB; a doc holds up to ${MAX_DOC_BYTES / 1024} KB. Split it into smaller files.` };
  const { title, markdown } = markdownFileToDoc(text, fileName);
  const clean = sanitizeDocMarkdown(markdown);
  return { element: newDocElement({ id, x: Math.round(point.x), y: Math.round(point.y), title: cleanTitle(title) || 'Imported doc', markdown: clean.markdown }), cleaned: clean };
}

export function useDocImport() {
  const { addElement, selectElement, diagram } = useDiagram() || {};
  const [notice, setNotice] = useState(null);
  const ref = useRef({});
  ref.current = { addElement, selectElement, editable: canWrite(diagram?.access) };

  const importFile = useCallback(async (file, point) => {
    const { addElement: add, selectElement: select, editable } = ref.current;
    if (!editable || !add) return;
    try {
      const text = await readFileText(file);
      const id = `el-${uuidv4()}`;
      const r = docElementFromMarkdownFile(text, file.name, point, id);
      if (r.error) {
        setNotice(r.error);
        return;
      }
      add(r.element);
      select?.(r.element.id);
      openDoc(r.element.id);
      const c = r.cleaned;
      setNotice(c.links + c.html + c.images > 0 ? 'Imported. Unsafe links, HTML and images in the file were neutralized.' : null);
    } catch {
      setNotice('That file could not be read.');
    }
  }, []);

  useEffect(() => {
    const onEvent = (e) => {
      const d = e.detail || {};
      if (d.file) importFile(d.file, { x: d.x || 0, y: d.y || 0 });
    };
    window.addEventListener(IMPORT_MD_EVENT, onEvent);
    return () => window.removeEventListener(IMPORT_MD_EVENT, onEvent);
  }, [importFile]);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(null), 8000);
    return () => clearTimeout(t);
  }, [notice]);

  return { notice, dismiss: () => setNotice(null) };
}
