// lib/doc/markdown.js
// A small, dependency-free Markdown parser for the doc card (AI-5). Pure; shared by the browser renderer, the SVG
// renderer (diagram_show), the server validator and the MCP projections.
//
// Security model: the output is an AST of known node types only. There is NO raw HTML (an HTML-looking tag is text),
// NO image node (an image becomes its alt text), and every link goes through `docHref`. Nothing here builds strings of
// HTML; consumers render text nodes. Parsing is linear in the input (bounded searches, no backtracking regexes), and
// nesting is capped, so hostile input cannot hang or overflow the stack.
//
// Supported: headings, paragraphs, bold, italic, strike, inline code, bullet / numbered / task lists, blockquote,
// fenced code, GFM tables, thematic break, links (inline, reference, <autolink>). Not supported: setext headings,
// indented code, raw HTML, images, footnotes.
//
// AST
//   block:  {t:'heading', level, c} {t:'p', c} {t:'ul'|'ol', start?, items:[{checked?: boolean, c: block[]}]}
//           {t:'quote', c: block[]} {t:'code', lang, v} {t:'table', align[], head: inline[][], rows: inline[][][]} {t:'hr'}
//   inline: {t:'text', v} {t:'strong'|'em'|'del', c} {t:'code', v} {t:'br'} {t:'link', link: docHrefResult, c}

import { docHref } from './docHref';

export const MAX_DOC_BYTES = 100 * 1024;

/** UTF-8 byte length without TextEncoder/Buffer (works in every runtime). */
export function utf8Length(str) {
  let n = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length && (str.charCodeAt(i + 1) & 0xfc00) === 0xdc00) {
      n += 4;
      i += 1;
    } else n += 3;
  }
  return n;
}
export const MAX_PARSE_CHARS = 200 * 1024; // hard ceiling for the parser regardless of caller
const MAX_BLOCK_DEPTH = 8; // nested lists / quotes; deeper content is flattened to text
const MAX_INLINE_DEPTH = 10; // nested emphasis / links
const MAX_NODES = 20000;
const MAX_TABLE_COLS = 20;
const MAX_TABLE_ROWS = 1000;
const MAX_DEST = 2000;
const MAX_SEARCH_FRAMES = 32;

const PUNCT_RE = /[!-/:-@[-`{-~‐-‧　-〿]/;
const ESCAPABLE_RE = /[!-/:-@[-`{-~]/;
const isSpace = (ch) => ch === undefined || ch === '' || /\s/.test(ch);
const isPunct = (ch) => ch !== undefined && ch !== '' && PUNCT_RE.test(ch);

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Decode the few entities that matter in prose. The result is only ever rendered as text. */
export function decodeEntities(s) {
  if (!s.includes('&')) return s;
  return s.replace(/&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|([a-zA-Z]{2,6}));/g, (m, dec, hex, name) => {
    if (name) return Object.prototype.hasOwnProperty.call(NAMED, name) ? NAMED[name] : m;
    const cp = dec !== undefined ? parseInt(dec, 10) : parseInt(hex, 16);
    if (!Number.isFinite(cp) || cp < 32 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff) || (cp >= 0x7f && cp <= 0x9f)) return m;
    return String.fromCodePoint(cp);
  });
}

function unescapeDest(s) {
  return decodeEntities(s.replace(/\\([!-/:-@[-`{-~])/g, '$1'));
}

/**
 * Parse an inline link tail starting at `str[pos]` which must be '('. Shared with the sanitizer.
 * Returns {dest, end} where `end` is the index just past ')', or null when it is not a link tail.
 * `dest` is the raw (still escaped) destination without angle brackets.
 * `budget` ({scan, exhausted}) bounds the TOTAL characters examined across calls (a stray "](" can make one call
 * read up to ~2,400 characters, so thousands of them would be quadratic); when it runs out the call returns null and
 * sets `budget.exhausted`, which callers treat as "not a link" (the sanitizer escapes the parenthesis instead).
 */
export function parseLinkTail(str, pos, budget) {
  if (budget && budget.scan <= 0) {
    budget.exhausted = true;
    return null;
  }
  const r = scanLinkTail(str, pos);
  if (budget) budget.scan -= Math.max(1, r.reach - pos);
  return r.value;
}

function scanLinkTail(str, pos) {
  if (str[pos] !== '(') return { value: null, reach: pos };
  const limit = Math.min(str.length, pos + MAX_DEST + 400);
  let i = pos + 1;
  const skipWs = () => {
    while (i < limit && /\s/.test(str[i])) i += 1;
  };
  skipWs();
  let dest;
  if (str[i] === '<') {
    let j = i + 1;
    while (j < limit && str[j] !== '>' && str[j] !== '<' && str[j] !== '\n') {
      if (str[j] === '\\') j += 1;
      j += 1;
    }
    if (str[j] !== '>') return { value: null, reach: j };
    dest = str.slice(i + 1, j);
    i = j + 1;
  } else {
    let depth = 0;
    let j = i;
    while (j < limit) {
      const ch = str[j];
      if (ch === '\\') {
        j += 2;
        continue;
      }
      if (/\s/.test(ch) || ch.charCodeAt(0) < 32) break;
      if (ch === '(') depth += 1;
      else if (ch === ')') {
        if (depth === 0) break;
        depth -= 1;
      }
      j += 1;
    }
    if (j > limit || depth !== 0) return { value: null, reach: j };
    dest = str.slice(i, j);
    i = j;
  }
  skipWs();
  // optional title
  const q = str[i];
  if (q === '"' || q === "'" || q === '(') {
    const close = q === '(' ? ')' : q;
    let j = i + 1;
    while (j < limit && str[j] !== close) {
      if (str[j] === '\\') j += 1;
      j += 1;
    }
    if (str[j] !== close) return { value: null, reach: j };
    i = j + 1;
    skipWs();
  }
  if (str[i] !== ')') return { value: null, reach: i };
  return { value: { dest, end: i + 1 }, reach: i + 1 };
}

const normLabel = (s) => s.trim().replace(/\s+/g, ' ').toLowerCase();

// ---------------------------------------------------------------- inline

/**
 * @param {string} str
 * @param {{refs: Map<string,string>, budget: {n: number}}} ctx
 */
export function parseInline(str, ctx) {
  const root = { kind: 'root', children: [] };
  const stack = [root];
  const top = () => stack[stack.length - 1];
  const pushNode = (node) => {
    ctx.budget.n += 1;
    if (ctx.budget.n > MAX_NODES) return;
    top().children.push(node);
  };
  const pushTextTo = (frame, s) => {
    if (!s) return;
    const c = frame.children;
    const last = c[c.length - 1];
    if (last && last.t === 'text') last.v += s;
    else {
      ctx.budget.n += 1;
      if (ctx.budget.n <= MAX_NODES) c.push({ t: 'text', v: s });
    }
  };
  const pushText = (s) => pushTextTo(top(), s);
  // An unmatched opener frame becomes its literal text followed by what it collected.
  const dissolve = (frame, parent) => {
    pushTextTo(parent, frame.literal);
    for (const child of frame.children) {
      if (child.t === 'text') pushTextTo(parent, child.v);
      else parent.children.push(child);
    }
  };
  const popToLevel = (level) => {
    while (stack.length > level) {
      const frame = stack.pop();
      dissolve(frame, top());
    }
  };

  // Backtick runs, grouped by length, consumed left to right (amortised linear).
  const runsByLen = new Map();
  for (let k = 0; k < str.length; ) {
    if (str[k] !== '`') {
      k += 1;
      continue;
    }
    let e = k;
    while (str[e] === '`') e += 1;
    const len = e - k;
    if (!runsByLen.has(len)) runsByLen.set(len, { list: [], at: 0 });
    runsByLen.get(len).list.push(k);
    k = e;
  }

  const n = str.length;
  let i = 0;
  while (i < n) {
    const ch = str[i];

    if (ch === '\\') {
      const nx = str[i + 1];
      if (nx === '\n') {
        pushNode({ t: 'br' });
        i += 2;
      } else if (nx !== undefined && ESCAPABLE_RE.test(nx)) {
        pushText(nx);
        i += 2;
      } else {
        pushText('\\');
        i += 1;
      }
      continue;
    }

    if (ch === '`') {
      let e = i;
      while (str[e] === '`') e += 1;
      const len = e - i;
      const runs = runsByLen.get(len);
      let close = -1;
      if (runs) {
        while (runs.at < runs.list.length && runs.list[runs.at] < e) runs.at += 1;
        if (runs.at < runs.list.length) close = runs.list[runs.at];
      }
      if (close >= 0) {
        let v = str.slice(e, close).replace(/\n/g, ' ');
        if (v.length > 2 && v.startsWith(' ') && v.endsWith(' ') && v.trim() !== '') v = v.slice(1, -1);
        pushNode({ t: 'code', v });
        i = close + len;
      } else {
        pushText(str.slice(i, e));
        i = e;
      }
      continue;
    }

    if (ch === '<') {
      const m = /^<([A-Za-z][A-Za-z0-9+.-]{1,31}:[^\s<>]{0,2000}|[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,255})>/.exec(str.slice(i, i + 2300));
      if (m) {
        const target = m[1].includes(':') ? m[1] : `mailto:${m[1]}`;
        const link = docHref(target);
        if (link) {
          pushNode({ t: 'link', link, c: [{ t: 'text', v: m[1] }] });
        } else {
          pushText(m[0]); // not an allowed link: plain text, never markup
        }
        i += m[0].length;
        continue;
      }
      pushText('<');
      i += 1;
      continue;
    }

    if (ch === '!' && str[i + 1] === '[') {
      if (stack.length < MAX_INLINE_DEPTH) stack.push({ kind: 'bracket', image: true, literal: '![', children: [], active: true });
      else pushText('![');
      i += 2;
      continue;
    }
    if (ch === '[') {
      if (stack.length < MAX_INLINE_DEPTH) stack.push({ kind: 'bracket', image: false, literal: '[', children: [], active: true });
      else pushText('[');
      i += 1;
      continue;
    }

    if (ch === ']') {
      let level = -1;
      for (let s = stack.length - 1; s >= 1 && stack.length - s <= MAX_SEARCH_FRAMES; s--) {
        if (stack[s].kind === 'bracket') {
          level = s;
          break;
        }
      }
      if (level < 0 || !stack[level].active) {
        if (level >= 0) {
          popToLevel(level + 1);
          const frame = stack.pop();
          dissolve(frame, top());
        }
        pushText(']');
        i += 1;
        continue;
      }
      let dest = null;
      let end = i + 1;
      if (str[i + 1] === '(') {
        const tail = parseLinkTail(str, i + 1, ctx.budget);
        if (tail) {
          dest = unescapeDest(tail.dest);
          end = tail.end;
        }
      }
      if (dest === null) {
        // reference style: [text][label], [text][] or [text]
        let label = null;
        if (str[i + 1] === '[') {
          const close = str.indexOf(']', i + 2);
          if (close > 0 && close - i < 1000 && !str.slice(i + 2, close).includes('[')) {
            label = str.slice(i + 2, close);
            end = close + 1;
          }
        }
        if (label === null || label.trim() === '') {
          // collapsed / shortcut: label is the text itself
          const text = textOf(stack[level].children);
          if (str[i + 1] === '[' && label !== null) end = i + 3; // "[]"
          label = text;
          if (label === '') label = null;
        }
        if (label !== null && ctx.refs.has(normLabel(label))) dest = unescapeDest(ctx.refs.get(normLabel(label)));
        else {
          // not a link: literal bracket
          popToLevel(level + 1);
          const frame = stack.pop();
          dissolve(frame, top());
          pushText(']');
          i += 1;
          continue;
        }
      }
      popToLevel(level + 1);
      const frame = stack.pop();
      const link = docHref(dest);
      const parent = top();
      if (frame.image) {
        // images are never rendered: the alt text stays
        for (const child of frame.children) {
          if (child.t === 'text') pushTextTo(parent, child.v);
          else parent.children.push(child);
        }
      } else if (link) {
        ctx.budget.n += 1;
        parent.children.push({ t: 'link', link, c: frame.children });
      } else {
        for (const child of frame.children) {
          if (child.t === 'text') pushTextTo(parent, child.v);
          else parent.children.push(child);
        }
      }
      if (!frame.image) for (const f of stack) if (f.kind === 'bracket') f.active = false; // links do not nest
      i = end;
      continue;
    }

    if (ch === '*' || ch === '_' || ch === '~') {
      let e = i;
      while (str[e] === ch) e += 1;
      const len = e - i;
      if (ch === '~' && len !== 2) {
        pushText(str.slice(i, e));
        i = e;
        continue;
      }
      const before = i === 0 ? undefined : str[i - 1];
      const after = str[e];
      const leftFlank = !isSpace(after) && (!isPunct(after) || isSpace(before) || isPunct(before));
      const rightFlank = !isSpace(before) && (!isPunct(before) || isSpace(after) || isPunct(after));
      let canOpen = leftFlank;
      let canClose = rightFlank;
      if (ch === '_') {
        canOpen = leftFlank && (!rightFlank || isPunct(before));
        canClose = rightFlank && (!leftFlank || isPunct(after));
      }
      let remaining = len;
      if (canClose) {
        while (remaining > 0) {
          let level = -1;
          for (let s = stack.length - 1; s >= 1 && stack.length - s <= MAX_SEARCH_FRAMES; s--) {
            const f = stack[s];
            if (f.kind === 'emph' && f.ch === ch && f.remaining > 0) {
              level = s;
              break;
            }
          }
          if (level < 0) break;
          const f = stack[level];
          const use = ch === '~' ? 2 : f.remaining >= 2 && remaining >= 2 ? 2 : 1;
          if (ch === '~' && (f.remaining < 2 || remaining < 2)) break;
          popToLevel(level + 1);
          const frame = stack.pop();
          frame.remaining -= use;
          remaining -= use;
          const node = { t: ch === '~' ? 'del' : use === 2 ? 'strong' : 'em', c: frame.children };
          ctx.budget.n += 1;
          if (frame.remaining > 0) {
            // keep the leftover opener characters open for an outer match
            const parentFrame = { kind: 'emph', ch, remaining: frame.remaining, literal: ch.repeat(frame.remaining), children: [node], canOpen: true };
            stack.push(parentFrame);
          } else {
            top().children.push(node);
          }
        }
      }
      if (remaining > 0) {
        if (canOpen && stack.length < MAX_INLINE_DEPTH) {
          stack.push({ kind: 'emph', ch, remaining, literal: ch.repeat(remaining), children: [] });
        } else {
          pushText(ch.repeat(remaining));
        }
      }
      i = e;
      continue;
    }

    // plain run
    let e = i + 1;
    while (e < n && !'\\`<![]*_~'.includes(str[e])) e += 1;
    pushText(decodeEntities(str.slice(i, e)));
    i = e;
  }

  popToLevel(1);
  return root.children;
}

function textOf(nodes) {
  let s = '';
  for (const node of nodes) {
    if (node.t === 'text' || node.t === 'code') s += node.v;
    else if (node.c) s += textOf(node.c);
  }
  return s;
}


// ---------------------------------------------------------------- blocks

const FENCE_RE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const LIST_RE = /^( *)([-*+]|\d{1,9}[.)])( +|$)/;

function fenceOpen(line) {
  const m = FENCE_RE.exec(line);
  if (!m) return null;
  const rest = m[2];
  if (m[1][0] === '`' && rest.includes('`')) return null;
  return { char: m[1][0], len: m[1].length, info: rest.trim() };
}

function isFenceClose(line, f) {
  const t = line.trimEnd();
  const lead = t.length - t.trimStart().length;
  if (lead > 3) return false;
  const body = t.slice(lead);
  if (body.length < f.len) return false;
  for (let k = 0; k < body.length; k++) if (body[k] !== f.char) return false;
  return true;
}

function isHr(line) {
  const lead = line.length - line.trimStart().length;
  if (lead > 3) return false;
  const s = line.replace(/[ \t]/g, '');
  if (s.length < 3) return false;
  const c = s[0];
  if (c !== '-' && c !== '*' && c !== '_') return false;
  for (let k = 1; k < s.length; k++) if (s[k] !== c) return false;
  return true;
}

export function headingOf(line) {
  const lead = line.length - line.trimStart().length;
  if (lead > 3) return null;
  let k = lead;
  while (line[k] === '#') k += 1;
  const level = k - lead;
  if (level < 1 || level > 6) return null;
  if (k < line.length && line[k] !== ' ' && line[k] !== '\t') return null;
  let text = line.slice(k).trim();
  // optional closing sequence
  let e = text.length;
  while (e > 0 && text[e - 1] === '#') e -= 1;
  if (e < text.length && (e === 0 || text[e - 1] === ' ' || text[e - 1] === '\t')) text = text.slice(0, e).trim();
  return { level, text };
}

const isQuoteLine = (line) => /^ {0,3}>/.test(line);
const stripQuote = (line) => line.replace(/^ {0,3}> ?/, '');

function listMarker(line) {
  const m = LIST_RE.exec(line);
  if (!m) return null;
  const ordered = /\d/.test(m[2][0]);
  const marker = m[2];
  const spaces = m[3].length;
  const lead = m[1].length;
  const gap = spaces >= 1 && spaces <= 4 ? spaces : 1;
  const contentIndent = lead + marker.length + gap;
  return { lead, ordered, bullet: ordered ? marker.slice(-1) : marker, num: ordered ? parseInt(marker, 10) : 0, contentIndent, rest: line.slice(contentIndent) };
}

function splitCells(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  const cells = [];
  let cur = '';
  for (let k = 0; k < s.length; k++) {
    if (s[k] === '\\' && s[k + 1] === '|') {
      cur += '|';
      k += 1;
    } else if (s[k] === '|') {
      cells.push(cur.trim());
      cur = '';
    } else cur += s[k];
  }
  cells.push(cur.trim());
  return cells;
}

function delimiterRow(line) {
  if (!line.includes('-')) return null;
  const cells = splitCells(line);
  const align = [];
  for (const c of cells) {
    if (!/^:?-+:?$/.test(c)) return null;
    align.push(c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : c.startsWith(':') ? 'left' : null);
  }
  return align;
}

function startsTable(lines, i) {
  if (!lines[i].includes('|') || i + 1 >= lines.length) return null;
  const align = delimiterRow(lines[i + 1]);
  if (!align) return null;
  const head = splitCells(lines[i]);
  if (head.length !== align.length || head.length > MAX_TABLE_COLS) return null;
  return { head, align };
}

function startsBlock(lines, i) {
  const line = lines[i];
  if (fenceOpen(line) || headingOf(line) || isHr(line) || isQuoteLine(line)) return true;
  const lm = LIST_RE.exec(line);
  if (lm && lm[1].length <= 3 && !(/^\s*$/.test(line.slice(lm[0].length)))) {
    if (!/\d/.test(lm[2][0])) return true;
    return parseInt(lm[2], 10) === 1;
  }
  return startsTable(lines, i) !== null;
}

function plainFromLines(lines, ctx) {
  const text = lines.join('\n').trim();
  return text ? [{ t: 'p', c: parseInline(text, ctx) }] : [];
}

function parseBlocks(lines, depth, ctx) {
  const out = [];
  let i = 0;
  while (i < lines.length) {
    if (ctx.budget.n > MAX_NODES) break;
    const line = lines[i];
    if (line.trim() === '') {
      i += 1;
      continue;
    }

    const f = fenceOpen(line);
    if (f) {
      const body = [];
      i += 1;
      while (i < lines.length && !isFenceClose(lines[i], f)) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1;
      ctx.budget.n += 1;
      out.push({ t: 'code', lang: f.info.split(/\s+/)[0].replace(/[^A-Za-z0-9_+.#-]/g, '').slice(0, 30), v: body.join('\n') });
      continue;
    }

    const h = headingOf(line);
    if (h) {
      ctx.budget.n += 1;
      out.push({ t: 'heading', level: Math.min(h.level, 6), c: parseInline(h.text, ctx) });
      i += 1;
      continue;
    }

    if (isHr(line)) {
      out.push({ t: 'hr' });
      i += 1;
      continue;
    }

    if (isQuoteLine(line)) {
      const inner = [];
      while (i < lines.length && lines[i].trim() !== '' && (isQuoteLine(lines[i]) || !startsBlock(lines, i))) {
        inner.push(isQuoteLine(lines[i]) ? stripQuote(lines[i]) : lines[i]);
        i += 1;
      }
      ctx.budget.n += 1;
      out.push({ t: 'quote', c: depth >= MAX_BLOCK_DEPTH ? plainFromLines(inner, ctx) : parseBlocks(inner, depth + 1, ctx) });
      continue;
    }

    const lm = listMarker(line);
    if (lm && lm.lead <= 3) {
      const items = [];
      const first = lm;
      let cur = lm;
      while (cur) {
        const itemLines = [cur.rest];
        i += 1;
        let pendingBlank = 0;
        let next = null;
        while (i < lines.length) {
          const l = lines[i];
          if (l.trim() === '') {
            pendingBlank += 1;
            i += 1;
            continue;
          }
          const lead = l.length - l.trimStart().length;
          if (lead >= cur.contentIndent) {
            for (let b = 0; b < pendingBlank; b++) itemLines.push('');
            pendingBlank = 0;
            itemLines.push(l.slice(cur.contentIndent));
            i += 1;
            continue;
          }
          const nm = listMarker(l);
          if (nm && nm.lead <= first.lead + 3 && nm.lead < cur.contentIndent && nm.ordered === first.ordered && (nm.ordered || nm.bullet === first.bullet)) {
            next = nm;
            break;
          }
          if (pendingBlank === 0 && !startsBlock(lines, i) && !nm) {
            itemLines.push(l.trimStart()); // lazy continuation of the item's paragraph
            i += 1;
            continue;
          }
          break;
        }
        let checked;
        const tm = /^\[([ xX])\][ \t]+/.exec(itemLines[0]);
        if (tm) {
          checked = tm[1] !== ' ';
          itemLines[0] = itemLines[0].slice(tm[0].length);
        }
        ctx.budget.n += 1;
        const item = { c: depth >= MAX_BLOCK_DEPTH ? plainFromLines(itemLines, ctx) : parseBlocks(itemLines, depth + 1, ctx) };
        if (checked !== undefined) item.checked = checked;
        items.push(item);
        if (items.length >= 2000) break;
        cur = next;
      }
      const node = { t: first.ordered ? 'ol' : 'ul', items };
      if (first.ordered) node.start = first.num;
      out.push(node);
      continue;
    }

    const tbl = startsTable(lines, i);
    if (tbl) {
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim() !== '' && lines[i].includes('|') && !startsBlock(lines, i) && rows.length < MAX_TABLE_ROWS) {
        const cells = splitCells(lines[i]);
        const row = [];
        for (let c = 0; c < tbl.head.length; c++) row.push(parseInline(cells[c] || '', ctx));
        rows.push(row);
        i += 1;
      }
      ctx.budget.n += 1;
      out.push({ t: 'table', align: tbl.align, head: tbl.head.map((c) => parseInline(c, ctx)), rows });
      continue;
    }

    // paragraph
    const para = [line.trimStart()];
    i += 1;
    while (i < lines.length && lines[i].trim() !== '' && !startsBlock(lines, i)) {
      para.push(lines[i].trimStart());
      i += 1;
    }
    // hard breaks: two trailing spaces before a newline
    const text = para.map((l, idx) => (idx < para.length - 1 && /( {2,})$/.test(l) ? `${l.trimEnd()}\\` : l.trimEnd())).join('\n');
    ctx.budget.n += 1;
    out.push({ t: 'p', c: parseInline(text, ctx) });
  }
  return out;
}

// Reference definitions `[label]: dest "title"` anywhere outside fences (they never render).
function collectRefs(lines) {
  const refs = new Map();
  let fence = null;
  const kept = [];
  for (const line of lines) {
    if (fence) {
      kept.push(line);
      if (isFenceClose(line, fence)) fence = null;
      continue;
    }
    const f = fenceOpen(line);
    if (f) {
      fence = f;
      kept.push(line);
      continue;
    }
    const m = /^ {0,3}\[([^\]\n]{1,999})\]:[ \t]*(<[^>\n]{0,2000}>|\S{1,2000})(?:[ \t]+(?:"[^"]*"|'[^']*'|\([^)]*\)))?[ \t]*$/.exec(line);
    if (m) {
      const label = normLabel(m[1]);
      if (label && !refs.has(label)) refs.set(label, m[2].startsWith('<') ? m[2].slice(1, -1) : m[2]);
      continue; // definitions are not content
    }
    kept.push(line);
  }
  return { refs, kept };
}

/**
 * @param {string} src markdown (never trusted)
 * @returns {object[]} block AST (see header)
 */
export function parseMarkdown(src) {
  const text = String(src ?? '').slice(0, MAX_PARSE_CHARS).replace(/\r\n?/g, '\n');
  const { refs, kept } = collectRefs(text.split('\n'));
  return parseBlocks(kept, 0, { refs, budget: { n: 0, scan: 500000 } });
}

// ---------------------------------------------------------------- derived text

/** Plain text of inline nodes (no markup). */
export const inlineText = (nodes) => textOf(nodes).replace(/\s+/g, ' ');

/** Headings of a document in order: [{level, text}] (for the compact MCP projection and the section tools). */
export function docHeadings(src, max = 60) {
  const out = [];
  for (const b of parseMarkdown(src)) {
    if (b.t === 'heading') {
      out.push({ level: b.level, text: inlineText(b.c).slice(0, 120) });
      if (out.length >= max) break;
    }
  }
  return out;
}

/**
 * Plain-text lines for an excerpt (SVG card, MCP summaries). Blocks become lines; lists get bullets.
 * @returns {{text: string, bold?: boolean}[]}
 */
export function docExcerptLines(src, maxLines = 6, maxWidthChars = 48) {
  const lines = [];
  const push = (text, bold) => {
    const t = text.trim();
    if (!t) return;
    // naive wrap by words
    let cur = '';
    for (const word of t.split(' ')) {
      if (cur && (cur + ' ' + word).length > maxWidthChars) {
        lines.push({ text: cur, bold });
        cur = word.slice(0, maxWidthChars);
      } else cur = cur ? `${cur} ${word}` : word.slice(0, maxWidthChars);
    }
    if (cur) lines.push({ text: cur, bold });
  };
  const walk = (blocks, prefix) => {
    for (const b of blocks) {
      if (lines.length >= maxLines) return;
      if (b.t === 'heading') push(inlineText(b.c), true);
      else if (b.t === 'p') push(prefix + inlineText(b.c));
      else if (b.t === 'ul' || b.t === 'ol') {
        b.items.forEach((it, idx) => {
          const mark = it.checked === undefined ? (b.t === 'ul' ? '• ' : `${(b.start || 1) + idx}. `) : it.checked ? '[x] ' : '[ ] ';
          const first = it.c.find((x) => x.t === 'p');
          if (first) push(mark + inlineText(first.c));
          walk(it.c.filter((x) => x !== first), '  ');
        });
      } else if (b.t === 'quote') walk(b.c, '> ');
      else if (b.t === 'code') b.v.split('\n').slice(0, 3).forEach((l) => push(l));
      else if (b.t === 'table') push(b.head.map(inlineText).join(' | '), true);
    }
  };
  walk(parseMarkdown(src), '');
  return lines.slice(0, maxLines);
}
