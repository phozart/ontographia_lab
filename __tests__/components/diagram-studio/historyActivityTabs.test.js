// LA-3: the Activity tab sits next to History in the right-hand panel; it can be opened directly (pill popover, menu).
import { render, screen, act, fireEvent } from '@testing-library/react';
import VersionHistoryPanel, { VersionHistory, OPEN_VERSION_HISTORY_EVENT, OPEN_ACTIVITY_EVENT } from '../../../components/diagram-studio/ui/VersionHistoryPanel';
import { DiagramProvider, useDiagram } from '../../../components/diagram-studio/DiagramContext';

const res = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const meta = (n) => ({ id: `v${n}`, number: n, kind: 'named', label: `Rev ${n}`, description: null, createdAt: '2026-10-01T10:00:00.000Z', createdBy: { id: 'u1', name: 'Alice' }, createdVia: 'web', sizeBytes: 1, elementCount: 1, connectionCount: 0, restoredFrom: null });
const ACT = { items: [{ id: 'v:7', kind: 'named_version', at: '2026-10-21T09:10:00.000Z', actor: { type: 'user', id: 'u', name: 'Peter H.' }, version: { number: 7, name: 'Workshop end' } }], nextCursor: null };
let calls;
beforeEach(() => {
  calls = [];
  jest.spyOn(console, 'error').mockImplementation(() => {});
  global.fetch = jest.fn(async (url, init = {}) => {
    calls.push(String(url));
    if (/\/activity\?/.test(url)) return res(200, ACT);
    if (/\/versions(\?|$)/.test(url)) return res(200, { items: [meta(7), meta(2)], nextCursor: null });
    if (/\/versions\/\d+$/.test(url)) return res(200, { ...meta(Number(String(url).split('/').pop())), content: { elements: [], connections: [] } });
    return res(404, {});
  });
});
afterEach(() => jest.restoreAllMocks());
const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }); };

const panel = (props = {}) => render(<VersionHistoryPanel open diagramId="d1" canWrite onClose={() => {}} onRestore={jest.fn()} {...props} />);

test('History is the default tab; the Activity tab is next to it', async () => {
  panel();
  await flush();
  const tabs = screen.getAllByRole('tab');
  expect(tabs.map((t) => t.textContent)).toEqual(['History', 'Activity']);
  expect(screen.getByRole('tab', { name: 'History' }).getAttribute('aria-selected')).toBe('true');
  expect(screen.getByLabelText('Version list')).toBeTruthy();
  expect(calls.some((u) => /\/activity\?/.test(u))).toBe(false); // not fetched until the tab is opened
});

test('opening Activity shows the feed; going back shows the versions', async () => {
  panel();
  await flush();
  await act(async () => { fireEvent.click(screen.getByRole('tab', { name: 'Activity' })); });
  await flush();
  expect(screen.getByRole('tab', { name: 'Activity' }).getAttribute('aria-selected')).toBe('true');
  expect(screen.getByText(/Workshop end/)).toBeTruthy();
  expect(screen.queryByLabelText('Version list')).toBeNull();
  await act(async () => { fireEvent.click(screen.getByRole('tab', { name: 'History' })); });
  await flush();
  expect(screen.getByLabelText('Version list')).toBeTruthy();
});

test('"Open version N" in the feed switches to History with that version selected', async () => {
  panel({ tab: undefined });
  await flush();
  await act(async () => { fireEvent.click(screen.getByRole('tab', { name: 'Activity' })); });
  await flush();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Open version 7/ })); });
  await flush();
  expect(screen.getByRole('tab', { name: 'History' }).getAttribute('aria-selected')).toBe('true');
  expect(screen.getByRole('region', { name: 'Version 7' })).toBeTruthy();
});

test('the panel can be opened straight on the Activity tab', async () => {
  panel({ tab: 'activity' });
  await flush();
  expect(screen.getByRole('tab', { name: 'Activity' }).getAttribute('aria-selected')).toBe('true');
  expect(screen.getByText(/Workshop end/)).toBeTruthy();
});

test('the panel title and close label follow the tab', async () => {
  panel({ tab: 'activity' });
  await flush();
  expect(screen.getByRole('complementary', { name: /Activity/ })).toBeTruthy();
});

describe('editor wiring', () => {
  const Probe = () => { const { setDiagram } = useDiagram(); return <button onClick={() => setDiagram({ id: 'd1', name: 'X', revision: 3, content: { elements: [], connections: [] }, access: { capabilities: ['version.create', 'version.restore'] } })}>load</button>; };
  const mount = async () => {
    render(<DiagramProvider diagramId="d1" defaultPack="process-flow"><Probe /><VersionHistory /></DiagramProvider>);
    await flush();
    await act(async () => { fireEvent.click(screen.getByText('load')); });
    await flush();
  };

  test('OPEN_ACTIVITY_EVENT opens the panel on the Activity tab; OPEN_VERSION_HISTORY_EVENT on History', async () => {
    await mount();
    await act(async () => { window.dispatchEvent(new CustomEvent(OPEN_ACTIVITY_EVENT)); });
    await flush();
    expect(screen.getByRole('tab', { name: 'Activity' }).getAttribute('aria-selected')).toBe('true');
    await act(async () => { window.dispatchEvent(new CustomEvent(OPEN_VERSION_HISTORY_EVENT)); });
    await flush();
    expect(screen.getByRole('tab', { name: 'History' }).getAttribute('aria-selected')).toBe('true');
  });
});
