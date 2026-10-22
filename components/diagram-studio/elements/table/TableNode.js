// components/diagram-studio/elements/table/TableNode.js
// The table element (core/table) on the canvas: a typed grid drawn as normal DOM (so PNG / PDF export and the stored
// thumbnail need no special path), with inline editing. Data lives in element.data.table (lib/table/tableModel.js).
//
// Layout is deterministic (tableMetrics): column widths scale with the element's width, row heights come from the
// text, and the element's size is kept equal to the content so selection, connectors and exports agree.
// Interaction: click selects and drags like any element; double-click (or Enter) edits a cell; the keyboard contract
// is in CellEditor. Read-only viewers and locked tables get the same drawing without any controls.

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDiagram } from '../../DiagramContext';
import { canWrite } from '../../sharing/accessMode';
import { downloadExport } from '../../export/ExportManager';
import { exportFilename } from '../../export/exportUtils';
import {
  TableError, LAYOUT, cellText, tableMetrics, tableElementSize, createEmptyTable, setCell, addRow, removeRow, moveRow, addColumn,
  removeColumn, moveColumn, renameColumn, setColumnType, setColumnWidth, sortByColumn, setRowLink, setHeaderRow, pasteGrid,
  columnWidths, COLUMN_TYPES, MIN_COLUMN_WIDTH,
} from '../../../../lib/table/tableModel';
import { tableToCsv, tableToJson, parseDelimited } from '../../../../lib/table/tableCsv';
import { copyTableRich, exportTableXlsx } from '../doc/docActions';
import CellEditor from './CellEditor';
import TableMenu from './TableMenu';

export const REVEAL_EVENT = 'ontographia:reveal-elements';
const TYPE_LABEL = { text: 'Text', number: 'Number', select: 'Select', boolean: 'Yes / no' };
const HTTP_URL = /^https?:\/\/\S+$/i;

// ---------------------------------------------------------------- cells

function CellValue({ column, value }) {
  if (value === undefined) return null;
  if (column.type === 'boolean') {
    return <span className={`ds-tbl-check${value ? ' on' : ''}`} role="img" aria-label={value ? 'Yes' : 'No'}>{value ? '✓' : ''}</span>;
  }
  const text = cellText(value);
  if (column.type === 'select') {
    const opt = Array.isArray(column.options) ? column.options.find((o) => o.value === value) : null;
    return <span className="ds-tbl-chip" style={opt?.color ? { background: `${opt.color}55`, borderColor: opt.color } : undefined}>{text}</span>;
  }
  if (column.type === 'text' && HTTP_URL.test(text.trim())) {
    return <a className="ds-tbl-text" href={text.trim()} target="_blank" rel="noopener noreferrer" onMouseDown={(e) => e.stopPropagation()}>{text}</a>;
  }
  return <span className="ds-tbl-text">{text}</span>;
}

const Row = memo(function Row({ row, index, columns, widths, height, linkLabel, linkLive, selected, canEdit, activeColId, editingColId, h }) {
  return (
    <div className="ds-tbl-row" role="row" style={{ height }} data-row-id={row.id}>
      <div className="ds-tbl-gutter" role="gridcell" style={{ width: LAYOUT.gutter }}>
        {selected && canEdit && (
          <button type="button" className="ds-tbl-mini" aria-label={`Row ${index + 1} options`} aria-haspopup="menu" data-testid="table-row-menu" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => h.openRowMenu(e, row.id)}>⋮</button>
        )}
        {row.elementId && (linkLive ? (
          <button type="button" className="ds-tbl-mini link" aria-label={`Go to ${linkLabel}`} title={`Go to ${linkLabel}`} data-testid="table-row-link" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); h.reveal(row.elementId); }}>↗</button>
        ) : (
          <span className="ds-tbl-mini gone" title="The linked element was removed" data-testid="table-row-link-gone">⌀</span>
        ))}
      </div>
      {columns.map((col, ci) => {
        const active = activeColId === col.id;
        const editing = editingColId === col.id;
        return (
          <div
            key={col.id}
            role="gridcell"
            aria-selected={active || undefined}
            className={`ds-tbl-cell t-${col.type}${active ? ' active' : ''}`}
            style={{ width: widths[ci] }}
            data-row-id={row.id}
            data-col-id={col.id}
            data-testid={`table-cell-${index}-${ci}`}
            onClick={(e) => h.cellClick(e, row.id, col.id, col.type)}
            onDoubleClick={(e) => h.cellDoubleClick(e, row.id, col.id)}
          >
            {editing ? (
              <CellEditor
                type={col.type}
                initial={h.editSeed(row, col)}
                options={(col.options || []).map((o) => o.value)}
                label={`${col.name}, row ${index + 1}`}
                onCommit={(raw, nav) => h.commitCell(row.id, col.id, raw, nav)}
                onCancel={h.cancelEdit}
                onPasteText={(text) => h.pasteText(row.id, col.id, text)}
              />
            ) : (
              <CellValue column={col} value={row.cells?.[col.id]} />
            )}
          </div>
        );
      })}
    </div>
  );
});

// ---------------------------------------------------------------- node

export default function TableNode({ element, stencil, isSelected }) {
  const ctx = useDiagram();
  const { updateElement, diagram, viewport, selection, elements = [] } = ctx;
  const table = element.data?.table;
  const canEdit = canWrite(diagram?.access) && !element.locked;
  const interactive = Boolean(isSelected && canEdit);
  const scale = viewport?.scale || 1;

  const rootRef = useRef(null);
  const elRef = useRef(element);
  elRef.current = element;
  const tableRef = useRef(table);
  tableRef.current = table;
  const [active, setActive] = useState(null); // {rowId, colId}
  const [editing, setEditing] = useState(null); // {rowId, colId, seed?} | {headerColId}
  const [menu, setMenu] = useState(null); // {kind, id, left, top}
  const [notice, setNotice] = useState('');
  const [titleEdit, setTitleEdit] = useState(false);

  const metrics = useMemo(() => (table ? tableMetrics(table, element.size?.width) : null), [table, element.size?.width]);

  // A table created through a generic path (shape sidebar) starts empty: give it a real table before the first save.
  useEffect(() => {
    if (table || !canEdit) return;
    const t = createEmptyTable();
    updateElement(element.id, { data: { ...(element.data || {}), table: t }, size: tableElementSize(t) });
  }, [table, canEdit, element.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep size and column widths equal to the content: a resize handle drag scales the columns proportionally and the
  // height always follows the rows (settles shortly after the gesture).
  // Never on open: a stored size that differs from the content stays as saved until the table or its size actually changes
  // in this session (an edit or a resize), so opening a board does not dirty it and bump the revision.
  const openedRef = useRef(null);
  if (openedRef.current === null && table) openedRef.current = { sig: JSON.stringify(table), w: element.size?.width, h: element.size?.height };
  useEffect(() => {
    if (!table || !canEdit) return undefined;
    const opened = openedRef.current;
    if (opened && JSON.stringify(table) === opened.sig && element.size?.width === opened.w && element.size?.height === opened.h) return undefined;
    const natural = tableMetrics(table);
    const w = element.size?.width;
    const hgt = element.size?.height;
    const widthOff = Number.isFinite(w) && Math.abs(w - natural.width) > 1;
    const heightOff = !Number.isFinite(hgt) || Math.abs(hgt - tableMetrics(table, widthOff ? w : undefined).height) > 1;
    if (!widthOff && !heightOff) return undefined;
    const timer = setTimeout(() => {
      const el = elRef.current;
      const t = tableRef.current;
      if (!t) return;
      const target = el.size?.width;
      const widths = Number.isFinite(target) ? columnWidths(t, target) : t.columns.map((c) => c.width);
      const scaled = { ...t, columns: t.columns.map((c, i) => ({ ...c, width: Math.max(MIN_COLUMN_WIDTH / 2, Math.round(widths[i])) })) };
      updateElement(el.id, { data: { ...(el.data || {}), table: scaled }, size: tableElementSize(scaled) }, { coalesceKey: `table-fit:${el.id}` });
    }, 350);
    return () => clearTimeout(timer);
  }, [table, element.size?.width, element.size?.height, canEdit, updateElement]);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  // leaving the selection ends editing and closes menus
  useEffect(() => {
    if (!isSelected) { setEditing(null); setActive(null); setMenu(null); }
  }, [isSelected]);

  // ---- commands ----
  const commit = useCallback((next, options) => {
    const el = elRef.current;
    updateElement(el.id, { data: { ...(el.data || {}), table: next }, size: tableElementSize(next) }, options);
  }, [updateElement]);

  const run = useCallback((fn, options) => {
    try {
      const out = fn(tableRef.current);
      if (out) commit(out, options);
      return true;
    } catch (e) {
      if (!(e instanceof TableError)) throw e;
      setNotice(e.message);
      return false;
    }
  }, [commit]);

  const focusRoot = () => rootRef.current?.focus({ preventScroll: true });
  const grid = () => ({ rows: tableRef.current?.rows || [], cols: tableRef.current?.columns || [] });

  const moveActive = useCallback((dr, dc, { grow = false } = {}) => {
    const { rows, cols } = grid();
    if (!rows.length || !cols.length) return;
    const cur = active || { rowId: rows[0].id, colId: cols[0].id };
    let r = rows.findIndex((x) => x.id === cur.rowId);
    let c = cols.findIndex((x) => x.id === cur.colId);
    c += dc;
    r += dr;
    if (c >= cols.length) { c = 0; r += 1; }
    if (c < 0) { c = cols.length - 1; r -= 1; }
    if (r >= rows.length) {
      if (grow) {
        const t = addRow(tableRef.current, {});
        commit(t);
        setActive({ rowId: t.rows[t.rows.length - 1].id, colId: cols[c].id });
        return;
      }
      r = rows.length - 1;
    }
    r = Math.max(0, r);
    setActive({ rowId: rows[r].id, colId: cols[c].id });
  }, [active, commit]);

  const startEdit = useCallback((rowId, colId, seed) => {
    if (!canEdit) return;
    const col = tableRef.current.columns.find((c) => c.id === colId);
    if (col?.type === 'boolean') {
      run((t) => {
        const cur = t.rows.find((r) => r.id === rowId)?.cells?.[colId];
        return setCell(t, rowId, colId, cur === true ? false : true);
      });
      return;
    }
    setActive({ rowId, colId });
    setEditing({ rowId, colId, seed });
  }, [canEdit, run]);

  const h = useRef({}).current;
  h.reveal = (id) => window.dispatchEvent(new CustomEvent(REVEAL_EVENT, { detail: { ids: [id] } }));
  h.editSeed = (row, col) => {
    if (editing?.seed !== undefined) return editing.seed;
    const v = row.cells?.[col.id];
    return v === undefined ? '' : cellText(v);
  };
  h.cellClick = (e, rowId, colId, type) => {
    if (!isSelected) return; // the first click only selects the table
    setActive({ rowId, colId });
    setMenu(null);
    focusRoot();
    if (type === 'boolean' && canEdit && active?.rowId === rowId && active?.colId === colId) startEdit(rowId, colId);
  };
  h.cellDoubleClick = (e, rowId, colId) => {
    e.stopPropagation();
    if (canEdit) startEdit(rowId, colId);
  };
  h.commitCell = (rowId, colId, raw, nav) => {
    const ok = run((t) => setCell(t, rowId, colId, raw));
    if (!ok) return false;
    setEditing(null);
    if (nav) {
      const step = { down: [1, 0], up: [-1, 0], right: [0, 1], left: [0, -1] }[nav];
      setActive({ rowId, colId });
      // the commit above is async state: move after it lands, from the cell that was edited
      requestAnimationFrame(() => {
        const { rows, cols } = grid();
        let r = rows.findIndex((x) => x.id === rowId) + step[0];
        let c = cols.findIndex((x) => x.id === colId) + step[1];
        if (c >= cols.length) { c = 0; r += 1; }
        if (c < 0) { c = cols.length - 1; r -= 1; }
        if (r >= rows.length && nav === 'right') {
          const t = addRow(tableRef.current, {});
          commit(t);
          r = rows.length;
          setActive({ rowId: t.rows[r].id, colId: cols[c].id });
          return;
        }
        r = Math.min(rows.length - 1, Math.max(0, r));
        setActive({ rowId: rows[r].id, colId: cols[c].id });
      });
    }
    focusRoot();
    return true;
  };
  h.cancelEdit = () => { setEditing(null); focusRoot(); };
  h.pasteText = (rowId, colId, text) => {
    setEditing(null);
    const out = pasteGrid(tableRef.current, parseDelimited(text), { rowId, columnId: colId });
    commit(out.table);
    setNotice(out.skipped ? `Pasted ${out.written} cells; ${out.skipped} did not fit and were skipped` : `Pasted ${out.written} cells`);
    focusRoot();
  };
  h.openRowMenu = (e, rowId) => {
    e.stopPropagation();
    openMenuAt(e.currentTarget, { kind: 'row', id: rowId });
  };

  const openMenuAt = (trigger, next) => {
    const rect = trigger.getBoundingClientRect();
    const base = rootRef.current.getBoundingClientRect();
    setMenu({ ...next, left: (rect.left - base.left) / scale, top: (rect.bottom - base.top) / scale + 2 });
  };

  // ---- keyboard on the focused grid ----
  const onKeyDown = (e) => {
    if (editing || !interactive) return;
    const key = e.key;
    const handled = () => { e.preventDefault(); e.stopPropagation(); };
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (key === 'Escape') { if (active) { handled(); setActive(null); } return; }
    if (!active) return;
    if (key === 'ArrowDown') { handled(); moveActive(1, 0); }
    else if (key === 'ArrowUp') { handled(); moveActive(-1, 0); }
    else if (key === 'ArrowRight') { handled(); moveActive(0, 1); }
    else if (key === 'ArrowLeft') { handled(); moveActive(0, -1); }
    else if (key === 'Tab') { handled(); moveActive(0, e.shiftKey ? -1 : 1, { grow: !e.shiftKey }); }
    else if (key === 'Enter' || key === 'F2') { handled(); startEdit(active.rowId, active.colId); }
    else if (key === 'Delete' || key === 'Backspace') { handled(); run((t) => setCell(t, active.rowId, active.colId, '')); }
    else if (key.length === 1) { handled(); startEdit(active.rowId, active.colId, key); }
  };

  // ---- menus ----
  const exportTable = (kind) => {
    const t = tableRef.current;
    const name = elRef.current.label || 'table';
    if (kind === 'csv') downloadExport({ content: `﻿${tableToCsv(t)}`, mimeType: 'text/csv;charset=utf-8', filename: exportFilename(name, 'csv') });
    else downloadExport({ content: tableToJson(t), mimeType: 'application/json', filename: exportFilename(name, 'json') });
  };
  const copyTable = async () => {
    const r = await copyTableRich(tableRef.current, diagram);
    setNotice(r.ok ? (r.rich ? 'Table copied. Paste into Excel, Sheets, Word or Outlook.' : 'Table copied as tab separated text') : 'Copy was blocked by the browser');
  };
  const otherSelected = (selection?.nodeIds || []).filter((id) => id !== element.id);
  const linkTarget = otherSelected.length === 1 ? elements.find((e) => e.id === otherSelected[0]) : null;

  const menuItems = () => {
    if (!menu || !table) return [];
    if (menu.kind === 'col') {
      const col = table.columns.find((c) => c.id === menu.id);
      if (!col) return [];
      const idx = table.columns.findIndex((c) => c.id === menu.id);
      return [
        { label: 'Rename column', onSelect: () => setEditing({ headerColId: col.id }) },
        { separator: true },
        ...COLUMN_TYPES.map((tp) => ({
          label: `Type: ${TYPE_LABEL[tp]}`, checked: col.type === tp,
          onSelect: () => run((t) => {
            const res = setColumnType(t, col.id, tp);
            if (res.dropped) setNotice(`${res.dropped} cell${res.dropped === 1 ? '' : 's'} could not become ${TYPE_LABEL[tp].toLowerCase()} and ${res.dropped === 1 ? 'was' : 'were'} emptied (undo restores)`);
            return res.table;
          }),
        })),
        { separator: true },
        { label: 'Sort A to Z (once)', onSelect: () => run((t) => sortByColumn(t, col.id, 'asc')) },
        { label: 'Sort Z to A (once)', onSelect: () => run((t) => sortByColumn(t, col.id, 'desc')) },
        { separator: true },
        { label: 'Insert column left', onSelect: () => run((t) => addColumn(t, { index: idx })) },
        { label: 'Insert column right', onSelect: () => run((t) => addColumn(t, { index: idx + 1 })) },
        { label: 'Move left', disabled: idx === 0, onSelect: () => run((t) => moveColumn(t, col.id, -1)) },
        { label: 'Move right', disabled: idx === table.columns.length - 1, onSelect: () => run((t) => moveColumn(t, col.id, 1)) },
        { separator: true },
        { label: 'Delete column', danger: true, disabled: table.columns.length <= 1, onSelect: () => run((t) => removeColumn(t, col.id)) },
      ];
    }
    if (menu.kind === 'row') {
      const idx = table.rows.findIndex((r) => r.id === menu.id);
      const row = table.rows[idx];
      if (!row) return [];
      const live = row.elementId && elements.some((e) => e.id === row.elementId);
      return [
        { label: 'Insert row above', onSelect: () => run((t) => addRow(t, { index: idx })) },
        { label: 'Insert row below', onSelect: () => run((t) => addRow(t, { index: idx + 1 })) },
        { label: 'Move up', disabled: idx === 0, onSelect: () => run((t) => moveRow(t, row.id, -1)) },
        { label: 'Move down', disabled: idx === table.rows.length - 1, onSelect: () => run((t) => moveRow(t, row.id, 1)) },
        { separator: true },
        { label: linkTarget ? `Link to "${String(linkTarget.label || linkTarget.name || linkTarget.id).slice(0, 30)}"` : 'Link to element (select it too)', disabled: !linkTarget, onSelect: () => run((t) => setRowLink(t, row.id, linkTarget.id)) },
        ...(live ? [{ label: 'Go to linked element', onSelect: () => h.reveal(row.elementId) }] : []),
        ...(row.elementId ? [{ label: 'Remove link', onSelect: () => run((t) => setRowLink(t, row.id, null)) }] : []),
        { separator: true },
        { label: 'Delete row', danger: true, onSelect: () => run((t) => removeRow(t, row.id)) },
      ];
    }
    return [
      { label: 'Header row', checked: table.headerRow !== false, onSelect: () => run((t) => setHeaderRow(t, t.headerRow === false)) },
      { separator: true },
      { label: 'Export as CSV', onSelect: () => exportTable('csv') },
      { label: 'Export as JSON', onSelect: () => exportTable('json') },
      { label: 'Export as Excel (.xlsx)', onSelect: () => exportTableXlsx(tableRef.current, { title: elRef.current.label || 'table', diagram }) },
      { label: 'Copy table (formatted)', onSelect: copyTable },
    ];
  };

  // ---- column width drag ----
  const startColumnDrag = (e, col, index) => {
    if (!canEdit || !interactive) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = metrics.colWidths[index];
    const move = (ev) => {
      const w = Math.max(MIN_COLUMN_WIDTH, Math.round(startW + (ev.clientX - startX) / scale));
      run((t) => setColumnWidth(t, col.id, w), { coalesceKey: `table-colw:${elRef.current.id}:${col.id}` });
    };
    const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };

  // ---------------------------------------------------------------- render
  const title = element.label && element.label !== 'Table' ? element.label : '';
  if (!table || !metrics) {
    return <div className="ds-table ds-tbl-empty" data-testid="table-node">{element.label || 'Table'}<TableStyles /></div>;
  }
  const liveIds = new Set(elements.map((e) => e.id));
  const labelOf = (id) => {
    const e = elements.find((x) => x.id === id);
    return e ? String(e.label || e.name || e.id).slice(0, 60) : '';
  };
  const showHeader = metrics.headerHeight > 0;

  return (
    <div
      ref={rootRef}
      className={`ds-table${isSelected ? ' selected' : ''}`}
      role="grid"
      aria-label={title || 'Table'}
      aria-rowcount={table.rows.length + (showHeader ? 1 : 0)}
      aria-colcount={table.columns.length}
      data-testid="table-node"
      tabIndex={interactive ? 0 : -1}
      onKeyDown={onKeyDown}
      style={{ width: metrics.width, height: metrics.height }}
    >
      {title && (
        titleEdit ? (
          <input
            className="ds-tbl-title-edit"
            autoFocus
            defaultValue={element.label}
            aria-label="Table title"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur(); }}
            onBlur={(e) => { setTitleEdit(false); if (canEdit && e.currentTarget.value !== element.label) updateElement(element.id, { label: e.currentTarget.value }); }}
          />
        ) : (
          <div className="ds-tbl-title" onDoubleClick={(e) => { e.stopPropagation(); if (canEdit) setTitleEdit(true); }} data-testid="table-title">{title}</div>
        )
      )}
      <div className="ds-tbl-grid" style={{ width: metrics.width, height: metrics.height }}>
        {showHeader && (
          <div className="ds-tbl-row ds-tbl-head" role="row" style={{ height: metrics.headerHeight }}>
            <div className="ds-tbl-gutter" role="columnheader" style={{ width: LAYOUT.gutter }}>
              {interactive && (
                <button type="button" className="ds-tbl-mini" aria-label="Table options" aria-haspopup="menu" data-testid="table-options" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); openMenuAt(e.currentTarget, { kind: 'table' }); }}>⋯</button>
              )}
            </div>
            {table.columns.map((col, ci) => (
              <div
                key={col.id}
                role="columnheader"
                className="ds-tbl-hcell"
                style={{ width: metrics.colWidths[ci] }}
                data-col-id={col.id}
                data-testid={`table-header-${ci}`}
                onDoubleClick={(e) => { e.stopPropagation(); if (canEdit) setEditing({ headerColId: col.id }); }}
              >
                {editing?.headerColId === col.id ? (
                  <CellEditor
                    type="name"
                    initial={col.name}
                    label={`Column name ${ci + 1}`}
                    onCommit={(raw, nav) => { const ok = run((t) => renameColumn(t, col.id, raw)); if (ok) { setEditing(null); focusRoot(); } return ok; }}
                    onCancel={() => { setEditing(null); focusRoot(); }}
                  />
                ) : (
                  <>
                    <span className="ds-tbl-hname" title={`${col.name} (${TYPE_LABEL[col.type]})`}>{col.name}</span>
                    {col.type !== 'text' && <span className="ds-tbl-type" aria-hidden="true">{col.type === 'number' ? '#' : col.type === 'boolean' ? '✓' : '☰'}</span>}
                    {interactive && (
                      <>
                        <button type="button" className="ds-tbl-mini" aria-label={`Column ${col.name} options`} aria-haspopup="menu" data-testid="table-column-menu" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); openMenuAt(e.currentTarget, { kind: 'col', id: col.id }); }}>▾</button>
                        <span className="ds-tbl-resize" role="separator" aria-orientation="vertical" aria-label={`Resize column ${col.name}`} data-testid="table-column-resize" onMouseDown={(e) => startColumnDrag(e, col, ci)} />
                      </>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
        {table.rows.map((row, ri) => (
          <Row
            key={row.id}
            row={row}
            index={ri}
            columns={table.columns}
            widths={metrics.colWidths}
            height={metrics.rowHeights[ri]}
            linkLabel={row.elementId ? labelOf(row.elementId) : ''}
            linkLive={row.elementId ? liveIds.has(row.elementId) : false}
            selected={interactive}
            canEdit={canEdit}
            activeColId={active?.rowId === row.id ? active.colId : null}
            editingColId={editing?.rowId === row.id ? editing.colId : null}
            h={h}
          />
        ))}
      </div>
      {interactive && (
        <>
          <button type="button" className="ds-tbl-add row" aria-label="Add row" data-testid="table-add-row" style={{ top: metrics.height + 4, width: metrics.width }} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); run((t) => addRow(t, {})); }}>+ Row</button>
          <button type="button" className="ds-tbl-add col" aria-label="Add column" data-testid="table-add-column" style={{ left: metrics.width + 4, height: metrics.height }} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); run((t) => addColumn(t, {})); }}>+</button>
        </>
      )}
      {menu && <TableMenu left={menu.left} top={menu.top} label={`${menu.kind} options`} items={menuItems()} onClose={() => { setMenu(null); }} />}
      {notice && <div className="ds-tbl-notice" role="status" data-testid="table-notice" style={{ top: metrics.height + 34 }}>{notice}</div>}
      <TableStyles />
    </div>
  );
}

// ---------------------------------------------------------------- styles

function TableStyles() {
  return (
    <style jsx global>{`
      .ds-table { position: relative; align-self: flex-start; font-size: 12px; line-height: ${LAYOUT.lineHeight}px; color: var(--text, #1e293b); outline: none; user-select: none; }
      .ds-table .ds-tbl-grid { position: relative; background: var(--panel, #fff); border: 1px solid var(--border, #cbd5e1); border-radius: 4px; overflow: hidden; box-sizing: border-box; }
      .ds-tbl-title { position: absolute; top: -26px; left: 0; font-size: 13px; font-weight: 600; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .ds-tbl-title-edit { position: absolute; top: -28px; left: 0; font-size: 13px; font-weight: 600; width: 240px; }
      .ds-tbl-row { display: flex; box-sizing: border-box; border-top: 1px solid var(--border, #cbd5e1); }
      .ds-tbl-row.ds-tbl-head { border-top: 0; background: color-mix(in srgb, var(--selection, #4FB3CE) 14%, var(--panel, #fff)); font-weight: 600; }
      .ds-tbl-gutter { flex: 0 0 auto; display: flex; align-items: center; justify-content: center; gap: 2px; border-right: 1px solid var(--border, #cbd5e1); box-sizing: border-box; background: color-mix(in srgb, var(--border, #cbd5e1) 18%, var(--panel, #fff)); }
      .ds-tbl-hcell, .ds-tbl-cell { position: relative; flex: 0 0 auto; box-sizing: border-box; padding: 0 10px; border-right: 1px solid var(--border, #cbd5e1); overflow: hidden; display: flex; align-items: center; gap: 4px; min-width: 0; }
      .ds-tbl-cell { padding-top: 7px; padding-bottom: 7px; align-items: flex-start; }
      .ds-tbl-cell.t-number { justify-content: flex-end; font-variant-numeric: tabular-nums; }
      .ds-tbl-cell.active { outline: 2px solid var(--selection, #4FB3CE); outline-offset: -2px; }
      .ds-tbl-hname { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .ds-tbl-type { color: #64748b; font-weight: 400; font-size: 11px; }
      .ds-tbl-text { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: ${LAYOUT.maxLines}; overflow: hidden; white-space: pre-wrap; overflow-wrap: anywhere; user-select: text; min-width: 0; }
      .ds-tbl-chip { display: inline-block; padding: 0 8px; border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
      .ds-tbl-check { display: inline-flex; width: 16px; height: 16px; border: 1.5px solid #94a3b8; border-radius: 3px; align-items: center; justify-content: center; font-size: 12px; line-height: 1; margin-top: 0; }
      .ds-tbl-check.on { background: var(--selection, #4FB3CE); border-color: var(--selection, #4FB3CE); color: #fff; }
      .ds-tbl-mini { all: unset; box-sizing: border-box; cursor: pointer; min-width: 16px; height: 18px; padding: 0 3px; border-radius: 3px; text-align: center; color: #475569; font-size: 12px; line-height: 18px; }
      .ds-tbl-mini:hover, .ds-tbl-mini:focus-visible { background: rgba(79,179,206,.2); }
      .ds-tbl-mini.link { color: var(--selection, #0e7490); font-weight: 700; }
      .ds-tbl-mini.gone { cursor: default; color: #94a3b8; }
      .ds-tbl-resize { position: absolute; right: -3px; top: 0; bottom: 0; width: 7px; cursor: col-resize; z-index: 2; }
      .ds-tbl-resize:hover { background: rgba(79,179,206,.5); }
      .ds-tbl-editor { position: absolute; inset: 0; width: 100%; height: 100%; box-sizing: border-box; border: 2px solid var(--selection, #4FB3CE); border-radius: 0; padding: 6px 8px; font: inherit; line-height: ${LAYOUT.lineHeight}px; resize: none; background: #fff; color: #0f172a; z-index: 3; outline: none; user-select: text; }
      .ds-tbl-editor.invalid { border-color: #d64545; }
      .ds-tbl-add { all: unset; box-sizing: border-box; position: absolute; cursor: pointer; border: 1px dashed var(--selection, #4FB3CE); color: var(--selection, #0e7490); border-radius: 4px; text-align: center; font-size: 12px; font-weight: 600; background: rgba(79,179,206,.08); }
      .ds-tbl-add:hover, .ds-tbl-add:focus-visible { background: rgba(79,179,206,.22); }
      .ds-tbl-add.row { left: 0; height: 22px; line-height: 20px; }
      .ds-tbl-add.col { top: 0; width: 22px; line-height: 20px; padding-top: 8px; }
      .ds-tbl-notice { position: absolute; left: 0; max-width: 420px; padding: 4px 8px; font-size: 12px; background: #1e293b; color: #fff; border-radius: 4px; z-index: 20; user-select: text; }
      .ds-tbl-menu { position: absolute; z-index: 30; min-width: 190px; padding: 4px; background: #fff; border: 1px solid #cbd5e1; border-radius: 6px; box-shadow: 0 8px 24px rgba(15,23,42,.18); font-size: 12px; }
      .ds-tbl-menu-item { all: unset; box-sizing: border-box; display: flex; align-items: center; gap: 6px; width: 100%; padding: 5px 8px; border-radius: 4px; cursor: pointer; color: #0f172a; }
      .ds-tbl-menu-item:hover:not([disabled]), .ds-tbl-menu-item:focus-visible { background: rgba(79,179,206,.18); }
      .ds-tbl-menu-item[disabled] { color: #94a3b8; cursor: default; }
      .ds-tbl-menu-item.danger { color: #b42318; }
      .ds-tbl-menu-check { width: 12px; flex: 0 0 12px; color: var(--selection, #0e7490); }
      .ds-tbl-menu-sep { height: 1px; margin: 4px 2px; background: #e2e8f0; }
      .ds-tbl-empty { padding: 8px 12px; border: 1px dashed #94a3b8; border-radius: 4px; }
    `}</style>
  );
}
