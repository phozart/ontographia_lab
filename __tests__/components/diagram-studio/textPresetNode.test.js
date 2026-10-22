// ADR-0007 P2 component tests: the preset text box (rendering through the theme, safe Markdown, inline editing, auto-size).
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

let mockCtx;
jest.mock('../../../components/diagram-studio/DiagramContext', () => ({ useDiagram: () => mockCtx }));

import TextPresetNode from '../../../components/diagram-studio/elements/text/TextPresetNode';
import { renderNode } from '../../../components/diagram-studio/packs/CorePack';
import { themeFromPreset, FONT_STACKS } from '../../../lib/present/themes';

const el = (data, extra = {}) => ({ id: 't1', type: 'text-block', packId: 'core', x: 0, y: 0, size: { width: 600, height: 120 }, label: 'x', fontSize: 72, data: { text: data }, ...extra });
const setCtx = (over = {}) => { mockCtx = { theme: themeFromPreset('ethereal-sky'), updateElement: jest.fn(), diagram: { access: { role: 'owner', canEdit: true } }, ...over }; };
const box = () => screen.getByTestId('text-preset');

beforeEach(() => setCtx());

describe('rendering', () => {
  test('applies the preset typography through the theme', () => {
    render(<TextPresetNode element={el({ preset: 'title', markdown: 'Hello' })} />);
    const s = box().style;
    expect(s.fontSize).toBe('72px');
    expect(s.fontWeight).toBe('700');
    expect(s.fontFamily).toContain('Inter');
    expect(box()).toHaveAttribute('data-preset', 'title');
    expect(box()).toHaveTextContent('Hello');
  });
  test('a theme switch changes colour and font without touching the element', () => {
    const { rerender } = render(<TextPresetNode element={el({ preset: 'body', markdown: 'x' }, { fontSize: 28 })} />);
    const before = box().style.color;
    setCtx({ theme: themeFromPreset('slate-dark') });
    rerender(<TextPresetNode element={el({ preset: 'body', markdown: 'x' }, { fontSize: 28 })} />);
    expect(box().style.color).not.toBe(before);
    setCtx({ theme: themeFromPreset('paper') });
    rerender(<TextPresetNode element={el({ preset: 'body', markdown: 'x' }, { fontSize: 28 })} />);
    expect(box().style.fontFamily).toBe(FONT_STACKS['source-serif-4'].replace(/"/g, '"'));
  });
  test('quote is italic, number uses the number preset size', () => {
    render(<TextPresetNode element={el({ preset: 'quote', markdown: 'q' }, { fontSize: 40 })} />);
    expect(box().style.fontStyle).toBe('italic');
  });
  test('alignment overrides map to text-align and vertical alignment', () => {
    render(<TextPresetNode element={el({ preset: 'body', markdown: 'x', align: 'center', verticalAlign: 'bottom' })} />);
    expect(box().style.textAlign).toBe('center');
    expect(box().style.justifyContent).toBe('flex-end');
  });
  test('never clips: the box allows overflow', () => {
    render(<TextPresetNode element={el({ preset: 'body', markdown: 'x' })} />);
    expect(box().style.overflow).not.toBe('hidden');
  });
});

describe('markdown (safe inline subset)', () => {
  test('bold, italic, lists and https links render as elements', () => {
    render(<TextPresetNode element={el({ preset: 'body', markdown: '**bold** and *it*\n\n- one\n- two\n\n[site](https://example.com)' })} />);
    expect(box().querySelector('strong')).toHaveTextContent('bold');
    expect(box().querySelector('em')).toHaveTextContent('it');
    expect(box().querySelectorAll('li')).toHaveLength(2);
    const a = box().querySelector('a');
    expect(a.getAttribute('href')).toMatch(/^https:\/\/example\.com\/?$/);
    expect(a).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });
  test('hostile markdown becomes text: no script, no javascript: href, no images, no handlers', () => {
    render(<TextPresetNode element={el({ preset: 'body', markdown: '<script>alert(1)</script> [x](javascript:alert(1)) ![i](http://evil/a.png) <img src=x onerror=alert(1)>' })} />);
    expect(box().querySelector('script')).toBeNull();
    expect(box().querySelector('img')).toBeNull();
    for (const a of box().querySelectorAll('a')) expect(a.getAttribute('href')).not.toMatch(/^javascript:/i);
    expect(box().querySelector('[onerror]')).toBeNull(); // the attack text is shown as text, never parsed as markup
  });
});

describe('editing', () => {
  const editing = (over = {}) => ({ editing: true, onDone: jest.fn(), ...over });
  test('shows a textarea with the markdown source; blur commits markdown and the plain label', () => {
    const ctrl = editing();
    render(<TextPresetNode element={el({ preset: 'body', markdown: 'old' })} edit={ctrl} />);
    const ta = screen.getByRole('textbox', { name: /text/i });
    expect(ta).toHaveValue('old');
    fireEvent.change(ta, { target: { value: 'new **text**' } });
    fireEvent.blur(ta);
    expect(mockCtx.updateElement).toHaveBeenCalledWith('t1', expect.objectContaining({ label: 'new text', data: { text: { preset: 'body', markdown: 'new **text**' } } }));
    expect(ctrl.onDone).toHaveBeenCalled();
  });
  test('Escape cancels without writing', () => {
    const ctrl = editing();
    render(<TextPresetNode element={el({ preset: 'body', markdown: 'old' })} edit={ctrl} />);
    const ta = screen.getByRole('textbox');
    fireEvent.change(ta, { target: { value: 'changed' } });
    fireEvent.keyDown(ta, { key: 'Escape' });
    expect(mockCtx.updateElement).not.toHaveBeenCalled();
    expect(ctrl.onDone).toHaveBeenCalledWith(true);
  });
  test('a viewer never gets an editor', () => {
    setCtx({ diagram: { access: { role: 'viewer', canEdit: false } } });
    render(<TextPresetNode element={el({ preset: 'body', markdown: 'old' })} edit={editing()} />);
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});

describe('auto-size', () => {
  const withScrollHeight = (h) => {
    const spy = jest.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(h);
    return () => spy.mockRestore();
  };
  test('an editor grows the box to fit the text (never shrinks, never writes when it fits)', () => {
    const restore = withScrollHeight(300);
    render(<TextPresetNode element={el({ preset: 'body', markdown: 'long' })} />);
    expect(mockCtx.updateElement).toHaveBeenCalledWith('t1', { size: { width: 600, height: 300 } }, expect.any(Object));
    restore();
    mockCtx.updateElement.mockClear();
    const restore2 = withScrollHeight(50);
    render(<TextPresetNode element={el({ preset: 'body', markdown: 'short' })} />);
    expect(mockCtx.updateElement).not.toHaveBeenCalled();
    restore2();
  });
  test('a viewer or a locked box is never written to; the overflow is flagged instead of clipped', () => {
    const restore = withScrollHeight(300);
    setCtx({ diagram: { access: { role: 'viewer', canEdit: false } } });
    render(<TextPresetNode element={el({ preset: 'body', markdown: 'long' })} />);
    expect(mockCtx.updateElement).not.toHaveBeenCalled();
    expect(box()).toHaveAttribute('data-overflow', 'true');
    restore();
  });
});

describe('CorePack.renderNode', () => {
  test('renders the preset node for a text-block with data.text and leaves legacy text-blocks to the default renderer', () => {
    expect(renderNode(el({ preset: 'body', markdown: 'x' }), {}, false)).toBeDefined();
    expect(renderNode({ id: 'l', type: 'text-block', packId: 'core', label: 'legacy' }, {}, false)).toBeUndefined();
  });
});
