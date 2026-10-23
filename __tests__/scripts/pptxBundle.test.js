/**
 * @jest-environment node
 */
// ADR-0007 P3: pptxgenjs is loaded only on export (dynamic import, its own chunk).
//  1. Source rule (always runs): nothing in the app imports pptxgenjs statically; the only reference is one dynamic import().
//  2. Build rule (runs when a production build exists, i.e. after `NODE_ENV=production npx next build --webpack`): the build
//     manifest lists no pptxgenjs / PPTX writer chunk for any page, and the export dialog does not share a chunk with the library.
const fs = require('fs');
const path = require('path');
const { checkBundle } = require('../../scripts/check-pptx-bundle');

const ROOT = path.join(__dirname, '..', '..');

function sourceFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.next', '.git', '__tests__', 'docs', 'public'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) sourceFiles(p, out);
    else if (/\.(js|jsx|ts|tsx|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
}

describe('pptxgenjs is lazy (source)', () => {
  const refs = sourceFiles(ROOT)
    .filter((f) => !f.includes(`${path.sep}scripts${path.sep}`))
    .flatMap((f) => fs.readFileSync(f, 'utf8').split('\n').map((line, i) => ({ f: path.relative(ROOT, f), i: i + 1, line })).filter((x) => /['"]pptxgenjs['"]/.test(x.line) && !/^\s*(\/\/|\*)/.test(x.line)));

  test('the only reference is a dynamic import in components/diagram-studio/present/exportPptx.js', () => {
    expect(refs.map((r) => r.f)).toEqual(['components/diagram-studio/present/exportPptx.js']);
    expect(refs[0].line).toMatch(/await import\(.*['"]pptxgenjs['"]\)/);
    expect(refs[0].line).not.toMatch(/^\s*import\s/);
  });

  test('no pptx module the editor loads statically imports the export module; it is imported dynamically', () => {
    const offenders = sourceFiles(path.join(ROOT, 'components')).concat(sourceFiles(path.join(ROOT, 'pages')))
      .filter((f) => fs.readFileSync(f, 'utf8').split('\n').some((l) => /^import .* from ['"].*(exportPptx|lib\/present\/pptx\/(compile|write|package))['"]/.test(l)))
      .map((f) => path.relative(ROOT, f));
    // exportPptx.js itself imports the compile / write modules (it is the lazy module); nothing else may import them statically
    expect(offenders).toEqual(['components/diagram-studio/present/exportPptx.js']);
  });

  test('the library is a pinned production dependency', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    expect(pkg.dependencies.pptxgenjs).toBe('4.0.1') // pinned: package.js assumes 4.0.1's bare <a:p> output;
  });
});

const hasBuild = fs.existsSync(path.join(ROOT, '.next', 'build-manifest.json'));
(hasBuild ? describe : describe.skip)('pptxgenjs is in its own chunk (production build)', () => {
  const result = hasBuild ? checkBundle(ROOT) : null;
  test('the build check passes', () => {
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });
  test('the library chunk is separate from the dialog and the writer is its own async chunk', () => {
    expect(result.lib.length).toBeGreaterThan(0);
    expect(result.writer.length).toBeGreaterThan(0);
    const dialog = new Set(result.dialog.map((d) => d.file));
    for (const c of result.lib) expect(dialog.has(c.file)).toBe(false);
  });
  test('size budget: pptxgenjs plus jszip stay under 140 KB gzip', () => {
    const gz = [...result.lib, ...result.jszip].reduce((a, c) => a + c.gzip, 0);
    expect(gz).toBeLessThan(140 * 1024);
  });
});
