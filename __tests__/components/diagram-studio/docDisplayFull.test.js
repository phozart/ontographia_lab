// ADR-0007 P2: doc `display: 'full'` (text without the card chrome, so a doc reads as slide prose).
import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('../../../components/diagram-studio/DiagramContext', () => ({
  useDiagram: () => ({ elements: [], selection: { nodeIds: [], connectionIds: [] }, updateElement: jest.fn(), addElement: jest.fn(), diagram: { access: { role: 'editor' } }, theme: require('../../../lib/present/themes').themeFromPreset('ethereal-sky') }),
}));

import DocCard from '../../../components/diagram-studio/elements/doc/DocCard';
import { newDocElement, cleanDoc, applyDocPatch } from '../../../lib/doc/docElement';
import { validateDiagramContent } from '../../../lib/diagramContent';
import { renderDiagramSvg } from '../../../lib/render/diagramSvg';

const doc = (display, extra = {}) => {
  const el = newDocElement({ id: 'd1', x: 0, y: 0, title: 'Findings', markdown: '# Heading\n\nBody text' });
  return { ...el, ...extra, data: { doc: { ...el.data.doc, ...(display ? { display } : {}) } } };
};

describe('DocCard display modes', () => {
  test('the default card has chrome (title bar)', () => {
    render(<DocCard element={doc()} />);
    expect(screen.getByTestId('doc-card')).toBeInTheDocument();
    expect(screen.getByText('Findings')).toBeInTheDocument();
    expect(screen.getByTestId('doc-card').getAttribute('data-display')).toBe('card');
  });
  test('full mode shows only the text: no title bar, no border, no shadow, a transparent ground, and a slide-sized font', () => {
    render(<DocCard element={doc('full', { fontSize: 28 })} />);
    const card = screen.getByTestId('doc-card');
    expect(card.getAttribute('data-display')).toBe('full');
    expect(screen.queryByText('Findings')).toBeNull();
    expect(card.style.border).toMatch(/^(0|none|)/);
    expect(card.style.boxShadow).toBe('none');
    expect(card.style.background).toMatch(/transparent|^$/);
    const md = card.querySelector('[data-doc-markdown]');
    expect(md.style.fontSize).toBe('28px');
    expect(card.textContent).toContain('Body text');
  });
});

describe('doc.display data model', () => {
  test('cleanDoc keeps card / full and rejects anything else', () => {
    expect(cleanDoc({ title: 't', markdown: '', display: 'full' }).doc.display).toBe('full');
    expect(cleanDoc({ title: 't', markdown: '', display: 'card' }).doc.display).toBe('card');
    expect(cleanDoc({ title: 't', markdown: '', display: 'popup' }).ok).toBe(false);
  });
  test('applyDocPatch accepts display', () => {
    expect(applyDocPatch({ title: 'a', markdown: 'b' }, { display: 'full' }).doc.display).toBe('full');
  });
  test('validateDiagramContent keeps it', () => {
    const r = validateDiagramContent({ elements: [doc('full')] });
    expect(r.content.elements[0].data.doc.display).toBe('full');
  });
});

describe('server SVG', () => {
  test('a full doc draws text without the card rectangle and title', () => {
    const full = renderDiagramSvg({ elements: [{ ...doc('full'), x: 0, y: 0, size: { width: 400, height: 200 } }] });
    expect(full.svg).toContain('Body text');
    expect(full.svg).not.toContain('Findings');
    const card = renderDiagramSvg({ elements: [{ ...doc(), x: 0, y: 0, size: { width: 400, height: 200 } }] });
    expect(card.svg).toContain('Findings');
  });
});
