// components/diagram-studio/export/useJsonImport.js
// JSON import flow: file -> validate -> (merge into current diagram | create new diagram).
// Drag-and-drop hands files over via a window event so the canvas needs no knowledge of the dialog.

import { useState, useCallback, useEffect, useRef } from 'react';
import { useDiagram } from '../DiagramContext';
import { parseImportText, remapForMerge, MAX_IMPORT_BYTES } from './diagramJson';
import { viewportCenter } from './exportUtils';

export const IMPORT_JSON_EVENT = 'ds:import-json-file';

const isJsonFile = (f) => !!f && (/\.json$/i.test(f.name || '') || f.type === 'application/json');

/**
 * Canvas drop hook-up: returns true (and requests the import) when the drop carries a .json file.
 * Usage in a drop handler: `if (requestJsonImportFromDrop(e.dataTransfer)) return;`
 */
export function requestJsonImportFromDrop(dataTransfer) {
  const files = dataTransfer?.files ? Array.from(dataTransfer.files) : [];
  const file = files.find(isJsonFile);
  if (!file || typeof window === 'undefined') return false;
  window.dispatchEvent(new CustomEvent(IMPORT_JSON_EVENT, { detail: { file } }));
  return true;
}

const defaultNavigate = (url) => { window.location.href = url; };

export function useJsonImport({ navigate = defaultNavigate, readOnly = false } = {}) {
  const ctx = useDiagram();
  const [pending, setPending] = useState(null); // { fileName, name, type, content, warnings, counts }
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  const dismiss = useCallback(() => { setPending(null); setError(null); }, []);

  const importText = useCallback((text, fileName = 'file.json') => {
    const res = parseImportText(text);
    if (!res.ok) {
      setPending(null);
      setError(res.error);
      return false;
    }
    setError(null);
    setPending({
      fileName,
      name: res.name,
      type: res.type,
      content: res.content,
      warnings: res.warnings,
      counts: { elements: res.content.elements.length, connections: res.content.connections.length },
    });
    return true;
  }, []);

  const importFile = useCallback(async (file) => {
    if (!file) return false;
    if (file.size > MAX_IMPORT_BYTES) {
      setPending(null);
      setError(`The file is too large. The limit is ${Math.round(MAX_IMPORT_BYTES / 1024 / 1024)} MB.`);
      return false;
    }
    try {
      const text = await file.text();
      return importText(text, file.name);
    } catch (e) {
      setPending(null);
      setError('The file could not be read.');
      return false;
    }
  }, [importText]);

  // Drag-and-drop requests
  useEffect(() => {
    if (readOnly) return undefined;
    const onFile = (e) => { importFile(e.detail?.file); };
    window.addEventListener(IMPORT_JSON_EVENT, onFile);
    return () => window.removeEventListener(IMPORT_JSON_EVENT, onFile);
  }, [importFile, readOnly]);

  const mergeIntoCurrent = useCallback(() => {
    if (!pending) return;
    const { viewport, setElements, setConnections, setSelection } = ctxRef.current;
    const area = typeof document !== 'undefined' ? document.querySelector('.ds-canvas-area') : null;
    const center = viewportCenter(viewport, area ? { width: area.clientWidth, height: area.clientHeight } : {});
    const out = remapForMerge(pending.content, { center });
    // Snap-free placement; ids are fresh so there is no collision with existing items.
    setElements(prev => [...prev, ...out.elements]);
    if (out.connections.length) setConnections(prev => [...prev, ...out.connections]);
    setSelection?.({ nodeIds: out.elements.map(e => e.id), connectionIds: [] });
    setPending(null);
  }, [pending]);

  const createNewDiagram = useCallback(async () => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/diagrams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: pending.name, type: pending.type, content: pending.content }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Could not create the diagram (${res.status}).`);
      setPending(null);
      navigate(`/diagram/${data.short_id || data.id}`);
    } catch (e) {
      setError(e.message || 'Could not create the diagram.');
    } finally {
      setBusy(false);
    }
  }, [pending, navigate]);

  return { pending, error, busy, importFile, importText, mergeIntoCurrent, createNewDiagram, dismiss };
}
