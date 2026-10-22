import { renderHook, act } from '@testing-library/react';
import { THUMBNAIL_DEBOUNCE_MS } from '../../../lib/thumbnail';

const mockRender = jest.fn();
jest.mock('../../../components/diagram-studio/export/thumbnailRenderer', () => ({
  renderThumbnailPng: (...args) => mockRender(...args),
}));

import { useThumbnailCapture } from '../../../components/diagram-studio/hooks/useThumbnailCapture';

const PNG = 'data:image/png;base64,AAAA';
const base = { diagramId: 'd1', elements: [{ id: 'a' }], connections: [], readOnly: false };

beforeEach(() => {
  jest.useFakeTimers();
  mockRender.mockReset();
  mockRender.mockResolvedValue(PNG);
  global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));
});
afterEach(() => jest.useRealTimers());

const puts = () => global.fetch.mock.calls.filter(([, o]) => o?.method === 'PUT');
const settle = async (ms) => { await act(async () => { jest.advanceTimersByTime(ms); }); await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };

test('opening a board never captures (the stored updated_at is only a baseline)', async () => {
  renderHook((p) => useThumbnailCapture(p), { initialProps: { ...base, lastSaved: '2026-01-01T00:00:00Z' } });
  await settle(10 * 60 * 1000);
  expect(mockRender).not.toHaveBeenCalled();
  expect(puts()).toHaveLength(0);
});

test('captures once, debounced, after an edit-save and PUTs the PNG as the thumbnail', async () => {
  const { rerender } = renderHook((p) => useThumbnailCapture(p), { initialProps: { ...base, lastSaved: 's0' } });
  rerender({ ...base, lastSaved: 's1' });
  await settle(THUMBNAIL_DEBOUNCE_MS - 1);
  expect(mockRender).not.toHaveBeenCalled();
  await settle(20000);
  expect(puts()).toHaveLength(1);
  expect(puts()[0][0]).toBe('/api/diagrams/d1');
  expect(JSON.parse(puts()[0][1].body)).toEqual({ thumbnail: PNG });
  expect(mockRender.mock.calls[0][0].elements).toEqual(base.elements);
});

test('does nothing without a save, for read-only, or for an empty canvas', async () => {
  const a = renderHook((p) => useThumbnailCapture(p), { initialProps: { ...base, lastSaved: null } });
  a.rerender({ ...base, lastSaved: null });
  const b = renderHook((p) => useThumbnailCapture(p), { initialProps: { ...base, readOnly: true, lastSaved: 'x' } });
  b.rerender({ ...base, readOnly: true, lastSaved: 'y' });
  const c = renderHook((p) => useThumbnailCapture(p), { initialProps: { ...base, elements: [], lastSaved: 'x' } });
  c.rerender({ ...base, elements: [], lastSaved: 'y' });
  await settle(60000);
  expect(mockRender).not.toHaveBeenCalled();
});

test('skips oversized captures and swallows capture errors', async () => {
  mockRender.mockResolvedValueOnce('data:image/png;base64,' + 'A'.repeat(300 * 1024));
  const a = renderHook((p) => useThumbnailCapture(p), { initialProps: { ...base, lastSaved: 's0' } });
  a.rerender({ ...base, lastSaved: 's1' });
  await settle(60000);
  expect(mockRender).toHaveBeenCalled();
  expect(puts()).toHaveLength(0);

  mockRender.mockRejectedValueOnce(new Error('boom'));
  const b = renderHook((p) => useThumbnailCapture(p), { initialProps: { ...base, diagramId: 'd2', lastSaved: 's0' } });
  b.rerender({ ...base, diagramId: 'd2', lastSaved: 's1' });
  await settle(60000);
  expect(puts()).toHaveLength(0);
});

test('unmounting with a pending capture flushes it instead of losing it', async () => {
  const { rerender, unmount } = renderHook((p) => useThumbnailCapture(p), { initialProps: { ...base, lastSaved: 's0' } });
  rerender({ ...base, lastSaved: 's1' });
  unmount();
  await settle(1000);
  expect(mockRender).toHaveBeenCalledTimes(1);
  expect(puts()).toHaveLength(1);
  expect(puts()[0][1].keepalive).toBe(true);
});

test('hiding the tab flushes a pending capture; with nothing pending nothing happens', async () => {
  const { rerender } = renderHook((p) => useThumbnailCapture(p), { initialProps: { ...base, lastSaved: 's0' } });
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
  await settle(100);
  expect(mockRender).not.toHaveBeenCalled();
  rerender({ ...base, lastSaved: 's1' });
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
  await settle(100);
  expect(puts()).toHaveLength(1);
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
});
