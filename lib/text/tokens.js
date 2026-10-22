// lib/text/tokens.js
// House style for node text (ADR-0008 section 7): one JS source of truth, mirrored in
// styles/diagram-studio-tokens.css (--ds-text-*), and a unit test asserts the two agree.
// Five roles replace the ten font sizes the audit found; nothing renders below MIN_SIZE (11 px at 100% zoom).

export const ROLES = Object.freeze({
  label: Object.freeze({ size: 14, weight: 500, lineHeight: 1.3 }), // node text
  title: Object.freeze({ size: 14, weight: 600, lineHeight: 1.25 }), // container, frame, swimlane, compartment header
  caption: Object.freeze({ size: 12, weight: 500, lineHeight: 1.3 }), // external labels, connection labels
  meta: Object.freeze({ size: 11, weight: 500, lineHeight: 1.25 }), // stereotypes, types
  emphasis: Object.freeze({ size: 18, weight: 600, lineHeight: 1.25 }), // mind-map central topic, persona name
});

export const ROLE_NAMES = Object.freeze(Object.keys(ROLES));
export const DEFAULT_ROLE = 'label';

/** The smallest size any text is drawn at (100% zoom). `shrink` stops here. */
export const MIN_SIZE = 11;

/** Padding tokens (px): small, medium (nodes), large (cards, stickies, containers). */
export const PAD = Object.freeze({ s: 6, m: 10, l: 14 });

/** Longest text before the clamp and the overflow badge (lines). */
export const MAX_LINES = 8;

/** Per-line width slack: real glyphs can be up to ~1% wider than the table and kerning is ignored (ADR-0008 2). */
export const SLACK_RATIO = 0.02;
export const SLACK_PX = 1;

/** Text-fit modes (ADR-0008 4). */
export const TEXT_FIT_MODES = Object.freeze(['auto', 'auto-height', 'shrink', 'fixed']);

/** Default maximum node text width (px) for modes that grow: 240 for narrow stencils, otherwise 1.6 x the default width. */
export const MAX_WIDTH_NARROW = 240;
export const MAX_WIDTH_FACTOR = 1.6;
export const MAX_WIDTH_CENTRAL = 320;

/** Font-size decrement (px) per `shrink` step. */
export const SHRINK_STEP = 1;

export function roleOf(name) {
  return ROLES[name] || ROLES[DEFAULT_ROLE];
}
