import React from 'react';
import { render, act, fireEvent } from '@testing-library/react';
import { NewCommentInput } from '../../../components/diagram-studio/ui/CommentSystem';
import StarterPackModal from '../../../components/diagram-studio/StarterPackModal';
import { BelowLabel } from '../../../components/diagram-studio/packs/NodeLabels';

describe('comment popup', () => {
  test('suspends shortcuts and focuses the textarea after the originating mousedown', async () => {
    render(<NewCommentInput position={{ x: 10, y: 10 }} currentUser={{ name: 'A' }} onSubmit={() => {}} onCancel={() => {}} />);
    const area = document.querySelector('textarea');
    expect(area.closest('[data-suspend-shortcuts]')).not.toBeNull();
    area.blur(); // simulate canvas mousedown default stealing focus
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(document.activeElement).toBe(area);
  });
});

describe('Templates modal', () => {
  test('Escape closes it', () => {
    const onClose = jest.fn();
    render(<StarterPackModal isOpen onClose={onClose} onApply={() => {}} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('shared label renderer', () => {
  test('applies italic and underline', () => {
    const { container } = render(<BelowLabel element={{ label: 'Hi', fontStyle: 'italic', textDecoration: 'underline' }} />);
    const el = container.firstChild;
    expect(el.style.fontStyle).toBe('italic');
    expect(el.style.textDecoration).toBe('underline');
  });
});

describe('ShapeSidebar hidden prop (key 1)', () => {
  const { DiagramProvider } = require('../../../components/diagram-studio/DiagramContext');
  const ShapeSidebar = require('../../../components/diagram-studio/ui/ShapeSidebar').default;
  const mount = (hidden) => render(
    <DiagramProvider diagramId="t" defaultPack="core">
      <ShapeSidebar enabledPacks={[]} hidden={hidden} />
    </DiagramProvider>
  );
  test('renders nothing when hidden, the rail otherwise', () => {
    expect(mount(true).container.querySelector('.ds-shape-sidebar')).toBeNull();
    expect(mount(false).container.querySelector('.ds-shape-sidebar')).not.toBeNull();
  });
});
