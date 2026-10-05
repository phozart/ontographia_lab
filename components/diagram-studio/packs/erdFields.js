// components/diagram-studio/packs/erdFields.js
// Structured ERD field rows: { name, dataType, isPrimaryKey, isForeignKey, ...extra }.
// Pure helpers shared by the ERD renderer and the Properties field-list editor.

const KEY_TOKENS = { pk: 'isPrimaryKey', fk: 'isForeignKey' };

// Parse one free-text line like "id int PK", "id: int, PK" or "created timestamp with time zone".
function parseLine(line) {
  const cleaned = line.trim().replace(/[,;]+/g, ' ').replace(/^([^\s:]+):/, '$1 ').trim();
  if (!cleaned) return null;
  const tokens = cleaned.split(/\s+/);
  const name = tokens.shift();
  const typeTokens = [];
  const row = { name, dataType: '' };
  tokens.forEach((t) => {
    const flag = KEY_TOKENS[t.toLowerCase()];
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

export function moveRow(rows, index, delta) {
  const to = index + delta;
  if (index < 0 || index >= rows.length || to < 0 || to >= rows.length) return rows;
  const next = rows.slice();
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}
