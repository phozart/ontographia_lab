// lib/text/policies/itil.js
// Text policies of the ITIL stencils (ADR-0008 T2), keyed by stencil id.
// Building blocks: lib/text/policyKit.js. Merged into lib/text/policy.js under the "itil/" prefix.
//
// Cards with an icon keep it in a 36 px column at the left and the label beside it. Cards with a status header (service,
// incident, problem) reserve the header strip at the top; the label is the body below it. The stakeholder reserves the
// stick figure at the top (62 px) and puts the label under it.

import { BASE, TITLE, inset, m, s } from '../policyKit';

const LABEL = { ...BASE, role: 'title' }; // 14 px, 600, as the cards were semibold before
const plain = { ...BASE }; // practice, process, change-request, ... are drawn by the default renderer

const ICON_CARD = { ...LABEL, inset: inset(m, m, m, 36) };
const HEADED = (top) => ({ ...BASE, inset: inset(top, m, 8, m) });

export default {
  'svc-engage': ICON_CARD,
  'svc-plan': ICON_CARD,
  'svc-design': ICON_CARD,
  'svc-obtain': ICON_CARD,
  'svc-deliver': ICON_CARD,
  'svc-improve': ICON_CARD,
  service: HEADED(30), // 24 px header strip with the service type and criticality
  practice: plain,
  process: plain,
  incident: HEADED(24), // 20 px status header with the priority
  problem: HEADED(24), // 20 px status header with the status
  'known-error': HEADED(24),
  'change-request': plain,
  release: plain,
  ci: { ...LABEL, inset: inset(8, m, 22, 36) }, // icon left, CI type caption below the label
  cmdb: TITLE('header'),
  stakeholder: { ...BASE, role: 'caption', valign: 'top', inset: inset(62, s, s, s) },
  team: plain,
  sla: plain,
  kpi: plain,
};
