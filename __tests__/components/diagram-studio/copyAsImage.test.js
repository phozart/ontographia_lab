// Copy as image: scope resolution, ClipboardItem path (image/png), download fallback with an explanatory toast, and the
// Cmd/Ctrl+Shift+C shortcut (canvas copies an image, the doc panel keeps "copy with formatting", typing is left alone).

import React from 'react';
import { render, screen, act } from '@testing-library/react';

let mockElements = [];
let mockSelection = { nodeIds: [], connectionIds: [] };
jest.mock('../../../components/diagram-studio/DiagramContext', () => ({
  useDiagram: () => ({ elements: mockElements, connections: [], selection: mockSelection, updateElement: jest.fn(), diagram: { name: 'My board', short_id: 'LAB-1', access: { role: 'editor' } } }),
}));

import { copyAsImage, resolveImageScope, IMAGE_SCALE } from '../../../components/diagram-studio/export/copyAsImage';
import DocPanelHost from '../../../components/diagram-studio/elements/doc/DocPanelHost';
import { resetDocStore } from '../../../components/diagram-studio/elements/doc/docStore';

const FRAME = { id: 'f1', type: 'frame', x: 0, y: 0, size: { width: 300, height: 200 } };
const A = { id: 'a', type: 'rectangle', x: 0, y: 0, size: { width: 10, height: 10 } };
const B = { id: 'b', type: 'table', x: 0, y: 0, size: { width: 10, height: 10 } };
const PNG = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' });

let written; let render2;
beforeEach(() => {
  resetDocStore();
  mockElements = [FRAME, A, B];
  mockSelection = { nodeIds: [], connectionIds: [] };
  written = null;
  render2 = jest.fn(async () => ({ content: PNG }));
  global.ClipboardItem = class { constructor(items) { this.items = items; } };
  Object.defineProperty(global.navigator, 'clipboard', { value: { write: jest.fn(async (items) => { written = await items[0].items['image/png']; }) }, configurable: true });
  global.URL.createObjectURL = jest.fn(() => 'blob:x');
  global.URL.revokeObjectURL = jest.fn();
});
afterEach(() => { delete global.ClipboardItem; });

test('resolveImageScope: none = board, lone frame = frame, otherwise selection (unknown ids ignored)', () => {
  expect(resolveImageScope({ elements: mockElements, selection: { nodeIds: [] } }).scope).toBe('canvas');
  expect(resolveImageScope({ elements: mockElements, selection: { nodeIds: ['f1'] } })).toMatchObject({ scope: 'frame', frame: FRAME });
  expect(resolveImageScope({ elements: mockElements, selection: { nodeIds: ['a', 'b'] } })).toMatchObject({ scope: 'selection', label: 'selection' });
  expect(resolveImageScope({ elements: mockElements, selection: { nodeIds: ['b'] } }).label).toBe('element');
  expect(resolveImageScope({ elements: mockElements, selection: { nodeIds: ['gone'] } }).scope).toBe('canvas');
});

test('writes image/png to the clipboard, rendering at 2x with padding on white', async () => {
  const r = await copyAsImage({ elements: mockElements, connections: [], selection: { nodeIds: ['a'] }, name: 'B', render: render2 });
  expect(r).toEqual({ ok: true, method: 'clipboard' });
  expect(written.type).toBe('image/png');
  expect(render2).toHaveBeenCalledWith('png', expect.objectContaining({ scope: 'selection', scale: IMAGE_SCALE, background: 'white', padding: expect.any(Number) }));
  expect(IMAGE_SCALE).toBe(2);
});

test('falls back to downloading the PNG when the clipboard blocks images', async () => {
  navigator.clipboard.write = jest.fn().mockRejectedValue(new Error('denied'));
  const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  render(<DocPanelHost />);
  const r = await act(async () => copyAsImage({ elements: mockElements, selection: { nodeIds: [] }, name: 'My board', render: render2 }));
  expect(r).toEqual({ ok: true, method: 'download' });
  expect(click).toHaveBeenCalledTimes(1);
  expect(await screen.findByTestId('doc-toast')).toHaveTextContent(/blocked copying images.*downloaded/i);
  click.mockRestore();
});

test('without ClipboardItem it downloads and says the browser cannot copy images', async () => {
  delete global.ClipboardItem;
  const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  render(<DocPanelHost />);
  await act(async () => { await copyAsImage({ elements: mockElements, selection: { nodeIds: [] }, render: render2 }); });
  expect(await screen.findByTestId('doc-toast')).toHaveTextContent(/cannot copy images/i);
  click.mockRestore();
});

test('a failing renderer reports an error toast', async () => {
  render(<DocPanelHost />);
  navigator.clipboard.write = jest.fn().mockRejectedValue(new Error('x'));
  const r = await act(async () => copyAsImage({ elements: mockElements, selection: { nodeIds: [] }, render: jest.fn().mockRejectedValue(new Error('boom')) }));
  expect(r.ok).toBe(false);
  expect(await screen.findByTestId('doc-toast')).toHaveAttribute('data-kind', 'error');
});

describe('Cmd/Ctrl+Shift+C', () => {
  beforeEach(() => { jest.resetModules(); });
  const key = (target, init) => { const ev = new KeyboardEvent('keydown', { key: 'C', shiftKey: true, ctrlKey: true, bubbles: true, cancelable: true, ...init }); target.dispatchEvent(ev); return ev; };

  test('on the canvas it is claimed (default prevented); plain Ctrl+C and typing in a field are left alone', async () => {
    render(<DocPanelHost />);
    const input = document.createElement('input');
    document.body.appendChild(input);
    expect(key(document.body, {}).defaultPrevented).toBe(true);
    expect(key(document.body, { shiftKey: false, key: 'c' }).defaultPrevented).toBe(false);
    expect(key(input, {}).defaultPrevented).toBe(false);
    input.remove();
    await act(async () => {}); // let the (failing, no canvas in jsdom) render settle into its error toast
  });
});
