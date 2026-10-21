// lib/doc/docText.js
// Pure text operations on doc markdown: sections, append, paging, and `.md` import/export (AI-5).
// Line based and fence-aware; never builds markup, so nothing here can introduce an executable construct
// (callers still run the result through `sanitizeDocMarkdown`).

import { headingOf } from './markdown';
import { sanitizeDocMarkdown } from './sanitize';

const FENCE_RE = /^ {0,3}(`{3,}|~{3,})(.*)$/;

function fenceOf(line) {
  const m = FENCE_RE.exec(line);
  if (!m) return null;
  if (m[1][0] === '`' && m[2].includes('`')) return null;
  return { char: m[1][0], len: m[1].length };
}
function closes(line, f) {
  const t = line.trim();
  const lead = line.length - line.trimStart().length;
  if (lead > 3 || t.length < f.len) return false;
  for (let k = 0; k < t.length; k++) if (t[k] !== f.char) return false;
  return true;
}

const plainHeading = (text) =>
  (text || '').replace(/[*_`~]/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').trim().toLowerCase();

/** ATX headings outside fenced code: [{line, level, text, offset}] where offset is the char index of the line start. */
export function scanHeadings(markdown) {
  const text = String(markdown ?? '');
  const out = [];
  let fence = null;
  let offset = 0;
  const lines = text.split('\n');
  lines.forEach((line, idx) => {
    if (fence) {
      if (closes(line, fence)) fence = null;
    } else {
      const f = fenceOf(line);
      if (f) fence = f;
      else {
        const h = headingOf(line);
        if (h) out.push({ line: idx, level: h.level, text: h.text, offset });
      }
    }
    offset += line.length + 1;
  });
  return out;
}

/** Append a block of markdown after the existing text. */
export function appendMarkdown(markdown, addition) {
  const base = String(markdown ?? '').replace(/\s+$/, '');
  const add = String(addition ?? '').trim();
  if (!add) return base ? `${base}\n` : '';
  return base ? `${base}\n\n${add}\n` : `${add}\n`;
}

/**
 * A section body must stay inside its section: heading lines at the section's level or higher are demoted to one level
 * below it (max h6), and an unterminated fenced code block is closed, so the following sections are never swallowed.
 */
export function confineSectionBody(body, level) {
  let fence = null;
  const out = String(body ?? '').trim().split('\n').map((line) => {
    if (fence) {
      if (closes(line, fence)) fence = null;
      return line;
    }
    const f = fenceOf(line);
    if (f) {
      fence = f;
      return line;
    }
    const h = headingOf(line);
    if (h && h.level <= level) return `${'#'.repeat(Math.min(6, level + 1))} ${h.text}`;
    return line;
  });
  if (fence) out.push(fence.char.repeat(fence.len));
  return out.join('\n');
}

/**
 * Replace the body of the section under a heading (the heading line itself stays).
 * `heading` may be plain text ("Findings") or include the hashes ("## Findings"); matching ignores case, emphasis
 * marks and link syntax. The section ends at the next heading of the same or a higher level.
 * @returns {{ok: true, markdown: string} | {ok: false, error: string, headings: string[]}}
 */
export function replaceSection(markdown, heading, body) {
  const md = String(markdown ?? '');
  const wanted = plainHeading(String(heading ?? '').replace(/^\s*#{1,6}[ \t]+/, ''));
  const heads = scanHeadings(md);
  const names = heads.map((h) => `${'#'.repeat(h.level)} ${h.text}`.slice(0, 120));
  const hits = heads.filter((h) => plainHeading(h.text) === wanted && wanted !== '');
  if (hits.length === 0) return { ok: false, error: `No heading "${String(heading).slice(0, 80)}" in this doc`, headings: names.slice(0, 40) };
  if (hits.length > 1) return { ok: false, error: `The heading "${String(heading).slice(0, 80)}" appears ${hits.length} times; replace the whole doc or use a unique heading`, headings: names.slice(0, 40) };
  const at = hits[0];
  const next = heads.find((h) => h.offset > at.offset && h.level <= at.level);
  const lines = md.split('\n');
  const before = lines.slice(0, at.line + 1).join('\n');
  const after = next ? lines.slice(next.line).join('\n') : '';
  const newBody = confineSectionBody(body, at.level);
  const parts = [before];
  if (newBody) parts.push('', newBody);
  if (after) parts.push('', after);
  return { ok: true, markdown: `${parts.join('\n').replace(/\s+$/, '')}\n` };
}

/**
 * One page of the text, cut at a heading boundary when one fits (else at a line, else hard).
 * `offset`/`limit` are in UTF-16 code units of the string. @returns {{text, offset, end, total, next?}}
 */
export function pageDoc(markdown, offset = 0, limit = 8000) {
  const md = String(markdown ?? '');
  const total = md.length;
  const start = Math.max(0, Math.min(Number.isFinite(offset) ? Math.floor(offset) : 0, total));
  const max = Math.max(200, Math.floor(limit));
  if (total - start <= max) return { text: md.slice(start), offset: start, end: total, total };
  let end = start + max;
  const heads = scanHeadings(md).filter((h) => h.offset > start && h.offset <= end);
  if (heads.length) end = heads[heads.length - 1].offset;
  else {
    const nl = md.lastIndexOf('\n', end);
    if (nl > start) end = nl + 1;
    else if (/[\ud800-\udbff]/.test(md[end - 1] || '')) end -= 1; // never split a surrogate pair
  }
  return { text: md.slice(start, end), offset: start, end, total, next: end };
}

// ---------------------------------------------------------------- .md files

export function docFileName(title) {
  const base = String(title || 'doc')
    .normalize('NFKD')
    .replace(/[^\w\s.-]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/\.+/g, '.')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(0, 80);
  return `${base || 'doc'}.md`;
}

/** The text of a `.md` export: the title as a first heading plus the stored markdown (no transformation). */
export function docToMarkdownFile({ title, markdown } = {}) {
  const t = String(title || '').replace(/\s+/g, ' ').trim();
  const body = String(markdown ?? '').replace(/\s+$/, '');
  const startsWithTitle = new RegExp(`^#[ \\t]+${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[ \\t]*(\\n|$)`).test(body);
  const head = t && !startsWithTitle ? `# ${t}\n\n` : '';
  // The whole file is sanitized, title included: a hostile title cannot reach another viewer through the export.
  return sanitizeDocMarkdown(`${head}${body}\n`).markdown;
}

/** Import a `.md` file: a leading `# Heading` becomes the title, else the file name. */
export function markdownFileToDoc(text, fileName = '') {
  const src = String(text ?? '').replace(/^\ufeff/, '').replace(/\r\n?/g, '\n');
  const m = /^[ \t]*#[ \t]+(.+?)[ \t]*(?:\n+|$)/.exec(src);
  const fromName = String(fileName).replace(/\.(md|markdown|txt)$/i, '').replace(/[-_]+/g, ' ').trim();
  if (m) return { title: m[1].replace(/[ \t]+#+$/, '').slice(0, 200), markdown: src.slice(m[0].length).replace(/^\n+/, '') };
  return { title: (fromName || 'Imported doc').slice(0, 200), markdown: src };
}
