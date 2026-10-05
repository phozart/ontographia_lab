// components/diagram-studio/packs/colorUtils.js
// Color parsing and WCAG contrast helpers for pack renderers.

export const LIGHT_TEXT = '#fff';
export const DARK_TEXT = '#374151';

// Parse #rgb, #rgba, #rrggbb, #rrggbbaa, rgb(), rgba() (case-insensitive).
// Returns [r, g, b] (0-255) or null for unknown formats. Alpha is ignored.
export function parseColor(input) {
  if (typeof input !== 'string') return null;
  const s = input.trim().toLowerCase();
  let m = /^#([0-9a-f]{3,4})$/.exec(s);
  if (m) {
    const h = m[1];
    return [0, 1, 2].map((i) => parseInt(h[i] + h[i], 16));
  }
  m = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/.exec(s);
  if (m) {
    const n = parseInt(m[1], 16);
    return [n >> 16, (n >> 8) & 255, n & 255];
  }
  m = /^rgba?\(\s*([\d.]+)(%?)\s*[, ]\s*([\d.]+)(%?)\s*[, ]\s*([\d.]+)(%?)\s*(?:[,/]\s*[\d.]+%?\s*)?\)$/.exec(s);
  if (m) {
    const ch = (v, pct) => Math.max(0, Math.min(255, Math.round(pct ? (parseFloat(v) * 255) / 100 : parseFloat(v))));
    return [ch(m[1], m[2]), ch(m[3], m[4]), ch(m[5], m[6])];
  }
  return null;
}

function relativeLuminance([r, g, b]) {
  const lin = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(rgbA, rgbB) {
  const la = relativeLuminance(rgbA);
  const lb = relativeLuminance(rgbB);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// Pick white or dark gray, whichever has the higher contrast against the fill.
// Unknown formats return `fallback`.
export function pickLabelColor(fill, fallback = LIGHT_TEXT) {
  const rgb = parseColor(fill);
  if (!rgb) return fallback;
  const white = contrastRatio(rgb, parseColor(LIGHT_TEXT));
  const dark = contrastRatio(rgb, parseColor(DARK_TEXT));
  return dark > white ? DARK_TEXT : LIGHT_TEXT;
}
