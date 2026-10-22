import { createThumbnailScheduler, THUMBNAIL_DEBOUNCE_MS, THUMBNAIL_INTERVAL_MS } from '../../lib/thumbnail';

// Board-load performance: thumbnails are never captured on open; after an edit-save they are debounced, idle-scheduled
// and throttled.
function harness() {
  let t = 0; const timers = new Map(); let id = 0; const idles = [];
  const capture = jest.fn(() => Promise.resolve());
  const s = createThumbnailScheduler({
    capture,
    now: () => t,
    setTimer: (fn, ms) => { id += 1; timers.set(id, { fn, at: t + ms }); return id; },
    clearTimer: (h) => timers.delete(h),
    requestIdle: (fn) => { idles.push(fn); return idles.length; },
    cancelIdle: () => { idles.length = 0; },
  });
  const advance = (ms) => { t += ms; for (const [h, x] of [...timers]) if (x.at <= t) { timers.delete(h); x.fn(); } };
  const runIdle = () => { while (idles.length) idles.shift()(); };
  return { s, capture, advance, runIdle, pending: () => timers.size };
}

test('is not called when a board is opened (its stored lastSaved is only a baseline), nor when the same value repeats', () => {
  const h = harness();
  h.s.observe('d1', 'T0'); h.s.observe('d1', 'T0');
  h.advance(10 * 60 * 1000); h.runIdle();
  expect(h.capture).not.toHaveBeenCalled();
  expect(h.pending()).toBe(0);
});

test('is called once, debounced and only when idle, after an edit-save; several quick saves collapse into one', () => {
  const h = harness();
  h.s.observe('d1', 'T0');
  h.s.observe('d1', 'T1'); h.advance(THUMBNAIL_DEBOUNCE_MS - 1);
  h.s.observe('d1', 'T2'); h.advance(THUMBNAIL_DEBOUNCE_MS - 1);
  expect(h.capture).not.toHaveBeenCalled();
  h.advance(1);
  expect(h.capture).not.toHaveBeenCalled(); // debounce elapsed, but the browser is not idle yet
  h.runIdle();
  expect(h.capture).toHaveBeenCalledTimes(1);
  expect(h.capture).toHaveBeenCalledWith('d1');
});

test('a second edit inside the throttle interval re-arms for the remaining time and still captures the final state', () => {
  const h = harness();
  h.s.observe('d1', 'T0'); h.s.observe('d1', 'T1'); h.advance(THUMBNAIL_DEBOUNCE_MS); h.runIdle();
  h.s.observe('d1', 'T2'); h.advance(THUMBNAIL_DEBOUNCE_MS); h.runIdle();
  expect(h.capture).toHaveBeenCalledTimes(1);
  h.advance(THUMBNAIL_INTERVAL_MS); h.runIdle();
  expect(h.capture).toHaveBeenCalledTimes(2);
});

test('switching boards drops a pending capture and the new board starts from its own baseline', () => {
  const h = harness();
  h.s.observe('d1', 'T0'); h.s.observe('d1', 'T1');
  h.s.observe('d2', 'U0');
  h.advance(THUMBNAIL_DEBOUNCE_MS * 2); h.runIdle();
  expect(h.capture).not.toHaveBeenCalled();
});

test('flush runs a pending capture now (leaving the board), once, and does nothing when nothing is pending', () => {
  const h = harness();
  h.s.observe('d1', 'T0');
  expect(h.s.flush()).toBe(false);
  h.s.observe('d1', 'T1');
  expect(h.s.flush()).toBe(true);
  expect(h.capture).toHaveBeenCalledWith('d1', { flush: true });
  h.advance(THUMBNAIL_DEBOUNCE_MS * 2); h.runIdle();
  expect(h.capture).toHaveBeenCalledTimes(1);
  expect(h.s.flush()).toBe(false);
});

test('flush is still throttled', () => {
  const h = harness();
  h.s.observe('d1', 'T0'); h.s.observe('d1', 'T1'); h.advance(THUMBNAIL_DEBOUNCE_MS); h.runIdle();
  h.s.observe('d1', 'T2');
  expect(h.s.flush()).toBe(false);
  expect(h.capture).toHaveBeenCalledTimes(1);
});

test('with prepare: the image is pre-rendered after a short quiet period (idle), once per edit burst', () => {
  let t = 0; const timers = new Map(); let id = 0; const idles = [];
  const prepare = jest.fn(() => Promise.resolve());
  const s = createThumbnailScheduler({
    capture: jest.fn(), prepare, now: () => t,
    setTimer: (fn, ms) => { id += 1; timers.set(id, { fn, at: t + ms }); return id; },
    clearTimer: (h) => timers.delete(h),
    requestIdle: (fn) => { idles.push(fn); return idles.length; },
    cancelIdle: () => { idles.length = 0; },
  });
  const advance = (ms) => { t += ms; for (const [h, x] of [...timers]) if (x.at <= t) { timers.delete(h); x.fn(); } };
  s.observe('d1', 'T0');
  advance(5000); while (idles.length) idles.shift()();
  expect(prepare).not.toHaveBeenCalled(); // opening prepares nothing
  s.observe('d1', 'T1'); advance(500); s.observe('d1', 'T2'); advance(799);
  expect(prepare).not.toHaveBeenCalled();
  advance(1); while (idles.length) idles.shift()();
  expect(prepare).toHaveBeenCalledTimes(1);
  expect(prepare).toHaveBeenCalledWith('d1');
});
