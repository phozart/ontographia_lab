// lib/doc/sanitize.js
// Server-side (and import-side) clean-up of doc markdown (AI-5). The stored text must be safe for EVERY consumer
// (our renderer, `.md` exports opened in other viewers, MCP text), not only for our renderer, so the stored string is
// rewritten, not just filtered at display time:
//   - control characters and bidi overrides are removed
//   - raw HTML cannot start: a `<` that could open a tag, comment or processing instruction becomes `\<`
//     (autolinks to allowed destinations are kept)
//   - link destinations outside the docHref allow-list become `<>` (the link text stays), including reference
//     definitions (`[x]: javascript:...` is escaped to plain text)
//   - images lose their `!` (they become ordinary, allow-listed links); images belong on the canvas
// Fenced code blocks and inline code spans are left alone. The pass is conservative: when in doubt it escapes.
// Idempotent: sanitize(sanitize(x)) === sanitize(x). Linear time.

import { docHref } from './docHref';
import { parseLinkTail } from './markdown';

const CONTROL_RE = new RegExp('[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f-\\u009f\\u202a-\\u202e\\u2066-\\u2069\\u2028\\u2029\\ufeff]', 'g');
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const AUTOLINK_RE = /^<([A-Za-z][A-Za-z0-9+.-]{1,31}:[^\s<>]{0,2000}|[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,255})>/;

function fenceOf(line) {
  const m = FENCE_RE.exec(line);
  if (!m) return null;
  if (m[1][0] === '`' && m[2].includes('`')) return null;
  return { char: m[1][0], len: m[1].length };
}
function closesFence(line, f) {
  const t = line.trim();
  const lead = line.length - line.trimStart().length;
  if (lead > 3 || t.length < f.len) return false;
  for (let k = 0; k < t.length; k++) if (t[k] !== f.char) return false;
  return true;
}

/** Skip blockquote / list prefixes so `> [x]: dest` and `- [x]: dest` are recognised as definitions. */
function prefixLength(line) {
  let k = 0;
  for (let guard = 0; guard < 40; guard++) {
    while (line[k] === ' ' || line[k] === '\t') k += 1;
    if (line[k] === '>') {
      k += 1;
      continue;
    }
    const m = /^(?:[-*+]|\d{1,9}[.)])[ \t]/.exec(line.slice(k, k + 14));
    if (m) {
      k += m[0].length;
      continue;
    }
    break;
  }
  return k;
}

function neutralizeDefinition(line, stats) {
  const at = prefixLength(line);
  const m = /^\[([^\]\n]{1,999})\]:[ \t]*(<[^>\n]{0,2000}>|\S{1,2000})/.exec(line.slice(at));
  if (!m) return line;
  const raw = m[2].startsWith('<') ? m[2].slice(1, -1) : m[2];
  if (docHref(raw)) return line;
  stats.links += 1;
  return `${line.slice(0, at)}\\${line.slice(at)}`; // "\[x]: ..." renders as text
}

function sanitizeSegment(text, stats) {
  let out = '';
  let i = 0;
  const n = text.length;
  while (i < n) {
    const ch = text[i];
    if (ch === '\\') {
      out += text.slice(i, i + 2);
      i += 2;
      continue;
    }
    if (ch === '`') {
      let e = i;
      while (text[e] === '`') e += 1;
      const len = e - i;
      // closing run of the same length on the same line = a code span: leave it alone
      let close = -1;
      let k = e;
      const eol = text.indexOf('\n', e);
      const limit = eol === -1 ? n : eol;
      while (k < limit) {
        if (text[k] === '`') {
          let r = k;
          while (text[r] === '`') r += 1;
          if (r - k === len) {
            close = k;
            break;
          }
          k = r;
        } else k += 1;
      }
      if (close >= 0) {
        out += text.slice(i, close + len);
        i = close + len;
      } else {
        out += text.slice(i, e);
        i = e;
      }
      continue;
    }
    if (ch === '<') {
      const m = AUTOLINK_RE.exec(text.slice(i, i + 2300));
      if (m) {
        const target = m[1].includes(':') ? m[1] : `mailto:${m[1]}`;
        if (docHref(target)) {
          out += m[0];
        } else {
          stats.links += 1;
          out += `\\<${m[0].slice(1)}`;
        }
        i += m[0].length;
        continue;
      }
      if (/[A-Za-z/!?]/.test(text[i + 1] || '')) {
        stats.html += 1;
        out += '\\<';
      } else out += '<';
      i += 1;
      continue;
    }
    if (ch === '!' && text[i + 1] === '[') {
      stats.images += 1;
      out += '\\![';
      i += 2;
      continue;
    }
    if (ch === ']' && text[i + 1] === '(') {
      const tail = parseLinkTail(text, i + 1);
      if (tail) {
        const dest = tail.dest.replace(/\\([!-/:-@[-`{-~])/g, '$1');
        if (docHref(tail.dest) && docHref(dest)) {
          out += text.slice(i, tail.end);
        } else {
          stats.links += 1;
          out += '](<>)';
        }
        i = tail.end;
        continue;
      }
    }
    out += ch;
    i += 1;
  }
  return out;
}

/**
 * @param {string} input
 * @returns {{markdown: string, links: number, html: number, images: number}}
 */
export function sanitizeDocMarkdown(input) {
  const stats = { links: 0, html: 0, images: 0 };
  const text = String(input ?? '').replace(/\r\n?/g, '\n').replace(CONTROL_RE, '');
  const lines = text.split('\n');
  const out = [];
  let segment = [];
  const flush = () => {
    if (segment.length) {
      out.push(sanitizeSegment(segment.join('\n'), stats));
      segment = [];
    }
  };
  let fence = null;
  for (const raw of lines) {
    if (fence) {
      out.push(raw);
      if (closesFence(raw, fence)) fence = null;
      continue;
    }
    const f = fenceOf(raw);
    if (f) {
      flush();
      fence = f;
      out.push(raw);
      continue;
    }
    segment.push(neutralizeDefinition(raw, stats));
  }
  flush();
  return { markdown: out.join('\n'), ...stats };
}
