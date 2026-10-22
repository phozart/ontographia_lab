// components/diagram-studio/present/PresentMode.js
// Full-screen present mode (ADR-0007 5.3). Read-only: the slide is a static, chrome-free clone of the live canvas
// clipped to the slide frame (the same clone the exports use, so present and export agree), scaled to fit the screen.
// Keyboard: see presentKeys.js. Esc leaves. A focus trap keeps Tab inside the controls. No transitions, so
// prefers-reduced-motion needs nothing special beyond not animating the auto-hiding controls.

import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CloseIcon from '@mui/icons-material/Close';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import NotesIcon from '@mui/icons-material/Notes';
import { buildExportHost } from '../export/captureCanvas';
import { pruneToFrame } from './slideClone';
import { actionForKey, actionForClick, actionForSwipe, moveIndex } from './presentKeys';

const HIDE_CONTROLS_MS = 2000;
const FOCUSABLE = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

const backgroundOf = (frame) => {
  const c = frame?.data?.backgroundColor;
  return typeof c === 'string' && c && c !== 'transparent' ? c : '#ffffff';
};

/**
 * @param {{slides: Array<{slideId: string, frameId: string, frame: object, title: string, notes: string}>,
 *          deckTitle: string, index: number, onIndexChange: (i: number) => void, onExit: () => void,
 *          elements: object[], connections: object[]}} props
 */
export default function PresentMode({ slides, deckTitle, index, onIndexChange, onExit, elements, connections }) {
  const count = slides.length;
  const slide = slides[Math.min(index, Math.max(0, count - 1))] || null;
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const bufferRef = useRef('');
  const stateRef = useRef({});
  const fsRef = useRef({ entered: false, toggled: false });
  const hideTimer = useRef(null);
  const swipe = useRef(null);
  const [black, setBlack] = useState(false);
  const [notesOn, setNotesOn] = useState(false);
  const [controls, setControls] = useState(true);
  const [typed, setTyped] = useState('');
  const [problem, setProblem] = useState(null);
  const [box, setBox] = useState({ w: 1280, h: 720 });

  stateRef.current = { index, count, onIndexChange, onExit, black, notesOn };

  const fw = slide?.frame?.size?.width || 400;
  const fh = slide?.frame?.size?.height || 300;
  const scale = Math.min(box.w / fw, box.h / fh);

  // size of the screen area
  useLayoutEffect(() => {
    const measure = () => setBox({ w: window.innerWidth || 1280, h: window.innerHeight || 720 });
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // focus the dialog; give focus back to what had it when present mode ends
  useEffect(() => {
    const previous = document.activeElement;
    rootRef.current?.focus();
    return () => { if (previous && typeof previous.focus === 'function' && document.contains(previous)) previous.focus(); };
  }, []);

  // full screen (best effort: needs a user gesture, so a deep link just stays windowed)
  useEffect(() => {
    const root = rootRef.current;
    const fs = fsRef.current;
    if (root?.requestFullscreen) {
      Promise.resolve(root.requestFullscreen()).then(() => { fs.entered = true; }).catch(() => {});
    }
    // The browser consumes Esc to leave full screen without a keydown: treat that as leaving the presentation.
    const onChange = () => {
      if (!document.fullscreenElement && fs.entered) {
        fs.entered = false;
        if (fs.toggled) fs.toggled = false; else stateRef.current.onExit();
      }
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      if (document.fullscreenElement) { fs.entered = false; Promise.resolve(document.exitFullscreen?.()).catch(() => {}); }
    };
  }, []);

  // the slide itself: clone the live canvas, clipped to the frame; re-cloned when the board changes under us
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !slide?.frame) return undefined;
    let built;
    try {
      built = buildExportHost({ scope: 'frame', frame: slide.frame, elements, connections, padding: 0, background: 'white' });
    } catch (e) {
      setProblem(e.message || 'This slide could not be shown.');
      return undefined;
    }
    setProblem(null);
    const { host, cleanup } = built;
    // off-slide elements are dropped, and the frame's own dashed outline is board chrome, not slide content
    pruneToFrame(host, slide.frame);
    stage.appendChild(host);
    host.style.setProperty('position', 'absolute', 'important');
    host.style.setProperty('z-index', 'auto', 'important');
    host.style.setProperty('left', '0', 'important');
    host.style.setProperty('top', '0', 'important');
    host.style.setProperty('transform-origin', '0 0', 'important');
    host.style.setProperty('transform', `scale(${scale})`, 'important');
    return cleanup;
  }, [slide?.frameId, slide?.frame, elements, connections, scale]); // eslint-disable-line react-hooks/exhaustive-deps

  const showControls = useCallback(() => {
    setControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControls(false), HIDE_CONTROLS_MS);
  }, []);
  useEffect(() => { showControls(); return () => hideTimer.current && clearTimeout(hideTimer.current); }, [showControls]);

  const toggleFullscreen = useCallback(() => {
    const root = rootRef.current;
    const fs = fsRef.current;
    if (document.fullscreenElement) { fs.toggled = true; Promise.resolve(document.exitFullscreen?.()).catch(() => {}); return; }
    if (root?.requestFullscreen) Promise.resolve(root.requestFullscreen()).then(() => { fs.entered = true; }).catch(() => {});
  }, []);

  const dispatch = useCallback((a) => {
    const s = stateRef.current;
    if (a.type === 'digit') { bufferRef.current = (bufferRef.current + a.digit).slice(0, 3); setTyped(bufferRef.current); return; }
    if (a.type === 'digit-back') { bufferRef.current = bufferRef.current.slice(0, -1); setTyped(bufferRef.current); return; }
    bufferRef.current = '';
    setTyped('');
    if (a.type === 'exit') { s.onExit(); return; }
    if (a.type === 'black') { setBlack((v) => !v); return; }
    if (a.type === 'fullscreen') { toggleFullscreen(); return; }
    if (a.type === 'notes') { setNotesOn((v) => !v); return; }
    const next = moveIndex(s.index, a, s.count);
    if (next !== s.index) s.onIndexChange(next);
    setBlack(false);
  }, [toggleFullscreen]);

  // keyboard: capture phase, so the editor's own shortcuts (V, C, Delete, Cmd+Z...) never fire while presenting
  useEffect(() => {
    const onKey = (e) => {
      e.stopPropagation();
      const root = rootRef.current;
      if (e.key === 'Tab' && root) {
        const items = [...root.querySelectorAll(FOCUSABLE)].filter((n) => n.tabIndex >= 0);
        if (items.length === 0) { e.preventDefault(); root.focus(); return; }
        const first = items[0];
        const last = items[items.length - 1];
        if (!root.contains(document.activeElement) || document.activeElement === root) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
        else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        showControls();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const onButton = e.target && e.target.tagName === 'BUTTON' && (e.key === 'Enter' || e.key === ' ');
      if (onButton) return; // a focused control keeps its own activation
      const a = actionForKey(e.key, bufferRef.current);
      if (!a) return;
      e.preventDefault();
      showControls();
      dispatch(a);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [dispatch, showControls]);

  const onClick = (e) => {
    if (e.target.closest('[data-present-controls]')) return;
    const rect = rootRef.current.getBoundingClientRect();
    const a = actionForClick(e.clientX - rect.left, rect.width);
    if (a) dispatch(a);
  };
  const onPointerDown = (e) => { if (e.pointerType === 'touch') swipe.current = { x: e.clientX, y: e.clientY }; };
  const onPointerUp = (e) => {
    if (!swipe.current) return;
    const a = actionForSwipe(e.clientX - swipe.current.x, e.clientY - swipe.current.y);
    swipe.current = null;
    if (a) dispatch(a);
  };
  const press = (a) => { dispatch(a); rootRef.current?.focus(); };

  return (
    <div
      ref={rootRef}
      className="ds-present"
      role="dialog"
      aria-modal="true"
      aria-label={`Presentation: ${deckTitle}`}
      tabIndex={-1}
      data-testid="present-mode"
      onMouseMove={showControls}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <div className="sr-only" role="status" aria-live="polite" data-testid="present-announce">
        {slide ? `Slide ${Math.min(index, count - 1) + 1} of ${count}: ${slide.title}` : 'There are no slides to present'}
      </div>

      {slide ? (
        <div
          ref={stageRef}
          className="ds-present-stage"
          data-testid="present-stage"
          style={{ width: fw * scale, height: fh * scale, background: backgroundOf(slide.frame), visibility: black ? 'hidden' : 'visible' }}
        />
      ) : (
        <p className="ds-present-empty">There are no slides to present. Add slides to the presentation, or show hidden ones.</p>
      )}
      {problem && <p className="ds-present-problem" role="alert">{problem}</p>}

      {notesOn && slide && (
        <section className="ds-present-notes" role="region" aria-label="Speaker notes" data-testid="present-notes">
          <h2>{slide.title}</h2>
          <p>{slide.notes || 'No notes for this slide.'}</p>
        </section>
      )}
      {typed && <div className="ds-present-goto" role="status">Go to slide {typed} (Enter)</div>}

      <div className={`ds-present-controls ${controls ? 'on' : ''}`} data-present-controls>
        <button type="button" onClick={() => press({ type: 'prev' })} disabled={index <= 0} aria-label="Previous slide"><ArrowBackIcon fontSize="small" /></button>
        <span className="ds-present-count" data-testid="present-counter">{count ? `${Math.min(index, count - 1) + 1} / ${count}` : '0 / 0'}</span>
        <button type="button" onClick={() => press({ type: 'next' })} disabled={index >= count - 1} aria-label="Next slide"><ArrowForwardIcon fontSize="small" /></button>
        <button type="button" onClick={() => press({ type: 'notes' })} aria-label="Speaker notes (N)" aria-pressed={notesOn}><NotesIcon fontSize="small" /></button>
        <button type="button" onClick={() => press({ type: 'fullscreen' })} aria-label="Toggle full screen (F)"><FullscreenIcon fontSize="small" /></button>
        <button type="button" onClick={onExit} aria-label="Exit presentation (Esc)" data-testid="present-exit"><CloseIcon fontSize="small" /></button>
      </div>

      <style jsx>{`
        .ds-present { position: fixed; inset: 0; z-index: 3000; background: #000; display: flex; align-items: center; justify-content: center; outline: none; cursor: default; user-select: none; }
        .ds-present-stage { position: relative; overflow: hidden; flex: none; }
        .ds-present-empty, .ds-present-problem { color: #e5e7eb; font-size: 18px; text-align: center; max-width: 36ch; margin: 0; }
        .ds-present-problem { position: absolute; bottom: 72px; }
        .ds-present-controls { position: absolute; right: 16px; bottom: 16px; display: flex; align-items: center; gap: 6px; padding: 6px 8px; border-radius: 999px; background: rgba(20, 24, 28, 0.82); color: #fff; opacity: 0; pointer-events: none; }
        .ds-present-controls.on, .ds-present-controls:focus-within { opacity: 1; pointer-events: auto; }
        .ds-present-controls button { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 50%; border: 0; background: transparent; color: inherit; cursor: pointer; }
        .ds-present-controls button:hover:not(:disabled) { background: rgba(255, 255, 255, 0.16); }
        .ds-present-controls button:focus-visible { outline: 2px solid var(--accent, #4fb3ce); outline-offset: 1px; }
        .ds-present-controls button:disabled { opacity: 0.35; cursor: default; }
        .ds-present-controls button[aria-pressed='true'] { background: rgba(79, 179, 206, 0.35); }
        .ds-present-count { min-width: 56px; text-align: center; font-size: 13px; font-variant-numeric: tabular-nums; }
        .ds-present-notes { position: absolute; left: 0; right: 0; bottom: 0; max-height: 34vh; overflow: auto; padding: 14px 24px 18px; background: rgba(20, 24, 28, 0.92); color: #f3f4f6; }
        .ds-present-notes h2 { margin: 0 0 6px; font-size: 13px; font-weight: 600; color: #9ca3af; }
        .ds-present-notes p { margin: 0; font-size: 18px; line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere; }
        .ds-present-goto { position: absolute; top: 16px; left: 50%; transform: translateX(-50%); padding: 6px 12px; border-radius: 8px; background: rgba(20, 24, 28, 0.85); color: #fff; font-size: 14px; }
        .sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
        @media (prefers-reduced-motion: reduce) { .ds-present-controls { transition: none; } }
      `}</style>
    </div>
  );
}
