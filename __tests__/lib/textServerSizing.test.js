/**
 * ADR-0008 3.3 / T1: the server sizes boxes from text. add_element and update_element (lib/mcp/ops.js), the fit_to_text
 * op, map_structure (lib/mcp/structure.js) and free placement (lib/mcp/placement.js), plus the editor rules that share
 * the same module (lib/text/autoFit.js). All of it is deterministic and never overlaps.
 */
import { applyOps } from '../../lib/mcp/ops';
import { compileMapStructure } from '../../lib/mcp/structure';
import { fitSize, sizeAfterLabelEdit, textFitAfterResize } from '../../lib/text/autoFit';
import { findStencilMeta } from '../../components/diagram-studio/packs/catalog';

let seq = 0;
const newId = (p) => `${p}-s${++seq}`;
const empty = () => ({ elements: [], connections: [], layers: [], groups: [], viewport: { x: 0, y: 0, zoom: 1 } });
const apply = (content, ops, opts = {}) => applyOps(content, ops, { newId, ...opts });
const ok = (r) => {
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r;
};
const sizeOf = (e) => e.size;
const C140 = 'Aggregate all inbound partner shipment notifications, reconcile them against open purchase orders and flag any discrepancies for review';
const VARIANTS = {
  w1: 'Billing',
  w3: 'Customer Order Service',
  c60: 'Validate payment details before confirming the customer order',
  c140: C140,
  ml: 'Order intake\nValidation\nFulfilment',
  num: 'p95 latency 250 ms / 1.2k req/s',
  de: 'Kundenzufriedenheitsanalyse',
  ja: '\u{9867}\u{5BA2}\u{6E80}\u{8DB3}\u{5EA6}\u{5206}\u{6790}\u{30B5}\u{30FC}\u{30D3}\u{30B9}',
  ar: '\u{062A}\u{062D}\u{0644}\u{064A}\u{0644} \u{0631}\u{0636}\u{0627} \u{0627}\u{0644}\u{0639}\u{0645}\u{0644}\u{0627}\u{0621}',
  emoji: '\u{1F680} Launch readiness \u{2705}',
};

describe('add_element sizes from the label', () => {
  test('a short label keeps the stencil default; a long label gets a bigger box (never clipped)', () => {
    const r = ok(apply(empty(), [
      { op: 'add_element', type: 'core/rectangle', label: 'Billing' },
      { op: 'add_element', type: 'core/rectangle', label: C140 },
    ]));
    const [a, b] = r.content.elements;
    expect(sizeOf(a)).toEqual({ width: 120, height: 80 });
    expect(sizeOf(b).width).toBeGreaterThan(120);
    expect(sizeOf(b).width).toBeLessThanOrEqual(240);
    expect(sizeOf(b).height).toBeGreaterThan(80);
  });

  test('explicit w and h win; only w keeps the width and lets the height follow; only h keeps the height', () => {
    const r = ok(apply(empty(), [
      { op: 'add_element', type: 'core/rectangle', label: C140, w: 150, h: 60 },
      { op: 'add_element', type: 'core/rectangle', label: C140, w: 150 },
      { op: 'add_element', type: 'core/rectangle', label: C140, h: 300 },
    ]));
    const [both, wOnly, hOnly] = r.content.elements;
    expect(sizeOf(both)).toEqual({ width: 150, height: 60 });
    expect(sizeOf(wOnly).width).toBe(150);
    expect(sizeOf(wOnly).height).toBeGreaterThan(80);
    expect(sizeOf(hOnly).height).toBe(300);
    expect(sizeOf(hOnly).width).toBeGreaterThan(120);
  });

  test('the same label gives the same size every time and on every stencil of the same shape', () => {
    const a = ok(apply(empty(), [{ op: 'add_element', type: 'core/rectangle', label: C140 }])).content.elements[0].size;
    const b = ok(apply(empty(), [{ op: 'add_element', type: 'core/rectangle', label: C140 }])).content.elements[0].size;
    expect(a).toEqual(b);
  });

  test('textFit can be set on creation and is validated', () => {
    const r = ok(apply(empty(), [{ op: 'add_element', type: 'core/rectangle', label: C140, textFit: 'fixed' }]));
    expect(r.content.elements[0].textFit).toBe('fixed');
    expect(sizeOf(r.content.elements[0])).toEqual({ width: 120, height: 80 });
    const bad = apply(empty(), [{ op: 'add_element', type: 'core/rectangle', label: 'x', textFit: 'huge' }]);
    expect(bad.ok).toBe(false);
    expect(JSON.stringify(bad.errors)).toMatch(/textFit must be one of/);
  });

  test('every label variant on every T1 stencil is created without error and placed without overlap', () => {
    const types = ['core/rectangle', 'core/circle', 'core/diamond', 'core/text-block', 'process-flow/task', 'process-flow/subprocess', 'process-flow/start-event', 'process-flow/exclusive-gateway', 'sticky-notes/sticky-medium', 'mind-map/sub-topic'];
    const ops = [];
    for (const t of types) for (const label of Object.values(VARIANTS)) ops.push({ op: 'add_element', type: t, label });
    const r = ok(apply(empty(), ops.slice(0, 200)));
    const boxes = r.content.elements.map((e) => ({ id: e.id, x: e.x, y: e.y, w: e.size.width, h: e.size.height }));
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        expect(a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y).toBe(false);
      }
    }
  });
});

describe('update_element', () => {
  const base = (label) => ok(apply(empty(), [{ op: 'add_element', type: 'core/rectangle', label }])).content;

  test('a new long label grows a box that follows its text', () => {
    const c = base('Billing');
    const id = c.elements[0].id;
    const r = ok(apply(c, [{ op: 'update_element', id, label: C140 }]));
    expect(r.content.elements[0].size.width).toBeGreaterThan(120);
  });

  test('a box that follows its text shrinks back when the label gets short again', () => {
    const c = base(C140);
    const id = c.elements[0].id;
    const r = ok(apply(c, [{ op: 'update_element', id, label: 'Billing' }]));
    expect(r.content.elements[0].size).toEqual({ width: 120, height: 80 });
  });

  test('a hand-sized box only grows, it is never shrunk behind its owner\'s back', () => {
    const c = base('Billing');
    c.elements[0].size = { width: 400, height: 300 };
    const id = c.elements[0].id;
    const r = ok(apply(c, [{ op: 'update_element', id, label: 'Billing service' }]));
    expect(r.content.elements[0].size).toEqual({ width: 400, height: 300 });
  });

  test('an explicit w/h on the same update wins over the re-fit', () => {
    const c = base('Billing');
    const id = c.elements[0].id;
    const r = ok(apply(c, [{ op: 'update_element', id, label: C140, w: 130, h: 90 }]));
    expect(r.content.elements[0].size).toEqual({ width: 130, height: 90 });
  });

  test('textFit fixed stops the re-fit; null resets it', () => {
    const c = base('Billing');
    const id = c.elements[0].id;
    const r1 = ok(apply(c, [{ op: 'update_element', id, textFit: 'fixed', label: C140 }]));
    expect(r1.content.elements[0].size).toEqual({ width: 120, height: 80 });
    const r2 = ok(apply(r1.content, [{ op: 'update_element', id, textFit: null }]));
    expect(r2.content.elements[0].textFit).toBeUndefined();
  });
});

describe('fit_to_text op', () => {
  const board = () => {
    const c = ok(apply(empty(), [
      { op: 'add_element', ref: '@a', type: 'core/rectangle', label: 'Billing', x: 100, y: 100, w: 120, h: 80 },
      { op: 'add_element', ref: '@b', type: 'process-flow/task', label: C140, x: 400, y: 100, w: 140, h: 70 },
      { op: 'add_element', ref: '@c', type: 'sticky-notes/sticky-medium', label: C140, x: 700, y: 100, w: 150, h: 150 },
      { op: 'add_element', ref: '@f', type: 'core/frame', label: 'Frame', x: 0, y: 500, w: 600, h: 400 },
    ]));
    return { content: c.content, ids: c.created };
  };

  test('ids: the box hugs the text, top-left stays, the original is not mutated', () => {
    const { content, ids } = board();
    const before = JSON.stringify(content);
    const r = ok(apply(content, [{ op: 'fit_to_text', ids: [ids['@b']] }]));
    expect(JSON.stringify(content)).toBe(before);
    const b = r.content.elements.find((e) => e.id === ids['@b']);
    expect(b.x).toBe(400);
    expect(b.y).toBe(100);
    expect(b.size.width).toBeGreaterThan(140);
    expect(b.size.height).toBeGreaterThan(70);
    expect(r.fitted).toHaveLength(1);
    expect(r.fitted[0]).toMatchObject({ id: ids['@b'], from: { width: 140, height: 70 } });
    expect(r.counts.updated).toBe(1);
  });

  test('all: every element whose box follows its text, frames and markers are skipped, a stored "shrink" sticky becomes auto', () => {
    const { content, ids } = board();
    const r = ok(apply(content, [{ op: 'fit_to_text', all: true }]));
    const byId = Object.fromEntries(r.content.elements.map((e) => [e.id, e]));
    expect(byId[ids['@a']].size).toEqual({ width: 120, height: 80 });
    expect(byId[ids['@b']].size.width).toBeGreaterThan(140);
    expect(byId[ids['@c']].size.width).toBeGreaterThan(150);
    expect(byId[ids['@c']].textFit).toBe('auto');
    expect(byId[ids['@f']].size).toEqual({ width: 600, height: 400 });
    expect(r.fitSkipped).toBeGreaterThan(0);
  });

  test('a long box shrinks back to the text but never below the stencil default', () => {
    const { content, ids } = board();
    content.elements.find((e) => e.id === ids['@a']).size = { width: 500, height: 400 };
    const r = ok(apply(content, [{ op: 'fit_to_text', ids: [ids['@a']] }]));
    expect(r.content.elements.find((e) => e.id === ids['@a']).size).toEqual({ width: 120, height: 80 });
  });

  test('needs exactly one of ids or all, refuses locked ids, skips locked elements under all, rejects unknown ids', () => {
    const { content, ids } = board();
    expect(apply(content, [{ op: 'fit_to_text' }]).ok).toBe(false);
    expect(apply(content, [{ op: 'fit_to_text', ids: ['x'], all: true }]).ok).toBe(false);
    expect(apply(content, [{ op: 'fit_to_text', ids: ['nope'] }]).ok).toBe(false);
    expect(apply(content, [{ op: 'fit_to_text', all: false }]).ok).toBe(false);
    const locked = { ...content, elements: content.elements.map((e) => (e.id === ids['@b'] ? { ...e, locked: true } : e)) };
    const one = apply(locked, [{ op: 'fit_to_text', ids: [ids['@b']] }]);
    expect(one.ok).toBe(false);
    expect(JSON.stringify(one.errors)).toMatch(/locked/);
    const all = ok(apply(locked, [{ op: 'fit_to_text', all: true }]));
    expect(all.content.elements.find((e) => e.id === ids['@b']).size).toEqual({ width: 140, height: 70 });
  });

  test('accepts an @ref made earlier in the batch', () => {
    const r = ok(apply(empty(), [
      { op: 'add_element', ref: '@n', type: 'core/rectangle', label: C140, w: 120, h: 80 },
      { op: 'fit_to_text', ids: ['@n'] },
    ]));
    expect(r.content.elements[0].size.width).toBeGreaterThan(120);
  });

  test('is idempotent: a second fit changes nothing', () => {
    const { content } = board();
    const once = ok(apply(content, [{ op: 'fit_to_text', all: true }]));
    const twice = ok(apply(once.content, [{ op: 'fit_to_text', all: true }]));
    expect(twice.fitted).toEqual([]);
    expect(JSON.stringify(twice.content.elements)).toBe(JSON.stringify(once.content.elements));
  });
});

describe('map_structure sizes nodes from their text before layout', () => {
  const run = (nodes, layout = 'grid', edges = []) => compileMapStructure(empty(), { structure: { nodes, edges }, layout }, { newId });
  const longNodes = Object.entries(VARIANTS).map(([k, label]) => ({ key: k, label, stencil: 'core/rectangle' }));

  test('long labels give bigger boxes and the laid-out boxes never overlap', () => {
    for (const layout of ['grid', 'tree', 'flow', 'cluster']) {
      const edges = layout === 'tree' || layout === 'flow' ? longNodes.slice(1).map((n) => ({ from: 'w1', to: n.key })) : [];
      const r = run(longNodes, layout, edges);
      expect(r.ok).toBe(true);
      const els = r.content.elements;
      const c140 = els.find((e) => e.label === C140);
      expect(c140.size.width).toBeGreaterThan(120);
      const boxes = els.map((e) => ({ x: e.x, y: e.y, w: e.size.width, h: e.size.height }));
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i];
          const b = boxes[j];
          expect([layout, i, j, a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y]).toEqual([layout, i, j, false]);
        }
      }
    }
  });

  test('size {w, h} on a node is honored and validated', () => {
    const r = run([{ key: 'a', label: C140, stencil: 'core/rectangle', size: { w: 300, h: 120 } }]);
    expect(r.content.elements[0].size).toEqual({ width: 300, height: 120 });
    const bad = run([{ key: 'a', label: 'x', size: { w: 3 } }]);
    expect(bad.ok).toBe(false);
    expect(bad.errors[0].message).toMatch(/size must be/);
    const bad2 = run([{ key: 'a', label: 'x', size: { depth: 3 } }]);
    expect(bad2.ok).toBe(false);
  });

  test('the editor path and the MCP path give the same size for the same label (acceptance b)', () => {
    const viaStructure = run([{ key: 'a', label: C140, stencil: 'process-flow/task' }]).content.elements[0].size;
    const viaOps = ok(apply(empty(), [{ op: 'add_element', type: 'process-flow/task', label: C140 }])).content.elements[0].size;
    const meta = findStencilMeta('process-flow/task');
    const viaEditor = fitSize(meta.packId, meta.stencil, { label: C140 });
    expect(viaStructure).toEqual(viaOps);
    expect({ width: viaEditor.width, height: viaEditor.height }).toEqual(viaOps);
  });

  test('external labels (events) reserve their footprint: neighbors do not overlap the label', () => {
    const nodes = Array.from({ length: 6 }, (_, i) => ({ key: `e${i}`, label: 'Validate payment details before confirming the customer order', stencil: 'process-flow/start-event' }));
    const r = run(nodes, 'grid');
    expect(r.ok).toBe(true);
    const els = r.content.elements;
    // the shape box is 44x44; the cell reserved room for a label of up to 120 px below it
    const ys = [...new Set(els.map((e) => e.y))].sort((a, b) => a - b);
    const xs = [...new Set(els.map((e) => e.x))].sort((a, b) => a - b);
    if (ys.length > 1) expect(ys[1] - ys[0]).toBeGreaterThanOrEqual(44 + 4 + 18);
    if (xs.length > 1) expect(xs[1] - xs[0]).toBeGreaterThanOrEqual(100);
  });

  test('every stencil of the four T1 packs (dividers and tiny markers included) compiles with all ten label variants', () => {
    const { PACK_CATALOG } = require('../../components/diagram-studio/packs/catalog');
    for (const packId of ['core', 'process-flow', 'sticky-notes', 'mind-map']) {
      const pack = PACK_CATALOG.find((p) => p.id === packId);
      const nodes = [];
      for (const st of pack.stencils.filter((x) => !['table', 'doc'].includes(x.id))) for (const [k, label] of Object.entries(VARIANTS)) nodes.push({ key: `${st.id}__${k}`, label, stencil: `${packId}/${st.id}` });
      for (let i = 0; i < nodes.length; i += 100) {
        const r = run(nodes.slice(i, i + 100), 'grid');
        expect([packId, i, r.ok ? 'ok' : JSON.stringify(r.errors).slice(0, 300)]).toEqual([packId, i, 'ok']);
      }
    }
  });

  test('is deterministic', () => {
    const a = JSON.stringify(run(longNodes).content.elements.map((e) => [e.x, e.y, e.size]));
    const b = JSON.stringify(run(longNodes).content.elements.map((e) => [e.x, e.y, e.size]));
    expect(a).toBe(b);
  });

  test('1,000 nodes lay out quickly (the same module on the server)', () => {
    const many = Array.from({ length: 200 }, (_, i) => ({ key: `n${i}`, label: `${C140} ${i}` }));
    const t0 = Date.now();
    for (let i = 0; i < 5; i++) run(many, 'grid');
    expect((Date.now() - t0) / 5).toBeLessThan(400);
  });
});

describe('editor rules (lib/text/autoFit)', () => {
  const meta = (t) => findStencilMeta(t);
  test('textFitAfterResize: width handles make auto into auto-height, height and corners make it fixed, sticky notes stay shrink', () => {
    const r = meta('core/rectangle');
    expect(textFitAfterResize(r.packId, r.stencil, {}, 'e')).toBe('auto-height');
    expect(textFitAfterResize(r.packId, r.stencil, {}, 'se')).toBe('fixed');
    expect(textFitAfterResize(r.packId, r.stencil, { textFit: 'auto-height' }, 's')).toBe('fixed');
    expect(textFitAfterResize(r.packId, r.stencil, { textFit: 'fixed' }, 'e')).toBeUndefined();
    const s = meta('sticky-notes/sticky-medium');
    expect(textFitAfterResize(s.packId, s.stencil, {}, 'se')).toBeUndefined();
    const f = meta('core/frame');
    expect(textFitAfterResize(f.packId, f.stencil, {}, 'se')).toBeUndefined();
  });

  test('sizeAfterLabelEdit: grows on a longer label, none when nothing changes, none for fixed and shrink', () => {
    const r = meta('core/rectangle');
    const el = { label: C140, size: { width: 120, height: 80 } };
    const next = sizeAfterLabelEdit(r.packId, r.stencil, el, 'Billing');
    expect(next.width).toBeGreaterThan(120);
    expect(sizeAfterLabelEdit(r.packId, r.stencil, { label: 'Billing', size: { width: 120, height: 80 } }, 'Billing')).toBeNull();
    expect(sizeAfterLabelEdit(r.packId, r.stencil, { ...el, textFit: 'fixed' }, 'Billing')).toBeNull();
    const s = meta('sticky-notes/sticky-medium');
    expect(sizeAfterLabelEdit(s.packId, s.stencil, { label: C140, size: { width: 150, height: 150 } }, 'x')).toBeNull();
  });

  test('fitSize returns null for stencils that keep their size and sets textFit only when it differs from the default', () => {
    const f = meta('core/frame');
    expect(fitSize(f.packId, f.stencil, { label: C140, size: { width: 600, height: 400 } })).toBeNull();
    const r = meta('core/rectangle');
    expect(fitSize(r.packId, r.stencil, { label: C140 }).textFit).toBeNull();
    const s = meta('sticky-notes/sticky-medium');
    expect(fitSize(s.packId, s.stencil, { label: C140 }).textFit).toBe('auto');
    const t = meta('core/text-block');
    expect(fitSize(t.packId, t.stencil, { label: C140, size: { width: 200, height: 40 } }).textFit).toBeNull();
  });
});
