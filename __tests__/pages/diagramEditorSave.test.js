// Slice 0: the editor page must not issue its own PUT (that was the duplicate write).
import { render, waitFor } from '@testing-library/react';

let captured = null;
jest.mock('next/dynamic', () => () => function MockStudio(props) {
  captured = props;
  return null;
});
jest.mock('../../components/diagram-studio/packs', () => ({ createDefaultRegistry: () => ({}) }));
jest.mock('next/router', () => ({
  useRouter: () => ({ query: { id: 'd1' }, replace: jest.fn(), push: jest.fn() }),
}));
jest.mock('next/head', () => ({ __esModule: true, default: () => null }));

import EditorPage from '../../pages/diagram/[id]';

describe('diagram editor page', () => {
  beforeEach(() => {
    captured = null;
    global.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ id: 'd1', type: 'infinite-canvas', content: {} }) }));
  });

  test('invoking the onSave prop (if any) performs no network write', async () => {
    render(<EditorPage theme="light" />);
    await waitFor(() => expect(captured).not.toBeNull());
    if (typeof captured.onSave === 'function') {
      await captured.onSave({ elements: [], diagram: { id: 'd1' } });
    }
    const writes = global.fetch.mock.calls.filter(([, init]) => init && init.method && init.method !== 'GET');
    expect(writes).toHaveLength(0);
  });
});
