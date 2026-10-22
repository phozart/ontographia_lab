// lib/text/segment.js
// Graphemes, script classes and line-break opportunities (ADR-0008 section 6). Pure, no DOM.
//
// Determinism: break opportunities are rule based, so Node and every browser agree. Intl.Segmenter is used for
// graphemes (stable across ICU versions for our purposes) and, only for scripts that have no spaces and need a
// dictionary (Thai, Lao, Khmer, Myanmar), for word boundaries. CJK breaks between any two ideographs/kana subject to
// basic kinsoku, the same default behavior as CSS `line-break: normal`.
// (Escapes are written \u{...} on purpose: the tool that writes this file expands the 4-digit form.)

const HAS_SEGMENTER = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function';
let graphemeSegmenter = null;
let wordSegmenter = null;
const getGraphemeSegmenter = () => graphemeSegmenter || (graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' }));
const getWordSegmenter = () => wordSegmenter || (wordSegmenter = new Intl.Segmenter(undefined, { granularity: 'word' }));

// Strings made only of these need no grapheme clustering: every code unit is one grapheme.
const SIMPLE_RE = /^[\u{20}-\u{7e}\u{a0}-\u{2ff}\u{1e00}-\u{1eff}\u{2010}-\u{205e}]*$/u;
const EMOJI_RE = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u{20e3}|\u{fe0f}/u;
const MARK_RE = /^\p{M}/u;

/** Split text into grapheme clusters (emoji ZWJ sequences, flags and combining marks stay whole). */
export function graphemes(text) {
  if (!text) return [];
  if (SIMPLE_RE.test(text)) return text.split('');
  if (HAS_SEGMENTER) return Array.from(getGraphemeSegmenter().segment(text), (s) => s.segment);
  // Fallback: code points, attaching combining marks / ZWJ sequences to the previous cluster.
  const out = [];
  for (const ch of text) {
    const prev = out[out.length - 1];
    if (prev !== undefined && (MARK_RE.test(ch) || ch === '\u{200d}' || prev.endsWith('\u{200d}') || ch === '\u{fe0f}')) out[out.length - 1] = prev + ch;
    else out.push(ch);
  }
  return out;
}

export const isEmojiCluster = (g) => (g.length > 1 ? EMOJI_RE.test(g) : /\p{Extended_Pictographic}/u.test(g));

const inRanges = (cp, ranges) => {
  for (let i = 0; i < ranges.length; i += 2) if (cp >= ranges[i] && cp <= ranges[i + 1]) return true;
  return false;
};

const CJK = [0x2e80, 0x303f, 0x3040, 0x30ff, 0x3100, 0x312f, 0x31f0, 0x31ff, 0x3400, 0x4dbf, 0x4e00, 0x9fff, 0xf900, 0xfaff, 0xff00, 0xffef, 0x20000, 0x2fa1f];
const HANGUL = [0x1100, 0x11ff, 0x3130, 0x318f, 0xac00, 0xd7af];
const ARABIC = [0x600, 0x6ff, 0x750, 0x77f, 0x8a0, 0x8ff, 0xfb50, 0xfdff, 0xfe70, 0xfeff];
const HEBREW = [0x590, 0x5ff, 0xfb1d, 0xfb4f];
const RTL_OTHER = [0x700, 0x74f, 0x780, 0x7bf, 0x7c0, 0x7ff]; // Syriac, Thaana, N'Ko
const THAI = [0xe00, 0xe7f];
const NO_SPACE_SCRIPTS = [0xe00, 0xeff, 0x1780, 0x17ff, 0x1000, 0x109f]; // Thai, Lao, Khmer, Myanmar
const INDIC = [0x900, 0xdff, 0x1c50, 0x1cff];
const ZERO_WIDTH = [0x300, 0x36f, 0x1ab0, 0x1aff, 0x1dc0, 0x1dff, 0x200b, 0x200f, 0x202a, 0x202e, 0x2060, 0x2064, 0x20d0, 0x20ff, 0xfe00, 0xfe0f, 0xfe20, 0xfe2f, 0xad, 0xad];

/** Width class of a code point that is not in the font table (ADR-0008 3.2). */
export function scriptClass(cp) {
  if (inRanges(cp, ZERO_WIDTH)) return 'zero';
  if (inRanges(cp, CJK)) return 'cjk';
  if (inRanges(cp, HANGUL)) return 'hangul';
  if (inRanges(cp, ARABIC)) return 'arabic';
  if (inRanges(cp, HEBREW)) return 'hebrew';
  if (inRanges(cp, THAI)) return 'thai';
  if (inRanges(cp, INDIC)) return 'indic';
  return 'other';
}

export const isCjk = (cp) => inRanges(cp, CJK);
export const isRtlCodePoint = (cp) => inRanges(cp, ARABIC) || inRanges(cp, HEBREW) || inRanges(cp, RTL_OTHER);
const isNoSpaceScript = (cp) => inRanges(cp, NO_SPACE_SCRIPTS);

/** 'rtl' when the first strong character is Arabic, Hebrew, Syriac, Thaana or N'Ko; otherwise 'ltr'. */
export function detectDir(text) {
  for (const ch of text || '') {
    const cp = ch.codePointAt(0);
    if (isRtlCodePoint(cp)) return 'rtl';
    if (/\p{L}/u.test(ch)) return 'ltr';
  }
  return 'ltr';
}

// Kinsoku: no break before closing punctuation, prolonged sound mark and small kana; none after opening brackets.
const KINSOKU_NO_BREAK_BEFORE = new Set(Array.from('、。，．・：；？！ー）〕］｝〉》」』】〙〗〟’”ゝゞヽヾぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮ々,.:;!?)]}%'));
const KINSOKU_NO_BREAK_AFTER = new Set(Array.from('（〔［｛〈《「『【〘〖〝‘“([{'));
const HYPHENS = new Set(['-', '\u{2013}', '\u{2014}', '\u{2010}']);
const SLASHLIKE = new Set(['/', '\u{b7}', '|', '_']);
const isLetterOrDigit = (g) => !!g && /[\p{L}\p{N}]/u.test(g);

const NBSP = '\u{a0}';
const SPACE_RE = /^[ \t\u{a0}\u{3000}\u{2000}-\u{200a}\u{202f}\u{205f}]$/u;
const isSpace = (g) => SPACE_RE.test(g);

/** Number of drawn graphemes (no spaces, zero-width marks) from gs[from] to the next space, counted up to `cap`. */
function runLength(gs, from, cap) {
  let n = 0;
  while (n < cap && from + n < gs.length && !isSpace(gs[from + n]) && gs[from + n] !== '\u{200b}') n++;
  return n;
}

/**
 * Break a paragraph (no newlines) into atoms: the units the line breaker fills lines with.
 * An atom is a run of graphemes between break opportunities.
 *   { gs: string[]    graphemes drawn (soft hyphens and zero-width spaces removed),
 *     space: boolean  a collapsed space follows the atom (it hangs at the end of a line),
 *     shy: boolean    the atom ends at a soft hyphen: a visible '-' is drawn if the line breaks here }
 * Runs of spaces collapse to one (ADR-0008 6.5); a no-break space glues its neighbors.
 * @param {string} text
 */
export function toAtoms(text) {
  const gs = graphemes(text);
  const atoms = [];
  let cur = { gs: [], space: false, shy: false };
  const push = () => {
    if (cur.gs.length || cur.space) atoms.push(cur);
    cur = { gs: [], space: false, shy: false };
  };
  // Word boundaries for scripts without spaces come from the dictionary segmenter, when the engine has one.
  const dictBreaks = new Set();
  if (HAS_SEGMENTER && gs.some((g) => isNoSpaceScript(g.codePointAt(0)))) {
    let offset = 0;
    const starts = [];
    for (const g of gs) {
      starts.push(offset);
      offset += g.length;
    }
    const boundaries = new Set();
    for (const s of getWordSegmenter().segment(text)) boundaries.add(s.index);
    gs.forEach((g, i) => {
      if (i > 0 && isNoSpaceScript(g.codePointAt(0)) && boundaries.has(starts[i])) dictBreaks.add(i);
    });
  }
  for (let i = 0; i < gs.length; i++) {
    const g = gs[i];
    const cp = g.codePointAt(0);
    if (isSpace(g)) {
      if (g === NBSP) {
        cur.gs.push(g); // a no-break space glues
        continue;
      }
      cur.space = true;
      push();
      while (i + 1 < gs.length && isSpace(gs[i + 1]) && gs[i + 1] !== NBSP) i++; // swallow the run
      continue;
    }
    if (g === '\u{200b}') {
      push();
      continue;
    }
    if (g === '\u{ad}') {
      if (cur.gs.length) {
        cur.shy = true;
        push();
      }
      continue;
    }
    if (cur.gs.length) {
      const prev = cur.gs[cur.gs.length - 1];
      const pcp = prev.codePointAt(0);
      const idLike = (c, gr) => isCjk(c) || isEmojiCluster(gr);
      if ((idLike(cp, g) || idLike(pcp, prev)) && !KINSOKU_NO_BREAK_BEFORE.has(g) && !KINSOKU_NO_BREAK_AFTER.has(prev)) push();
      else if (dictBreaks.has(i)) push();
    }
    cur.gs.push(g);
    // after a hyphen or a slash-like char that sits between letters/digits
    const next = gs[i + 1];
    const before = cur.gs[cur.gs.length - 2];
    // (and only when the piece after it is at least 3 characters, so "req/s" never leaves a lone "s" on the next line)
    if ((HYPHENS.has(g) || SLASHLIKE.has(g)) && isLetterOrDigit(before) && isLetterOrDigit(next) && runLength(gs, i + 1, 3) >= 3) push();
  }
  push();
  return atoms;
}
