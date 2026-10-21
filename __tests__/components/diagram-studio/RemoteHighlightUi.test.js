// LA-1: rings / ghosts / edge chip components and the highlight lifecycle (fade, reduced motion, expiry).
import { render, screen, act, fireEvent } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import {
  RemoteHighlightLayer, RemoteHighlightChip, useHighlightLifecycle,
} from '../../../components/diagram-studio/ui/RemoteHighlight';

const hl = (over = {}) => ({
  key: 'hl-1', agent: true, who: null, color: '#9A8AC8', collapsed: false, count: 2, union: { x: 0, y: 0, w: 300, h: 100 },
  items: [
    { id: 'a', kind: 'element', rect: { x: 0, y: 0, w: 100, h: 60 } },
    { id: 'gone', kind: 'ghost', rect: { x: 200, y: 0, w: 100, h: 60 } },
    { id: 'k', kind: 'connection', rect: { x: 0, y: 0, w: 300, h: 30 }, points: [{ x: 0, y: 0 }, { x: 300, y: 30 }] },
  ],
  ...over,
});

const mockMotion = (reduce) => {
  window.matchMedia = jest.fn().mockImplementation((q) => ({
    matches: reduce && /prefers-reduced-motion/.test(q), media: q, addEventListener: jest.fn(), removeEventListener: jest.fn(), addListener: jest.fn(), removeListener: jest.fn(),
  }));
};
beforeEach(() => { jest.useFakeTimers(); mockMotion(false); });
afterEach(() => { jest.useRealTimers(); delete window.matchMedia; });

describe('RemoteHighlightLayer', () => {
  it('draws a ring per element, a ghost per removed element and a line per connection, in the highlight color', () => {
    render(<RemoteHighlightLayer highlight={hl()} scale={1} reduced={false} />);
    const rings = screen.getAllByTestId('remote-ring');
    expect(rings.map((r) => r.getAttribute('data-kind')).sort()).toEqual(['connection', 'element', 'ghost']);
    const el = rings.find((r) => r.getAttribute('data-kind') === 'element');
    expect(el.getAttribute('data-agent')).toBe('true');
    expect(el.style.getPropertyValue('--hl-color')).toBe('#9A8AC8');
    expect(el.style.left).toBe('-4px'); // 4 px padding around the element
  });

  it('is aria-hidden and never intercepts the pointer', () => {
    const { container } = render(<RemoteHighlightLayer highlight={hl()} scale={1} reduced={false} />);
    const layer = container.firstChild;
    expect(layer.getAttribute('aria-hidden')).toBe('true');
    expect(layer.style.pointerEvents).toBe('none');
  });

  it('keeps stroke width constant on screen at any zoom', () => {
    render(<RemoteHighlightLayer highlight={hl()} scale={0.5} reduced={false} />);
    const el = screen.getAllByTestId('remote-ring').find((r) => r.getAttribute('data-kind') === 'element');
    expect(parseFloat(el.style.borderWidth)).toBeCloseTo(4); // 2 px on screen at 50 % zoom
  });

  it('reduced motion: static rings, no fade class', () => {
    render(<RemoteHighlightLayer highlight={hl()} scale={1} reduced />);
    const el = screen.getAllByTestId('remote-ring').find((r) => r.getAttribute('data-kind') === 'element');
    expect(el.getAttribute('data-motion')).toBe('reduced');
    expect(el.className).toMatch(/ds-remote-static/);
    expect(el.className).not.toMatch(/ds-remote-fade/);
  });

  it('normal motion: fade class', () => {
    render(<RemoteHighlightLayer highlight={hl()} scale={1} reduced={false} />);
    const el = screen.getAllByTestId('remote-ring').find((r) => r.getAttribute('data-kind') === 'element');
    expect(el.getAttribute('data-motion')).toBe('fade');
    expect(el.className).toMatch(/ds-remote-fade/);
  });

  it('renders nothing for no highlight', () => {
    const { container } = render(<RemoteHighlightLayer highlight={null} scale={1} reduced={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('a collapsed highlight is one ring', () => {
    render(<RemoteHighlightLayer highlight={hl({ collapsed: true, items: [{ id: 'union', kind: 'union', rect: { x: 0, y: 0, w: 900, h: 700 } }] })} scale={1} reduced={false} />);
    expect(screen.getAllByTestId('remote-ring')).toHaveLength(1);
  });
});

describe('useHighlightLifecycle', () => {
  const run = (highlight, enabled = true, onExpire = jest.fn()) => ({ ...renderHook((p) => useHighlightLifecycle(p.h, p.on, onExpire), { initialProps: { h: highlight, on: enabled } }), onExpire });

  it('shows the rings for the fade duration, then hides them; expires the highlight after the chip lifetime', () => {
    const { result, onExpire } = run(hl());
    expect(result.current.ringsOn).toBe(true);
    act(() => { jest.advanceTimersByTime(1500); });
    expect(result.current.ringsOn).toBe(true);
    act(() => { jest.advanceTimersByTime(300); });
    expect(result.current.ringsOn).toBe(false);
    expect(onExpire).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(10000); });
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('reduced motion holds a static ring for 3 s', () => {
    mockMotion(true);
    const { result } = run(hl());
    expect(result.current.reduced).toBe(true);
    act(() => { jest.advanceTimersByTime(2900); });
    expect(result.current.ringsOn).toBe(true);
    act(() => { jest.advanceTimersByTime(300); });
    expect(result.current.ringsOn).toBe(false);
  });

  it('shows nothing when the setting is off', () => {
    const { result } = run(hl(), false);
    expect(result.current.ringsOn).toBe(false);
    expect(result.current.chipOn).toBe(false);
  });

  it('replay restarts the rings', () => {
    const { result } = run(hl());
    act(() => { jest.advanceTimersByTime(2000); });
    expect(result.current.ringsOn).toBe(false);
    act(() => { result.current.replay(); });
    expect(result.current.ringsOn).toBe(true);
    expect(result.current.replayCount).toBe(1);
  });
});

describe('RemoteHighlightChip', () => {
  const summary = { count: 4, direction: 'ne', bbox: { x: 5000, y: -400, w: 300, h: 200 } };

  it('says how many changes are off-screen and pans there on click', () => {
    const onReveal = jest.fn();
    render(<RemoteHighlightChip summary={summary} agent onReveal={onReveal} />);
    const chip = screen.getByRole('button', { name: /4 changes/i });
    expect(chip.textContent).toMatch(/4 changes/);
    expect(chip.textContent).toMatch(/↗/); // north-east arrow
    fireEvent.click(chip);
    expect(onReveal).toHaveBeenCalledWith(summary.bbox);
  });

  it('singular and edge placement', () => {
    render(<RemoteHighlightChip summary={{ count: 1, direction: 'w', bbox: { x: 0, y: 0, w: 1, h: 1 } }} agent={false} onReveal={() => {}} />);
    const chip = screen.getByTestId('remote-chip');
    expect(chip.textContent).toMatch(/1 change /);
    expect(chip.getAttribute('data-direction')).toBe('w');
    expect(chip.style.left).toBe('12px');
  });

  it('renders nothing when there is no summary', () => {
    const { container } = render(<RemoteHighlightChip summary={null} agent onReveal={() => {}} />);
    expect(container.firstChild).toBeNull();
  });
});
