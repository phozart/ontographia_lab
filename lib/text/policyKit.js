// lib/text/policyKit.js
// Building blocks for the per-pack text policies (lib/text/policies/*.js, ADR-0008 T2): the generic shape policies and
// the inset helpers. Pure data; shared by lib/text/policy.js and the policy files so none of them imports the other.

import { PAD } from './tokens';

export const s = PAD.s;
export const m = PAD.m;
export const l = PAD.l;

export const inset = (t, r, b, left) => ({ t, r, b, l: left });
export const sym = (v, h = v) => inset(v, h, v, h);

export const BASE = { slot: 'inside', shape: 'rect', mode: 'auto', role: 'label', inset: sym(m), maxLines: 8, align: 'center', valign: 'middle' };

export const EXTERNAL = (side = 'below') => ({ slot: 'external', shape: 'rect', mode: 'fixed', role: 'caption', inset: sym(0), maxLines: 3, align: 'center', valign: 'top', external: { side, maxLines: 3, minWidth: 120, gap: 4 } });
export const TITLE = (kind, role = 'title') => ({ slot: 'title', shape: 'rect', mode: 'fixed', role, inset: sym(0), maxLines: 1, align: 'start', valign: 'middle', title: { kind } });
export const NONE = { ...BASE, slot: 'none', mode: 'fixed' };

/** Icon column (px) a stencil draws at the left of its label: the text area starts after it (icon + gap). */
export const ICON_COL = 34;
/** A label box next to an icon column: `iconCol` px reserved at the left, the usual padding elsewhere. */
export const withIcon = (p = BASE, iconCol = ICON_COL) => ({ ...p, inset: inset(p.inset.t, p.inset.r, p.inset.b, iconCol) });
