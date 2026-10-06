jest.mock('../../lib/db', () => ({ query: jest.fn() }));

import { query } from '../../lib/db';
import { authorize, authorizeMeta } from '../../lib/authz/index';

const A = '123e4567-e89b-12d3-a456-426614174000';
const B = '123e4567-e89b-12d3-a456-426614174001';
const OWNER = '11111111-1111-4111-8111-111111111111';
const meta = (id) => ({ id, short_id: 'LAB-1', name: 'D', type: 'x', owner_id: OWNER, created_by: 'o', revision: '1' });
const agent = (over = {}) => ({ kind: 'agent', userId: OWNER, tokenId: 't', roleCap: 'viewer', ...over });

beforeEach(() => query.mockReset());

describe('agent diagramScope (token allowlist)', () => {
  test('diagram inside the allowlist is readable', async () => {
    query.mockResolvedValue({ rows: [meta(A)] });
    const r = await authorize(agent({ diagramScope: [A] }), A, 'diagram.read');
    expect(r.role).toBe('viewer');
  });

  test('diagram outside the allowlist is 404 (existence not revealed), even for the owner', async () => {
    query.mockResolvedValue({ rows: [meta(B)] });
    await expect(authorize(agent({ diagramScope: [A] }), B, 'diagram.read')).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
  });

  test('empty allowlist grants nothing; null/undefined means unrestricted', async () => {
    query.mockResolvedValue({ rows: [meta(A)] });
    await expect(authorize(agent({ diagramScope: [] }), A, 'diagram.read')).rejects.toMatchObject({ status: 404 });
    await expect(authorize(agent({ diagramScope: null }), A, 'diagram.read')).resolves.toBeTruthy();
    await expect(authorize(agent(), A, 'diagram.read')).resolves.toBeTruthy();
  });

  test('a malformed (non-array) scope fails closed', async () => {
    query.mockResolvedValue({ rows: [meta(A)] });
    await expect(authorize(agent({ diagramScope: A }), A, 'diagram.read')).rejects.toMatchObject({ status: 404 });
  });

  test('scope never raises the cap: viewer token cannot write even inside the allowlist', async () => {
    query.mockResolvedValue({ rows: [meta(A)] });
    await expect(authorize(agent({ diagramScope: [A] }), A, 'diagram.write')).rejects.toMatchObject({ status: 403 });
  });

  test('authorizeMeta applies the same rules without a database round trip', async () => {
    const r = await authorizeMeta(agent({ diagramScope: [A] }), meta(A), 'diagram.read');
    expect(r.role).toBe('viewer');
    expect(query).not.toHaveBeenCalled();
    await expect(authorizeMeta(agent({ diagramScope: [A] }), meta(B), 'diagram.read')).rejects.toMatchObject({ status: 404 });
  });
});
