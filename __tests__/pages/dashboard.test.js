import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DashboardPage from '../../pages/dashboard';

const push = jest.fn();
let mockMatches = false;
jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { name: 'Ada Lovelace', role: 'user', status: 'active' } },
    status: 'authenticated',
  }),
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
