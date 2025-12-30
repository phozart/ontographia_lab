// components/diagram-studio/hooks/utilities/useDocumentEvents.js
// Safe document-level event listener management

import { useRef, useCallback, useEffect } from 'react';

/**
 * Manages document-level event listeners with proper cleanup.
 * Prevents race conditions between multiple cleanup systems.
 *
 * @returns {Object} - { addListener, removeListener, removeAllListeners }
 */
export function useDocumentEvents() {
  // Track all active listeners for cleanup
  const listenersRef = useRef(new Map());

  /**
   * Add a document event listener with automatic tracking
   * @param {string} eventType - Event type (e.g., 'mousemove', 'mouseup')
   * @param {Function} handler - Event handler
   * @param {Object} options - addEventListener options
   * @returns {string} - Listener ID for manual removal
   */
  const addListener = useCallback((eventType, handler, options = {}) => {
    const id = `${eventType}_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // Store listener info
    listenersRef.current.set(id, {
      eventType,
      handler,
      options,
    });

    // Add the listener
    document.addEventListener(eventType, handler, options);

    return id;
  }, []);

  /**
   * Remove a specific listener by ID
   * @param {string} id - Listener ID returned from addListener
   */
  const removeListener = useCallback((id) => {
    const listenerInfo = listenersRef.current.get(id);
    if (listenerInfo) {
      document.removeEventListener(
        listenerInfo.eventType,
        listenerInfo.handler,
        listenerInfo.options
      );
      listenersRef.current.delete(id);
    }
  }, []);

  /**
   * Remove a listener by event type and handler reference
   * @param {string} eventType - Event type
   * @param {Function} handler - Handler reference to match
   */
  const removeListenerByHandler = useCallback((eventType, handler) => {
    for (const [id, info] of listenersRef.current.entries()) {
      if (info.eventType === eventType && info.handler === handler) {
        document.removeEventListener(eventType, handler, info.options);
        listenersRef.current.delete(id);
        break;
      }
    }
  }, []);

  /**
   * Remove all listeners of a specific event type
   * @param {string} eventType - Event type to remove
   */
  const removeListenersByType = useCallback((eventType) => {
    for (const [id, info] of listenersRef.current.entries()) {
      if (info.eventType === eventType) {
        document.removeEventListener(eventType, info.handler, info.options);
        listenersRef.current.delete(id);
      }
    }
  }, []);

  /**
   * Remove all managed listeners
   */
  const removeAllListeners = useCallback(() => {
    for (const [id, info] of listenersRef.current.entries()) {
      document.removeEventListener(info.eventType, info.handler, info.options);
    }
    listenersRef.current.clear();
  }, []);

  // Cleanup all listeners on unmount
  useEffect(() => {
    return () => {
      removeAllListeners();
    };
  }, [removeAllListeners]);

  return {
    addListener,
    removeListener,
    removeListenerByHandler,
    removeListenersByType,
    removeAllListeners,
  };
}

/**
 * Simplified hook for a single document event listener
 * Automatically adds/removes based on active state
 *
 * @param {string} eventType - Event type
 * @param {Function} handler - Event handler
 * @param {boolean} active - Whether listener is active
 * @param {Object} options - addEventListener options
 */
export function useDocumentEvent(eventType, handler, active = true, options = {}) {
  const handlerRef = useRef(handler);

  // Keep handler ref up to date
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  // Wrapper that calls current handler
  const stableHandler = useCallback((event) => {
    handlerRef.current(event);
  }, []);

  useEffect(() => {
    if (!active) return;

    document.addEventListener(eventType, stableHandler, options);
    return () => {
      document.removeEventListener(eventType, stableHandler, options);
    };
  }, [eventType, stableHandler, active, options]);
}

/**
 * Hook for drag operation document listeners (mousemove + mouseup)
 * Commonly used pattern in canvas interactions
 *
 * @param {Object} handlers - { onMove, onEnd }
 * @param {boolean} active - Whether drag is active
 */
export function useDragListeners(handlers, active) {
  const { onMove, onEnd } = handlers;
  const moveRef = useRef(onMove);
  const endRef = useRef(onEnd);

  // Update refs
  useEffect(() => {
    moveRef.current = onMove;
  }, [onMove]);

  useEffect(() => {
    endRef.current = onEnd;
  }, [onEnd]);

  useEffect(() => {
    if (!active) return;

    const handleMove = (e) => moveRef.current?.(e);
    const handleEnd = (e) => endRef.current?.(e);

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);

    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
    };
  }, [active]);
}

export default useDocumentEvents;
