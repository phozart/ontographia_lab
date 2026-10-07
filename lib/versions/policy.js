// lib/versions/policy.js
// Automatic checkpoint policy (ADR-0001 decisions 2 and 6; open-questions Q-V1 / Q-V2). One place for the numbers.

/** An `auto` version is created at most once per interval per diagram (checked against the latest version). */
export const VERSION_AUTO_INTERVAL_MS = 10 * 60 * 1000;

/** Retention of `auto` versions: keep all younger than this ... */
export const AUTO_KEEP_ALL_MS = 24 * 60 * 60 * 1000;
/** ... then one per UTC day until this age ... */
export const AUTO_DAILY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
/** ... then one per ISO week (UTC, Monday start). Hard cap on `auto` versions per diagram. */
export const AUTO_CAP = 100;

/** Session-end checkpoint requests per user and diagram per minute (the throttle itself is skipped for them). */
export const SESSION_END_RATE_LIMIT = { interval: 60 * 1000, limit: 6 };

/** Upper bound on `auto` rows read by one prune pass (the cap keeps the real number near AUTO_CAP). */
export const PRUNE_SCAN_LIMIT = 1000;
