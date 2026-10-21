import { render, screen, fireEvent } from '@testing-library/react';

jest.mock('next-auth/react', () => ({ signOut: jest.fn() }));
import ConsentForm from '../../components/oauth/ConsentForm';

const DIAGRAMS = [
  { id: 'd1', shortId: 'LAB-1', name: 'Mine', role: 'owner', canEdit: true },
  { id: 'd2', shortId: 'LAB-2', name: 'Shared view', role: 'viewer', canEdit: false },
];
const base = { rid: 'r1', csrf: 'c1', clientLabel: 'claude.ai', redirectHost: 'claude.ai', account: { email: 'me@x.co', name: 'Me' }, isAdmin: false, ceiling: 'editor', diagrams: DIAGRAMS, formError: null };
const hidden = (container, name) => [...container.querySelectorAll(`input[type=hidden][name="${name}"]`)].map((i) => i.value);

describe('ConsentForm', () => {
  test('shows who asks, where you return to, the account and the warning; Viewer is the default', () => {
    const { container } = render(<ConsentForm {...base} />);
    expect(screen.getByRole('heading')).toHaveTextContent('claude.ai wants to use Ontographia Lab as me@x.co');
    expect(screen.getByText(/Only continue if you started connecting Claude yourself/)).toBeInTheDocument();
    expect(screen.getByText(/sent back to/).textContent).toMatch(/claude\.ai/);
    expect(screen.getByLabelText(/Viewer/)).toBeChecked();
    expect(hidden(container, 'rid')).toEqual(['r1']);
    expect(hidden(container, 'csrf')).toEqual(['c1']);
    expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled();
  });

  test('roles above the requested scope are disabled', () => {
    render(<ConsentForm {...base} ceiling="commenter" />);
    expect(screen.getByLabelText(/Editor/)).toBeDisabled();
    expect(screen.getByLabelText(/Commenter/)).toBeEnabled();
  });

  test('non-admin Editor must choose diagrams they can edit; Approve stays disabled until then', () => {
    const { container } = render(<ConsentForm {...base} />);
    fireEvent.click(screen.getByLabelText(/Editor/));
    expect(screen.queryByText('All boards I can edit')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();
    expect(screen.queryByText(/Shared view/)).not.toBeInTheDocument(); // read-only diagrams are not offered
    fireEvent.click(screen.getByLabelText(/Mine/));
    expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled();
    expect(hidden(container, 'diagramMode')).toEqual(['selected']);
    expect(hidden(container, 'diagramIds')).toEqual(['d1']);
  });

  test('admin Editor gets "All boards I can edit" with the clear warning', () => {
    const { container } = render(<ConsentForm {...base} isAdmin />);
    fireEvent.click(screen.getByLabelText(/Editor/));
    expect(screen.getByText('All boards I can edit')).toBeInTheDocument();
    expect(screen.getByText(/Claude can change any board you can edit; every change is saved as a version you can restore/)).toBeInTheDocument();
    expect(hidden(container, 'diagramMode')).toEqual(['all']);
    expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled();
  });

  test('Viewer can be limited to chosen diagrams', () => {
    const { container } = render(<ConsentForm {...base} />);
    fireEvent.click(screen.getByLabelText(/Only the diagrams I choose/));
    expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/Shared view/));
    expect(hidden(container, 'diagramIds')).toEqual(['d2']);
  });

  test('form errors are shown as an alert', () => {
    render(<ConsentForm {...base} formError="Something was wrong." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Something was wrong.');
  });

  test('Cancel and Approve submit a decision to the consent endpoint', () => {
    const { container } = render(<ConsentForm {...base} />);
    const form = container.querySelector('form');
    expect(form.getAttribute('method').toLowerCase()).toBe('post');
    expect(form.getAttribute('action')).toBe('/api/oauth/consent');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveAttribute('value', 'deny');
    expect(screen.getByRole('button', { name: 'Approve' })).toHaveAttribute('value', 'approve');
  });
});
