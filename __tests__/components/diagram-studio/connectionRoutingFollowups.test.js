import { buildOrthogonalPath } from '../../../components/diagram-studio/connections/geometry/orthogonalRouting';
import { selectAutoPorts, resolveConnectionPorts, manualWaypointUpdate } from '../../../components/diagram-studio/connections/geometry/autoPorts';

const A = { x: 0, y: 0, width: 120, height: 60 };

describe('manualWaypointUpdate (stale stored ports)', () => {
  it('pins the effective ports and clears autoPorts alongside the waypoints', () => {
    const resolved = { id: 'c', autoPorts: true, sourcePort: 'bottom', targetPort: 'top' };
    const wps = [{ x: 10, y: 20 }];
    const upd = manualWaypointUpdate(resolved, wps);
    expect(upd).toEqual({ waypoints: wps, hasManualWaypoints: true, sourcePort: 'bottom', targetPort: 'top', autoPorts: false });
    // After the write the stored ports are the effective ones, so they survive a shape move
    const stored = { ...resolved, ...upd };
    const moved = { x: 300, y: 0, width: 120, height: 60 };
    expect(resolveConnectionPorts(stored, A, moved)).toEqual({ sourcePort: 'bottom', targetPort: 'top' });
  });
  it('does not add autoPorts for pinned connections', () => {
    expect(manualWaypointUpdate({ sourcePort: 'left', targetPort: 'right' }, [])).toEqual({
      waypoints: [], hasManualWaypoints: true, sourcePort: 'left', targetPort: 'right',
    });
  });
});

describe('selectAutoPorts hysteresis', () => {
  // Diagonal target with gapX = 100, gapY = 105: raw rule says vertical
  const T = { x: 220, y: 165, width: 120, height: 60 };
  it('keeps the axis already in use when the gaps are nearly equal', () => {
    expect(selectAutoPorts(A, T)).toEqual({ sourcePort: 'bottom', targetPort: 'top' });
    expect(selectAutoPorts(A, T, { sourcePort: 'right' })).toEqual({ sourcePort: 'right', targetPort: 'left' });
    expect(selectAutoPorts(A, T, { sourcePort: 'bottom' })).toEqual({ sourcePort: 'bottom', targetPort: 'top' });
  });
  it('still flips when one gap clearly dominates', () => {
    const far = { x: 220, y: 400, width: 120, height: 60 };
    expect(selectAutoPorts(A, far, { sourcePort: 'right' })).toEqual({ sourcePort: 'bottom', targetPort: 'top' });
  });
});

describe('snap-to-straight within 15px', () => {
  const S = { x: 0, y: 0, width: 120, height: 60 };
  it.each([4, 10, 14])('draws a single straight segment for a %ipx vertical offset', (off) => {
    const T = { x: 300, y: off, width: 120, height: 60 };
    const r = buildOrthogonalPath({ x: 120, y: 30 }, { x: 300, y: 30 + off }, 'right', 'left', { sourceBounds: S, targetBounds: T });
    expect(r.points).toHaveLength(2);
    expect(r.points[0].y).toBe(r.points[1].y);
  });
  it('draws a straight vertical segment for a small horizontal offset', () => {
    const T = { x: 9, y: 300, width: 120, height: 60 };
    const r = buildOrthogonalPath({ x: 60, y: 60 }, { x: 69, y: 300 }, 'bottom', 'top', { sourceBounds: S, targetBounds: T });
    expect(r.points).toHaveLength(2);
    expect(r.points[0].x).toBe(r.points[1].x);
  });
  it('does not snap through an obstacle', () => {
    const T = { x: 300, y: 10, width: 120, height: 60 };
    const obstacle = { x: 180, y: 0, width: 60, height: 80 };
    const r = buildOrthogonalPath({ x: 120, y: 30 }, { x: 300, y: 40 }, 'right', 'left', { sourceBounds: S, targetBounds: T, obstacles: [obstacle] });
    expect(r.points.length).toBeGreaterThan(2);
  });
  it('still routes with bends beyond the threshold', () => {
    const T = { x: 300, y: 40, width: 120, height: 60 };
    const r = buildOrthogonalPath({ x: 120, y: 30 }, { x: 300, y: 70 }, 'right', 'left', { sourceBounds: S, targetBounds: T });
    expect(r.points.length).toBeGreaterThan(2);
  });
});
