// lib/text/policies/cld.js
// Text policies of the cld stencils (ADR-0008 T2), keyed by stencil id.
// Building blocks: lib/text/policyKit.js. Merged into lib/text/policy.js under the "cld/" prefix.
//
// Variables, stocks, table functions and annotations hold their label inside (auto). The hourglass of a flow narrows to half
// its width at mid height and the constant diamond is 50 px, so both keep the glyph small and label below (like the cloud).
// Loop markers (50 px circles) hold R, B or a short name: `shrink` down to 11 px, then clamp with the badge (ADR-0008 4).

import { BASE, EXTERNAL, TITLE, inset, sym, m } from '../policyKit';

export default {
  variable: { ...BASE },
  stock: { ...BASE, inset: inset(m, 16, m, 16) }, // the double vertical borders sit 6 px in
  flow: EXTERNAL(),
  cloud: EXTERNAL(),
  'reinforcing-loop': { ...BASE, shape: 'circle', mode: 'shrink', role: 'title', inset: sym(6), maxLines: 8, ring: true },
  'balancing-loop': { ...BASE, shape: 'circle', mode: 'shrink', role: 'title', inset: sym(6), maxLines: 8, ring: true },
  constant: EXTERNAL(),
  'table-function': { ...BASE, role: 'caption', inset: inset(4, 8, 26, 8) }, // the sparkline occupies the bottom 22 px
  'system-boundary': TITLE('header'),
  annotation: { ...BASE, inset: inset(m, m, m, m) },
};
