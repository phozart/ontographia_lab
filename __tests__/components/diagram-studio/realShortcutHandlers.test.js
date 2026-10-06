// Dispatches real key events through the actual DiagramCanvas handler (not regexes over source)
// and asserts the single focus rule: suppressed in fields / suspended containers, handled on the canvas.
import React from 'react';
import { render, act, fireEvent } from '@testing-library/react';
import { DiagramProvider, useDiagram } from '../../../components/diagram-studio/DiagramContext';
import DiagramCanvas from '../../../components/diagram-studio/DiagramCanvas';

let api;
function Probe() {
  api = useDiagram();
  return null;
}

function mount({ popup = true } = {}) {
  const utils = render(
    <DiagramProvider diagramId="t" defaultPack="core">
      <Probe />
      <DiagramCanvas profile={{ editingPolicy: {} }} />
      <input data-testid="field" />
      <textarea data-testid="area" />
      {popup && <div data-suspend-shortcuts data-testid="popup"><button data-testid="popup-btn">x</button><textarea data-testid="popup-area" /></div>}
    </DiagramProvider>
  );
  return utils;
}

const stickyCount = () => api.elements.filter((e) => e.shape === 'sticky' || e.packId === 'sticky-notes').length;

describe('real keyboard handlers obey the focus rule', () => {
  beforeEach(() => {
    window.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  });

  test('N creates a sticky when focus is on the body/canvas', () => {
    mount({ popup: false });
    act(() => { fireEvent.keyDown(document.body, { key: 'n' }); });
    expect(stickyCount()).toBe(1);
  });

  test.each(['field', 'area', 'popup-area', 'popup-btn'])('N is ignored when focus is in %s', (id) => {
    const { getByTestId } = mount();
    const el = getByTestId(id);
    el.focus();
    act(() => { fireEvent.keyDown(el, { key: 'n' }); });
    expect(stickyCount()).toBe(0);
  });

  test('N is ignored while a [data-suspend-shortcuts] container exists, even with body focus', () => {
    mount();
    document.body.focus();
    act(() => { fireEvent.keyDown(document.body, { key: 'n' }); });
    expect(stickyCount()).toBe(0);
  });
});
