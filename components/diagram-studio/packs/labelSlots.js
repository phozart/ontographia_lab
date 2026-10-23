// components/diagram-studio/packs/labelSlots.js
// The label slots of the stencils whose canvas renderer draws the name in a bespoke compartment, tab or header strip instead of
// the generic text rectangle of its policy (UML class and lifeline names, swimlane and system-boundary titles, ERD entity
// headers, the persona header, the TOGAF container header, the ITIL CMDB header). One definition: the pack renderers draw
// through it and so do diagram_show and the SVG exporter (ADR-0008 T3), so the canvas and the exports break the same lines in
// the same boxes. Pure: no React, no DOM.
//
// Each function returns a `layoutForSlot` spec (box in the coordinates of the slot's parent) plus `origin`, the offset of that
// parent inside the node, so a server renderer can place it. `null` when the stencil uses its policy slot.

import { layoutForSlot } from '../../../lib/text/fit';
import { ERD_HEADER_H, ERD_ROW_H } from './erdFields';

const LH = 17.5; // the 14 px title role at 1.25
const dims = (element, stencil) => element.size || stencil?.defaultSize || { width: 120, height: 60 };

// ---- UML class family: the NAME compartment, capped so the member compartments keep at least 45% of the node
export function umlClassNameSpec(element, stencil) {
  const { width: W, height: H } = dims(element, stencil);
  const stereo = element.data?.stereotype || (element.type === 'interface' ? 'interface' : element.type === 'enum' ? 'enumeration' : '');
  const stereoH = stereo ? 16 : 0;
  const defH = stencil?.defaultSize?.height || H;
  const maxNameLines = Math.max(1, Math.floor((H * 0.55 - 16 - stereoH) / LH), Math.floor((H - defH + 24 + 1) / LH));
  return { box: { x: 10, y: 8 + stereoH, width: Math.max(20, W - 20), height: maxNameLines * LH }, role: 'title', maxLines: maxNameLines, align: 'center', valign: 'top', own: true };
}

export const umlSystemBoundarySpec = (element, stencil) => ({ box: { x: 10, y: 6, width: Math.max(20, dims(element, stencil).width - 20), height: 20 }, role: 'title', maxLines: 1, align: 'start', own: true });
export const umlSwimlaneSpec = (element, stencil) => ({ box: { x: 8, y: 2, width: Math.max(20, dims(element, stencil).width - 16), height: 24 }, role: 'title', maxLines: 1, align: 'center', own: true });
export const umlLifelineHeadSpec = (element, stencil) => ({ box: { x: 10, y: 8, width: Math.max(20, dims(element, stencil).width - 20), height: 3 * LH }, role: 'label', maxLines: 3, align: 'center', valign: 'top', own: true });

// ---- ITIL CMDB: the title next to the folder icon
export const itilCmdbSpec = (element, stencil) => ({ box: { x: 32, y: 5, width: Math.max(20, dims(element, stencil).width - 40), height: 20 }, role: 'title', maxLines: 1, align: 'start', own: true });

// ---- TOGAF containers: the title in the header strip, after the icon column
const TOGAF_NO_ICON = new Set(['business-actor', 'stakeholder', 'application-component', 'system-software']);
export const TOGAF_CONTAINERS = new Set(['grouping', 'location', 'plateau', 'product', 'node']);
export function togafContainerSpec(element, stencil) {
  const { width } = dims(element, stencil);
  const type = element.type;
  const hasIcon = !TOGAF_NO_ICON.has(type);
  const iconSize = 20;
  const iconLeft = 8;
  const x = iconLeft + (hasIcon ? iconSize + 6 : 0);
  return { box: { x, y: type === 'node' ? 8 : 4, width: Math.max(20, width - x - 8), height: 22 }, role: 'title', maxLines: 1, align: 'start', own: true };
}

// ---- Product design persona header: the name (up to maxLines) and the role under it, centered as one block
export function personaNameSpec(element, stencil, label, policy) {
  const { width, height } = dims(element, stencil);
  const w = Math.max(20, width - policy.inset.l - policy.inset.r);
  const nameLayout = layoutForSlot(element, { text: label, box: { x: 0, y: 0, width: w, height: 80 }, role: 'emphasis', maxLines: policy.maxLines, align: 'start', valign: 'top', own: true }).layout;
  const roleH = 18;
  const gap = 4;
  const nameH = Math.max(nameLayout.height, 22);
  const top = Math.max(4, (height - (nameH + gap + roleH)) / 2);
  return { name: { box: { x: policy.inset.l, y: top, width: w, height: nameH }, role: 'emphasis', maxLines: policy.maxLines, align: 'start', valign: 'top', own: true }, role: { box: { x: policy.inset.l, y: top + nameH + gap, width: w, height: roleH }, role: 'meta', maxLines: 1, align: 'start', valign: 'top' } };
}

// ---- ERD entity: the name through the header strip; a long name makes the header taller
const BADGE_COL = { view: 52, junction: 76 }; // the VIEW / JUNCTION tag at the left of the header (same numbers as the text policy)
const NAME_PAD_X = 12;
/** The header strip: { box (in the header), headerH, border } where `border` is the card border the header sits inside. */
export function erdHeaderSlot(element, stencil, label) {
  const width = element.size?.width || stencil?.defaultSize?.width || 200;
  const height = element.size?.height || stencil?.defaultSize?.height || 160;
  const bw = element.type === 'weak-entity' ? 4 : 2;
  const badgeW = BADGE_COL[element.type] || 0;
  const w = Math.max(20, width - 2 * bw - 2 * NAME_PAD_X - badgeW);
  const maxH = height - 2 * bw - ERD_ROW_H - 12;
  const probe = layoutForSlot(element, { text: label, box: { x: 0, y: 0, width: w, height: 8 * LH }, role: 'title', own: true, maxLines: 8, valign: 'top' });
  const need = Math.ceil(probe.layout.lines.length * probe.layout.lineHeight) + 12;
  const headerH = Math.min(Math.max(ERD_HEADER_H, need), Math.max(ERD_HEADER_H, maxH));
  const box = { x: NAME_PAD_X + badgeW, y: 0, width: w, height: headerH };
  return { spec: { box, role: 'title', own: true, maxLines: 8, valign: 'middle' }, headerH, border: bw };
}

/**
 * The slot a server renderer draws the main label in, for the stencils above: { spec, origin } or null.
 * `spec.text` is not set: the caller passes the label.
 */
export function labelSlotFor(packId, element, stencil, policy) {
  const t = element.type;
  if (packId === 'uml-class') {
    if (t === 'class' || t === 'abstract-class' || t === 'interface' || t === 'enum') return { spec: umlClassNameSpec(element, stencil), origin: { x: 0, y: 0 }, delta: 2 };
    if (t === 'system-boundary') return { spec: umlSystemBoundarySpec(element, stencil), origin: { x: 0, y: 0 }, delta: 2 };
    if (t === 'swimlane') return { spec: umlSwimlaneSpec(element, stencil), origin: { x: 0, y: 0 }, delta: 2 };
    if (t === 'lifeline') return { spec: umlLifelineHeadSpec(element, stencil), origin: { x: 0, y: 0 }, delta: 0 };
  }
  if (packId === 'itil' && t === 'cmdb') return { spec: itilCmdbSpec(element, stencil), origin: { x: 0, y: 0 }, delta: 0 };
  if (packId === 'togaf' && TOGAF_CONTAINERS.has(t)) return { spec: togafContainerSpec(element, stencil), origin: { x: 0, y: 0 }, delta: 0 };
  if (packId === 'product-design' && t === 'persona-header') return { spec: personaNameSpec(element, stencil, element.label || '', policy).name, origin: { x: 0, y: 0 }, delta: 0 };
  if (packId === 'erd' && (t === 'entity' || t === 'weak-entity' || t === 'view' || t === 'junction')) {
    const h = erdHeaderSlot(element, stencil, element.label || 'Untitled');
    return { spec: h.spec, origin: { x: h.border, y: h.border }, delta: 0 };
  }
  return null;
}
