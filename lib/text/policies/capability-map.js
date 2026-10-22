// lib/text/policies/capability-map.js
// Text policies of the capability-map stencils (ADR-0008 T2), keyed by stencil id.
// Building blocks: lib/text/policyKit.js. Merged into lib/text/policy.js under the "capability-map/" prefix.
//
// Cards have a color bar (4 px) and an emoji icon at the left, so the text area starts after a 34 px column. Chevrons
// (value stream and stage) keep their points clear: 23 px on both sides. Groups, swimlanes and the operating model are
// fixed one-line header titles that start after the icon. The annotation is paper (`shrink`).

import { BASE, TITLE, inset, sym, m, l, ICON_COL } from '../policyKit';

const CARD = { ...BASE, inset: inset(m, m, m, ICON_COL), maxLines: 6 };
const CHEVRON = { ...BASE, role: 'title', inset: inset(6, 23, 6, 23) };
const HEADER = { ...TITLE('header'), title: { kind: 'header', indent: 24 } };

export default {
  'cap-capability': CARD,
  'cap-capability-group': HEADER,
  'cap-value-stream': CHEVRON,
  'cap-value-stage': CHEVRON,
  'cap-assessment': CARD,
  'cap-gap': CARD,
  'cap-operating-model': HEADER,
  'cap-resource': CARD,
  'cap-accountability': CARD,
  'cap-initiative': CARD,
  'cap-swimlane': HEADER,
  'cap-annotation': { ...BASE, shape: 'sticky', mode: 'shrink', role: 'caption', align: 'start', valign: 'top', inset: sym(l), maxLines: 12 },
};
