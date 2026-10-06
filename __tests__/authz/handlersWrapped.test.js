// Fails when any file under pages/api/diagrams/** exports a handler that is not wrapped by
// withDiagramAuth / withUserAuth (lib/authz/next.js). New diagram routes (versions, comments, shares...) are
// picked up automatically.
jest.mock('../../lib/useAuth', () => ({ requireActiveUser: jest.fn() }));
jest.mock('../../lib/db', () => ({ query: jest.fn() }));

const fs = require('fs');
const path = require('path');
const { AUTHZ_WRAPPED } = require('../../lib/authz/next');

const ROOT = path.join(__dirname, '..', '..', 'pages', 'api', 'diagrams');

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return listFiles(full);
    return /\.(js|jsx|ts|tsx)$/.test(e.name) ? [full] : [];
  });
}

const files = listFiles(ROOT);

describe('pages/api/diagrams/** handlers are authorization-wrapped', () => {
  test('there are routes to check', () => expect(files.length).toBeGreaterThanOrEqual(2));

  test.each(files.map((f) => [path.relative(ROOT, f), f]))('%s', (rel, file) => {
     
    const mod = require(file);
    expect(typeof mod.default).toBe('function');
    expect(mod.default[AUTHZ_WRAPPED]).toBe(true);
    // No second, unwrapped handler may be exported next to the default one
    for (const [name, value] of Object.entries(mod)) {
      if (name === 'default' || name === 'config') continue;
      expect(typeof value).not.toBe('function');
    }
  });

  test('an unwrapped handler would be detected', () => {
    const raw = async () => {};
    expect(raw[AUTHZ_WRAPPED]).toBeUndefined();
  });
});
