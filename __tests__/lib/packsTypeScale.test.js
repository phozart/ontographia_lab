/**
 * ADR-0008 T2 acceptance: "the type-scale tokens are used everywhere (lint check: no numeric fontSize literals in packs/,
 * except the explicitly allowed icon glyphs)". Node text goes through lib/text (roles, TextBlock, SlotText); a pack never
 * styles its own label size, never clamps with CSS (WebkitLineClamp / textOverflow) and never forbids wrapping.
 *
 * An allowed exception (an icon glyph that is not text, a drawing detail) carries the marker `ds-allow-text-style: <why>`
 * on the same line or the line above.
 */
import fs from 'fs';
import path from 'path';

const DIR = path.join(__dirname, '..', '..', 'components', 'diagram-studio', 'packs');
const FILES = fs.readdirSync(DIR).filter((f) => /\.js$/.test(f));

const RULES = [
  { name: 'numeric fontSize literal', re: /fontSize\s*[:=]\s*\{?\s*['"]?\d/ },
  { name: 'numeric fontSize fallback (|| 12)', re: /fontSize\s*\|\|\s*\d/ },
  { name: 'CSS line clamp', re: /WebkitLineClamp|-webkit-line-clamp|WebkitBoxOrient/ },
  { name: 'CSS text-overflow', re: /textOverflow/ },
  { name: "white-space: nowrap", re: /whiteSpace\s*:\s*['"]nowrap['"]/ },
  { name: 'SVG <text> label', re: /<text[\s>]/ },
];

function violations(file) {
  const lines = fs.readFileSync(path.join(DIR, file), 'utf8').split('\n');
  const out = [];
  lines.forEach((line, i) => {
    if (/ds-allow-text-style/.test(line) || (i > 0 && /ds-allow-text-style/.test(lines[i - 1]))) return;
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
    for (const r of RULES) if (r.re.test(line)) out.push(`${file}:${i + 1} ${r.name}: ${line.trim().slice(0, 100)}`);
  });
  return out;
}

describe('packs draw text through lib/text, not their own styles', () => {
  for (const f of FILES) {
    test(f, () => {
      expect(violations(f)).toEqual([]);
    });
  }
});
