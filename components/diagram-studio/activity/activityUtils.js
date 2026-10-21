// components/diagram-studio/activity/activityUtils.js
// Pure helpers for the Activity tab (ADR-0006 5.3): grouping by day then by actor, collapsing runs of agent edits,
// and the wording of counts, times, compare targets and sharing events. No React, no fetch.

export const AGENT_COLLAPSE_MS = 10 * 60 * 1000;

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** "+12 ~3 −1" from an agent edit's counts (keys starting "added" add, "removed" remove, anything else is a change). */
export function summarizeCounts(counts) {
  if (!counts || typeof counts !== 'object') return '';
  let added = 0; let changed = 0; let removed = 0;
  for (const [k, v] of Object.entries(counts)) {
    if (k.startsWith('added')) added += num(v);
    else if (k.startsWith('removed')) removed += num(v);
    else changed += num(v);
  }
  return [added && `+${added}`, changed && `~${changed}`, removed && `−${removed}`].filter(Boolean).join(' ');
}

const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

export function dayLabel(iso, now = Date.now()) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diffDays = Math.round((startOfDay(now) - startOfDay(t)) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return new Date(t).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric', ...(new Date(t).getFullYear() !== new Date(now).getFullYear() ? { year: 'numeric' } : {}) });
}

const clock = (iso) => new Date(iso).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false });

/** "14:02–14:20" for a burst of saves, "14:02" for a single moment. */
export function sessionTime(startIso, endIso) {
  if (!startIso) return '';
  const a = clock(startIso);
  if (!endIso) return a;
  const b = clock(endIso);
  return a === b ? a : `${a}–${b}`;
}

const sortKey = (item) => new Date(item?.endAt || item?.at || 0).getTime();
const actorKey = (item) => {
  if (!item) return '';
  if (item.kind === 'agent_edit') return `agent:${item.agent?.label || ''}:${item.onBehalfOf?.id || ''}`;
  return `user:${item.actor?.id || item.actor?.name || ''}`;
};

/**
 * @param {object[]} items newest first (the API order)
 * @returns {Array<{day: string, rows: object[]}>} rows are {type: 'item', key, item, sameActorAsPrevious} or
 *   {type: 'agent_group', key, items, label, onBehalfOf, tools, count, summary, at, sameActorAsPrevious}
 */
export function groupActivity(items, now = Date.now()) {
  const list = (Array.isArray(items) ? items : []).filter((i) => i && typeof i === 'object' && i.id);
  const days = [];
  for (const item of list) {
    const day = dayLabel(item.endAt || item.at, now);
    let group = days[days.length - 1];
    if (!group || group.day !== day) { group = { day, rows: [] }; days.push(group); }
    const prev = group.rows[group.rows.length - 1];
    // a run of agent edits by the same agent for the same person, each within 10 minutes of the one before
    if (
      item.kind === 'agent_edit' && prev && (prev.type === 'agent_group' || (prev.type === 'item' && prev.item.kind === 'agent_edit'))
      && actorKey(prev.type === 'agent_group' ? prev.items[0] : prev.item) === actorKey(item)
      && sortKey(prev.type === 'agent_group' ? prev.items[prev.items.length - 1] : prev.item) - sortKey(item) <= AGENT_COLLAPSE_MS
    ) {
      if (prev.type === 'item') {
        const first = prev.item;
        prev.type = 'agent_group';
        prev.items = [first];
        prev.label = first.agent?.label || 'Agent';
        prev.onBehalfOf = first.onBehalfOf || null;
        prev.at = first.at;
        delete prev.item;
      }
      prev.items.push(item);
      continue;
    }
    group.rows.push({ type: 'item', key: item.id, item, sameActorAsPrevious: false });
  }
  for (const g of days) {
    g.rows.forEach((row, i) => {
      if (row.type === 'agent_group') {
        row.key = row.items[0].id;
        row.count = row.items.length;
        row.tools = [...new Set(row.items.map((i) => i.agent?.tool).filter(Boolean).reverse())]; // chronological: oldest first
        const total = {};
        for (const it of row.items) for (const [k, v] of Object.entries(it.counts || {})) total[k] = num(total[k]) + num(v);
        row.summary = summarizeCounts(total);
      }
      const keyOf = (r) => actorKey(r.type === 'agent_group' ? r.items[0] : r.item);
      row.sameActorAsPrevious = i > 0 && keyOf(g.rows[i - 1]) === keyOf(row);
    });
  }
  return days;
}

/**
 * Where "Review" / "Compare" should compare to. An item that is the board's newest state compares against the live
 * board ('head', which also unlocks the canvas overlay); otherwise the version bound the server computed.
 * @returns {{from: number, to: number|'head', approximate: boolean}|null}
 */
export function compareTarget(item, headRevision) {
  const c = item?.compare;
  if (!c || c.from == null) return null;
  const to = item.revision?.to != null && Number(item.revision.to) === Number(headRevision) ? 'head' : c.to;
  return { from: c.from, to, approximate: !!c.approximate };
}

export function describeShare(share) {
  const who = share?.target?.name;
  const role = share?.role;
  switch (share?.action) {
    case 'share.grant': return who ? `shared with ${who}${role ? ` as ${role}` : ''}` : 'shared the board';
    case 'share.change': return who ? `changed ${who}${role ? ` to ${role}` : ''}` : 'changed a role';
    case 'share.revoke': return who ? `removed ${who}` : 'removed access';
    default: return 'changed sharing';
  }
}
