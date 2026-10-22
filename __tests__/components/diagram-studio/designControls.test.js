// ADR-0007 P2 component tests: theme picker, layout picker, text preset bar, and their place in the Presentation panel.
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';

jest.mock('../../../components/diagram-studio/export/captureCanvas', () => ({ buildExportHost: jest.fn() }));
jest.mock('../../../components/diagram-studio/DiagramContext', () => ({ useDiagram: () => ({}) }));

import { ThemePicker, LayoutPicker, TextPresetBar } from '../../../components/diagram-studio/present/DesignControls';
import PresentationPanel from '../../../components/diagram-studio/present/PresentationPanel';
import { themeFromPreset } from '../../../lib/present/themes';
import { LAYOUT_NAMES } from '../../../lib/present/layouts';
import { TEXT_PRESETS } from '../../../lib/present/textPreset';

describe('ThemePicker', () => {
  test('lists the four presets as a radio group with the current one checked', () => {
    render(<ThemePicker theme={themeFromPreset('paper')} onApply={jest.fn()} />);
    const group = screen.getByRole('radiogroup', { name: 'Theme' });
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((r) => r.textContent)).toEqual(['Ethereal Sky', 'Paper', 'Slate dark', 'Contrast']);
    expect(screen.getByTestId('theme-paper')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('theme-contrast')).toHaveAttribute('aria-checked', 'false');
  });
  test('choosing a preset applies it; choosing a font applies only that font', () => {
    const onApply = jest.fn();
    render(<ThemePicker theme={undefined} onApply={onApply} />);
    expect(screen.getByTestId('theme-ethereal-sky')).toHaveAttribute('aria-checked', 'true'); // the default
    fireEvent.click(screen.getByTestId('theme-slate-dark'));
    expect(onApply).toHaveBeenLastCalledWith({ preset: 'slate-dark' });
    fireEvent.change(screen.getByLabelText('Heading font'), { target: { value: 'montserrat' } });
    expect(onApply).toHaveBeenLastCalledWith({ fonts: { heading: 'montserrat' } });
    fireEvent.change(screen.getByLabelText('Body font'), { target: { value: 'lato' } });
    expect(onApply).toHaveBeenLastCalledWith({ fonts: { body: 'lato' } });
  });
  test('offers only the closed list of self-hosted fonts', () => {
    render(<ThemePicker theme={undefined} onApply={jest.fn()} />);
    const names = within(screen.getByLabelText('Body font')).getAllByRole('option').map((o) => o.textContent);
    expect(names).toEqual(['Inter', 'Source Serif 4', 'IBM Plex Sans', 'IBM Plex Mono', 'Lato', 'Montserrat']);
  });
  test('disabled for read-only roles', () => {
    render(<ThemePicker theme={undefined} onApply={jest.fn()} disabled />);
    expect(screen.getByTestId('theme-paper')).toBeDisabled();
    expect(screen.getByLabelText('Heading font')).toBeDisabled();
  });
  test('swatches show the theme colours', () => {
    render(<ThemePicker theme={undefined} onApply={jest.fn()} />);
    const sw = screen.getByTestId('theme-paper').querySelectorAll('.dc-sw');
    expect(sw.length).toBeGreaterThanOrEqual(4);
  });
});

describe('LayoutPicker', () => {
  const props = (over = {}) => ({ layout: 'two-column', onLayoutChange: jest.fn(), onAddSlide: jest.fn(), onApplyLayout: jest.fn(), canApply: true, ...over });
  test('offers all eight layouts', () => {
    render(<LayoutPicker {...props()} />);
    expect(within(screen.getByLabelText('Slide layout')).getAllByRole('option')).toHaveLength(LAYOUT_NAMES.length);
  });
  test('Add slide with layout and Apply to selected slide pass the chosen layout', () => {
    const p = props();
    render(<LayoutPicker {...p} />);
    fireEvent.click(screen.getByTestId('layout-add-slide'));
    expect(p.onAddSlide).toHaveBeenCalledWith('two-column');
    fireEvent.click(screen.getByTestId('layout-apply'));
    expect(p.onApplyLayout).toHaveBeenCalledWith('two-column');
    fireEvent.change(screen.getByLabelText('Slide layout'), { target: { value: 'big-number' } });
    expect(p.onLayoutChange).toHaveBeenCalledWith('big-number');
  });
  test('Apply is disabled until a slide frame is selected', () => {
    render(<LayoutPicker {...props({ canApply: false })} />);
    expect(screen.getByTestId('layout-apply')).toBeDisabled();
    expect(screen.getByTestId('layout-add-slide')).not.toBeDisabled();
  });
});

describe('TextPresetBar', () => {
  test('one button per preset, each adds that preset', () => {
    const onAdd = jest.fn();
    render(<TextPresetBar onAdd={onAdd} target="Adds to the selected slide" />);
    for (const p of TEXT_PRESETS) fireEvent.click(screen.getByTestId(`add-text-${p}`));
    expect(onAdd.mock.calls.map((c) => c[0])).toEqual(TEXT_PRESETS);
    expect(screen.getByText('Adds to the selected slide')).toBeInTheDocument();
  });
});

describe('inside the Presentation panel', () => {
  const content = { elements: [{ id: 'f1', type: 'frame', packId: 'core', isFrame: true, x: 0, y: 0, size: { width: 1920, height: 1080 }, label: 'A' }], connections: [], presentations: [{ id: 'p1', title: 'Deck', aspect: '16:9', slides: [{ id: 's1', frameId: 'f1' }] }] };
  const base = (over = {}) => ({
    open: true, onClose: jest.fn(), content, activeId: 'p1', onActiveChange: jest.fn(), canEdit: true, selectedFrameIds: ['f1'], patchPresentation: jest.fn(() => ({ ok: true })),
    addElement: jest.fn(), removeElement: jest.fn(), getLiveElements: () => content.elements, onPresent: jest.fn(), onExportPdf: jest.fn(), onExportPng: jest.fn(), onRevealFrame: jest.fn(),
    exporting: null, onCancelExport: jest.fn(), exportError: null, theme: themeFromPreset('ethereal-sky'), onApplyTheme: jest.fn(), onAddSlideWithLayout: jest.fn(), onApplyLayout: jest.fn(), onAddText: jest.fn(), ...over,
  });
  test('an editor sees the design controls and they call the host', () => {
    const p = base();
    render(<PresentationPanel {...p} />);
    fireEvent.click(screen.getByTestId('theme-paper'));
    expect(p.onApplyTheme).toHaveBeenCalledWith({ preset: 'paper' });
    fireEvent.click(screen.getByTestId('layout-add-slide'));
    expect(p.onAddSlideWithLayout).toHaveBeenCalledWith('title-body');
    fireEvent.change(screen.getByLabelText('Slide layout'), { target: { value: 'three-column' } });
    fireEvent.click(screen.getByTestId('layout-apply'));
    expect(p.onApplyLayout).toHaveBeenCalledWith('three-column');
    fireEvent.click(screen.getByTestId('add-text-number'));
    expect(p.onAddText).toHaveBeenCalledWith('number');
  });
  test('a viewer sees none of them', () => {
    render(<PresentationPanel {...base({ canEdit: false })} />);
    expect(screen.queryByTestId('theme-picker')).toBeNull();
    expect(screen.queryByTestId('layout-picker')).toBeNull();
    expect(screen.queryByTestId('text-presets')).toBeNull();
  });
});
