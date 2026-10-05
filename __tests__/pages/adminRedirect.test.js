import { render } from '@testing-library/react';
import AdminDashboard from '../../pages/admin/index';
import AdminUsers from '../../pages/admin/users';

const mockUseSession = jest.fn();
const push = jest.fn();
jest.mock('next-auth/react', () => ({ useSession: () => mockUseSession() }));
jest.mock('next/router', () => ({ useRouter: () => ({ push, pathname: '/admin', query: {} }) }));
jest.mock('../../components/ui/UserMenu', () => ({ UserMenu: () => null }));
jest.mock('../../components/ui/ToastProvider', () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn() }),
}));

beforeEach(() => {
  push.mockClear();
  global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([]) }));
});

describe.each([
  ['/admin', AdminDashboard],
  ['/admin/users', AdminUsers],
])('%s redirects', (_name, Page) => {
  it('does not redirect while session is loading', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'loading' });
    render(<Page />);
    expect(push).not.toHaveBeenCalled();
  });

  it('redirects unauthenticated users to /login', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' });
    render(<Page />);
    expect(push).toHaveBeenCalledWith('/login');
  });

  it('redirects non-admins to /dashboard', () => {
    mockUseSession.mockReturnValue({
      data: { user: { role: 'user', status: 'active' } },
      status: 'authenticated',
    });
    render(<Page />);
    expect(push).toHaveBeenCalledWith('/dashboard');
  });

  it('does not redirect admins', () => {
    mockUseSession.mockReturnValue({
      data: { user: { role: 'admin', status: 'active' } },
      status: 'authenticated',
    });
    render(<Page />);
    expect(push).not.toHaveBeenCalled();
  });
});
