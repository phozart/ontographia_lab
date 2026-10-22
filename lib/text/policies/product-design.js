// lib/text/policies/product-design.js
// Text policies of the product-design stencils (ADR-0008 T2), keyed by stencil id.
// Building blocks: lib/text/policyKit.js. Merged into lib/text/policy.js under the "product-design/" prefix.
//
// Cards (icon pill on top) and colored cards are paper: `shrink`, like sticky notes. Outcome-tree nodes carry an icon
// column on the left. Zones (quadrant, lane, phase, column, section) are fixed one-line header titles.

import { BASE, EXTERNAL, TITLE, inset, sym, m, s } from '../policyKit';

// card with an icon pill (28 px at y 12) above the text
const ICON_CARD = { ...BASE, shape: 'sticky', mode: 'shrink', role: 'title', inset: inset(40, 12, 12, 12), maxLines: 6 };
// colored sticky card
const COLOR_CARD = { ...BASE, shape: 'sticky', mode: 'shrink', inset: sym(m), maxLines: 8 };
// outcome tree node: left accent bar and a 20 px icon, then the text
const OST = { ...BASE, role: 'title', align: 'start', inset: inset(8, 10, 8, 46), maxLines: 6 };

export default {
  'insight-card': ICON_CARD,
  'action-card': ICON_CARD,
  'pain-point': ICON_CARD,
  'opportunity-card': ICON_CARD,
  'quote-card': ICON_CARD,
  'outcome-node': OST,
  'opportunity-node': OST,
  'solution-node': OST,
  'experiment-node': OST,
  'quadrant-zone': TITLE('header'),
  'lane-zone': TITLE('header'),
  'phase-container': TITLE('header'),
  'column-zone': TITLE('header'),
  'section-zone': TITLE('header'),
  // name (emphasis, up to 2 lines, sits on the baseline of the info block) above a one-line role; avatar column on the left
  'persona-header': { ...BASE, mode: 'auto-height', role: 'emphasis', align: 'start', valign: 'bottom', inset: inset(16, 16, 58, 96), maxLines: 3 },
  touchpoint: { ...BASE, align: 'start', inset: inset(s + 2, m, s + 2, 36) },
  'emotion-point': EXTERNAL(),
  'scored-item': { ...BASE, inset: sym(m) },
  'yellow-card': COLOR_CARD,
  'blue-card': COLOR_CARD,
  'green-card': COLOR_CARD,
  'pink-card': COLOR_CARD,
  'orange-card': COLOR_CARD,
  'purple-card': COLOR_CARD,
};
