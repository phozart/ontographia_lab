import { buildOrthogonalPath } from '../../../components/diagram-studio/connections/geometry/orthogonalRouting';
import {
  routeOrthogonal,
  normalizePoints,
  validateRoute,
  portDir,
} from '../../../components/diagram-studio/connections/geometry/orthogonalRouter';
import { selectAutoPorts, resolveConnectionPorts } from '../../../components/diagram-studio/connections/geometry/autoPorts';

const PORTS = ['top', 'right', 'bottom', 'left'];

function portPos(b, port, ratio = 0.5) {
  switch (port) {
    case 'top': return { x: b.x + b.width * ratio, y: b.y };
    case 'bottom': return { x: b.x + b.width * ratio, y: b.y + b.height };
    case 'left': return { x: b.x, y: b.y + b.height * ratio };
    default: return { x: b.x + b.width, y: b.y + b.height * ratio };
  }
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function overlaps(a, b, gap) {
  return !(a.x + a.width + gap <= b.x || b.x + b.width + gap <= a.x ||
           a.y + a.height + gap <= b.y || b.y + b.height + gap <= a.y);
}

// Parse an SVG path and return its end points (M/L/Q), with Q control points
function pathPoints(d) {
  const nums = d.replace(/[MLQ]/g, ' ').trim().split(/\s+/).map(Number);
  const cmds = d.match(/[MLQ]/g) || [];
  const pts = [];
  let i = 0;
  for (const c of cmds) {
    if (c === 'Q') { pts.push({ x: nums[i + 2], y: nums[i + 3], ctrl: { x: nums[i], y: nums[i + 1] } }); i += 4; }
    else { pts.push({ x: nums[i], y: nums[i + 1] }); i += 2; }
  }
  return pts;
}

function assertInvariants(points, sB, tB, sp, tp, label) {
  const res = validateRoute(points, sB, tB, sp, tp);
  if (!res.valid) {
    throw new Error(`${label}: ${res.reason} ${JSON.stringify({ points, sB, tB, sp, tp })}`);
  }
}

function expectNoDegenerateQ(path) {
  expect(path).not.toMatch(/NaN/);
  const pts = pathPoints(path);
  // no zero-length L segments in the path string
  pts.forEach((p, i) => {
    const prev = pts[i - 1];
    if (prev && !p.ctrl) expect(Math.abs(p.x - prev.x) < 0.01 && Math.abs(p.y - prev.y) < 0.01).toBe(false);
  });
  pts.forEach((p, i) => {
    if (!p.ctrl) return;
    const prev = pts[i - 1];
    expect(p.ctrl.x === p.x && p.ctrl.y === p.y).toBe(false);
    expect(p.ctrl.x === prev.x && p.ctrl.y === prev.y).toBe(false);
  });
}

describe('normalizePoints', () => {
  it('removes duplicates, collinear points and spikes; idempotent', () => {
    const pts = [
      { x: 0, y: 0 }, { x: 0, y: -18 }, { x: 0, y: 100 }, { x: 0, y: 100 }, { x: 50, y: 100 }, { x: 80, y: 100 },
    ];
    const out = normalizePoints(pts);
    expect(out).toEqual([{ x: 0, y: 0 }, { x: 0, y: 100 }, { x: 80, y: 100 }]);
    expect(normalizePoints(out)).toEqual(out);
  });
});

describe('selectAutoPorts', () => {
  const A = { x: 0, y: 0, width: 120, height: 60 };
  it('side by side -> right/left, regardless of source width', () => {
    expect(selectAutoPorts(A, { x: 300, y: 10, width: 120, height: 60 })).toEqual({ sourcePort: 'right', targetPort: 'left' });
    expect(selectAutoPorts({ ...A, width: 260 }, { x: 300, y: 10, width: 120, height: 60 })).toEqual({ sourcePort: 'right', targetPort: 'left' });
    expect(selectAutoPorts(A, { x: -300, y: 0, width: 120, height: 60 })).toEqual({ sourcePort: 'left', targetPort: 'right' });
  });
  it('stacked -> bottom/top', () => {
    expect(selectAutoPorts(A, { x: 0, y: 200, width: 120, height: 60 })).toEqual({ sourcePort: 'bottom', targetPort: 'top' });
    expect(selectAutoPorts(A, { x: 20, y: -200, width: 120, height: 60 })).toEqual({ sourcePort: 'top', targetPort: 'bottom' });
  });
  it('diagonal picks the axis with the larger gap; overlapping falls back to centers', () => {
    expect(selectAutoPorts(A, { x: 400, y: 100, width: 120, height: 60 })).toEqual({ sourcePort: 'right', targetPort: 'left' });
    expect(selectAutoPorts(A, { x: 100, y: 300, width: 120, height: 60 })).toEqual({ sourcePort: 'bottom', targetPort: 'top' });
    expect(selectAutoPorts(A, { x: 80, y: 20, width: 120, height: 60 })).toEqual({ sourcePort: 'right', targetPort: 'left' });
  });
});

describe('resolveConnectionPorts', () => {
  const A = { x: 0, y: 0, width: 120, height: 60 };
  const B = { x: 300, y: 0, width: 120, height: 60 };
  it('re-evaluates for autoPorts connections when shapes move', () => {
    const c = { autoPorts: true, sourcePort: 'right', targetPort: 'left' };
    expect(resolveConnectionPorts(c, A, B)).toEqual({ sourcePort: 'right', targetPort: 'left' });
    expect(resolveConnectionPorts(c, A, { x: 0, y: 300, width: 120, height: 60 })).toEqual({ sourcePort: 'bottom', targetPort: 'top' });
  });
  it('keeps pinned ports and manually routed connections', () => {
    const below = { x: 0, y: 300, width: 120, height: 60 };
    expect(resolveConnectionPorts({ sourcePort: 'top', targetPort: 'top' }, A, below)).toEqual({ sourcePort: 'top', targetPort: 'top' });
    expect(resolveConnectionPorts({ autoPorts: true, sourcePort: 'top', targetPort: 'top', waypoints: [{ x: 1, y: 1 }] }, A, below))
      .toEqual({ sourcePort: 'top', targetPort: 'top' });
    expect(resolveConnectionPorts({ autoPorts: true }, null, null)).toEqual({ sourcePort: 'right', targetPort: 'left' });
  });
});

describe('orthogonal router fixtures (QA #6)', () => {
  const src = { x: 100, y: 100, width: 120, height: 60 };

  it('top exit with target below: never doubles back through the source', () => {
    const tgt = { x: 100, y: 300, width: 120, height: 60 };
    const r = buildOrthogonalPath(portPos(src, 'top'), portPos(tgt, 'top'), 'top', 'top', { sourceBounds: src, targetBounds: tgt });
    assertInvariants(r.points, src, tgt, 'top', 'top', 'top->top');
    expectNoDegenerateQ(r.path);
  });

  it('top -> bottom with target below routes around the source', () => {
    const tgt = { x: 110, y: 300, width: 120, height: 60 };
    const r = buildOrthogonalPath(portPos(src, 'top'), portPos(tgt, 'bottom'), 'top', 'bottom', { sourceBounds: src, targetBounds: tgt });
    assertInvariants(r.points, src, tgt, 'top', 'bottom', 'top->bottom');
    expectNoDegenerateQ(r.path);
  });

  it('side-by-side top->top is a clean U without zero-length corners', () => {
    const tgt = { x: 400, y: 100, width: 120, height: 60 };
    const r = buildOrthogonalPath(portPos(src, 'top'), portPos(tgt, 'top'), 'top', 'top', { sourceBounds: src, targetBounds: tgt });
    assertInvariants(r.points, src, tgt, 'top', 'top', 'U');
    expect(r.points).toHaveLength(4);
    expectNoDegenerateQ(r.path);
  });

  it('right -> top with target to the lower right: single L, no loop around the target', () => {
    const tgt = { x: 400, y: 260, width: 120, height: 60 };
    const r = buildOrthogonalPath(portPos(src, 'right'), portPos(tgt, 'top'), 'right', 'top', { sourceBounds: src, targetBounds: tgt });
    assertInvariants(r.points, src, tgt, 'right', 'top', 'right->top');
    expect(r.points).toHaveLength(3);
  });

  it('right -> top with target to the left (needs a detour) stays valid', () => {
    const tgt = { x: -200, y: 260, width: 120, height: 60 };
    const r = buildOrthogonalPath(portPos(src, 'right'), portPos(tgt, 'top'), 'right', 'top', { sourceBounds: src, targetBounds: tgt });
    assertInvariants(r.points, src, tgt, 'right', 'top', 'right->top-left');
  });

  it('manual waypoints containing a stub fall back to a valid route', () => {
    const tgt = { x: 100, y: 300, width: 120, height: 60 };
    const sPos = portPos(src, 'top');
    const tPos = portPos(tgt, 'bottom');
    const r = buildOrthogonalPath(sPos, tPos, 'top', 'bottom', {
      sourceBounds: src, targetBounds: tgt,
      waypoints: [{ x: sPos.x, y: sPos.y - 18 }, { x: sPos.x, y: tPos.y + 30 }],
    });
    assertInvariants(r.points, src, tgt, 'top', 'bottom', 'stub waypoints');
  });

  it('small gaps shrink the stubs instead of reversing', () => {
    const tgt = { x: 240, y: 110, width: 120, height: 60 }; // 20px gap
    const r = buildOrthogonalPath(portPos(src, 'right'), portPos(tgt, 'left'), 'right', 'left', { sourceBounds: src, targetBounds: tgt });
    assertInvariants(r.points, src, tgt, 'right', 'left', 'small gap');
  });

  it('routes around other obstacles when given', () => {
    const tgt = { x: 500, y: 100, width: 120, height: 60 };
    const obstacle = { x: 300, y: 80, width: 80, height: 100 };
    const r = buildOrthogonalPath(portPos(src, 'right'), portPos(tgt, 'left'), 'right', 'left', { sourceBounds: src, targetBounds: tgt, obstacles: [obstacle] });
    assertInvariants(r.points, src, tgt, 'right', 'left', 'obstacle');
    for (let i = 0; i < r.points.length - 1; i++) {
      const a = r.points[i]; const b = r.points[i + 1];
      const hit = Math.max(a.x, b.x) > obstacle.x && Math.min(a.x, b.x) < obstacle.x + obstacle.width &&
                  Math.max(a.y, b.y) > obstacle.y && Math.min(a.y, b.y) < obstacle.y + obstacle.height;
      expect(hit).toBe(false);
    }
  });
});

describe('orthogonal router property tests', () => {
  const rand = mulberry32(20260105);
  const between = (lo, hi) => lo + rand() * (hi - lo);
  const N = 3000;

  it(`random shapes/ports/ratios satisfy invariants (a)-(c), N=${N}`, () => {
    let checked = 0;
    for (let n = 0; n < N; n++) {
      const sB = { x: Math.round(between(0, 600)), y: Math.round(between(0, 600)), width: Math.round(between(40, 300)), height: Math.round(between(30, 200)) };
      const tB = { x: Math.round(between(-200, 900)), y: Math.round(between(-200, 900)), width: Math.round(between(40, 300)), height: Math.round(between(30, 200)) };
      if (overlaps(sB, tB, 4)) continue;
      const sp = PORTS[Math.floor(rand() * 4)];
      const tp = PORTS[Math.floor(rand() * 4)];
      const sr = rand() < 0.5 ? 0.5 : between(0.05, 0.95);
      const tr = rand() < 0.5 ? 0.5 : between(0.05, 0.95);
      const sPos = portPos(sB, sp, sr);
      const tPos = portPos(tB, tp, tr);
      const r = buildOrthogonalPath(sPos, tPos, sp, tp, { sourceBounds: sB, targetBounds: tB, sharp: rand() < 0.5 });
      assertInvariants(r.points, sB, tB, sp, tp, `case ${n}`);
      expectNoDegenerateQ(r.path);
      checked++;
    }
    expect(checked).toBeGreaterThan(1500);
  });

  it('random shapes with manual waypoints and obstacles still satisfy invariants', () => {
    for (let n = 0; n < 1500; n++) {
      const sB = { x: Math.round(between(0, 500)), y: Math.round(between(0, 500)), width: Math.round(between(60, 200)), height: Math.round(between(40, 120)) };
      const tB = { x: Math.round(between(-200, 800)), y: Math.round(between(-200, 800)), width: Math.round(between(60, 200)), height: Math.round(between(40, 120)) };
      if (overlaps(sB, tB, 4)) continue;
      const sp = PORTS[Math.floor(rand() * 4)];
      const tp = PORTS[Math.floor(rand() * 4)];
      const sPos = portPos(sB, sp);
      const tPos = portPos(tB, tp);
      const wps = Array.from({ length: Math.floor(rand() * 3) }, () => ({ x: Math.round(between(-100, 800)), y: Math.round(between(-100, 800)) }));
      const obstacles = Array.from({ length: Math.floor(rand() * 3) }, () => ({ id: 'o', x: Math.round(between(0, 700)), y: Math.round(between(0, 700)), width: 80, height: 60 }))
        .filter(o => !overlaps(o, sB, 0) && !overlaps(o, tB, 0));
      const r = buildOrthogonalPath(sPos, tPos, sp, tp, { sourceBounds: sB, targetBounds: tB, waypoints: wps, obstacles });
      assertInvariants(r.points, sB, tB, sp, tp, `wp case ${n}`);
    }
  });

  it('portDir helper', () => {
    expect(portDir('top')).toEqual({ x: 0, y: -1 });
    expect(portDir('nope')).toBeNull();
  });

  it('routeOrthogonal returns null for unknown ports', () => {
    expect(routeOrthogonal({ x: 0, y: 0 }, { x: 5, y: 5 }, 'x', 'y', null, null)).toBeNull();
  });
});
