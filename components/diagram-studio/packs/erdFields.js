// components/diagram-studio/packs/erdFields.js
// Structured ERD field rows: { name, dataType, isPrimaryKey, isForeignKey, ...extra }.
// Pure helpers shared by the ERD renderer and the Properties field-list editor.

const KEY_TOKENS = { pk: 'isPrimaryKey', fk: 'isForeignKey' };

// Parse one free-text line like "id int PK", "id: int, PK" or "created timestamp with time zone".
function parseLine(line) {
  // Separators (, ;) outside parentheses become spaces; "decimal(10, 2)" keeps its comma.
  let depth = 0;
  let sep = '';
  for (const ch of line.trim()) {
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    sep += depth === 0 && (ch === ',' || ch === ';') ? ' ' : ch;
  }
  const cleaned = sep.replace(/^([^\s:]+):/, '$1 ').trim();
  if (!cleaned) return null;
  const tokens = cleaned.split(/\s+/);
  const name = tokens.shift();
  const typeTokens = [];
  const row = { name, dataType: '' };
  tokens.forEach((t) => {
    const lower = t.toLowerCase();
    const flag = Object.hasOwn(KEY_TOKENS, lower) ? KEY_TOKENS[lower] : null;
    if (flag) row[flag] = true;
    else typeTokens.push(t);
  });
  row.dataType = typeTokens.join(' ');
  return row;
}

export function parseFieldsText(text) {
  if (typeof text !== 'string') return [];
  return text.split(/\r?\n/).map(parseLine).filter(Boolean);
}

// Accepts a structured array, an array of legacy strings, or a free-text string.
export function normalizeFields(value) {
  if (typeof value === 'string') return parseFieldsText(value);
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === 'string') return parseFieldsText(item);
    return item && typeof item === 'object' ? [item] : [];
  });
}

export function keyOf(row) {
  if (row?.isPrimaryKey && row?.isForeignKey) return 'PK+FK';
  if (row?.isPrimaryKey) return 'PK';
  if (row?.isForeignKey) return 'FK';
  return '';
}

export function withKey(row, key) {
  return {
    ...row,
    isPrimaryKey: key === 'PK' || key === 'PK+FK',
    isForeignKey: key === 'FK' || key === 'PK+FK',
  };
}

// Layout metrics of the ERD entity card (px), shared by the renderer and the editor.
export const ERD_HEADER_H = 40;
export const ERD_ROW_H = 20;
export const ERD_PAD_H = 12;
export const ERD_INDEX_H = 20;

// Minimum height that shows every field row (and index) without clipping.
export function entityMinHeight(fieldCount, indexCount = 0) {
  const rows = Math.max(1, fieldCount);
  return ERD_HEADER_H + ERD_PAD_H + rows * ERD_ROW_H + (indexCount > 0 ? 8 + indexCount * ERD_INDEX_H : 0);
}

// How many rows fit at a given height; when some are hidden the last slot becomes "+N more".
export function visibleRows(height, fieldCount, indexCount = 0) {
  const avail = height - ERD_HEADER_H - ERD_PAD_H - (indexCount > 0 ? 8 + indexCount * ERD_INDEX_H : 0);
  const capacity = Math.max(1, Math.floor(avail / ERD_ROW_H));
  if (fieldCount <= capacity) return { shown: fieldCount, hidden: 0 };
  const shown = Math.max(1, capacity - 1);
  return { shown, hidden: fieldCount - shown };
}

export function moveRow(rows, index, delta) {
  const to = index + delta;
  if (index < 0 || index >= rows.length || to < 0 || to >= rows.length) return rows;
  const next = rows.slice();
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}
