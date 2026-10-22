// lib/dedupeIds.js
// Legacy content can hold two entities with the same id in one collection. Merging and saving key everything by id,
// so the later duplicates get a fresh suffixed id (first occurrence keeps the id and its references). Nothing is
// dropped. Pure; returns the input untouched when there are no duplicates.

const KEYS = ['elements', 'connections', 'layers', 'groups', 'presentations'];
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** @returns {string|null} "elements:e1" for the first duplicated id found, or null when all ids are unique */
export function findDuplicateId(content) {
  if (!isObj(content)) return null;
  for (const k of KEYS) {
    if (!Array.isArray(content[k])) continue;
    const seen = new Set();
    for (const item of content[k]) {
      if (!isObj(item) || (typeof item.id !== 'string' && typeof item.id !== 'number')) continue;
      const id = String(item.id);
      if (seen.has(id)) return `${k}:${id}`;
      seen.add(id);
    }
  }
  return null;
}

export function dedupeContentIds(content) {
  if (!findDuplicateId(content)) return content;
  const out = { ...content };
  for (const k of KEYS) {
    if (!Array.isArray(content[k])) continue;
    const used = new Set(content[k].filter((i) => isObj(i) && i.id != null).map((i) => String(i.id)));
    const seen = new Set();
    out[k] = content[k].map((item) => {
      if (!isObj(item) || (typeof item.id !== 'string' && typeof item.id !== 'number')) return item;
      const id = String(item.id);
      if (!seen.has(id)) { seen.add(id); return item; }
      let n = 2;
      while (used.has(`${id}-dup${n}`)) n += 1;
      const next = `${id}-dup${n}`;
      used.add(next); seen.add(next);
      return { ...item, id: next };
    });
  }
  return out;
}
