// lib/thumbnail.js
// Shared (client + server) rules for diagram preview thumbnails.

export const MAX_THUMBNAIL_BYTES = 200 * 1024; // 200 KB cap on the stored data URL
export const THUMBNAIL_INTERVAL_MS = 5 * 60 * 1000; // capture at most once per 5 minutes
export const THUMBNAIL_WIDTH = 320;
export const THUMBNAIL_DEBOUNCE_MS = 3000; // quiet period after the last edit-save before a capture is even considered
export const THUMBNAIL_PREPARE_MS = 800; // quiet period after an edit-save before the PNG is pre-rendered (so a flush on leave can send it synchronously)
export const THUMBNAIL_IDLE_TIMEOUT_MS = 10000; // requestIdleCallback timeout: capture at most this long after the debounce

const PNG_DATA_URL_RE = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/;

export function isValidThumbnail(value) {
  return (
    typeof value === 'string' &&
    value.length < MAX_THUMBNAIL_BYTES &&
    PNG_DATA_URL_RE.test(value)
  );
}

/** lastCapturedAt is a ms timestamp (0 = never). */
export function shouldCaptureThumbnail(lastCapturedAt, now = Date.now()) {
  return !lastCapturedAt || now - lastCapturedAt >= THUMBNAIL_INTERVAL_MS;
}

/**
 * Decides WHEN a thumbnail is captured (board-load performance, docs/architecture/investigations/board-load-performance.md):
 *  - never on open: the first `lastSaved` seen for a board (the stored updated_at) is a baseline, not an edit;
 *  - after an edit-save (lastSaved changed): debounced (each further save restarts the quiet period), then idle-scheduled,
 *    then throttled to one capture per THUMBNAIL_INTERVAL_MS (a throttled capture re-arms for the remaining time, so the
 *    final state is still captured);
 *  - switching boards or cancel() drops anything pending.
 * `capture(diagramId)` does the work (render + PUT); timers and idle scheduling are injectable for tests.
 */
export function createThumbnailScheduler({
  capture,
  prepare = null, // optional: pre-render after a short quiet period; capture(id, {flush}) can then send at once
  prepareMs = THUMBNAIL_PREPARE_MS,
  debounceMs = THUMBNAIL_DEBOUNCE_MS,
  idleTimeoutMs = THUMBNAIL_IDLE_TIMEOUT_MS,
  now = Date.now,
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (h) => clearTimeout(h),
  requestIdle = (fn, opts) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, opts) : setTimeout(fn, 0)),
  cancelIdle = (h) => (typeof cancelIdleCallback === 'function' ? cancelIdleCallback(h) : clearTimeout(h)),
} = {}) {
  let boardId = null;
  let baseline;
  let timer = null;
  let idle = null;
  let prepTimer = null;
  let prepIdle = null;
  const lastCaptured = new Map(); // diagramId -> ms

  const drop = () => {
    if (timer !== null) { clearTimer(timer); timer = null; }
    if (idle !== null) { cancelIdle(idle); idle = null; }
    if (prepTimer !== null) { clearTimer(prepTimer); prepTimer = null; }
    if (prepIdle !== null) { cancelIdle(prepIdle); prepIdle = null; }
  };
  const armPrepare = (id) => {
    if (!prepare) return;
    prepTimer = setTimer(() => {
      prepTimer = null;
      prepIdle = requestIdle(() => { prepIdle = null; try { Promise.resolve(prepare(id)).catch(() => {}); } catch { /* best effort */ } }, { timeout: idleTimeoutMs });
    }, prepareMs);
  };
  const arm = (id, ms) => {
    drop();
    timer = setTimer(() => {
      timer = null;
      const wait = THUMBNAIL_INTERVAL_MS - (now() - (lastCaptured.get(id) || 0));
      if (lastCaptured.get(id) && wait > 0) { arm(id, wait); return; }
      idle = requestIdle(() => {
        idle = null;
        lastCaptured.set(id, now()); // claim the slot before the (async) capture so overlapping saves cannot start a second one
        try { Promise.resolve(capture(id)).catch(() => {}); } catch { /* best effort */ }
      }, { timeout: idleTimeoutMs });
    }, ms);
  };

  return {
    /** Call with the current board id and its lastSaved on every change of either. */
    observe(diagramId, lastSaved) {
      if (!diagramId || !lastSaved) return;
      if (diagramId !== boardId) { drop(); boardId = diagramId; baseline = lastSaved; return; } // opening a board: baseline only
      if (lastSaved === baseline) return;
      baseline = lastSaved;
      arm(diagramId, debounceMs);
      armPrepare(diagramId);
    },
    cancel() { drop(); },
    /**
     * Leaving the board (unmount, pagehide, tab hidden): a pending capture runs NOW instead of being lost. Still
     * throttled. Returns true when a capture was started.
     */
    flush() {
      const id = boardId;
      const pending = timer !== null || idle !== null;
      drop();
      if (!pending || !id || !shouldCaptureThumbnail(lastCaptured.get(id), now())) return false;
      lastCaptured.set(id, now());
      try { Promise.resolve(capture(id, { flush: true })).catch(() => {}); } catch { /* best effort */ }
      return true;
    },
  };
}
