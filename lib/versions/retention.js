// lib/versions/retention.js
// Pure retention planner for `auto` versions (Q-V1). Never sees named / restore / pre_restore versions: callers
// pass only `auto` rows. Framework- and clock-free (the caller supplies `now`) so a fake clock can test it.

import { AUTO_KEEP_ALL_MS, AUTO_DAILY_WINDOW_MS, AUTO_CAP } from './policy';

const DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(t) { return `d${Math.floor(t / DAY_MS)}`; }
// 1970-01-01 was a Thursday; shifting by 3 days makes weeks start on Monday.
function weekKey(t) { return `w${Math.floor((Math.floor(t / DAY_MS) + 3) / 7)}`; }

/**
 * @param {{id: string, createdAt: Date|string|number}[]} autos  `auto` versions of one diagram, any order
 * @param {Date|number} now
 * @returns {string[]} ids to delete
 */
export function planRetention(autos, now) {
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  const rows = autos
    .map((a) => ({ id: a.id, t: new Date(a.createdAt).getTime() }))
    .sort((a, b) => b.t - a.t); // newest first

  const seen = new Set();
  const kept = [];
  const remove = [];
  for (const r of rows) {
    const age = nowMs - r.t;
    let keep;
    if (age <= AUTO_KEEP_ALL_MS) {
      keep = true;
    } else {
      const key = age <= AUTO_DAILY_WINDOW_MS ? dayKey(r.t) : weekKey(r.t);
      keep = !seen.has(key);
      if (keep) seen.add(key);
    }
    if (keep) kept.push(r); else remove.push(r.id);
  }
  for (const r of kept.slice(AUTO_CAP)) remove.push(r.id); // oldest beyond the cap; the newest are never touched
  return remove;
}
