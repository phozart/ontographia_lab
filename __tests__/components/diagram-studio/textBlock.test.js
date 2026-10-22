/**
 * ADR-0008 T1: the shared text component and the migrated renderNodes (Core, ProcessFlow, StickyNotes, MindMap).
 * Every label is drawn as pinned lines from the shared layout: no browser wrapping, 11 px minimum, an overflow badge
 * with the full text instead of silent clipping.
 */
import React from 'react';
import { render, act } from '@testing-library/react';
import TextBlock from '../../../components/diagram-studio/text/TextBlock';
import { layoutText } from '../../../lib/text/layout';
import CorePack from '../../../components/diagram-studio/packs/CorePack';
import ProcessFlowPack from '../../../components/diagram-studio/packs/ProcessFlowPack';
import StickyNotesPack from '../../../components/diagram-studio/packs/StickyNotesPack';
import MindMapPack from '../../../components/diagram-studio/packs/MindMapPack';
import { sizeForText } from '../../../lib/text/fit';
import fs from 'fs';
import path from 'path';

const css = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'styles', 'diagram-studio.css'), 'utf8');

const C140 = 'Aggregate all inbound partner shipment notifications, reconcile them against open purchase orders and flag any discrepancies for review';
const pack = { core: CorePack, 'process-flow': ProcessFlowPack, 'sticky-notes': StickyNotesPack, 'mind-map': MindMapPack };

function draw(packId, stencilId, label, extra = {}) {
  const p = pack[packId];
  const stencil = p.stencils.find((s) => s.id === stencilId);
  const el = { id: 'n1', type: stencilId, packId, label, x: 0, y: 0, size: { ...stencil.defaultSize }, ...extra };
  const out = p.renderNode(el, stencil, false);
  return render(<div>{out}</div>);
}
// the drawn lines of every text block: the block's own text node split on newlines (or its line spans for RTL)
const blockLines = (block) => {
  const spans = [...block.querySelectorAll(':scope > .ds-text-line')];
  if (spans.length) return spans.map((x) => x.textContent.replace(/\n$/, ''));
  return [...block.childNodes].filter((n) => n.nodeType === 3).map((n) => n.nodeValue).join('').split('\n');
};
const lineSpans = (c) => [...c.container.querySelectorAll('[data-text-block]')].flatMap((b) => (b.textContent === '' ? [] : blockLines(b)));
const sizes = (c) => [...c.container.querySelectorAll('[data-text-block]')].map((b) => parseFloat(b.getAttribute('data-font-size')));

describe('TextBlock', () => {
  const layout = layoutText({ text: 'Customer Order Service', font: { size: 14, weight: 500, lineHeight: 1.3 }, box: { width: 80, height: 60 }, mode: 'fixed' });

  test('LTR text is one text node of newline-joined lines; only per-node values are inline', () => {
    const { container } = render(<TextBlock layout={layout} box={{ x: 5, y: 7, width: 80, height: 60 }} color="#123456" />);
    const block = container.querySelector('[data-text-block]');
    expect(container.querySelectorAll('.ds-text-line')).toHaveLength(0);
    expect(blockLines(block)).toEqual(layout.lines.map((l) => l.text));
    expect(block.childNodes).toHaveLength(1); // a div and one text node per label
    expect(block.style.left).toBe('5px');
    expect(block.style.top).toBe('7px');
    expect(block.style.color).toBe('rgb(18, 52, 86)');
    expect(block.style.fontSize).toBe('14px');
    expect(block.classList.contains('ds-text-lh130')).toBe(true); // the role line height is a class (1.3 x 14 = 18.2 px)
    expect(css).toMatch(/\.ds-text-lh130\s*\{\s*line-height:\s*1\.3/);
    expect(parseFloat(block.style.paddingTop || '0')).toBeCloseTo(layout.lines[0].top, 1); // the vertical-align offset
    expect(block.classList.contains('ds-text-w500')).toBe(true);
    expect(block.getAttribute('data-font-size')).toBe('14');
    expect(block.getAttribute('data-overflow')).toBeNull();
    expect(container.querySelector('.ds-text-badge')).toBeNull();
    expect(block.getAttribute('style').split(';').filter(Boolean).length).toBeLessThanOrEqual(8); // perf: few style writes per node
    expect(css).toMatch(/\.ds-text\s*\{[^}]*white-space:\s*pre/);
  });

  test('textContent keeps the words apart across lines (copy, search and tests read it)', () => {
    const { container } = render(<TextBlock layout={layout} box={{ x: 0, y: 0, width: 80, height: 60 }} />);
    expect(container.textContent.replace(/\s+/g, ' ').trim()).toBe('Customer Order Service'); // lines are separated by a newline, so words never fuse
  });

  test('a clamped layout shows an accent badge whose title is the full text, never silent', () => {
    const clamped = layoutText({ text: C140, font: { size: 14, weight: 500, lineHeight: 1.3 }, box: { width: 90, height: 40 }, mode: 'fixed' });
    const { container } = render(<TextBlock layout={clamped} box={{ x: 0, y: 0, width: 90, height: 40 }} />);
    const badge = container.querySelector('.ds-text-badge');
    expect(badge).not.toBeNull();
    expect(badge.getAttribute('title')).toBe(C140);
    expect(badge.getAttribute('role')).toBe('button'); // keyboard reachable, with the full text on focus
    expect(badge.getAttribute('tabindex')).toBe('0');
    expect(badge.querySelector('.ds-text-full')).toBeNull(); // the popover exists only while focused
    act(() => badge.focus());
    expect(badge.querySelector('.ds-text-full').textContent).toBe(C140);
    act(() => badge.blur());
    expect(badge.querySelector('.ds-text-full')).toBeNull();
    expect(badge.getAttribute('aria-label')).toContain(C140);
    expect(container.querySelector('[data-text-block]').getAttribute('data-overflow')).toBe('true');
    expect(css).toMatch(/\.ds-text-badge\s*\{[^}]*pointer-events:\s*auto/); // hover works; the rest of the block never blocks the node
    expect(css).toMatch(/\.ds-text\s*\{[^}]*pointer-events:\s*none/);
  });

  test('right-to-left lines carry their direction', () => {
    const ar = layoutText({ text: '\u{062A}\u{062D}\u{0644}\u{064A}\u{0644} \u{0631}\u{0636}\u{0627}', font: { size: 14, weight: 500, lineHeight: 1.3 }, box: { width: 200, height: 40 }, mode: 'fixed', align: 'start' });
    const { container } = render(<TextBlock layout={ar} box={{ x: 0, y: 0, width: 200, height: 40 }} />);
    const span = container.querySelector('.ds-text-line');
    expect(span.getAttribute('dir')).toBe('rtl');
    expect(css).toMatch(/\.ds-text-line\s*\{[^}]*unicode-bidi:\s*plaintext/);
    expect(css).not.toMatch(/\.ds-text\s*\{[^}]*user-select:\s*none/); // the label can be selected and copied
  });

  test('the badge glyph has at least 3:1 contrast (white on the badge background)', () => {
    const { parseColor, contrastRatio } = require('../../../components/diagram-studio/packs/colorUtils');
    const bg = /\.ds-text-badge\s*\{[^}]*background:\s*(#[0-9a-f]{6})/i.exec(css)[1];
    expect(contrastRatio(parseColor(bg), parseColor('#ffffff'))).toBeGreaterThanOrEqual(3);
  });

  test('renders nothing without a layout', () => {
    const { container } = render(<TextBlock layout={null} box={null} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('migrated renderNodes', () => {
  test('Core diamond: label through the shared layout, no rotation', () => {
    const fit = sizeForText('core', CorePack.stencils.find((s) => s.id === 'diamond'), 'Decision?');
    const c = draw('core', 'diamond', 'Decision?', { size: { width: fit.width, height: fit.height } });
    expect(lineSpans(c)).toHaveLength(1);
    expect(c.container.innerHTML).not.toMatch(/rotate\(/);
  });

  test('Core frame and section: one-line title with an ellipsis and badge when it does not fit', () => {
    const f = draw('core', 'frame', C140, { size: { width: 200, height: 120 } });
    expect(lineSpans(f)[0].trim().endsWith('\u{2026}')).toBe(true);
    expect(f.container.querySelector('.ds-text-badge').getAttribute('title')).toBe(C140);
    const s = draw('core', 'section', C140, { size: { width: 200, height: 120 } });
    expect(lineSpans(s)[0].trim().endsWith('\u{2026}')).toBe(true);
  });

  test('ProcessFlow task keeps a column free for the type icon and wraps instead of clamping at 2 lines', () => {
    const fit = sizeForText('process-flow', ProcessFlowPack.stencils.find((s) => s.id === 'task'), C140);
    const c = draw('process-flow', 'task', C140, { size: { width: fit.width, height: fit.height }, data: { taskType: 'user' } });
    expect(lineSpans(c).length).toBeGreaterThan(2);
    expect(c.container.querySelector('.ds-text-badge')).toBeNull();
    expect(c.container.innerHTML).not.toMatch(/line-clamp/i);
  });

  test.each(['start-event', 'end-event', 'intermediate-event', 'parallel-gateway', 'data-object', 'data-store'])('ProcessFlow %s: the label hangs below, wrapped to at most 3 lines', (id) => {
    const c = draw('process-flow', id, C140);
    const spans = lineSpans(c);
    expect(spans.length).toBeLessThanOrEqual(3);
    expect(c.container.querySelector('.ds-node-label-below')).not.toBeNull();
    expect(c.container.querySelector('.ds-text-badge')).not.toBeNull(); // 140 chars cannot fit 3 lines of 120 px
  });

  test('ProcessFlow swimlane title is drawn rotated by the shared layout, one line', () => {
    const c = draw('process-flow', 'lane', 'Finance');
    expect(lineSpans(c)).toHaveLength(1);
    expect(c.container.querySelector('[data-text-block]').style.transform).toMatch(/rotate\(-90deg\)/);
  });

  test('StickyNotes: no handwriting font request, the text shrinks (min 11 px) and is badged when it still does not fit', () => {
    const c = draw('sticky-notes', 'sticky-small', C140);
    expect(c.container.innerHTML).not.toMatch(/Patrick Hand/);
    expect(Math.min(...sizes(c))).toBeGreaterThanOrEqual(11);
    expect(c.container.querySelector('.ds-text-badge')).not.toBeNull();
    const short = draw('sticky-notes', 'sticky-medium', 'Idea');
    expect(sizes(short)[0]).toBe(14);
    expect(short.container.querySelector('.ds-text-badge')).toBeNull();
  });

  test('StickyNotes containers, markers and link cards use the shared layout', () => {
    const g = draw('sticky-notes', 'group-box', 'Category A');
    expect(g.container.innerHTML).not.toMatch(/uppercase/);
    expect(lineSpans(g)).toHaveLength(1);
    const m = draw('sticky-notes', 'circle-marker', 'Flag');
    expect(m.container.querySelector('.ds-node-label-below')).not.toBeNull();
    const l = draw('sticky-notes', 'link-card', 'Docs', { data: { url: 'https://example.com/a/very/long/url' } });
    expect(lineSpans(l)).toHaveLength(2); // the title and the URL line (a shared-layout slot, ellipsis + badge with the full URL)
    expect(l.container.querySelector('[data-text-block="url"] [title="https://example.com/a/very/long/url"], [title="https://example.com/a/very/long/url"]')).not.toBeNull();
  });

  test.each(['central-topic', 'main-topic', 'sub-topic', 'floating-topic', 'topic-red', 'callout', 'boundary', 'summary'])('MindMap %s: shape in an svg, label in HTML lines, min 11 px', (id) => {
    const c = draw('mind-map', id, 'Customer Order Service');
    expect(c.container.querySelector('svg')).not.toBeNull();
    expect(c.container.querySelectorAll('svg text')).toHaveLength(0);
    expect(lineSpans(c).length).toBeGreaterThan(0);
    expect(Math.min(...sizes(c))).toBeGreaterThanOrEqual(11);
  });

  test('MindMap central topic uses the emphasis role (18 px) when it fits', () => {
    const c = draw('mind-map', 'central-topic', 'Hub');
    expect(sizes(c)[0]).toBe(18);
  });

  test('no migrated renderer draws below 11 px for any T1 stencil and a 140-character label', () => {
    for (const [packId, p] of Object.entries(pack)) {
      for (const st of p.stencils) {
        const el = { id: 'n', type: st.id, packId, label: C140, x: 0, y: 0, size: { ...st.defaultSize } };
        const out = p.renderNode(el, st, false);
        if (out === undefined || out === null) continue;
        const { container, unmount } = render(<div>{out}</div>);
        for (const b of container.querySelectorAll('[data-text-block]')) expect([packId, st.id, parseFloat(b.getAttribute('data-font-size')) >= 11]).toEqual([packId, st.id, true]);
        unmount();
      }
    }
  });
});
