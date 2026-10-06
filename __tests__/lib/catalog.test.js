import fs from 'fs';
import path from 'path';
import { createDefaultRegistry } from '../../components/diagram-studio/packs';
import { PACK_CATALOG, getPackCatalog, findStencilMeta } from '../../components/diagram-studio/packs/catalog';

describe('pure stencil catalog', () => {
  const registry = createDefaultRegistry();

  test('covers every registered pack, in the same order', () => {
    expect(PACK_CATALOG.map((p) => p.id)).toEqual(registry.getIds());
  });

  test.each(registry.getAll().map((p) => [p.id, p]))('%s: catalog equals the pack', (id, pack) => {
    const cat = getPackCatalog(id);
    expect(cat.name).toBe(pack.name);
    expect(cat.description).toBe(pack.description);
    expect(cat.icon).toBe(pack.icon);
    expect(cat.stencils).toBe(pack.stencils);
    expect(cat.connectionTypes).toEqual(pack.connectionTypes);
  });

  test('catalog files import no UI code', () => {
    const dir = path.join(__dirname, '../../components/diagram-studio/packs/catalog');
    for (const f of fs.readdirSync(dir)) {
      const src = fs.readFileSync(path.join(dir, f), 'utf8');
      expect(src).not.toMatch(/from 'react'|require\('react'\)/);
      const imports = [...src.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1]);
      for (const i of imports) expect(i.startsWith('./')).toBe(true);
    }
  });

  test('stencil metadata contains no functions or React elements', () => {
    for (const p of PACK_CATALOG) {
      for (const s of p.stencils) {
        for (const v of Object.values(s)) {
          expect(typeof v).not.toBe('function');
          expect(v && v.$$typeof).toBeFalsy();
        }
      }
    }
  });

  test('findStencilMeta resolves plain and namespaced types', () => {
    expect(findStencilMeta('frame').packId).toBe('core');
    expect(findStencilMeta('core/frame').stencil.id).toBe('frame');
    expect(findStencilMeta('nope/frame')).toBeNull();
    expect(findStencilMeta(42)).toBeNull();
  });
});
