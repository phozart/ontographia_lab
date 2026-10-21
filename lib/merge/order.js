// lib/merge/order.js
// Order merge shared by the three-way merge of collections (z-order) and of table rows and columns.
// If the local side did not reorder, the remote order is adopted and local additions are inserted after their
// predecessor; otherwise the local order stays and remote additions are inserted after their predecessor.

function insertAfterPredecessor(skeleton, extras, source) {
  const out = [...skeleton];
  for (const id of extras) {
    const at = source.indexOf(id);
    let placed = false;
    for (let i = at - 1; i >= 0 && !placed; i -= 1) {
      const pos = out.indexOf(source[i]);
      if (pos !== -1) { out.splice(pos + 1, 0, id); placed = true; }
    }
    if (!placed) out.push(id);
  }
  return out;
}

export function mergeOrder(baseIds, oursIds, theirsIds, resultIds) {
  const oursSet = new Set(oursIds);
  const baseSet = new Set(baseIds);
  const theirsSet = new Set(theirsIds);
  const a = baseIds.filter((id) => oursSet.has(id));
  const bOrder = oursIds.filter((id) => baseSet.has(id));
  const localReordered = a.length !== bOrder.length || a.some((id, i) => id !== bOrder[i]);
  let order;
  if (!localReordered) {
    order = insertAfterPredecessor(theirsIds, oursIds.filter((id) => !theirsSet.has(id)), oursIds);
  } else {
    order = insertAfterPredecessor(oursIds, theirsIds.filter((id) => !oursSet.has(id)), theirsIds);
  }
  return order.filter((id) => resultIds.has(id));
}

