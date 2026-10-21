// components/diagram-studio/elements/table/useTablePaste.js
// Paste a spreadsheet range (tab separated from Sheets / Excel, or CSV) onto the canvas: it becomes a table at the
// center of the visible area, selected. Ignored while typing somewhere (the cell editor handles its own paste), by
// read-only viewers, and for text that is not a grid. Also reveals a table row's linked element (REVEAL_EVENT).

import { useEffect, useRef } from 'react';
import { useDiagram, useDiagramSelection } from '../../DiagramContext';
import { canWrite } from '../../sharing/accessMode';
import { isTypingTarget } from '../../hooks/interaction/keyboardFocus';
import { viewportCenter } from '../../export/exportUtils';
import { computeFitForCanvas } from '../../viewportFit';
import { looksTabular, tableFromText } from '../../../../lib/table/tableCsv';
import { TableError } from '../../../../lib/table/tableModel';
import { newTableElement } from './newTableElement';
import { REVEAL_EVENT } from './TableNode';

/** @param {{containerRef: {current: HTMLElement|null}}} p */
export function useTablePaste({ containerRef }) {
  const { selectElement } = useDiagramSelection();
  const ctx = { ...useDiagram(), selectElement };
  const ref = useRef(ctx);
  useEffect(() => { ref.current = ctx; });

  useEffect(() => {
    const onPaste = (e) => {
      const c = ref.current;
      if (e.defaultPrevented || isTypingTarget(e.target) || !canWrite(c.diagram?.access)) return;
      const text = e.clipboardData?.getData('text/plain');
      if (!looksTabular(text)) return;
      let table;
      try {
        table = tableFromText(text);
      } catch (err) {
        if (err instanceof TableError) return;
        throw err;
      }
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect?.() || {};
      const center = viewportCenter(c.viewport, { width: rect.width, height: rect.height });
      const probe = newTableElement({ x: 0, y: 0, table });
      const grid = 20;
      const el = newTableElement({
        x: Math.round((center.x - probe.size.width / 2) / grid) * grid,
        y: Math.round((center.y - Math.min(probe.size.height, 300) / 2) / grid) * grid,
        table,
      });
      c.addElement(el);
      c.selectElement(el.id);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [containerRef]);

  // Row link -> select and zoom to the element
  useEffect(() => {
    const onReveal = (e) => {
      const c = ref.current;
      const ids = Array.isArray(e.detail?.ids) ? e.detail.ids : [];
      const targets = (c.elements || []).filter((el) => ids.includes(el.id));
      if (!targets.length) return;
      c.selectElement(targets[0].id);
      const fit = computeFitForCanvas(targets, { container: containerRef.current, padding: 120, maxScale: 1 });
      if (fit) c.setViewport(fit);
    };
    window.addEventListener(REVEAL_EVENT, onReveal);
    return () => window.removeEventListener(REVEAL_EVENT, onReveal);
  }, [containerRef]);
}
