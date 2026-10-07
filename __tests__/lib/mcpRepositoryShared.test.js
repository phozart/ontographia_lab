// Slice 5: the MCP list/search pre-filter includes diagrams shared with the token owner. It only PRE-FILTERS;
// every row is still re-checked through authorize (role cap + allowlist), covered in mcpServer / agentScope tests.
jest.mock('../../lib/db', () => ({ query: jest.fn(async () => ({ rows: [] })) }));
import { query } from '../../lib/db';
import { mcpRepository } from '../../lib/mcp/repository';

beforeEach(() => query.mockClear());

describe.each([
  ['listReadable', (r) => r.listReadable('u1', { limit: 5 })],
  ['searchReadable', (r) => r.searchReadable('u1', { text: 'x', limit: 5 })],
])('%s', (name, run) => {
  test('selects owned OR directly shared diagrams, parameterized by the user id', async () => {
    await run(mcpRepository);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/owner_id = \$1 OR id IN \(SELECT diagram_id FROM diagram_members WHERE user_id = \$1\)/);
    expect(params[0]).toBe('u1');
    expect(sql.split('FROM diagrams')[0]).not.toMatch(/\bcontent\b/); // the select list never carries content
  });

  test('the token allowlist still narrows the candidates', async () => {
    const scope = ['123e4567-e89b-12d3-a456-426614174000'];
    if (name === 'listReadable') await mcpRepository.listReadable('u1', { scope, limit: 5 });
    else await mcpRepository.searchReadable('u1', { scope, text: 'x', limit: 5 });
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/id = ANY\(\$\d+::uuid\[\]\)/);
    expect(params).toContainEqual(scope);
  });
});
