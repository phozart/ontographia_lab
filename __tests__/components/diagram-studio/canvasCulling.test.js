// Viewport culling in the real canvas: off-screen nodes are not mounted, a held capture mounts them, selection keeps
// a node mounted, small boards are never culled.
import React from 'react';
import { render, act } from '@testing-library/react';
import { DiagramProvider, useDiagram, useDiagramSelection } from '../../../components/diagram-studio/DiagramContext';
import DiagramCanvas from '../../../components/diagram-studio/DiagramCanvas';
import { suspendCulling } from '../../../components/diagram-studio/canvasCulling';

let api;
let sel;
function Probe() {
  api = useDiagram();
  sel = useDiagramSelection();
  return null;
}

// a 20 x N grid, 300 px apart: only the first columns/rows are near a 1024x768 viewport at the origin
const grid = (n) => Array.from({ length: n }, (_, i) => ({
  id: `n${i}`, type: 'rectangle', packId: 'core', x: (i % 20) * 300, y: Math.floor(i / 20) * 300,
  size: { width: 120, height: 60 }, label: `Node ${i}`, color: '#4FB3CE', layerId: 'default', properties: {},
}));

function mount(n) {
  const utils = render(
    <DiagramProvider diagramId="t" defaultPack="core">
      <Probe />
      <DiagramCanvas profile={{ editingPolicy: {} }} />
    </DiagramProvider>
  );
  act(() => { api.setViewport({ x: 0, y: 0, scale: 1 }); api.setElements(grid(n)); });
  return utils;
}
const mounted = (c) => [...c.querySelectorAll('[data-node-id]')].map((n) => n.getAttribute('data-node-id'));

describe('viewport culling in the canvas', () => {
  test('a big board mounts only what is near the viewport; the far nodes are not in the DOM', () => {
    const { container } = mount(400);
    const ids = mounted(container);
    expect(ids).toContain('n0');
    expect(ids).toContain('n1');
    expect(ids).not.toContain('n19'); // x = 5700
    expect(ids).not.toContain('n399'); // far corner
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.length).toBeLessThan(400);
  });

  test('a small board is never culled', () => {
    const { container } = mount(100);
    expect(mounted(container)).toHaveLength(100);
  });

  test('panning mounts the nodes that come into range', () => {
    const { container } = mount(400);
    expect(mounted(container)).not.toContain('n19');
    act(() => { api.setViewport({ x: -5500, y: 0, scale: 1 }); });
    expect(mounted(container)).toContain('n19');
    expect(mounted(container)).not.toContain('n0');
  });

  test('a selected node stays mounted when it is off-screen', () => {
    const { container } = mount(400);
    expect(mounted(container)).not.toContain('n399');
    act(() => { sel.selectElement('n399'); });
    expect(mounted(container)).toContain('n399');
  });

  test('holding culling off (export, copy as image, present) mounts everything, releasing culls again', async () => {
    const { container } = mount(400);
    let held; // (not awaited inside act: act would wait for the very render that resolves it)
    act(() => { held = suspendCulling(); });
    await act(async () => {});
    const release = await held;
    expect(mounted(container)).toHaveLength(400);
    await act(async () => { release(); });
    expect(mounted(container).length).toBeLessThan(400);
  });

  test('a held world rectangle (a frame being copied) mounts just that region', async () => {
    const { container } = mount(400);
    expect(mounted(container)).not.toContain('n399');
    // n399 sits at x = 5700, y = 5700
    let held;
    act(() => { held = suspendCulling({ x: 5600, y: 5600, width: 400, height: 300 }); });
    await act(async () => {});
    const release = await held;
    const ids = mounted(container);
    expect(ids).toContain('n399');
    expect(ids).toContain('n0');
    expect(ids).not.toContain('n19'); // x = 5700 but y = 0: in neither region
    await act(async () => { release(); });
    expect(mounted(container)).not.toContain('n399');
  });

  test('connections whose endpoints are off-screen but whose line crosses the viewport still render', () => {
    const { container } = mount(400);
    act(() => {
      api.setConnections([
        { id: 'cross', sourceId: 'n19', targetId: 'n399', lineStyle: 'straight' }, // far right to far corner: crosses x ~ 0..5700 diagonal
        { id: 'span', sourceId: 'n19', targetId: 'n380', lineStyle: 'straight' }, // far right top -> far left bottom: crosses the viewport region
        { id: 'away', sourceId: 'n398', targetId: 'n399', lineStyle: 'straight' },
      ]);
    });
    const ids = [...container.querySelectorAll('[data-connection-id]')].map((n) => n.getAttribute('data-connection-id'));
    expect(ids).toContain('span');
    expect(ids).not.toContain('away');
  });
});
