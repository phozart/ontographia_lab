import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import ConnectedAppsSection, { describeDiagrams } from '../../components/account/ConnectedAppsSection';

const APP = { id: 'g1', clientLabel: 'claude.ai', roleCap: 'viewer', scope: 'diagrams:read', allDiagrams: false, scopeKind: 'all_readable', diagramCount: null, diagrams: [], createdAt: '2026-10-01T00:00:00Z', lastUsedAt: null, expiresAt: null };
const EDITOR = { ...APP, id: 'g2', roleCap: 'editor', scopeKind: 'selected', diagramCount: 3, diagrams: [{ id: 'd1', shortId: 'LAB-1', name: 'Roadmap' }, { id: 'd2', shortId: 'LAB-2', name: 'Journey' }] };
const ALL = { ...APP, id: 'g3', roleCap: 'editor', allDiagrams: true, scopeKind: 'all_editable' };

function mockFetch(handlers) {
  global.fetch = jest.fn(async (url, opts = {}) => {
    const key = `${opts.method || 'GET'} ${url}`;
    const h = handlers[key];
    if (!h) throw new Error(`unexpected fetch ${key}`);
    const { status = 200, body } = typeof h === 'function' ? h(opts) : h;
    return { ok: status < 400, status, json: async () => body };
  });
}

test('describeDiagrams wording', () => {
  expect(describeDiagrams(ALL)).toBe('All boards I can edit');
  expect(describeDiagrams(APP)).toBe('All my diagrams');
  expect(describeDiagrams(EDITOR)).toBe('3 diagrams');
  expect(describeDiagrams({ scopeKind: 'selected', diagramCount: 1 })).toBe('1 diagram');
});

describe('ConnectedAppsSection', () => {
  test('hidden when the feature is off and nothing is connected', async () => {
    mockFetch({ 'GET /api/user/connected-apps': { body: { enabled: false, apps: [] } } });
    const { container } = render(<ConnectedAppsSection />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  test('empty state when enabled', async () => {
    mockFetch({ 'GET /api/user/connected-apps': { body: { enabled: true, apps: [] } } });
    render(<ConnectedAppsSection />);
    expect(await screen.findByText('No connected apps.')).toBeInTheDocument();
  });

  test('lists apps with client host, access level, diagrams, dates; all-boards is labeled', async () => {
    mockFetch({ 'GET /api/user/connected-apps': { body: { enabled: true, apps: [APP, EDITOR, ALL] } } });
    render(<ConnectedAppsSection />);
    const rows = await screen.findAllByTestId('connected-app-row');
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText('claude.ai')).toBeInTheDocument();
    expect(rows[0].textContent).toMatch(/Viewer · All my diagrams/);
    expect(rows[0].textContent).toMatch(/last used never/);
    expect(rows[1].textContent).toMatch(/Editor · 3 diagrams/);
    expect(rows[2].textContent).toMatch(/Editor · All boards I can edit/);
  });

  test('expands the chosen diagrams, noting ones the user can no longer see', async () => {
    mockFetch({ 'GET /api/user/connected-apps': { body: { enabled: true, apps: [EDITOR] } } });
    render(<ConnectedAppsSection />);
    fireEvent.click(await screen.findByRole('button', { name: 'Show diagrams' }));
    expect(screen.getByText('Roadmap (LAB-1)')).toBeInTheDocument();
    expect(screen.getByText('1 more you can no longer see')).toBeInTheDocument();
  });

  test('Disconnect asks for confirmation, calls DELETE and reloads', async () => {
    let apps = [APP];
    mockFetch({
      'GET /api/user/connected-apps': () => ({ body: { enabled: true, apps } }),
      'DELETE /api/user/connected-apps/g1': () => { apps = []; return { body: { revoked: true } }; },
    });
    render(<ConnectedAppsSection />);
    fireEvent.click(await screen.findByRole('button', { name: 'Disconnect' }));
    expect(global.fetch).not.toHaveBeenCalledWith('/api/user/connected-apps/g1', expect.anything());
    fireEvent.click(screen.getByRole('button', { name: 'Confirm disconnect' }));
    await waitFor(() => expect(screen.getByText('No connected apps.')).toBeInTheDocument());
  });

  test('a failed Disconnect shows an error and keeps the row', async () => {
    mockFetch({
      'GET /api/user/connected-apps': { body: { enabled: true, apps: [APP] } },
      'DELETE /api/user/connected-apps/g1': { status: 500, body: {} },
    });
    render(<ConnectedAppsSection />);
    fireEvent.click(await screen.findByRole('button', { name: 'Disconnect' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm disconnect' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Could not disconnect/);
    expect(screen.getAllByTestId('connected-app-row')).toHaveLength(1);
  });
});
