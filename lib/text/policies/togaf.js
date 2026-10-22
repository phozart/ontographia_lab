// lib/text/policies/togaf.js
// Text policies of the TOGAF / ArchiMate stencils (ADR-0008 T2), keyed by stencil id.
// Building blocks: lib/text/policyKit.js. Merged into lib/text/policy.js under the "togaf/" prefix.
//
// Layout of a node: the icon owns a 34 px column at the left (8 px margin + 20 px icon + gap), so the label sits BESIDE
// it instead of stacked under it against the bottom border. Notation drawn at the right edge (the stick figure of an
// actor, the component tabs, the interface circle) reserves its own right inset. Containers draw a one-line header title.

import { BASE, TITLE, inset, m } from '../policyKit';

const LABEL = { ...BASE, role: 'title' }; // 14 px, 600: ArchiMate labels are semibold
const node = (t, r, b, l) => ({ ...LABEL, inset: inset(t, r, b, l) });

const ICON_NODE = node(m, m, m, 34); // icon left, label beside it
const FIGURE_RIGHT = node(m, 34, m, m); // stick figure at the right edge, no icon column
const NOTATION_RIGHT = node(m, 30, m, m); // component tabs at the right edge
const SERVICE = node(m + 2, m, m, 34); // the rounded service shape bulges at the top
const ELLIPSE = node(12, 24, 12, 34); // motivation ovals: the corners of the text box stay inside the curve
const BOX3D = node(14, 16, 8, 34); // node / device: the front face of the 3D box (depth 10)

const CONTAINER = TITLE('header');

export default {
  // business
  'business-actor': FIGURE_RIGHT,
  'business-role': ICON_NODE,
  'business-process': ICON_NODE,
  'business-function': ICON_NODE,
  'business-service': SERVICE,
  'business-object': ICON_NODE,
  product: CONTAINER,
  contract: ICON_NODE,
  // application
  'application-component': NOTATION_RIGHT,
  'application-service': SERVICE,
  'application-interface': node(m, 30, m, 34), // icon left, interface circle right
  'application-function': ICON_NODE,
  'data-object': ICON_NODE,
  // technology
  node: CONTAINER,
  device: BOX3D,
  'system-software': NOTATION_RIGHT,
  'technology-service': SERVICE,
  artifact: ICON_NODE,
  'communication-network': node(6, 22, 6, 38), // pill with an end cap at the left
  // motivation
  stakeholder: FIGURE_RIGHT,
  driver: ELLIPSE,
  assessment: ELLIPSE,
  goal: ELLIPSE,
  outcome: ELLIPSE,
  principle: ICON_NODE,
  requirement: ICON_NODE,
  constraint: ICON_NODE,
  // strategy
  resource: ICON_NODE,
  capability: ICON_NODE,
  'value-stream': node(m, 22, m, 47), // chevron: notch at the left, point at the right
  'course-of-action': ICON_NODE,
  // implementation and migration
  'work-package': ICON_NODE,
  deliverable: ICON_NODE,
  plateau: CONTAINER,
  gap: ICON_NODE,
  // composite
  grouping: CONTAINER,
  location: CONTAINER,
};
