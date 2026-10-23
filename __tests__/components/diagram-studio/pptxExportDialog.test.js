// ADR-0007 P3: the Export PowerPoint dialog states the fidelity limits honestly, has the Office-safe fonts option on by
// default, previews the deck without loading pptxgenjs, and hands the file to the download callback.
import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';

const mockExport = jest.fn();
jest.mock('../../../components/diagram-studio/present/exportPptx', () => {
  const real = jest.requireActual('../../../components/diagram-studio/present/exportPptx');
  return { ...real, exportDeckPptx: (...a) => mockExport(...a) };
});

import PptxExportDialog, { FIDELITY_NOTES } from '../../../components/diagram-studio/present/PptxExportDialog';

const { mixedDeck } = require('../../helpers/pptxFixtures');

function open(over = {}) {
  const deck = mixedDeck();
  const props = { open: true, onClose: jest.fn(), content: deck.content, presentationId: deck.presentationId, boardUrl: 'https://lab.example.com/diagram/LAB-1', onDownload: jest.fn(), ...over };
  const utils = render(<PptxExportDialog {...props} />);
  return { ...utils, props };
}

describe('PptxExportDialog', () => {
  beforeEach(() => mockExport.mockReset());

  test('states the fidelity limits: wraps may differ, no gradients, fonts not embedded, diagrams are pictures', async () => {
    open();
    const box = await screen.findByTestId('pptx-fidelity');
    const text = box.textContent;
    expect(text).toMatch(/line wraps can differ/i);
    expect(text).toMatch(/no gradients/i);
    expect(text).toMatch(/fonts are not embedded/i);
    expect(text).toMatch(/not editable/i);
    expect(text).toMatch(/native powerpoint objects you can edit/i);
    expect(FIDELITY_NOTES.length).toBeGreaterThanOrEqual(5);
  });

  test('previews the deck: slide count, skipped slides, diagram pictures and warnings', async () => {
    open();
    const summary = await screen.findByTestId('pptx-summary');
    await waitFor(() => expect(summary.textContent).toMatch(/4 slides/));
    expect(summary.textContent).toMatch(/2 skipped \(1 hidden, 1 missing\)/);
    expect(summary.textContent).toMatch(/1 diagram group will be pictures/);
    expect(screen.getByTestId('pptx-warnings').textContent).toMatch(/Research notes/);
  });

  test('Office-safe fonts is on by default and explains the other choice', async () => {
    open();
    const box = await screen.findByTestId('pptx-office-fonts');
    expect(box.checked).toBe(true);
    fireEvent.click(box);
    expect(box.checked).toBe(false);
    expect(screen.getByRole('dialog').textContent).toMatch(/need those fonts installed/i);
  });

  test('Export runs the export with the option and hands the result to onDownload', async () => {
    const result = { format: 'pptx', filename: 'Deck.pptx', slides: 4, content: new Blob(['x']), warnings: [] };
    mockExport.mockResolvedValue(result);
    const { props } = open();
    await waitFor(() => expect(screen.getByTestId('pptx-export').disabled).toBe(false));
    fireEvent.click(screen.getByTestId('pptx-office-fonts'));
    await act(async () => { fireEvent.click(screen.getByTestId('pptx-export')); });
    await waitFor(() => expect(props.onDownload).toHaveBeenCalledWith(result));
    expect(mockExport.mock.calls[0][0]).toMatchObject({ presentationId: 'pres-mixed', officeSafeFonts: false, boardUrl: 'https://lab.example.com/diagram/LAB-1' });
    expect((await screen.findByTestId('pptx-done')).textContent).toMatch(/4 slides exported as Deck\.pptx/);
  });

  test('a failed export shows the message and stays open', async () => {
    mockExport.mockRejectedValue(new Error('boom'));
    open();
    await waitFor(() => expect(screen.getByTestId('pptx-export').disabled).toBe(false));
    await act(async () => { fireEvent.click(screen.getByTestId('pptx-export')); });
    expect((await screen.findByRole('alert')).textContent).toBe('boom');
  });

  test('a cancelled export is silent', async () => {
    mockExport.mockRejectedValue(Object.assign(new Error('Export cancelled'), { name: 'AbortError' }));
    open();
    await waitFor(() => expect(screen.getByTestId('pptx-export').disabled).toBe(false));
    await act(async () => { fireEvent.click(screen.getByTestId('pptx-export')); });
    await waitFor(() => expect(screen.getByTestId('pptx-export').disabled).toBe(false));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('Escape closes the dialog and the editor shortcuts do not see the key', async () => {
    const { props } = open();
    await screen.findByTestId('pptx-summary');
    const seen = jest.fn();
    window.addEventListener('keydown', seen); // the editor's handlers listen in the bubble phase
    act(() => { fireEvent.keyDown(window, { key: 'Delete' }); });
    expect(seen).not.toHaveBeenCalled();
    act(() => { fireEvent.keyDown(window, { key: 'Escape' }); });
    expect(props.onClose).toHaveBeenCalled();
    window.removeEventListener('keydown', seen);
  });

  test('a deck with no visible slides cannot be exported', async () => {
    const deck = mixedDeck();
    deck.content.presentations[0].slides.forEach((s) => { s.hidden = true; });
    open({ content: deck.content });
    await waitFor(() => expect(screen.getByTestId('pptx-summary').textContent).toMatch(/0 slides/));
    expect(screen.getByTestId('pptx-export').disabled).toBe(true);
  });

  test('renders nothing while closed', () => {
    const { container } = open({ open: false });
    expect(container.firstChild).toBeNull();
  });
});
