// components/diagram-studio/hooks/utilities/useRafCallback.js
// RAF-throttled callback hook to prevent excessive updates

import { useRef, useCallback, useEffect } from 'react';

/**
 * Creates a RAF-throttled version of a callback.
 * The callback will be called at most once per animation frame.
 *
 * @param {Function} callback - The callback to throttle
 * @param {Array} deps - Dependencies for the callback
 * @returns {Function} - RAF-throttled callback
 */
export function useRafCallback(callback, deps = []) {
  const rafIdRef = useRef(null);
  const pendingArgsRef = useRef(null);
  const callbackRef = useRef(callback);

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  const throttledCallback = useCallback((...args) => {
    pendingArgsRef.current = args;

    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        if (pendingArgsRef.current !== null) {
          callbackRef.current(...pendingArgsRef.current);
          pendingArgsRef.current = null;
        }
      });
    }
  }, deps);

  // Function to cancel pending RAF
  const cancel = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    pendingArgsRef.current = null;
  }, []);

  // Function to flush immediately (cancel RAF and execute)
  const flush = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (pendingArgsRef.current !== null) {
      const args = pendingArgsRef.current;
      pendingArgsRef.current = null;
      callbackRef.current(...args);
    }
  }, []);

  return { callback: throttledCallback, cancel, flush };
}

/**
 * Creates a RAF-based animation loop that calls a callback on each frame.
 *
 * @param {Function} callback - Called on each frame with deltaTime
 * @param {boolean} active - Whether the loop is active
 * @returns {Object} - { start, stop } controls
 */
export function useRafLoop(callback, active = true) {
  const rafIdRef = useRef(null);
  const lastTimeRef = useRef(0);
  const callbackRef = useRef(callback);
  const activeRef = useRef(active);

  // Update refs
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const loop = useCallback((time) => {
    if (!activeRef.current) return;

    const deltaTime = lastTimeRef.current ? time - lastTimeRef.current : 0;
    lastTimeRef.current = time;

    callbackRef.current(deltaTime, time);
    rafIdRef.current = requestAnimationFrame(loop);
  }, []);

  const start = useCallback(() => {
    if (rafIdRef.current === null) {
      lastTimeRef.current = 0;
      rafIdRef.current = requestAnimationFrame(loop);
    }
  }, [loop]);

  const stop = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  // Auto-start/stop based on active prop
  useEffect(() => {
    if (active) {
      start();
    } else {
      stop();
    }
    return stop;
  }, [active, start, stop]);

  return { start, stop };
}

export default useRafCallback;
