import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ApiTokensSection, { tokenState } from '../../components/account/ApiTokensSection';

const TOKEN = { id: 't1', name: 'Laptop', token_prefix: 'ogl_abcd', role_cap: 'viewer', diagram_ids: null, created_at: '2026-10-01T00:00:00Z', last_used_at: null, expires_at: null, revoked_at: null };

function mockFetch(handlers) {
  global.fetch = jest.fn(async (url, opts = {}) => {
    const key = `${opts.method || 'GET'} ${url}`;
    const h = handlers[key];
    if (!h) throw new Error(`unexpected fetch ${key}`);
    const { status = 200, body } = typeof h === 'function' ? h(opts) : h;
    return { ok: status < 400, status, json: async () => body };
  });
}

describe('tokenState', () => {
  test('revoked beats expired beats active', () => {
    expect(tokenState({ revoked_at: 'x', expires_at: '2000-01-01' })).toBe('revoked');
    expect(tokenState({ expires_at: '2000-01-01' })).toBe('expired');
    expect(tokenState({ expires_at: '2999-01-01' })).toBe('active');
    expect(tokenState({})).toBe('active');
  });
});

describe('ApiTokensSection', () => {
  test('lists tokens without any secret material', async () => {
    mockFetch({ 'GET /api/user/tokens': { body: { tokens: [TOKEN] } } });
    render(<ApiTokensSection />);
    expect(await screen.findByText('Laptop')).toBeInTheDocument();
    expect(screen.getByText(/ogl_abcd/)).toBeInTheDocument();
  });

  test('create shows the secret once, with the name and chosen cap sent to the API', async () => {
    let posted;
    mockFetch({
      'GET /api/user/tokens': { body: { tokens: [] } },
      'POST /api/user/tokens': (opts) => {
        posted = JSON.parse(opts.body);
        return { status: 201, body: { token: 'ogl_SECRETVALUE', record: { id: 't2', name: posted.name } } };
      },
    });
    render(<ApiTokensSection />);
    fireEvent.change(screen.getByLabelText(/Token name/i), { target: { value: 'CI' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create token' }));
    expect(await screen.findByText('ogl_SECRETVALUE')).toBeInTheDocument();
    expect(screen.getByText(/will not be shown again/i)).toBeInTheDocument();
    expect(posted).toMatchObject({ name: 'CI', roleCap: 'viewer', expiresInDays: 90, diagramIds: null });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByText('ogl_SECRETVALUE')).not.toBeInTheDocument();
  });

  test('revoke needs a second click, then calls DELETE and reloads', async () => {
    let tokens = [TOKEN];
    mockFetch({
      'GET /api/user/tokens': () => ({ body: { tokens } }),
      'DELETE /api/user/tokens/t1': () => { tokens = [{ ...TOKEN, revoked_at: '2026-10-06T00:00:00Z' }]; return { body: { revoked: true } }; },
    });
    render(<ApiTokensSection />);
    fireEvent.click(await screen.findByRole('button', { name: 'Revoke' }));
    expect(global.fetch).not.toHaveBeenCalledWith('/api/user/tokens/t1', expect.anything());
    fireEvent.click(screen.getByRole('button', { name: 'Confirm revoke' }));
    await waitFor(() => expect(screen.getByText('revoked')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument();
  });

  test('server validation errors are shown', async () => {
    mockFetch({
      'GET /api/user/tokens': { body: { tokens: [] } },
      'POST /api/user/tokens': { status: 400, body: { error: 'Role must be viewer or commenter' } },
    });
    render(<ApiTokensSection />);
    fireEvent.change(screen.getByLabelText(/Token name/i), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create token' }));
    expect(await screen.findByText('Role must be viewer or commenter')).toBeInTheDocument();
  });
});
