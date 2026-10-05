import { render, screen } from '@testing-library/react';
import StarterPackModal, { STARTER_PACKS } from '../../../components/diagram-studio/StarterPackModal';

const center = (el) => ({ x: el.x + el.size.width / 2, y: el.y + el.size.height / 2 });

describe('template connection definitions', () => {
  it('right -> left connections between elements join at the same height (no squiggle stub)', () => {
    STARTER_PACKS.forEach((pack) => {
      (pack.connections || []).forEach((c) => {
        if ((c.sourcePort || 'right') !== 'right' || (c.targetPort || 'left') !== 'left') return;
        const s = pack.elements[c.sourceIdx];
        const t = pack.elements[c.targetIdx];
        // Either exactly aligned or clearly offset (a deliberate elbow), never a near-miss jog
        const dy = Math.abs(center(s).y - center(t).y);
        expect([pack.id, dy === 0 || dy > 15]).toEqual([pack.id, true]);
      });
    });
  });

  it('Simple Process Flow Start -> Step 1 is perfectly straight', () => {
    const pack = STARTER_PACKS.find((p) => p.id === 'process-flow-basic');
    const [start, step] = pack.elements;
    expect(center(start).y).toBe(center(step).y);
  });

  it('every template connection references existing elements', () => {
    STARTER_PACKS.forEach((pack) => {
      (pack.connections || []).forEach((c) => {
        expect(pack.elements[c.sourceIdx]).toBeDefined();
        expect(pack.elements[c.targetIdx]).toBeDefined();
      });
    });
  });
});

describe('StarterPackModal', () => {
  it('is titled Templates and rendered above canvas overlays', () => {
    render(<StarterPackModal isOpen onClose={() => {}} onApply={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Templates' })).toBeTruthy();
    expect(screen.queryByText('Starter Packs')).toBeNull();
    const overlay = screen.getByTestId('templates-modal');
    expect(Number(overlay.style.zIndex)).toBeGreaterThan(10000); // floating rotation handle is 10000
    expect(overlay.parentElement).toBe(document.body); // portal: not trapped in a lower stacking context
  });
});
