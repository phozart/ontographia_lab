/**
 * @jest-environment jsdom
 */
import { copyRich } from '../../lib/clipboard/richCopy';

const payload = { html: '<p>hi</p>', text: 'hi' };
afterEach(() => {
  delete global.ClipboardItem;
  delete document.execCommand;
  Object.defineProperty(global.navigator, 'clipboard', { value: undefined, configurable: true });
});

test('ClipboardItem path writes text/html and text/plain', async () => {
  const write = jest.fn().mockResolvedValue();
  global.ClipboardItem = class { constructor(items) { this.items = items; } };
  Object.defineProperty(global.navigator, 'clipboard', { value: { write, writeText: jest.fn() }, configurable: true });
  const r = await copyRich(payload);
  expect(r).toEqual({ ok: true, method: 'clipboard-item', rich: true });
  expect(Object.keys(write.mock.calls[0][0][0].items).sort()).toEqual(['text/html', 'text/plain']);
});

test('falls back to execCommand on a hidden contenteditable when ClipboardItem is unavailable', async () => {
  let seen = null;
  document.execCommand = jest.fn(() => { seen = document.querySelector('[contenteditable="true"]')?.innerHTML; return true; });
  const r = await copyRich(payload);
  expect(r).toEqual({ ok: true, method: 'exec-command', rich: true });
  expect(seen).toBe('<p>hi</p>');
  expect(document.querySelector('[contenteditable="true"]')).toBeNull(); // cleaned up
});

test('falls back to plain text when rich copy is blocked', async () => {
  const writeText = jest.fn().mockResolvedValue();
  global.ClipboardItem = class {};
  document.execCommand = jest.fn(() => false);
  Object.defineProperty(global.navigator, 'clipboard', { value: { write: jest.fn().mockRejectedValue(new Error('denied')), writeText }, configurable: true });
  const r = await copyRich(payload);
  expect(r).toEqual({ ok: true, method: 'text', rich: false });
  expect(writeText).toHaveBeenCalledWith('hi');
});

test('reports failure when everything is blocked', async () => {
  document.execCommand = jest.fn(() => false);
  expect((await copyRich(payload)).ok).toBe(false);
});
