import { routeOrthogonal, clearRouteCache, validateRoute } from '../../../components/diagram-studio/connections/geometry/orthogonalRouter';

const PORTS = ['top', 'right', 'bottom', 'left'];
const pos = (b, p) => p === 'right' ? { x: b.x + b.width, y: b.y + b.height / 2 }
  : p === 'left' ? { x: b.x, y: b.y + b.height / 2 }
    : p === 'top' ? { x: b.x + b.width / 2, y: b.y } : { x: b.x + b.width / 2, y: b.y + b.height };

// Same cost model as the router: length + 50 per bend
const cost = (pts) => {
  let l = 0;
  for (let i = 0; i < pts.length - 1; i++) l += Math.abs(pts[i + 1].x - pts[i].x) + Math.abs(pts[i + 1].y - pts[i].y);
  return l + 50 * (pts.length - 2);
};

function rng(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const route = (s, t, sp, tp, obstacles, extra = {}) =>
  routeOrthogonal(pos(s, sp), pos(t, tp), sp, tp, s, t, { obstacles, noCache: true, ...extra });

describe('routeOrthogonal trivial-first routing', () => {
  it('never costs more than the grid search (beyond tie-break noise)', () => {
    const rnd = rng(42);
    const mk = () => ({ x: Math.round(rnd() * 600), y: Math.round(rnd() * 400), width: 40 + Math.round(rnd() * 100), height: 30 + Math.round(rnd() * 60) });
    let compared = 0;
    for (let i = 0; i < 400; i++) {
      const s = mk();
      const t = mk();
      const obstacles = Array.from({ length: Math.floor(rnd() * 12) }, mk);
      const sp = PORTS[Math.floor(rnd() * 4)];
      const tp = PORTS[Math.floor(rnd() * 4)];
      const fast = route(s, t, sp, tp, obstacles);
      const slow = route(s, t, sp, tp, obstacles, { skipTrivial: true });
      if (!slow) continue;
      expect(fast).not.toBeNull();
      expect(cost(fast)).toBeLessThanOrEqual(cost(slow) + 1);
      expect(validateRoute(fast, s, t, sp, tp).valid).toBe(true);
      compared++;
    }
    expect(compared).toBeGreaterThan(200);
  });

  it('uses a single straight/elbow route for open facing shapes', () => {
    const s = { x: 0, y: 0, width: 100, height: 60 };
    const t = { x: 300, y: 0, width: 100, height: 60 };
    expect(route(s, t, 'right', 'left', [])).toHaveLength(2);
  });
});

describe('route cache', () => {
  const s = { x: 0, y: 0, width: 100, height: 60 };
  const t = { x: 300, y: 120, width: 100, height: 60 };
  it('returns equal routes for equal inputs and isolates callers from the cache', () => {
    clearRouteCache();
    const a = routeOrthogonal(pos(s, 'right'), pos(t, 'left'), 'right', 'left', s, t, { obstacles: [] });
    a[0].x = 9999; // caller mutation must not poison the cache
    const b = routeOrthogonal(pos(s, 'right'), pos(t, 'left'), 'right', 'left', s, t, { obstacles: [] });
    expect(b[0].x).toBe(100);
  });
  it('invalidates when a relevant obstacle moves', () => {
    clearRouteCache();
    const o1 = { x: 180, y: 50, width: 40, height: 40 };
    const a = routeOrthogonal(pos(s, 'right'), pos(t, 'left'), 'right', 'left', s, t, { obstacles: [o1] });
    const b = routeOrthogonal(pos(s, 'right'), pos(t, 'left'), 'right', 'left', s, t, { obstacles: [{ ...o1, y: 400 }] });
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(b));
  });
});

describe('routing performance budget', () => {
  // 108 shapes in a 12x9 grid, 300 connections; generous budget so only real regressions fail
  it('routes 300 connections across 108 shapes quickly', () => {
    const shapes = [];
    for (let r = 0; r < 9; r++) for (let c = 0; c < 12; c++) shapes.push({ x: 40 + c * 170, y: 60 + r * 120, width: 110, height: 60 });
    const rnd = rng(7);
    const jobs = [];
    for (let i = 0; i < 300; i++) {
      const a = Math.floor(rnd() * shapes.length);
      let b = Math.floor(rnd() * shapes.length);
      if (a === b) b = (b + 1) % shapes.length;
      jobs.push([a, b]);
    }
    const t0 = performance.now();
    for (const [a, b] of jobs) {
      const s = shapes[a];
      const t = shapes[b];
      const sp = t.x >= s.x + s.width ? 'right' : t.x + t.width <= s.x ? 'left' : t.y > s.y ? 'bottom' : 'top';
      const tp = { right: 'left', left: 'right', top: 'bottom', bottom: 'top' }[sp];
      route(s, t, sp, tp, shapes.filter((_, i) => i !== a && i !== b));
    }
    const ms = performance.now() - t0;
    // ~10x headroom over the measured time on a dev laptop
    expect(ms).toBeLessThan(2000);
  });
});
