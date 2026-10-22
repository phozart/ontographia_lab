// lib/text/connectionLabel.js
// Connection labels (ADR-0008 5): `auto` text, at most 200 px wide, wrapped at word boundaries. The background rectangle is
// the measured lines plus padding (it replaces `chars x 8`), so a wrapped label gets a real height and the placement code
// can keep it clear of the nodes. Pure and isomorphic: the canvas (SVG) and any exporter draw the same lines.

import { layoutText } from './layout';
import { roleOf } from './tokens';

export const CONN_LABEL = Object.freeze({ padX: 8, padY: 4, minWidth: 40, minHeight: 20, maxWidth: 200, maxLines: 3 });
export const ENDPOINT_LABEL = Object.freeze({ padX: 4, padY: 2, minWidth: 24, minHeight: 16, maxWidth: 120, maxLines: 3 });

function measure(text, role, base, maxWidth) {
  const cfg = Number.isFinite(maxWidth) ? { ...base, maxWidth: Math.max(base.minWidth, Math.min(base.maxWidth, maxWidth)) } : base;
  const r = roleOf(role);
  const t = typeof text === 'string' ? text : '';
  const innerMin = cfg.minWidth - 2 * cfg.padX;
  const layout = layoutText({
    text: t,
    font: { size: r.size, weight: r.weight, lineHeight: r.lineHeight },
    box: { width: innerMin, height: r.size * r.lineHeight },
    mode: 'auto',
    limits: { minWidth: innerMin, maxWidth: cfg.maxWidth - 2 * cfg.padX, maxLines: cfg.maxLines },
    align: 'center',
    valign: 'middle',
  });
  if (!layout.lines.length) return { layout, width: 0, height: 0, textBox: { x: 0, y: 0, width: 0, height: 0 } };
  const width = Math.min(cfg.maxWidth, Math.max(cfg.minWidth, Math.ceil(layout.box.width) + 2 * cfg.padX));
  const height = Math.max(cfg.minHeight, Math.ceil(layout.height) + 2 * cfg.padY);
  // the text rectangle inside the label background (lines are positioned in it)
  const textBox = { x: (width - layout.box.width) / 2, y: (height - layout.height) / 2, width: layout.box.width, height: layout.height };
  return { layout, width, height, textBox };
}

/** The mid-section label of a connection: { layout, width, height, textBox } (textBox in label-rectangle coordinates). */
/** `maxWidth` (the room between the two nodes, never below 76 px) narrows the label in a tight gap so it wraps instead of reaching a node. */
export const connectionLabelLayout = (text, maxWidth) => measure(text, 'caption', CONN_LABEL, Number.isFinite(maxWidth) ? Math.max(76, maxWidth) : undefined);

/** A source or target (multiplicity, cardinality) label: the 11 px meta role. */
/** `maxWidth` caps the label at the room along the line between the two nodes (it wraps instead of reaching a node). */
export const endpointLabelLayout = (text, maxWidth) => measure(text, 'meta', ENDPOINT_LABEL, maxWidth);
