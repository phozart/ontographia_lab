// ADR-0007 P1 component tests: the slide frame, the Presentation panel, present mode (keyboard, focus trap, a11y) and
// the frame toolbar actions. The canvas clone is mocked (buildExportHost); the e2e test covers the real clone.

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

jest.mock('../../../components/diagram-studio/export/captureCanvas', () => ({
  buildExportHost: jest.fn(({ frame }) => {
    const host = document.createElement('div');
    host.setAttribute('data-testid', 'clone');
    host.setAttribute('data-frame', frame.id);
    document.body.appendChild(host);
    return { host, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, cleanup: () => host.remove() };
  }),
}));
let mockCtx;
jest.mock('../../../components/diagram-studio/DiagramContext', () => ({
  useDiagram: () => mockCtx,
}));

import PresentMode from '../../../components/diagram-studio/present/PresentMode';
import PresentationPanel from '../../../components/diagram-studio/present/PresentationPanel';
import SlideFrameActions from '../../../components/diagram-studio/present/SlideFrameActions';
import { resetPresentState, getPresentState } from '../../../components/diagram-studio/present/presentStore';
import { renderNode } from '../../../components/diagram-studio/packs/CorePack';
import { buildExportHost } from '../../../components/diagram-studio/export/captureCanvas';
import CompareSummary from '../../../components/diagram-studio/ui/CompareSummary';
import { pruneToFrame } from '../../../components/diagram-studio/present/slideClone';

const frame = (id, x = 0, label = id, extra = {}) => ({ id, type: 'frame', packId: 'core', x, y: 0, size: { width: 1920, height: 1080 }, label, ...extra });
const slide = (n, title, notes = '') => ({ slideId: `s${n}`, frameId: `f${n}`, frame: frame(`f${n}`, n * 2000, title), title, notes });
const SLIDES = [slide(1, 'Problem', 'Open with the number'), slide(2, 'Funnel'), slide(3, 'Next steps')];

function present(over = {}) {
  const props = { slides: SLIDES, deckTitle: 'Review', index: 0, onIndexChange: jest.fn(), onExit: jest.fn(), elements: [], connections: [], ...over };
  const utils = render(<PresentMode {...props} />);
  return { ...utils, props };
}
const keydown = (key, opts = {}) => act(() => { fireEvent.keyDown(window, { key, ...opts }); });

beforeEach(() => { jest.clearAllMocks(); resetPresentState(); });

describe('present mode', () => {
  test('is a modal dialog with the slide counter and a live announcement', () => {
    present({ index: 1 });
    const dialog = screen.getByRole('dialog', { name: 'Presentation: Review' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByTestId('present-counter')).toHaveTextContent('2 / 3');
    expect(screen.getByTestId('present-announce')).toHaveTextContent('Slide 2 of 3: Funnel');
    expect(screen.getByTestId('present-announce')).toHaveAttribute('aria-live', 'polite');
    expect(document.activeElement).toBe(dialog);
  });

  test('clones the live canvas clipped to the current slide frame, and re-clones when the slide changes', () => {
    const { rerender, props } = present();
    expect(buildExportHost).toHaveBeenLastCalledWith(expect.objectContaining({ scope: 'frame', padding: 0, frame: SLIDES[0].frame }));
    expect(screen.getByTestId('present-stage').querySelector('[data-frame="f1"]')).not.toBeNull();
    rerender(<PresentMode {...props} index={2} />);
    expect(screen.getByTestId('present-stage').querySelector('[data-frame="f3"]')).not.toBeNull();
    expect(document.querySelectorAll('[data-testid="clone"]')).toHaveLength(1); // the previous clone is cleaned up
  });

  test.each([
    ['ArrowRight', 1, 2], [' ', 1, 2], ['PageDown', 1, 2], ['ArrowDown', 1, 2], ['Enter', 1, 2],
    ['ArrowLeft', 1, 0], ['PageUp', 1, 0], ['ArrowUp', 1, 0], ['Backspace', 1, 0],
    ['Home', 2, 0], ['End', 0, 2],
  ])('%s moves from slide index %i to %i', (k, from, to) => {
    const { props } = present({ index: from });
    keydown(k);
    expect(props.onIndexChange).toHaveBeenCalledWith(to);
  });

  test('does not move past the ends', () => {
    const { props } = present({ index: 0 });
    keydown('ArrowLeft');
    expect(props.onIndexChange).not.toHaveBeenCalled();
    const second = present({ index: 2 });
    keydown('ArrowRight');
    expect(second.props.onIndexChange).not.toHaveBeenCalled();
  });

  test('a slide number then Enter jumps to it', () => {
    const { props } = present();
    keydown('3');
    expect(screen.getByText('Go to slide 3 (Enter)')).toBeInTheDocument();
    keydown('Enter');
    expect(props.onIndexChange).toHaveBeenCalledWith(2);
  });

  test('Escape leaves; N shows the notes for the current slide; B blacks the stage out', () => {
    const { props } = present();
    keydown('n');
    expect(screen.getByRole('region', { name: 'Speaker notes' })).toHaveTextContent('Open with the number');
    keydown('n');
    expect(screen.queryByRole('region', { name: 'Speaker notes' })).toBeNull();
    keydown('b');
    expect(screen.getByTestId('present-stage')).toHaveStyle({ visibility: 'hidden' });
    keydown('b');
    expect(screen.getByTestId('present-stage')).toHaveStyle({ visibility: 'visible' });
    keydown('Escape');
    expect(props.onExit).toHaveBeenCalledTimes(1);
  });

  test('no notes: says so', () => {
    present({ index: 1 });
    keydown('n');
    expect(screen.getByRole('region', { name: 'Speaker notes' })).toHaveTextContent('No notes for this slide.');
  });

  test('editor shortcuts never see the keys while presenting', () => {
    const editor = jest.fn();
    window.addEventListener('keydown', editor); // the editor registers on window (bubble phase)
    present();
    keydown('v');
    keydown('Delete');
    keydown('z', { ctrlKey: true });
    keydown('ArrowRight');
    window.removeEventListener('keydown', editor);
    expect(editor).not.toHaveBeenCalled();
  });

  test('Tab stays inside the dialog (focus trap), forwards and backwards', () => {
    present({ index: 1 });
    const dialog = screen.getByRole('dialog');
    const buttons = [...dialog.querySelectorAll('button:not([disabled])')];
    expect(buttons.length).toBeGreaterThan(2);
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    last.focus();
    keydown('Tab');
    expect(document.activeElement).toBe(first);
    first.focus();
    keydown('Tab', { shiftKey: true });
    expect(document.activeElement).toBe(last);
    dialog.focus();
    keydown('Tab');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  test('the controls work with the mouse: next, previous, exit; the left and right thirds of the screen navigate', () => {
    const { props } = present({ index: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(props.onIndexChange).toHaveBeenLastCalledWith(2);
    fireEvent.click(screen.getByRole('button', { name: 'Previous slide' }));
    expect(props.onIndexChange).toHaveBeenLastCalledWith(0);
    fireEvent.click(screen.getByRole('button', { name: /Exit presentation/ }));
    expect(props.onExit).toHaveBeenCalled();
    const dialog = screen.getByRole('dialog');
    dialog.getBoundingClientRect = () => ({ left: 0, width: 900, top: 0, height: 500 });
    props.onIndexChange.mockClear();
    fireEvent.click(dialog, { clientX: 800 });
    expect(props.onIndexChange).toHaveBeenCalledWith(2);
    fireEvent.click(dialog, { clientX: 450 });
    expect(props.onIndexChange).toHaveBeenCalledTimes(1);
  });

  test('a focused control keeps its own Enter and Space (they do not also advance the slide)', () => {
    const { props } = present({ index: 1 });
    const exit = screen.getByRole('button', { name: /Exit presentation/ });
    exit.focus();
    act(() => { fireEvent.keyDown(exit, { key: 'Enter' }); });
    expect(props.onIndexChange).not.toHaveBeenCalled();
  });

  test('swipe left goes next (touch)', () => {
    const { props } = present();
    const dialog = screen.getByRole('dialog');
    // jsdom has no PointerEvent: build the events by hand
    const pointer = (type, props) => { const e = new Event(type, { bubbles: true }); Object.assign(e, { pointerType: 'touch', ...props }); act(() => { dialog.dispatchEvent(e); }); };
    pointer('pointerdown', { clientX: 300, clientY: 100 });
    pointer('pointerup', { clientX: 100, clientY: 110 });
    expect(props.onIndexChange).toHaveBeenCalledWith(1);
  });

  test('no slides: a message and a working exit, nothing is cloned', () => {
    const { props } = present({ slides: [] });
    expect(screen.getByText(/^There are no slides to present\. /)).toBeInTheDocument();
    expect(screen.getByTestId('present-counter')).toHaveTextContent('0 / 0');
    keydown('Escape');
    expect(props.onExit).toHaveBeenCalled();
    expect(buildExportHost).not.toHaveBeenCalled();
  });

  test('restores focus to the element that had it when present mode ends', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const { unmount } = present();
    expect(document.activeElement).not.toBe(opener);
    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});

describe('slide clone pruning', () => {
  const node = (id, x, y, w, h) => {
    const n = document.createElement('div');
    n.setAttribute('data-node-id', id);
    Object.assign(n.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
    return n;
  };
  test('keeps what touches the frame, removes the rest, and hides the frame outline', () => {
    const host = document.createElement('div');
    const f = frame('f', 1000);
    const fn = node('f', 1000, 0, 1920, 1080);
    fn.innerHTML = '<svg><rect stroke-dasharray="8 4" stroke="#000"/></svg>';
    host.append(fn, node('in', 1100, 100, 50, 50), node('edge', 2900, 500, 200, 50), node('out', 5000, 100, 50, 50), node('left', 0, 0, 100, 100));
    expect(pruneToFrame(host, f)).toBe(2);
    expect([...host.querySelectorAll('[data-node-id]')].map((n) => n.getAttribute('data-node-id'))).toEqual(['f', 'in', 'edge']);
    expect(host.querySelector('rect').getAttribute('stroke')).toBe('none');
  });
});

describe('slide frame rendering', () => {
  const dashed = (el) => !!render(renderNode(el, { id: 'frame' }, false)).container.querySelector('rect[stroke-dasharray]');
  test('an ordinary frame keeps the dashed outline; a slide frame is a solid, square-cornered slide', () => {
    expect(dashed(frame('a'))).toBe(true);
    expect(dashed(frame('b', 0, 'b', { data: { aspect: 'free' } }))).toBe(true);
    expect(dashed(frame('c', 0, 'c', { data: { aspect: '16:9' } }))).toBe(false);
  });
});

describe('Presentation panel', () => {
  const content = (over = {}) => ({
    elements: [frame('f1', 0, 'Problem'), frame('f2', 2000, 'Funnel'), frame('f3', 4000, 'Next')],
    connections: [],
    presentations: [{ id: 'p1', title: 'Review', aspect: '16:9', slides: [{ id: 's1', frameId: 'f1', notes: 'hello' }, { id: 's2', frameId: 'f2', hidden: true }, { id: 's3', frameId: 'gone' }] }],
    ...over,
  });
  function panel(over = {}) {
    const props = {
      open: true, onClose: jest.fn(), content: content(), activeId: 'p1', onActiveChange: jest.fn(), canEdit: true, selectedFrameIds: [],
      patchPresentation: jest.fn(() => ({ ok: true, presentationId: 'p1' })), addElement: jest.fn(), removeElement: jest.fn(), getLiveElements: () => [],
      onPresent: jest.fn(), onExportPdf: jest.fn(), onExportPng: jest.fn(), onRevealFrame: jest.fn(), exporting: null, onCancelExport: jest.fn(), exportError: null,
      ...over,
    };
    return { ...render(<PresentationPanel {...props} />), props };
  }

  test('lists the slides in order: hidden and missing slides are marked', () => {
    panel();
    const rows = screen.getAllByTestId('pp-slide');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('Problem');
    expect(rows[1]).toHaveTextContent('Hidden');
    expect(rows[2]).toHaveTextContent(/Missing slide: its frame was deleted/);
    expect(screen.getByRole('button', { name: 'Present from slide 3' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Download slide 3 as PNG' })).toBeDisabled();
  });

  test('Present starts at slide 1; "present from here" uses the playable index', () => {
    const { props } = panel();
    fireEvent.click(screen.getByTestId('pp-present'));
    expect(props.onPresent).toHaveBeenCalledWith('p1', 0);
    fireEvent.click(screen.getByRole('button', { name: 'Present from slide 1' }));
    expect(props.onPresent).toHaveBeenLastCalledWith('p1', 0);
  });

  test('Present and Export are disabled when nothing is playable', () => {
    panel({ content: content({ presentations: [{ id: 'p1', title: 'Empty', aspect: '16:9', slides: [{ id: 's3', frameId: 'gone' }] }] }) });
    expect(screen.getByTestId('pp-present')).toBeDisabled();
    expect(screen.getByTestId('pp-export-pdf')).toBeDisabled();
  });

  test('reorder with the move buttons sends one order patch; the ends are disabled', () => {
    const { props } = panel();
    expect(screen.getByRole('button', { name: 'Move slide 1 up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move slide 3 down' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Move slide 2 up' }));
    expect(props.patchPresentation).toHaveBeenCalledWith({ id: 'p1', order: ['s2', 's1', 's3'] });
  });

  test('drag and drop reorders', () => {
    const { props } = panel();
    const rows = screen.getAllByTestId('pp-slide');
    fireEvent.dragStart(rows[2]);
    fireEvent.dragOver(rows[0]);
    fireEvent.drop(rows[0]);
    expect(props.patchPresentation).toHaveBeenCalledWith({ id: 'p1', order: ['s3', 's1', 's2'] });
  });

  test('hide / show and notes (committed on blur, not on every key)', () => {
    const { props } = panel();
    fireEvent.click(screen.getByRole('button', { name: 'Show slide 2' }));
    expect(props.patchPresentation).toHaveBeenCalledWith({ id: 'p1', updateSlides: [{ slideId: 's2', hidden: false }] });
    props.patchPresentation.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Notes for slide 1' }));
    const box = screen.getByLabelText('Speaker notes for slide 1');
    expect(box).toHaveValue('hello');
    fireEvent.change(box, { target: { value: 'hello world' } });
    expect(props.patchPresentation).not.toHaveBeenCalled();
    fireEvent.blur(box);
    expect(props.patchPresentation).toHaveBeenCalledWith({ id: 'p1', updateSlides: [{ slideId: 's1', notes: 'hello world' }] });
  });

  test('removing a slide whose frame exists asks: slide only, or delete the frame too', () => {
    const { props } = panel();
    fireEvent.click(screen.getByRole('button', { name: 'Remove slide 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove slide only' }));
    expect(props.patchPresentation).toHaveBeenCalledWith({ id: 'p1', removeSlideIds: ['s1'] });
    expect(props.removeElement).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Remove slide 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete frame too' }));
    expect(props.removeElement).toHaveBeenCalledWith('f2');
  });

  test('a missing slide is removed without asking', () => {
    const { props } = panel();
    fireEvent.click(screen.getByRole('button', { name: 'Remove slide 3' }));
    expect(props.patchPresentation).toHaveBeenCalledWith({ id: 'p1', removeSlideIds: ['s3'] });
  });

  test('Add selected frame is enabled only with a frame selected and adds it to the active deck', () => {
    const { props, rerender } = panel();
    expect(screen.getByTestId('pp-add-selected')).toBeDisabled();
    rerender(<PresentationPanel {...props} selectedFrameIds={['f3']} />);
    fireEvent.click(screen.getByTestId('pp-add-selected'));
    expect(props.patchPresentation).toHaveBeenCalledWith({ id: 'p1', insertSlides: [{ frameId: 'f3' }] });
  });

  test('Add slide creates a 16:9 frame and the slide; with no deck it creates "Presentation 1" first', () => {
    const calls = [];
    const patchPresentation = jest.fn((p) => { calls.push(p); return { ok: true, presentationId: 'new' }; });
    const addElement = jest.fn((e) => ({ id: 'newframe', ...e }));
    panel({ content: content({ presentations: [] }), activeId: null, patchPresentation, addElement });
    fireEvent.click(screen.getByTestId('pp-add-slide'));
    expect(calls[0]).toEqual({ create: { title: 'Presentation 1' } });
    expect(addElement).toHaveBeenCalledWith(expect.objectContaining({ type: 'frame', size: { width: 1920, height: 1080 }, data: expect.objectContaining({ aspect: '16:9' }) }));
    expect(calls[1]).toEqual({ id: 'new', insertSlides: [{ frameId: 'newframe' }] });
  });

  test('a viewer sees the deck, Present and Export, but no editing control', () => {
    panel({ canEdit: false });
    expect(screen.getByTestId('pp-present')).toBeInTheDocument();
    expect(screen.getByTestId('pp-export-pdf')).toBeInTheDocument();
    expect(screen.queryByTestId('pp-add-slide')).toBeNull();
    expect(screen.queryByTestId('pp-add-selected')).toBeNull();
    expect(screen.queryByRole('button', { name: /Move slide/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Remove slide/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Hide slide|Show slide/ })).toBeNull();
    expect(screen.queryByLabelText('Presentation title')).toBeNull();
    expect(screen.getAllByTestId('pp-slide')[0]).toHaveAttribute('draggable', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Notes for slide 1' }));
    expect(screen.getByLabelText('Speaker notes for slide 1')).toBeDisabled();
  });

  test('export progress with cancel, and export errors are announced', () => {
    const { props } = panel({ exporting: { done: 1, total: 3 }, exportError: 'The export failed.' });
    expect(screen.getByText(/Exporting slide 2 of 3/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onCancelExport).toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('The export failed.');
    expect(screen.getByTestId('pp-export-pdf')).toBeDisabled();
  });

  test('an export note says what the export left out', () => {
    panel({ exportNote: '1 slide exported; 2 skipped (hidden or missing).' });
    expect(screen.getByTestId('pp-export-note')).toHaveTextContent('2 skipped');
  });

  test('Escape closes; closed renders nothing', () => {
    const { props, rerender } = panel();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalled();
    rerender(<PresentationPanel {...props} open={false} />);
    expect(screen.queryByTestId('presentation-panel')).toBeNull();
  });

  test('a patch error is shown, not thrown', () => {
    panel({ patchPresentation: jest.fn(() => ({ ok: false, errors: ['A presentation holds at most 200 slides'] })) });
    fireEvent.click(screen.getByRole('button', { name: 'Move slide 2 up' }));
    expect(screen.getByRole('alert')).toHaveTextContent('at most 200 slides');
  });
});

describe('frame toolbar: slide shape and Add to presentation', () => {
  beforeEach(() => {
    mockCtx = {
      diagram: { access: { role: 'editor', capabilities: ['diagram.read', 'diagram.write'] } },
      presentations: [], patchPresentation: jest.fn(() => ({ ok: true, presentationId: 'p9' })), updateElement: jest.fn(),
    };
  });
  const small = frame('f1', 0, 'F', { size: { width: 600, height: 400 }, data: { backgroundColor: '#fff' } });

  test('the shape presets grow the frame to the ratio and keep its other data', () => {
    render(<SlideFrameActions frame={small} />);
    fireEvent.click(screen.getByTestId('frame-slide-shape'));
    fireEvent.click(screen.getByTestId('frame-shape-16x9'));
    expect(mockCtx.updateElement).toHaveBeenCalledWith('f1', { size: { width: 711, height: 400 }, data: { backgroundColor: '#fff', aspect: '16:9' } });
  });

  test('offers 16:9, 4:3, 1:1 and free, with the current shape checked', () => {
    render(<SlideFrameActions frame={frame('f1', 0, 'F', { data: { aspect: '4:3' } })} />);
    fireEvent.click(screen.getByTestId('frame-slide-shape'));
    const items = screen.getAllByRole('menuitemradio');
    expect(items.map((i) => i.textContent)).toEqual(['16:9 slide', '4:3 slide', '1:1 slide', 'Free shape']);
    expect(items.find((i) => i.getAttribute('aria-checked') === 'true')).toHaveTextContent('4:3 slide');
  });

  test('Add to presentation creates the first deck, adds the frame and opens the panel on it', () => {
    render(<SlideFrameActions frame={small} />);
    fireEvent.click(screen.getByTestId('frame-add-to-presentation'));
    expect(mockCtx.patchPresentation).toHaveBeenNthCalledWith(1, { create: { title: 'Presentation 1' } });
    expect(mockCtx.patchPresentation).toHaveBeenNthCalledWith(2, { id: 'p9', insertSlides: [{ frameId: 'f1' }] });
    expect(getPresentState()).toMatchObject({ panelOpen: true, activeId: 'p9' });
  });

  test('read-only roles get nothing', () => {
    mockCtx.diagram.access = { role: 'viewer', capabilities: ['diagram.read'] };
    const { container } = render(<SlideFrameActions frame={small} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('Compare (History panel)', () => {
  test('a changed deck is listed under Presentations with what changed (order, notes)', () => {
    const diff = { to: { number: 5 }, summary: { added: 0, removed: 0, changed: 1 }, changes: [{ id: 'p1', kind: 'presentation', change: 'changed', fields: ['notes', 'order'], label: 'Review' }] };
    render(<CompareSummary diff={diff} against="head" fromTitle="Version 3" onToggleOverlay={() => {}} />);
    expect(screen.getByText('Presentations')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
    expect(screen.getByText('changed: notes, order')).toBeInTheDocument();
  });
});
