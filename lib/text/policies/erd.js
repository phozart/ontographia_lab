// lib/text/policies/erd.js
// Text policies of the erd stencils (ADR-0008 T2), keyed by stencil id.
// Building blocks: lib/text/policyKit.js. Merged into lib/text/policy.js under the "erd/" prefix.
//
// An entity card is a name header (40 px) over a mono attribute list. The policy describes the NAME compartment: the label's
// text area is the header strip, so a long name grows the card (width up to 1.6x, then the header gets a second and a third
// line and the card taller by the same amount). The attribute rows are fixed slots drawn by the renderer (11 px mono, clamped
// with the badge); they never size the card.

import { BASE, inset, sym, ERD_HEADER } from '../policyKit';

// VIEW and JUNCTION tags sit at the left of the header and take that much of the name's width
const BADGE_COL = { view: 52, junction: 76 };

const entity = (id, defaultHeight) => ({
  ...BASE,
  role: 'title',
  maxLines: 8,
  maxWidth: 330, // the VIEW / JUNCTION tag takes up to 88 px of the header: one long word still fits whole
  // 12 px of name padding plus the card's border (4 px weak entity, else 2 px) on each side, as the renderer lays it out
  inset: inset(0, 12 + (id === 'weak-entity' ? 4 : 2), defaultHeight - ERD_HEADER, 12 + (id === 'weak-entity' ? 4 : 2) + (BADGE_COL[id] || 0)),
});

export default {
  entity: entity('entity', 160),
  'weak-entity': entity('weak-entity', 140),
  view: entity('view', 100),
  junction: entity('junction', 100),
  attribute: { ...BASE, shape: 'ellipse', inset: sym(3) },
  'relationship-chen': { ...BASE, shape: 'diamond', inset: sym(2) },
  'erd-note': { ...BASE },
};
