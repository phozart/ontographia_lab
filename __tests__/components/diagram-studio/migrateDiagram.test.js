import { migrateDiagram } from '../../../components/diagram-studio/migrations/migrateDiagram';

describe('migrateDiagram', () => {
  const legacy = () => ({
    viewport: { x: 0, y: 0, zoom: 1 },
    elements: [
      { id: 'a', type: 'central-idea', label: 'Main', x: 1, y: 2, size: { width: 150, height: 80 }, color: '#f00' },
      { id: 'b', type: 'branch', label: 'B1', x: 3, y: 4, size: { width: 120, height: 50 } },
      { id: 'c', type: 'rectangle', packId: 'core', label: 'Keep' },
    ],
    connections: [{ id: 'k', from: 'a', to: 'b' }],
  });

  it('maps legacy mind-map types and sets packId', () => {
    const out = migrateDiagram(legacy());
    expect(out.elements[0]).toMatchObject({ id: 'a', type: 'central-topic', packId: 'mind-map', label: 'Main', x: 1, y: 2, color: '#f00', size: { width: 150, height: 80 } });
    expect(out.elements[1]).toMatchObject({ id: 'b', type: 'main-topic', packId: 'mind-map', label: 'B1' });
  });

  it('leaves other elements, connections and fields untouched', () => {
    const input = legacy();
    const out = migrateDiagram(input);
    expect(out.elements[2]).toEqual(input.elements[2]);
    expect(out.connections).toEqual(input.connections);
    expect(out.viewport).toEqual(input.viewport);
  });

  it('is idempotent and does not mutate input', () => {
    const input = legacy();
    const snapshot = JSON.parse(JSON.stringify(input));
    const once = migrateDiagram(input);
    expect(input).toEqual(snapshot);
    expect(migrateDiagram(once)).toEqual(once);
  });

  it('returns the same reference when nothing to migrate', () => {
    const c = { elements: [{ id: 'x', type: 'main-topic' }] };
    expect(migrateDiagram(c)).toBe(c);
  });

  it('handles missing/empty content', () => {
    expect(migrateDiagram(null)).toBeNull();
    expect(migrateDiagram(undefined)).toBeUndefined();
    expect(migrateDiagram({})).toEqual({});
    expect(migrateDiagram({ elements: [] })).toEqual({ elements: [] });
    expect(migrateDiagram({ elements: null })).toEqual({ elements: null });
  });

  it('also migrates the legacy nodes key', () => {
    const out = migrateDiagram({ nodes: [{ id: 'n', type: 'branch' }] });
    expect(out.nodes[0]).toMatchObject({ type: 'main-topic', packId: 'mind-map' });
  });

  it('maps sticky-yellow to sticky-medium in the sticky-notes pack', () => {
    const out = migrateDiagram({ elements: [{ id: 's', type: 'sticky-yellow', label: 'To Do', x: 5 }] });
    expect(out.elements[0]).toMatchObject({ id: 's', type: 'sticky-medium', packId: 'sticky-notes', label: 'To Do', x: 5 });
  });

  describe('connection stub cleanup (QA #6)', () => {
    const els = () => ([
      { id: 'a', type: 'rectangle', packId: 'core', x: 100, y: 100, size: { width: 120, height: 60 } },
      { id: 'b', type: 'rectangle', packId: 'core', x: 100, y: 300, size: { width: 120, height: 60 } },
    ]);
    // a.top = (160,100); stub goes up 18px then straight back down past a
    const stubbed = () => ({
      elements: els(),
      connections: [{
        id: 'c', sourceId: 'a', targetId: 'b', sourcePort: 'top', targetPort: 'top',
        lineStyle: 'step', hasManualWaypoints: true,
        waypoints: [{ x: 160, y: 82 }, { x: 160, y: 348 }],
      }],
    });

    it('removes backtracking waypoints and clears the manual flag when none remain', () => {
      const out = migrateDiagram(stubbed());
      expect(out.connections[0].waypoints).toEqual([]);
      expect(out.connections[0].hasManualWaypoints).toBe(false);
    });

    it('removes duplicate consecutive waypoints but keeps real corners', () => {
      const input = {
        elements: els(),
        connections: [{ id: 'c', sourceId: 'a', targetId: 'b', sourcePort: 'right', targetPort: 'right', lineStyle: 'step', hasManualWaypoints: true,
          waypoints: [{ x: 300, y: 130 }, { x: 300, y: 130 }, { x: 300, y: 330 }] }],
      };
      const out = migrateDiagram(input);
      expect(out.connections[0].waypoints).toEqual([{ x: 300, y: 130 }, { x: 300, y: 330 }]);
    });

    it('works without element sizes (waypoint-only spike detection)', () => {
      const out = migrateDiagram({
        connections: [{ id: 'c', lineStyle: 'step', waypoints: [{ x: 0, y: 0 }, { x: 0, y: -20 }, { x: 0, y: 50 }, { x: 80, y: 50 }] }],
      });
      expect(out.connections[0].waypoints.length).toBeLessThan(4);
    });

    it('leaves clean connections untouched (same reference) and is idempotent', () => {
      const clean = {
        elements: els(),
        connections: [{ id: 'c', sourceId: 'a', targetId: 'b', sourcePort: 'right', targetPort: 'right',
          waypoints: [{ x: 300, y: 130 }, { x: 300, y: 330 }] }],
      };
      expect(migrateDiagram(clean)).toBe(clean);
      const once = migrateDiagram(stubbed());
      expect(migrateDiagram(once)).toBe(once);
    });

    it('leaves non-orthogonal line styles untouched (same reference)', () => {
      for (const lineStyle of ['curved', 'arc', 'straight', 'smart', undefined]) {
        const input = stubbed();
        input.connections[0].lineStyle = lineStyle;
        expect(migrateDiagram(input)).toBe(input);
      }
    });

    it('does not mutate its input', () => {
      const input = stubbed();
      const snap = JSON.parse(JSON.stringify(input));
      migrateDiagram(input);
      expect(input).toEqual(snap);
    });
  });
});

describe('migrateDiagram frame membership', () => {
  const content = () => ({
    elements: [
      { id: 'f', type: 'frame', x: 0, y: 0, size: { width: 500, height: 500 } },
      { id: 'in', type: 'rectangle', packId: 'core', x: 10, y: 10, size: { width: 100, height: 50 } },
      { id: 'out', type: 'rectangle', packId: 'core', x: 900, y: 10, size: { width: 100, height: 50 } },
    ],
  });

  it('derives explicit membership once for legacy frames and flags them', () => {
    const out = migrateDiagram(content());
    expect(out.elements.find((e) => e.id === 'in').parentFrameId).toBe('f');
    expect(out.elements.find((e) => e.id === 'out').parentFrameId).toBeUndefined();
    expect(out.elements.find((e) => e.id === 'f').membershipExplicit).toBe(true);
  });

  it('does not re-adopt after the user released a shape (idempotent)', () => {
    const once = migrateDiagram(content());
    const released = { ...once, elements: once.elements.map((e) => (e.id === 'in' ? { ...e, parentFrameId: null } : e)) };
    expect(migrateDiagram(released)).toBe(released);
  });
});
