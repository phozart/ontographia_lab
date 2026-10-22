// lib/text/policies/uml-class.js
// Text policies of the uml-class stencils (ADR-0008 T2), keyed by stencil id.
// Building blocks: lib/text/policyKit.js. Merged into lib/text/policy.js under the "uml-class/" prefix.
//
// Classes: the policy describes the NAME compartment (the member compartments are fixed lists drawn by the pack): the name
// area starts below the optional stereotype line and leaves the member area (default height minus the name area) free, so
// a long name grows the node in width first (auto, up to maxW) and then in height, and the members keep their room.
// Small marker shapes (<= 64 px) keep the glyph and put the label below it (external slot, bounded wrap, footprint
// reserved by the layout). Containers (package, system boundary, swimlane, composite state, combined fragment) draw one
// title line with an ellipsis and the badge.

import { BASE, EXTERNAL, TITLE, inset, sym, m, s } from '../policyKit';

const NAME_H = 24; // a one-line name compartment (14 px title role + padding)
const STEREO_H = 16; // «interface» line above the name

// name compartment of a class-like node of `height` (default) with `stereo` px of stereotype above the name
const cls = (height, stereo = 0) => ({ ...BASE, role: 'title', valign: 'top', inset: inset(8 + stereo, 10, Math.max(0, height - 8 - stereo - NAME_H), 10) });
const ACTION = { ...BASE, inset: sym(8, 14) };
const STATE = { ...BASE, inset: sym(8, 14) };
const MARKER = EXTERNAL('below');
const BAR = { ...MARKER, external: { ...MARKER.external, maxWidth: 240 } }; // a 150 px bar: the label stays 240 px at most

export default {
  // class diagram
  class: cls(120),
  'abstract-class': cls(120),
  interface: cls(100, STEREO_H),
  enum: cls(100, STEREO_H),
  package: TITLE('header'),
  'data-type': { ...BASE },
  note: { ...BASE, role: 'caption', align: 'start', valign: 'top', inset: inset(10, 26, 10, 10) },
  constraint: { ...BASE, role: 'caption', inset: sym(8, 12) },
  // use case
  actor: MARKER,
  'use-case': { ...BASE, shape: 'ellipse', inset: sym(3) },
  'system-boundary': TITLE('header'),
  // activity
  'initial-node': MARKER,
  'final-node': MARKER,
  'flow-final': MARKER,
  action: ACTION,
  decision: MARKER,
  'fork-join': BAR,
  swimlane: TITLE('header'),
  'object-node': { ...BASE, inset: sym(s, m) },
  // state machine
  'initial-state': MARKER,
  'final-state': MARKER,
  state: STATE,
  'composite-state': TITLE('header'),
  choice: MARKER,
  history: MARKER,
  // sequence
  lifeline: { ...BASE, valign: 'top', inset: inset(8, 10, 260, 10) },
  activation: MARKER,
  'combined-fragment': TITLE('header', 'meta'),
};
