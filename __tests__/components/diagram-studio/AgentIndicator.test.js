// LA-2: the agent pill (top bar), its popover, and the dashed read-focus box (ADR-0006 5.1, 5.2).
import { render, screen, fireEvent, act, renderHook } from '@testing-library/react';
import {
  AgentIndicator, AgentFocusLayer, useAgentFocus, describeTool, formatAge, FOCUS_BOX_MS,
} from '../../../components/diagram-studio/ui/AgentIndicator';

const agent = (over = {}) => ({ key: 'k1', label: 'Claude', state: 'reading', tool: 'diagram_get', lastAt: 1000, ageMs: 2000, mine: true, forUser: { id: 'u', name: 'Peter' }, ...over });

beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); });

describe('describeTool / formatAge', () => {
  it('speaks plain language for known tools and falls back safely', () => {
    expect(describeTool('map_structure')).toBe('mapped a structure');
    expect(describeTool('board_read_region')).toBe('read a region');
    expect(describeTool('totally_new_tool')).toBe('used totally_new_tool');
    expect(describeTool(undefined)).toBe('');
  });
  it('formats ages', () => {
    expect(formatAge(1200)).toBe('just now');
    expect(formatAge(12_000)).toBe('12 s ago');
    expect(formatAge(95_000)).toBe('1 min ago');
  });
});

describe('AgentIndicator pill', () => {
  it('renders nothing when no agent is around', () => {
    const { container } = render(<AgentIndicator agents={[]} />);
    expect(container.firstChild).toBeNull();
    const { container: c2 } = render(<AgentIndicator agents={undefined} />);
    expect(c2.firstChild).toBeNull();
  });

  it('says "Claude · reading" and "Claude · editing" with a state attribute', () => {
    const { rerender } = render(<AgentIndicator agents={[agent()]} />);
    const pill = screen.getByTestId('agent-pill');
    expect(pill.textContent).toMatch(/Claude/);
    expect(pill.textContent).toMatch(/reading/);
    expect(pill.getAttribute('data-state')).toBe('reading');
    rerender(<AgentIndicator agents={[agent({ state: 'editing', tool: 'map_structure' })]} />);
    expect(screen.getByTestId('agent-pill').textContent).toMatch(/editing/);
    expect(screen.getByTestId('agent-pill').getAttribute('data-state')).toBe('editing');
  });

  it('a recent agent is muted and shows how long ago', () => {
    render(<AgentIndicator agents={[agent({ state: 'recent', ageMs: 45_000 })]} />);
    const pill = screen.getByTestId('agent-pill');
    expect(pill.getAttribute('data-state')).toBe('recent');
    expect(pill.textContent).toMatch(/45 s ago/);
  });

  it('shows the most recent agent and a +n count for the others', () => {
    render(<AgentIndicator agents={[agent({ key: 'a', label: 'Agent for Anna', mine: false, state: 'editing' }), agent({ key: 'b', label: 'Claude' })]} />);
    expect(screen.getByTestId('agent-pill').textContent).toMatch(/Agent for Anna/);
    expect(screen.getByTestId('agent-pill').textContent).toMatch(/\+1/);
  });

  it('uses lavender (the agent color) and never relies on color alone (text states the activity)', () => {
    render(<AgentIndicator agents={[agent()]} />);
    expect(screen.getByTestId('agent-pill').style.getPropertyValue('--agent-color').toLowerCase()).toBe('#9a8ac8');
  });

  it('the popover shows the last tool and time, and Review only when a change can be reviewed', () => {
    const onReview = jest.fn();
    const { rerender } = render(<AgentIndicator agents={[agent({ state: 'editing', tool: 'map_structure', ageMs: 4000 })]} canReview onReview={onReview} />);
    const pill = screen.getByTestId('agent-pill');
    expect(pill.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(pill);
    expect(pill.getAttribute('aria-expanded')).toBe('true');
    const pop = screen.getByTestId('agent-popover');
    expect(pop.textContent).toMatch(/mapped a structure/);
    expect(pop.textContent).toMatch(/just now/);
    fireEvent.click(screen.getByRole('button', { name: /Review/i }));
    expect(onReview).toHaveBeenCalledTimes(1);
    rerender(<AgentIndicator agents={[agent({ state: 'editing' })]} canReview={false} />);
    expect(screen.queryByRole('button', { name: /Review/i })).toBeNull();
  });

  it('offers "Open activity" only when the host provides it', () => {
    const onOpenActivity = jest.fn();
    const { rerender } = render(<AgentIndicator agents={[agent()]} />);
    fireEvent.click(screen.getByTestId('agent-pill'));
    expect(screen.queryByRole('button', { name: /Open activity/i })).toBeNull();
    rerender(<AgentIndicator agents={[agent()]} onOpenActivity={onOpenActivity} />);
    fireEvent.click(screen.getByRole('button', { name: /Open activity/i }));
    expect(onOpenActivity).toHaveBeenCalled();
  });

  it('Escape closes the popover', () => {
    render(<AgentIndicator agents={[agent()]} />);
    fireEvent.click(screen.getByTestId('agent-pill'));
    expect(screen.getByTestId('agent-popover')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('agent-popover')).toBeNull();
  });

  it('announces politely (status region), not assertively', () => {
    render(<AgentIndicator agents={[agent()]} />);
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite');
  });
});

describe('read focus box', () => {
  const reading = (focus, over = {}) => agent({ state: 'reading', focus, ...over });

  it('shows a dashed lavender rectangle labeled "<label> is reading" for 5 s', () => {
    const f = { x: 10, y: 20, w: 300, h: 200 };
    const { result } = renderHook(({ a }) => useAgentFocus(a), { initialProps: { a: [reading(f)] } });
    expect(result.current).toEqual([expect.objectContaining({ rect: f, label: 'Claude is reading' })]);
    act(() => { jest.advanceTimersByTime(FOCUS_BOX_MS - 100); });
    expect(result.current).toHaveLength(1);
    act(() => { jest.advanceTimersByTime(200); });
    expect(result.current).toEqual([]);
  });

  it('a new read (new lastAt) shows the box again; the same read does not', () => {
    const f = { x: 0, y: 0, w: 10, h: 10 };
    const { result, rerender } = renderHook(({ a }) => useAgentFocus(a), { initialProps: { a: [reading(f, { lastAt: 1 })] } });
    act(() => { jest.advanceTimersByTime(FOCUS_BOX_MS + 100); });
    expect(result.current).toEqual([]);
    rerender({ a: [reading(f, { lastAt: 1 })] });
    expect(result.current).toEqual([]);
    rerender({ a: [reading(f, { lastAt: 2 })] });
    expect(result.current).toHaveLength(1);
  });

  it('never shows a box for agents that are not "mine" or have no focus', () => {
    const f = { x: 0, y: 0, w: 10, h: 10 };
    const { result } = renderHook(() => useAgentFocus([reading(f, { mine: false }), reading(undefined)]));
    expect(result.current).toEqual([]);
  });

  it('AgentFocusLayer draws it dashed in lavender, aria-hidden, without pointer events, constant 2 px on screen', () => {
    const { container } = render(<AgentFocusLayer boxes={[{ id: 'k1:1', rect: { x: 10, y: 20, w: 300, h: 200 }, label: 'Claude is reading' }]} scale={0.5} />);
    expect(container.firstChild.getAttribute('aria-hidden')).toBe('true');
    expect(container.firstChild.style.pointerEvents).toBe('none');
    const box = screen.getByTestId('agent-focus-box');
    expect(box.style.borderStyle).toBe('dashed');
    expect(box.style.borderColor.toLowerCase()).toMatch(/154, 138, 200|#9a8ac8/);
    expect(parseFloat(box.style.borderWidth)).toBeCloseTo(4);
    expect(box.textContent).toMatch(/Claude is reading/);
  });

  it('AgentFocusLayer renders nothing without boxes', () => {
    const { container } = render(<AgentFocusLayer boxes={[]} scale={1} />);
    expect(container.firstChild).toBeNull();
  });
});
