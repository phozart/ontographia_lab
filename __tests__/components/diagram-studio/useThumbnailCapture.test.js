import { renderHook, act, waitFor } from '@testing-library/react';
import { THUMBNAIL_INTERVAL_MS } from '../../../lib/thumbnail';

const mockRenderPreview = jest.fn();
jest.mock('../../../components/diagram-studio/export/exportRenderer', () => ({
  renderPreview: (...args) => mockRenderPreview(...args),
  nextFrames: () => Promise.resolve(),
}));

import { useThumbnailCapture } from '../../../components/diagram-studio/hooks/useThumbnailCapture';

const PNG = 'data:image/png;base64,AAAA';
const base = { diagramId: 'd1', elements: [{ id: 'a' }], connections: [], readOnly: false };

beforeEach(() => {
  mockRenderPreview.mockReset();
  mockRenderPreview.mockResolvedValue({ dataUrl: PNG });
  global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));
});

const puts = () => global.fetch.mock.calls.filter(([, o]) => o?.method === 'PUT');

test('captures a small PNG after a save and PUTs it as the thumbnail', async () => {
  renderHook((p) => useThumbnailCapture(p), { initialProps: { ...base, lastSaved: '2026-01-01T00:00:00Z' } });
  await waitFor(() => expect(puts()).toHaveLength(1));
  expect(mockRenderPreview.mock.calls[0][1]).toBeLessThanOrEqual(160); // <= 320px wide at 2x
  expect(puts()[0][0]).toBe('/api/diagrams/d1');
  expect(JSON.parse(puts()[0][1].body)).toEqual({ thumbnail: PNG });
});

test('does nothing without a save, for read-only, or for an empty canvas', async () => {
  renderHook((p) => useThumbnailCapture(p), { initialProps: { ...base, lastSaved: null } });
  renderHook((p) => useThumbnailCapture(p), { initialProps: { ...base, readOnly: true, lastSaved: 'x' } });
  renderHook((p) => useThumbnailCapture(p), { initialProps: { ...base, elements: [], lastSaved: 'x' } });
  await act(async () => { await Promise.resolve(); });
  expect(mockRenderPreview).not.toHaveBeenCalled();
});

test('throttles: a second save inside the interval does not recapture', async () => {
  const { rerender } = renderHook((p) => useThumbnailCapture(p), {
    initialProps: { ...base, lastSaved: 's1' },
  });
  await waitFor(() => expect(puts()).toHaveLength(1));
  rerender({ ...base, lastSaved: 's2' });
  await act(async () => { await Promise.resolve(); });
  expect(puts()).toHaveLength(1);
  expect(THUMBNAIL_INTERVAL_MS).toBeGreaterThan(0);
});

test('skips oversized captures and swallows capture errors', async () => {
  mockRenderPreview.mockResolvedValueOnce({ dataUrl: 'data:image/png;base64,' + 'A'.repeat(300 * 1024) });
  renderHook((p) => useThumbnailCapture(p), { initialProps: { ...base, lastSaved: 's1' } });
  await waitFor(() => expect(mockRenderPreview).toHaveBeenCalled());
  await act(async () => { await Promise.resolve(); });
  expect(puts()).toHaveLength(0);

  mockRenderPreview.mockRejectedValueOnce(new Error('boom'));
  const { rerender } = renderHook((p) => useThumbnailCapture(p), { initialProps: { ...base, diagramId: 'd2', lastSaved: 's1' } });
  rerender({ ...base, diagramId: 'd2', lastSaved: 's1' });
  await act(async () => { await Promise.resolve(); });
  expect(puts()).toHaveLength(0);
});
