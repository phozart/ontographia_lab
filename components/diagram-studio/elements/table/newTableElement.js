// components/diagram-studio/elements/table/newTableElement.js
// Builds a core/table element for the editor (Table tool, paste from a spreadsheet, shape sidebar).

import { generateId } from '../../utils/ids';
import { createEmptyTable, tableElementSize } from '../../../../lib/table/tableModel';

export const TABLE_COLOR = '#4FB3CE';

/**
 * @param {{x: number, y: number, table?: object, place?: (point: {x: number, y: number}, size: {width: number, height: number}) => {x: number, y: number}}} p
 * `place` centers the element on the point (the Table tool passes the canvas placement helper); without it x, y is the top-left corner.
 */
export function newTableElement({ x, y, table = createEmptyTable(), place }) {
  const size = tableElementSize(table);
  const pos = place ? place({ x, y }, size) : { x, y };
  return {
    id: generateId('el'),
    type: 'table',
    packId: 'core',
    name: 'Table',
    label: '',
    x: pos.x,
    y: pos.y,
    size,
    color: TABLE_COLOR,
    layerId: 'default',
    properties: {},
    data: { table },
  };
}

/** A table created by a generic path (shape sidebar) has no data.table yet: give it one so it can be saved. */
export function ensureTableData(element) {
  if (!element || element.type !== 'table' || (element.packId && element.packId !== 'core')) return element;
  if (element.data && element.data.table) return element;
  const table = createEmptyTable();
  return { ...element, label: element.label === 'Table' ? '' : element.label, data: { ...(element.data || {}), table }, size: tableElementSize(table) };
}
