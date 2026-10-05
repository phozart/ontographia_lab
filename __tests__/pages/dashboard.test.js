import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DashboardPage from '../../pages/dashboard';

const push = jest.fn();
let mockMatches = false;
// Stable session object (as in production) so the dashboard does not refetch on every render
const mockSession = {
  data: { user: { name: 'Ada Lovelace', role: 'user', status: 'active' } },
  status: 'authenticated',
};
jest.mock('next-auth/react', () => ({
  useSession: () => mockSession,
}));
jest.mock('next/router', () => ({ useRouter: () => ({ push, pathname: '/dashboard', query: {} }) }));
jest.mock('../../components/ui/ToastProvider', () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn() }),
}));
jest.mock('@mui/material/useMediaQuery', () => ({
  __esModule: true,
  default: () => mockMatches,
}));
jest.mock('../../components/ui/AppSidebar', () => function MockAppSidebar() {
  return (
  <aside data-testid="sidebar">
    <a href="#home" onClick={(e) => e.preventDefault()}>Home</a>
  </aside>
  );
});

const diagram = { id: '1', name: 'WS One', type: 'mindmap', updated_at: new Date().toISOString() };

beforeEach(() => {
  global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([diagram]) }));
});

describe('Dashboard responsive sidebar', () => {
  it('on narrow screens hides sidebar and shows a labelled menu button that opens it', async () => {
    mockMatches = true;
    render(<DashboardPage />);
    const btn = await screen.findByLabelText('Open navigation menu');
    expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();
    fireEvent.click(btn);
    expect(await screen.findByTestId('sidebar')).toBeInTheDocument();
  });

  it('on desktop renders the sidebar inline with no menu button', async () => {
    mockMatches = false;
    render(<DashboardPage />);
    expect(await screen.findByTestId('sidebar')).toBeInTheDocument();
    expect(screen.queryByLabelText('Open navigation menu')).not.toBeInTheDocument();
  });

  it('labels the workspace card more button', async () => {
    mockMatches = false;
    render(<DashboardPage />);
    expect(await screen.findByLabelText('Workspace actions')).toBeInTheDocument();
  });

  it('closes the mobile drawer when any nav item is clicked', async () => {
    mockMatches = true;
    render(<DashboardPage />);
    fireEvent.click(await screen.findByLabelText('Open navigation menu'));
    fireEvent.click(await screen.findByText('Home'));
    await waitFor(() => expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument());
  });
});

function routeFetch(extra = {}) {
  global.fetch = jest.fn((url, opts = {}) => {
    const method = opts.method || 'GET';
    const key = `${method} ${url}`;
    if (extra[key]) return Promise.resolve(extra[key]);
    if (key === 'GET /api/diagrams') return Promise.resolve({ ok: true, json: () => Promise.resolve([diagram]) });
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: '2', short_id: 'LAB-2', name: 'x' }) });
  });
}
const callsTo = (method, url) => global.fetch.mock.calls.filter(([u, o]) => u === url && (o?.method || 'GET') === method);

describe('Dashboard loading state', () => {
  it('does not show the first-workspace prompt while diagrams are loading', async () => {
    mockMatches = false;
    global.fetch = jest.fn(() => new Promise(() => {}));
    render(<DashboardPage />);
    await screen.findByTestId('sidebar');
    expect(screen.queryByText(/Get started by creating/)).not.toBeInTheDocument();
    expect(screen.queryByText('No workspaces yet')).not.toBeInTheDocument();
  });
});

describe('Dashboard new workspace dialog', () => {
  beforeEach(() => { mockMatches = false; routeFetch(); });

  it('asks for a name (prefilled) before creating, Enter creates', async () => {
    render(<DashboardPage />);
    fireEvent.click(await screen.findByRole('button', { name: /^New$/ }));
    const input = await screen.findByLabelText('Workspace name');
    expect(input.value).toBe('Untitled Workspace');
    expect(callsTo('POST', '/api/diagrams')).toHaveLength(0);
    fireEvent.change(input, { target: { value: 'Roadmap' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(callsTo('POST', '/api/diagrams')).toHaveLength(1));
    expect(JSON.parse(callsTo('POST', '/api/diagrams')[0][1].body).name).toBe('Roadmap');
  });

  it('Escape cancels without creating', async () => {
    render(<DashboardPage />);
    fireEvent.click(await screen.findByRole('button', { name: /^New$/ }));
    const input = await screen.findByLabelText('Workspace name');
    fireEvent.keyDown(input, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByLabelText('Workspace name')).not.toBeInTheDocument());
    expect(callsTo('POST', '/api/diagrams')).toHaveLength(0);
  });
});

describe('Dashboard card actions', () => {
  beforeEach(() => { mockMatches = false; routeFetch(); });

  it('renames via the card menu using PUT name', async () => {
    render(<DashboardPage />);
    fireEvent.click(await screen.findByLabelText('Workspace actions'));
    fireEvent.click(await screen.findByText('Rename'));
    const input = await screen.findByLabelText('Workspace name');
    expect(input.value).toBe('WS One');
    fireEvent.change(input, { target: { value: 'Renamed' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(callsTo('PUT', '/api/diagrams/1')).toHaveLength(1));
    expect(JSON.parse(callsTo('PUT', '/api/diagrams/1')[0][1].body)).toEqual({ name: 'Renamed' });
    expect(await screen.findByText('Renamed')).toBeInTheDocument();
  });

  it('duplicates via the server endpoint and lists the copy', async () => {
    const copy = { ...diagram, id: '9', name: 'WS One (copy)' };
    routeFetch({ 'POST /api/diagrams/1/duplicate': { ok: true, json: () => Promise.resolve(copy) } });
    render(<DashboardPage />);
    fireEvent.click(await screen.findByLabelText('Workspace actions'));
    fireEvent.click(await screen.findByText('Duplicate'));
    await waitFor(() => expect(callsTo('POST', '/api/diagrams/1/duplicate')).toHaveLength(1));
    expect(await screen.findByText('WS One (copy)')).toBeInTheDocument();
  });

  it('gives the title a tooltip and shows the stored thumbnail, else the logo', async () => {
    const withThumb = { ...diagram, id: '3', name: 'Has Thumb', thumbnail: 'data:image/png;base64,AAAA' };
    routeFetch({ 'GET /api/diagrams': { ok: true, json: () => Promise.resolve([diagram, withThumb]) } });
    render(<DashboardPage />);
    expect(await screen.findByTitle('Has Thumb')).toBeInTheDocument();
    const img = await screen.findByAltText('Preview of Has Thumb');
    expect(img.getAttribute('src')).toBe('data:image/png;base64,AAAA');
    expect(screen.queryByAltText('Preview of WS One')).not.toBeInTheDocument();
  });
});
