import { resolveLabelColor, DARK_TEXT, LIGHT_TEXT } from '../../../components/diagram-studio/packs/colorUtils';
import { createDefaultRegistry } from '../../../components/diagram-studio/packs';
import React from 'react';
import { render } from '@testing-library/react';

describe('resolveLabelColor (default label colour follows the fill)', () => {
  test('explicit textColor always wins', () => {
    expect(resolveLabelColor({ textColor: '#123456', color: '#000000' })).toBe('#123456');
  });
  test('no fill at all (panel/white default) gives dark text, never white', () => {
    expect(resolveLabelColor({})).toBe('var(--text, #374151)');
  });
  test('stencil colour is NOT the fill when the element has no colour', () => {
    // the canvas paints var(--panel) for such elements, so a dark stencil colour must not flip text to white
    expect(resolveLabelColor({}, { color: '#3b82f6' })).not.toBe(LIGHT_TEXT);
  });
  test('dark fill gives light text, light fill gives dark text', () => {
    expect(resolveLabelColor({ color: '#1e3a8a' })).toBe(LIGHT_TEXT);
    expect(resolveLabelColor({ backgroundColor: '#fde68a' })).toBe(DARK_TEXT);
  });
  test('backgroundColor takes precedence over color', () => {
    expect(resolveLabelColor({ color: '#1e3a8a', backgroundColor: '#ffffff' })).toBe(DARK_TEXT);
  });
});

describe('pack renderers do not hardcode white text on user fills', () => {
  test('ITIL header text contrasts with a light user colour', () => {
    const reg = createDefaultRegistry();
    const pack = reg.get('itil');
    const stencil = pack.stencils.find((s) => s.id === 'change-request');
    const el = { id: 'c1', type: stencil.id, label: 'CR', color: '#fde68a', size: { ...stencil.defaultSize } };
    const { container } = render(<div>{pack.renderNode(el, stencil, false)}</div>);
    expect(container.innerHTML).not.toMatch(/color:\s*white/);
  });
});
