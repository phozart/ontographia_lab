// LA-1: "Highlight others' changes" is a per-user toggle in the canvas context menu (default on).
import { render, screen, fireEvent } from '@testing-library/react';
import { DiagramProvider } from '../../../components/diagram-studio/DiagramContext';
import ContextMenu from '../../../components/diagram-studio/ui/ContextMenu';

const renderMenu = (props) => render(
  <DiagramProvider diagramId="d1" defaultPack="process-flow">
    <ContextMenu position={{ x: 10, y: 10 }} targetElement={null} onClose={jest.fn()} {...props} />
  </DiagramProvider>,
);

test('menu offers to stop highlighting when it is on and calls the toggle', () => {
  const onToggle = jest.fn();
  renderMenu({ highlightRemoteChanges: true, onToggleHighlightRemoteChanges: onToggle });
  const item = screen.getByRole('menuitemcheckbox');
  expect(item.textContent).toMatch(/Stop highlighting others/);
  expect(item.getAttribute('aria-checked')).toBe('true');
  fireEvent.click(item);
  expect(onToggle).toHaveBeenCalledTimes(1);
});

test('menu offers to start highlighting when it is off', () => {
  renderMenu({ highlightRemoteChanges: false, onToggleHighlightRemoteChanges: jest.fn() });
  expect(screen.getByRole('menuitemcheckbox').textContent).toMatch(/^Highlight others/);
});

test('no toggle without a handler (embedded canvas)', () => {
  renderMenu({});
  expect(screen.queryByRole('menuitemcheckbox')).toBeNull();
});
