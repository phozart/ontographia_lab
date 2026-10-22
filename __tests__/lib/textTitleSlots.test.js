/**
 * ADR-0008 8 / T2: containers, frames, sections, pools and lanes draw their title in a fixed one-line slot: it never wraps,
 * it never spills past the slot, a title that is too long ends in an ellipsis and reports the overflow (the renderer then
 * draws the badge with the full text), and frames on slide-sized boards scale their title with the frame.
 */
import { PACK_CATALOG } from '../../components/diagram-studio/packs/catalog';
import { policyFor } from '../../lib/text/policy';
import { layoutForTitle } from '../../lib/text/fit';
import { titleBoxOf } from '../../lib/text/policy';
import { MIN_SIZE } from '../../lib/text/tokens';

const LONG = 'Aggregate all inbound partner shipment notifications, reconcile them against open purchase orders and flag any discrepancies for review';
const titleStencils = PACK_CATALOG.flatMap((p) => p.stencils.map((s) => ({ packId: p.id, stencil: s, policy: policyFor(p.id, s) }))).filter((x) => x.policy.slot === 'title');

describe('title slots of every pack', () => {
  test('there are title-slot stencils in the packs (frames, lanes, zones, groups, packages...)', () => {
    expect(titleStencils.length).toBeGreaterThan(15);
  });

  test.each(titleStencils.map((x) => [`${x.packId}/${x.stencil.id}`, x]))('%s: one line, inside its slot, an ellipsis and the overflow flag when cut', (_n, { stencil, policy }) => {
    const size = { width: stencil.defaultSize.width, height: stencil.defaultSize.height };
    const long = layoutForTitle({ label: LONG, size }, policy);
    expect(long.layout.lines).toHaveLength(1);
    expect(long.layout.fontSize).toBeGreaterThanOrEqual(MIN_SIZE);
    expect(long.layout.overflow).toBeTruthy();
    expect(long.layout.lines[0].text.endsWith('…')).toBe(true);
    expect(long.layout.lines[0].width).toBeLessThanOrEqual(long.box.width);
    const short = layoutForTitle({ label: 'Billing', size }, policy);
    expect(short.layout.overflow).toBe(false);
    expect(short.layout.lines[0].text).toBe('Billing');
  });

  test('a frame on a slide-sized board scales its title with the frame, never below 14 px', () => {
    const p = policyFor('core', { id: 'frame', shape: 'frame', defaultSize: { width: 600, height: 400 } });
    const small = layoutForTitle({ label: 'Slide', size: { width: 600, height: 400 } }, p).layout.fontSize;
    const slide = layoutForTitle({ label: 'Slide', size: { width: 1920, height: 1080 } }, p).layout.fontSize;
    expect(small).toBe(14);
    expect(slide).toBe(28);
  });

  test('an element font size overrides the frame scaling', () => {
    const p = policyFor('core', { id: 'frame', shape: 'frame', defaultSize: { width: 600, height: 400 } });
    expect(layoutForTitle({ label: 'Slide', fontSize: 16, size: { width: 1920, height: 1080 } }, p).layout.fontSize).toBe(16);
  });

  test('the title strip honours an icon indent (the icon column is not overlapped)', () => {
    const plain = titleBoxOf({ title: { kind: 'header' } }, { width: 300, height: 200 });
    const indented = titleBoxOf({ title: { kind: 'header', indent: 28 } }, { width: 300, height: 200 });
    expect(indented.x).toBe(plain.x + 28);
    expect(indented.width).toBe(plain.width - 28);
  });

  test('a rotated lane title uses the lane height as its width', () => {
    const p = policyFor('process-flow', PACK_CATALOG.find((x) => x.id === 'process-flow').stencils.find((s) => s.id === 'lane'));
    const t = layoutForTitle({ label: LONG, size: { width: 800, height: 150 } }, p);
    expect(t.box.rotate).toBe(-90);
    expect(t.box.width).toBe(134);
    expect(t.layout.overflow).toBeTruthy();
  });
});
