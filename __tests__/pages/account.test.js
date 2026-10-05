import { render, screen } from '@testing-library/react';
import AccountPage from '../../pages/account';

const mockUseSession = jest.fn();
const push = jest.fn();
jest.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
  signOut: jest.fn(),
}));
jest.mock('next/router', () => ({ useRouter: () => ({ push, pathname: '/account', query: {} }) }));
jest.mock('../../components/ui/AppSidebar', () => () => <aside />);

const authed = {
  data: { user: { name: 'Ada', email: 'ada@x.io', role: 'user', status: 'active' } },
  status: 'authenticated',
};

describe('AccountPage hooks order', () => {
  beforeEach(() => push.mockClear());

  it('does not crash when session goes from loading to authenticated', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockUseSession.mockReturnValue({ data: null, status: 'loading' });
    const { rerender } = render(<AccountPage />);
    mockUseSession.mockReturnValue(authed);
    expect(() => rerender(<AccountPage />)).not.toThrow();
    expect(screen.getByText('Account Settings')).toBeInTheDocument();
    spy.mockRestore();
  });

  it('redirects to /login when unauthenticated', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' });
    render(<AccountPage />);
    expect(push).toHaveBeenCalledWith('/login');
  });
});
