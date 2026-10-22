// lib/mcp/slideCompose.js
// Pure compilers for the P2 deck tools (ADR-0007 section 9): slide_add with layouts and blocks, slide_update re-compose,
// text_add and theme_apply. They only build ops and run them through `applyOps` (the same applier, validation and locks
// as every other write); the server's `agentWrite` wraps the result in ONE version and ONE audit row.
//
// A new slide is a frame (data.layout remembers its layout) holding, in order: an accent bar (decor), the title text
// (preset from the layout slot), then one element or snapshot copy per block. Everything the tool places carries
// origin.slot so a later re-compose replaces only what the tool put there. Frames and snapshots are built here with ids we
// generate and sent as the internal `paste_clones` op; text goes through `add_element` (sanitizer, label, font size).

import { applyOps, MAX_STRUCTURE_OPS } from './ops';
import { validateDiagramContent } from '../diagramContent';
import { generateId } from '../../components/diagram-studio/utils/ids';
import { buildTableFromSpec } from '../table/tablePatch';
import { tableElementSize } from '../table/tableModel';
import { findPresentation, isFrameElement, nextSlidePosition, SLIDE_SIZES, SLIDE_GAP, frameSize } from '../present/presentationModel';
import { LAYOUT_NAMES, layoutSlots, layoutDecor, layoutBackground, assignBlocksToSlots, MARGIN } from '../present/layouts';
import { decorElement } from '../present/slideBuild';
import { copyIntoSlot, fitScale } from '../present/compose';
import { materializedFontSize, estimateTextHeight, plainLabelOf } from '../present/textPreset';
import { MIN_READABLE } from '../present/textLayout';
import { MAX_BLOCKS_PER_SLIDE, MAX_SLIDES } from '../diagramLimits';
import { boxOf, occupiedSpace, placeBlock, placeInFrame, CONTENT_GAP } from '../layout/freeSpace';

export const DEFAULT_LAYOUT = 'title-body';
export const MAX_NEW_SLIDES_PER_CALL = 40;
const COORD_LIMIT = 99000;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const clip = (s, n = 60) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, n) : String(s).slice(0, n));
const fail = (errors) => ({ ok: false, code: 'INVALID_OPS', errors: (Array.isArray(errors) ? errors : [errors]).slice(0, 20).map((message) => ({ index: -1, message })) });
const V_ALIGN = { top: 'top', middle: 'middle', bottom: 'bottom' };

const frameElement = ({ id, label, x, y, size, aspect, layout }) => ({
  id, type: 'frame', packId: 'core', name: 'Frame', label, layerId: 'default', x, y, size: { ...size }, color: '#64748b', properties: {},
  isFrame: true, membershipExplicit: true,
  data: { backgroundColor: layout ? layoutBackground(layout) : '@bg', showTitle: true, aspect, ...(layout ? { layout } : {}) },
});

function blockKind(b) {
  const keys = ['text', 'copy', 'table'].filter((k) => b[k] !== undefined);
  return keys.length === 1 ? keys[0] : null;
}

/**
 * Ops that build the content of one slide frame: decor, title, blocks. `warnings` carries readability notes.
 * @returns {{ok: true, ops: object[], warnings: string[]} | {ok: false, errors: string[]}}
 */
function slideContentOps(content, { frameId, size, at, layout, title, blocks, revision, idGen }) {
  const lay = layoutSlots(layout, size, at);
  if (lay.ok === false) return { ok: false, errors: [lay.error] };
  const assigned = assignBlocksToSlots(layout, blocks || []);
  if (!assigned.ok) return { ok: false, errors: [assigned.error] };
  const u = size.height / 1080;
  const bySlot = new Map(lay.slots.map((s) => [s.name, s]));
  const ops = [];
  const textOps = [];
  const warnings = [];
  const textOp = (slot, markdown, preset, extra = {}) => {
    const fontSize = materializedFontSize(preset, size.height);
    const need = estimateTextHeight(markdown, preset, slot.w, fontSize);
    let h = slot.h;
    if (need > slot.h) {
      h = need;
      warnings.push(`The text in slot "${slot.name}" needs ${need} units of height but the slot has ${slot.h}; the box grew to fit and may overlap the next slot. Shorten the text or use a layout with more room.`);
    }
    if (fontSize < Math.round(MIN_READABLE[preset] * u)) warnings.push(`The ${preset} text in slot "${slot.name}" is below the minimum readable size for this slide.`);
    return {
      op: 'add_element', type: 'core/text-block', x: slot.x, y: slot.y, w: slot.w, h, parent: frameId,
      text: { preset, markdown, verticalAlign: V_ALIGN[slot.vAlign] || 'top', ...(slot.align ? { align: slot.align } : {}), ...extra },
      origin: { slot: slot.name },
    };
  };
  const wanted = [];

  const titleSlot = bySlot.get('title');
  const titleBlock = assigned.assigned.find((b) => b.slot === 'title');
  if (titleSlot && !titleBlock && title) {
    wanted.push({ slot: titleSlot, block: { text: { markdown: title, preset: titleSlot.preset } } });
  }
  // decor (accent bar above the title; a strip on the cover) gives every slide the same anchor
  const decorElements = layoutDecor(layout, size, at).map((d) => decorElement(idGen('el'), frameId, d));
  for (const b of assigned.assigned) wanted.push({ slot: bySlot.get(b.slot), block: b });

  if (decorElements.length) ops.push({ op: 'paste_clones', elements: decorElements });
  const pasteElements = [];
  const pasteConnections = [];
  for (const { slot, block } of wanted) {
    const kind = blockKind(block);
    if (!kind) return { ok: false, errors: [`The block for slot "${slot.name}" needs exactly one of text, copy, table`] };
    if (kind === 'text') {
      const t = block.text;
      if (!isObj(t) || typeof t.markdown !== 'string') return { ok: false, errors: [`text block in slot "${slot.name}" needs {markdown, preset?}`] };
      const preset = t.preset || slot.preset || 'body';
      const op = textOp(slot, t.markdown, preset, t.color !== undefined ? { color: t.color } : {});
      textOps.push(op);
    } else if (kind === 'copy') {
      const r = copyIntoSlot(content, block.copy, slot, { newId: idGen, revision, parentId: frameId });
      if (!r.ok) return { ok: false, errors: [`slot "${slot.name}": ${r.error}`] };
      const check = validateDiagramContent({ elements: r.elements });
      if (!check.ok) return { ok: false, errors: [`slot "${slot.name}" (copy block): ${check.error}`] };
      pasteElements.push(...r.elements);
      pasteConnections.push(...r.connections);
    } else {
      const built = buildTableFromSpec(block.table, { newId: idGen });
      if (!built.ok) return { ok: false, errors: [`slot "${slot.name}": ${built.errors.join('; ')}`] };
      const nat = tableElementSize(built.table);
      const fit = fitScale(nat, slot);
      if (!fit.ok) return { ok: false, errors: [`slot "${slot.name}": ${fit.error}`] };
      const s = fit.scale;
      const w = nat.width * s;
      const h = nat.height * s;
      pasteElements.push({
        id: idGen('el'), type: 'table', packId: 'core', name: 'Table', label: '', layerId: 'default', parentFrameId: frameId, properties: {},
        x: slot.x + (slot.w - w) / 2, y: slot.y,
        size: { width: w, height: h }, data: { table: { ...built.table, ...(s !== 1 ? { scale: s } : {}) } }, origin: { slot: slot.name },
      });
    }
  }
  const finalOps = [...ops, ...textOps];
  if (pasteElements.length) finalOps.push({ op: 'paste_clones', elements: pasteElements, connections: pasteConnections });
  return { ok: true, ops: finalOps, warnings };
}

/**
 * slide_add for NEW slides: [{title?, layout?, blocks?, notes?}] appended (or inserted at `position`) to a deck.
 * Pure. @returns the applyOps result plus {presentationId, slideIds, frameIds, warnings}
 */
export function compileNewSlides(content, { presentationId, slides, position, revision, newId }) {
  const deck = findPresentation(content, presentationId);
  if (!deck) return fail(`Presentation "${clip(presentationId)}" does not exist; create one with presentation_create or read them with presentation_get`);
  if (!Array.isArray(slides) || slides.length === 0) return fail('slides must be a non-empty array');
  if (slides.length > MAX_NEW_SLIDES_PER_CALL) return fail(`Too many slides in one call (${slides.length}); the limit is ${MAX_NEW_SLIDES_PER_CALL}`);
  if ((deck.slides || []).length + slides.length > MAX_SLIDES) return fail(`A presentation holds at most ${MAX_SLIDES} slides`);
  const size = SLIDE_SIZES[deck.aspect] || SLIDE_SIZES['16:9'];
  const idGen = newId || generateId;
  const ops = [];
  const warnings = [];
  const frameIds = [];
  const origin = nextSlidePosition(content, deck);
  let cursorX = origin.x;
  for (let i = 0; i < slides.length; i += 1) {
    const spec = slides[i];
    const at = `slides[${i}]`;
    if (!isObj(spec)) return fail(`${at} must be an object {title?, layout?, blocks?, notes?}`);
    for (const k of Object.keys(spec)) if (!['title', 'layout', 'blocks', 'notes'].includes(k)) return fail(`${at}: unknown field "${clip(k, 40)}"; allowed: title, layout, blocks, notes`);
    const layout = spec.layout ?? DEFAULT_LAYOUT;
    if (!LAYOUT_NAMES.includes(layout)) return fail(`${at}: unknown layout "${clip(layout)}"; use one of ${LAYOUT_NAMES.join(', ')}`);
    if (spec.blocks !== undefined && (!Array.isArray(spec.blocks) || spec.blocks.length > MAX_BLOCKS_PER_SLIDE)) return fail(`${at}.blocks must be an array of at most ${MAX_BLOCKS_PER_SLIDE} blocks`);
    if (spec.title !== undefined && typeof spec.title !== 'string') return fail(`${at}.title must be a string`);
    const frameId = idGen('el');
    frameIds.push(frameId);
    const label = (spec.title ? plainLabelOf(spec.title) : '') || `Slide ${(deck.slides || []).length + i + 1}`;
    ops.push({ op: 'paste_clones', elements: [frameElement({ id: frameId, label, x: cursorX, y: origin.y, size, aspect: deck.aspect, layout })] });
    const built = slideContentOps(content, { frameId, size, at: { x: cursorX, y: origin.y }, layout, title: spec.title, blocks: spec.blocks || [], revision, idGen });
    if (!built.ok) return fail(built.errors.map((m) => `${at}: ${m}`));
    ops.push(...built.ops);
    warnings.push(...built.warnings.map((w) => `${at}: ${w}`));
    cursorX += size.width + SLIDE_GAP;
  }
  ops.push({
    op: 'presentation_patch', id: presentationId,
    insertSlides: slides.map((s, i) => ({ frameId: frameIds[i], ...(position !== undefined ? { position: position + i } : {}), ...(s.notes !== undefined ? { notes: s.notes } : {}) })),
  });
  if (ops.length > MAX_STRUCTURE_OPS) return fail(`This call compiles to ${ops.length} operations; the limit is ${MAX_STRUCTURE_OPS}. Split it into several calls.`);
  const r = applyOps(content, ops, { internal: true, maxOps: MAX_STRUCTURE_OPS, newId: idGen });
  if (!r.ok) return r;
  const patch = r.presentationPatches[r.presentationPatches.length - 1];
  return { ...r, presentationId, slideIds: patch.slideIds, frameIds, warnings: [...(r.warnings || []), ...warnings.slice(0, 10)] };
}

/** The elements a previous compose placed in a frame (origin.slot), excluding locked ones. */
const placedIn = (content, frameId) => (content.elements || []).filter((e) => isObj(e) && e.parentFrameId === frameId && isObj(e.origin) && typeof e.origin.slot === 'string');

/**
 * slide_update re-compose: replaces only the elements the tool placed (origin.slot), then lays out `title` / `blocks` on
 * `layout` (default: the frame's stored layout, else title-body). Pure.
 */
export function compileSlideRecompose(content, { presentationId, slideId, layout, blocks, title, revision, newId }) {
  const deck = findPresentation(content, presentationId);
  const slide = deck && (deck.slides || []).find((s) => s.id === slideId);
  if (!slide) return fail(`Slide "${clip(slideId)}" is not in presentation "${clip(presentationId)}"`);
  const frame = (content.elements || []).find((e) => isObj(e) && e.id === slide.frameId && isFrameElement(e));
  if (!frame) return fail('This slide has no frame (it was deleted); remove the slide or add a new one');
  if (frame.locked === true) return fail('The slide frame is locked; the owner must unlock it before an agent can change it');
  const lay = layout ?? frame.data?.layout ?? DEFAULT_LAYOUT;
  if (!LAYOUT_NAMES.includes(lay)) return fail(`unknown layout "${clip(lay)}"; use one of ${LAYOUT_NAMES.join(', ')}`);
  const idGen = newId || generateId;
  const size = frameSize(frame);
  const old = placedIn(content, frame.id);
  const locked = old.filter((e) => e.locked === true);
  const removeOps = old.filter((e) => e.locked !== true).map((e) => ({ op: 'remove_element', id: e.id }));
  const slideTitle = title ?? (typeof frame.label === 'string' ? frame.label : undefined);
  const built = slideContentOps(content, { frameId: frame.id, size, at: { x: frame.x || 0, y: frame.y || 0 }, layout: lay, title: slideTitle, blocks: blocks || [], revision, idGen });
  if (!built.ok) return fail(built.errors);
  const ops = [...removeOps, { op: 'update_element', id: frame.id, label: (slideTitle && plainLabelOf(slideTitle)) || frame.label || 'Slide' }, ...built.ops];
  const r0 = applyOps(content, ops, { internal: true, maxOps: MAX_STRUCTURE_OPS, newId: idGen });
  if (!r0.ok) return r0;
  const stamped = r0.content;
  // remember the layout on the frame
  const bgToken = layoutBackground(lay);
  const content2 = {
    ...stamped,
    elements: stamped.elements.map((e) => {
      if (e.id !== frame.id) return e;
      const cur = isObj(e.data) ? e.data : {};
      const themed = cur.backgroundColor === '@bg' || cur.backgroundColor === '@surface';
      return { ...e, data: { ...cur, layout: lay, ...(themed ? { backgroundColor: bgToken } : {}) } };
    }),
  };
  const warnings = [...(r0.warnings || []), ...built.warnings];
  if (locked.length) warnings.push(`${locked.length} locked element${locked.length === 1 ? '' : 's'} placed earlier were kept.`);
  return { ...r0, content: content2, presentationId, warnings };
}

/** resolve text_add placement: inSlide {presentationId, slideId, slot} or anchor {near|at|inFrame}. */
function resolveTextPlacement(content, { anchor, inSlide, width, markdown, preset }) {
  const elements = Array.isArray(content?.elements) ? content.elements : [];
  const byId = new Map(elements.filter(isObj).map((e) => [e.id, e]));
  if (inSlide !== undefined && anchor !== undefined) return { error: 'Give either anchor or inSlide, not both' };
  if (inSlide !== undefined) {
    if (!isObj(inSlide) || typeof inSlide.slot !== 'string') return { error: 'inSlide must be {presentationId, slideId, slot}' };
    const deck = findPresentation(content, inSlide.presentationId);
    const slide = deck && (deck.slides || []).find((s) => s.id === inSlide.slideId);
    if (!slide) return { error: `Slide "${clip(inSlide.slideId)}" is not in presentation "${clip(inSlide.presentationId)}"` };
    const frame = byId.get(slide.frameId);
    if (!frame || !isFrameElement(frame)) return { error: 'This slide has no frame' };
    const layout = frame.data?.layout;
    if (!layout) return { error: 'This slide was not made with a layout, so it has no named slots; use anchor {inFrame: frameId} instead' };
    const slots = layoutSlots(layout, frameSize(frame), { x: frame.x || 0, y: frame.y || 0 });
    const slot = slots.slots.find((s) => s.name === inSlide.slot);
    if (!slot) return { error: `Layout "${layout}" has no slot "${clip(inSlide.slot)}"; its slots are ${slots.slots.map((s) => s.name).join(', ')}` };
    return { kind: 'slot', frame, slot, remove: placedIn(content, frame.id).filter((e) => e.origin.slot === slot.name && e.locked !== true) };
  }
  const size = { w: width || 800, h: estimateTextHeight(markdown, preset, width || 800, materializedFontSize(preset, 1080)) };
  let a = null;
  if (anchor !== undefined) {
    const keys = isObj(anchor) ? Object.keys(anchor) : [];
    if (keys.length !== 1 || !['near', 'at', 'inFrame'].includes(keys[0])) return { error: 'anchor must be exactly one of {near: elementId} | {at: {x, y}} | {inFrame: frameId}' };
    if (keys[0] === 'at') {
      const v = anchor.at;
      if (!isObj(v) || !finite(v.x) || !finite(v.y) || Math.abs(v.x) > COORD_LIMIT || Math.abs(v.y) > COORD_LIMIT) return { error: `anchor.at must be {x, y} with numbers between -${COORD_LIMIT} and ${COORD_LIMIT}` };
      a = { kind: 'at', x: v.x, y: v.y };
    } else {
      const el = typeof anchor[keys[0]] === 'string' ? byId.get(anchor[keys[0]]) : null;
      if (!el) return { error: `anchor.${keys[0]}: element "${clip(anchor[keys[0]])}" does not exist` };
      if (keys[0] === 'inFrame' && !isFrameElement(el)) return { error: `anchor.inFrame: "${clip(anchor.inFrame)}" is not a frame` };
      a = { kind: keys[0], el };
    }
  }
  if (a?.kind === 'inFrame') {
    const frame = a.el;
    const members = elements.filter((e) => isObj(e) && e.parentFrameId === frame.id);
    const space = occupiedSpace(elements, new Set([frame.id]));
    const spot = placeInFrame({ space, frame, size, members });
    return { kind: 'free', x: spot.x, y: spot.y, parent: frame.id, grow: spot.grow, frame };
  }
  const space = occupiedSpace(elements);
  let preferred;
  if (a?.kind === 'at') preferred = { x: a.x, y: a.y };
  else if (a?.kind === 'near') {
    const b = boxOf(a.el);
    preferred = { x: b.x + b.width + CONTENT_GAP / 2, y: b.y };
  }
  const spot = placeBlock({ space, size, preferred });
  return { kind: 'free', x: spot.x, y: spot.y };
}

/** text_add: one preset text on the board (anchor) or in a slide slot (inSlide; replaces the tool-placed text in that slot). Pure. */
export function compileTextAdd(content, { markdown, preset, anchor, inSlide, width, color }) {
  const p = resolveTextPlacement(content, { anchor, inSlide, width, markdown, preset });
  if (p.error) return fail(p.error);
  const ops = [];
  if (p.kind === 'slot') {
    for (const e of p.remove) ops.push({ op: 'remove_element', id: e.id });
    const fontSize = materializedFontSize(preset, frameSize(p.frame).height);
    const need = estimateTextHeight(markdown, preset, p.slot.w, fontSize);
    ops.push({ op: 'add_element', type: 'core/text-block', x: p.slot.x, y: p.slot.y, w: p.slot.w, h: Math.max(p.slot.h, need), parent: p.frame.id, origin: { slot: p.slot.name }, text: { preset, markdown, verticalAlign: V_ALIGN[p.slot.vAlign] || 'top', ...(color ? { color } : {}) } });
  } else {
    if (p.grow) ops.push({ op: 'update_element', id: p.frame.id, w: p.grow.width, h: p.grow.height });
    ops.push({ op: 'add_element', type: 'core/text-block', x: p.x, y: p.y, w: width || 800, ...(p.parent ? { parent: p.parent } : {}), text: { preset, markdown, ...(color ? { color } : {}) } });
  }
  const r = applyOps(content, ops, { newId: generateId, internal: true });
  if (!r.ok) return r;
  const el = r.elements.find((e) => e.type === 'core/text-block');
  return { ...r, elementId: el.id };
}

/** theme_apply -> one theme_set op. Pure. */
export function compileThemeApply(content, { preset, palette, fonts }) {
  const op = { op: 'theme_set', ...(preset !== undefined ? { preset } : {}), ...(palette !== undefined ? { palette } : {}), ...(fonts !== undefined ? { fonts } : {}) };
  const r = applyOps(content, [op]);
  return r.ok ? { ...r, theme: r.content.theme } : r;
}

export { MARGIN };
