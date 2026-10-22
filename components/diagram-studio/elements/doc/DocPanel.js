// components/diagram-studio/elements/doc/DocPanel.js
// Side-panel editor for a doc (AI-5). Lazy-loaded by DocPanelHost, so the canvas bundle does not carry it.
//
// Editor decision (Q-AC1, recorded in docs/architecture/investigations/ai-canvas-via-mcp.md section 11): a Markdown
// textarea with a formatting toolbar and a live preview. Storage is Markdown either way, so a WYSIWYG editor can be
// swapped in later without a migration. The textarea has no HTML surface at all: what is typed is text, the preview
// goes through the same safe renderer as the card, and the server rewrites the stored text again (lib/doc/sanitize).
//
// Behaviour: edits are kept as a local draft and flushed into the element (one undo step per burst) 400 ms after the
// last keystroke and when the panel closes. If the doc changes elsewhere (an agent, a collaborator, live pickup)
// while the draft is clean, the new text is adopted; if the draft is dirty, the local text wins and a notice says so
// (the same rule as AI-2's three-way merge). View-only roles get the preview and the export, no editing controls.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDiagram } from '../../DiagramContext';
import { canWrite } from '../../sharing/accessMode';
import DocMarkdown from './DocMarkdown';
import { followElementLink } from './docStore';
import { copyDocRich, exportDocFile } from './docActions';
import { docOf, cleanTitle, MAX_DOC_TITLE } from '../../../../lib/doc/docElement';
import { MAX_DOC_BYTES, utf8Length } from '../../../../lib/doc/markdown';
import { docToMarkdownFile, docFileName } from '../../../../lib/doc/docText';
import { elementLink } from '../../../../lib/doc/docHref';

const FLUSH_MS = 400;
const PREVIEW_MAX_BLOCKS = 400;
const utf8Bytes = utf8Length;
const linkText = (label) => String(label || 'element').replace(/[[\]\\\n\r]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'element';

const S = {
  panel: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, flex: '1 1 auto', overflow: 'hidden', background: 'var(--panel, #fff)', color: 'var(--text, #0f172a)', fontSize: 13 },
  head: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--border, #e2e8f0)' },
  title: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: 650, border: '1px solid transparent', borderRadius: 6, padding: '4px 6px', background: 'transparent', color: 'inherit' },
  iconBtn: { border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--text-muted, #475569)', borderRadius: 6, padding: '4px 8px', fontSize: 12 },
  tabs: { display: 'flex', gap: 4, padding: '6px 12px 0' },
  tab: (on) => ({ border: 0, background: on ? 'var(--accent-soft, rgba(79,179,206,.12))' : 'transparent', color: on ? 'var(--accent, #4FB3CE)' : 'var(--text-muted, #475569)', fontWeight: on ? 650 : 500, borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }),
  tools: { display: 'flex', flexWrap: 'wrap', gap: 2, padding: '6px 12px', borderBottom: '1px solid var(--border-subtle, #f1f5f9)' },
  tool: { border: '1px solid var(--border, #e2e8f0)', background: 'var(--panel, #fff)', borderRadius: 5, padding: '2px 7px', cursor: 'pointer', fontSize: 12, color: 'var(--text, #0f172a)', minWidth: 26 },
  area: { flex: '1 1 0', minHeight: 0, overflowY: 'auto', margin: 0, padding: '10px 12px', border: 0, outline: 'none', resize: 'none', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5, lineHeight: 1.55, background: 'transparent', color: 'inherit' },
  preview: { flex: '1 1 0', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '10px 14px' },
  foot: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderTop: '1px solid var(--border-subtle, #f1f5f9)', fontSize: 11.5, color: 'var(--text-muted, #475569)' },
  notice: { margin: '6px 12px 0', padding: '6px 8px', borderRadius: 6, background: '#fff7e6', color: '#5c3b00', border: '1px solid #f0c36d', fontSize: 12 },
  picker: { padding: '6px 12px', borderBottom: '1px solid var(--border-subtle, #f1f5f9)' },
  pickerList: { maxHeight: 150, overflow: 'auto', marginTop: 4, border: '1px solid var(--border, #e2e8f0)', borderRadius: 6 },
  pickerItem: { display: 'flex', width: '100%', textAlign: 'left', gap: 8, border: 0, background: 'transparent', padding: '5px 8px', cursor: 'pointer', fontSize: 12.5, color: 'inherit' },
  input: { width: '100%', boxSizing: 'border-box', border: '1px solid var(--border, #e2e8f0)', borderRadius: 6, padding: '4px 8px', fontSize: 12.5, background: 'transparent', color: 'inherit' },
};

export default function DocPanel({ elementId, onClose }) {
  const { elements = [], updateElement, diagram, selection } = useDiagram() || {};
  const element = useMemo(() => elements.find((e) => e.id === elementId) || null, [elements, elementId]);
  const doc = docOf(element) || {};
  const editable = canWrite(diagram?.access);

  const [title, setTitle] = useState(doc.title ?? element?.label ?? '');
  const [text, setText] = useState(typeof doc.markdown === 'string' ? doc.markdown : '');
  const [mode, setMode] = useState(editable ? 'write' : 'preview');
  const [notice, setNotice] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const areaRef = useRef(null);
  const pendingSelRef = useRef(null);

  // Latest values for the unmount flush and for merging into the freshest element.
  const draftRef = useRef({ title, text });
  draftRef.current = { title, text };
  const elementRef = useRef(element);
  elementRef.current = element;
  const flushedRef = useRef({ title: doc.title ?? element?.label ?? '', text: typeof doc.markdown === 'string' ? doc.markdown : '' });
  const timerRef = useRef(null);

  const flush = useCallback(() => {
    clearTimeout(timerRef.current);
    const el = elementRef.current;
    if (!editable || !el || !updateElement) return;
    const { title: t, text: m } = draftRef.current;
    const cur = docOf(el) || {};
    const nextTitle = cleanTitle(t) || 'Untitled doc';
    if (cur.title === nextTitle && cur.markdown === m) {
      flushedRef.current = { title: t, text: m };
      return;
    }
    flushedRef.current = { title: t, text: m };
    updateElement(el.id, { label: nextTitle, data: { ...(el.data || {}), doc: { ...cur, title: nextTitle, markdown: m } } }, { coalesceKey: `doc:${el.id}` });
  }, [editable, updateElement]);

  const flushRef = useRef(flush);
  flushRef.current = flush;
  const schedule = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => flushRef.current(), FLUSH_MS);
  }, []);

  // Flush when the panel closes / switches doc (once, on unmount; the latest flush reads refs only).
  useEffect(() => () => flushRef.current(), []);

  // Pick up changes made elsewhere.
  useEffect(() => {
    const remoteTitle = doc.title ?? element?.label ?? '';
    const remoteText = typeof doc.markdown === 'string' ? doc.markdown : '';
    const flushed = flushedRef.current;
    if (remoteTitle === flushed.title && remoteText === flushed.text) return;
    if (remoteTitle === cleanTitle(flushed.title) && remoteText === flushed.text) return;
    const d = draftRef.current;
    if (d.title === flushed.title && d.text === flushed.text) {
      setTitle(remoteTitle);
      setText(remoteText);
      flushedRef.current = { title: remoteTitle, text: remoteText };
      setNotice('Updated from another change.');
    } else {
      setNotice('This doc was also changed elsewhere. Your text is kept and will be saved over it.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.title, doc.markdown]);

  // The element disappeared (deleted, or restored away): close.
  useEffect(() => {
    if (!element) onClose?.();
  }, [element, onClose]);

  useEffect(() => {
    const sel = pendingSelRef.current;
    if (sel && areaRef.current) {
      areaRef.current.focus();
      areaRef.current.setSelectionRange(sel[0], sel[1]);
      pendingSelRef.current = null;
    }
  });

  const knownIds = useMemo(() => new Set(elements.map((e) => e.id)), [elements]);
  const bytes = useMemo(() => utf8Bytes(text), [text]);

  const setBody = useCallback(
    (next, selection2) => {
      if (utf8Bytes(next) > MAX_DOC_BYTES) {
        setNotice(`A doc holds up to ${MAX_DOC_BYTES / 1024} KB of text. Split it into two docs.`);
        return;
      }
      setNotice((n) => (n && /KB of text/.test(n) ? null : n));
      setText(next);
      if (selection2) pendingSelRef.current = selection2;
      schedule();
    },
    [schedule]
  );

  const onTitle = (e) => {
    setTitle(e.target.value.slice(0, MAX_DOC_TITLE));
    schedule();
  };

  // ---- toolbar helpers (operate on the textarea selection) ----
  const edit = (fn) => {
    const ta = areaRef.current;
    const start = ta ? ta.selectionStart : text.length;
    const end = ta ? ta.selectionEnd : text.length;
    const r = fn(text, start, end);
    setBody(r.text, r.sel);
  };
  const wrap = (before, after, placeholder) =>
    edit((t, a, b) => {
      const chosen = t.slice(a, b) || placeholder;
      const out = t.slice(0, a) + before + chosen + after + t.slice(b);
      return { text: out, sel: [a + before.length, a + before.length + chosen.length] };
    });
  const prefixLines = (prefix) =>
    edit((t, a, b) => {
      const lineStart = t.lastIndexOf('\n', a - 1) + 1;
      const block = t.slice(lineStart, b);
      const lines = block.split('\n').map((l, i) => (typeof prefix === 'function' ? prefix(i) : prefix) + l);
      const out = t.slice(0, lineStart) + lines.join('\n') + t.slice(b);
      return { text: out, sel: [lineStart, lineStart + lines.join('\n').length] };
    });
  const insert = (snippet) =>
    edit((t, a, b) => {
      const out = t.slice(0, a) + snippet + t.slice(b);
      return { text: out, sel: [a + snippet.length, a + snippet.length] };
    });

  const linkable = useMemo(
    () => elements.filter((e) => e.id !== elementId && elementLink(e.id)),
    [elements, elementId]
  );
  const matches = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return linkable
      .filter((e) => !q || String(e.label || e.name || e.type).toLowerCase().includes(q))
      .slice(0, 12);
  }, [linkable, filter]);
  const labelOf = (e) => e.label || e.name || e.type;
  const selectedLinkables = useMemo(
    () => linkable.filter((e) => selection?.nodeIds?.includes(e.id)),
    [linkable, selection]
  );

  const insertElementLink = (e) => {
    insert(`[${linkText(labelOf(e))}](${elementLink(e.id)})`);
    setPickerOpen(false);
    setFilter('');
    setMode('write');
  };
  const insertSelectedLinks = () => {
    if (selectedLinkables.length === 0) return;
    const lines = selectedLinkables.slice(0, 50).map((e) => `- [${linkText(labelOf(e))}](${elementLink(e.id)})`);
    insert(`${lines.join('\n')}\n`);
    setMode('write');
  };

  const exportMd = () => {
    const blob = new Blob([docToMarkdownFile({ title: cleanTitle(title), markdown: text })], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = docFileName(title);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Copy with formatting / .docx / .pdf use the draft in the panel (what the user sees), not the last saved value.
  const copyRichNow = () => copyDocRich({ title: cleanTitle(title), markdown: text, diagram });
  const exportAs = (kind) => exportDocFile(kind, { title: cleanTitle(title), markdown: text, diagram });
  // Cmd/Ctrl+Shift+C copies the doc with formatting. Plain Cmd/Ctrl+C inside the textarea is left alone.
  const onPanelKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && !e.altKey && String(e.key).toLowerCase() === 'c') {
      e.preventDefault();
      e.stopPropagation();
      copyRichNow();
    }
  };

  const close = () => {
    flush();
    onClose?.();
  };

  if (!element) return null;

  return (
    <div style={S.panel} data-testid="doc-panel" role="region" aria-label="Doc editor" onKeyDown={onPanelKeyDown}>
      <div style={S.head}>
        <input
          style={S.title}
          value={title}
          onChange={onTitle}
          onBlur={flush}
          readOnly={!editable}
          placeholder="Untitled doc"
          aria-label="Doc title"
          data-testid="doc-title"
        />
        <button type="button" style={{ ...S.iconBtn, fontWeight: 650 }} onClick={copyRichNow} data-testid="doc-copy-rich" title="Copy with formatting, to paste into Outlook or Word (Cmd/Ctrl+Shift+C)">Copy</button>
        <button type="button" style={S.iconBtn} onClick={() => exportAs('docx')} data-testid="doc-export-docx" title="Download as a Word document">.docx</button>
        <button type="button" style={S.iconBtn} onClick={() => exportAs('pdf')} data-testid="doc-export-pdf" title="Download as a PDF">.pdf</button>
        <button type="button" style={S.iconBtn} onClick={exportMd} data-testid="doc-export-md" title="Download as a Markdown file">.md</button>
        <button type="button" style={S.iconBtn} onClick={close} aria-label="Close doc" data-testid="doc-close">&times;</button>
      </div>

      {editable && (
        <div style={S.tabs} role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'write'} style={S.tab(mode === 'write')} onClick={() => setMode('write')} data-testid="doc-tab-write">Write</button>
          <button type="button" role="tab" aria-selected={mode === 'preview'} style={S.tab(mode === 'preview')} onClick={() => setMode('preview')} data-testid="doc-tab-preview">Preview</button>
        </div>
      )}

      {editable && mode === 'write' && (
        <div style={S.tools} role="toolbar" aria-label="Formatting">
          <button type="button" style={S.tool} title="Heading" onClick={() => prefixLines('## ')}>H</button>
          <button type="button" style={{ ...S.tool, fontWeight: 700 }} title="Bold" onClick={() => wrap('**', '**', 'bold')}>B</button>
          <button type="button" style={{ ...S.tool, fontStyle: 'italic' }} title="Italic" onClick={() => wrap('*', '*', 'italic')}>I</button>
          <button type="button" style={S.tool} title="Code" onClick={() => wrap('`', '`', 'code')}>{'</>'}</button>
          <button type="button" style={S.tool} title="Bulleted list" onClick={() => prefixLines('- ')}>&bull;</button>
          <button type="button" style={S.tool} title="Numbered list" onClick={() => prefixLines((i) => `${i + 1}. `)}>1.</button>
          <button type="button" style={S.tool} title="Task list" onClick={() => prefixLines('- [ ] ')}>&#9744;</button>
          <button type="button" style={S.tool} title="Quote" onClick={() => prefixLines('> ')}>&ldquo;</button>
          <button type="button" style={S.tool} title="Web link" onClick={() => wrap('[', '](https://)', 'text')}>link</button>
          <button type="button" style={S.tool} title="Table" onClick={() => insert('\n| A | B |\n|---|---|\n|   |   |\n')}>table</button>
          <button type="button" style={{ ...S.tool, color: 'var(--accent, #4FB3CE)', fontWeight: 650 }} title="Link to an element on the board" aria-expanded={pickerOpen} onClick={() => setPickerOpen((v) => !v)} data-testid="doc-link-element">Link element</button>
          <button type="button" style={S.tool} title="Insert links to the elements selected on the board" disabled={selectedLinkables.length === 0} onClick={insertSelectedLinks} data-testid="doc-link-selected">Link selected ({selectedLinkables.length})</button>
        </div>
      )}

      {editable && pickerOpen && mode === 'write' && (
        <div style={S.picker} data-testid="doc-element-picker">
          <input style={S.input} autoFocus placeholder="Find an element by name" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Find an element" />
          <div style={S.pickerList} role="listbox" aria-label="Elements">
            {matches.length === 0 && <div style={{ padding: 8, color: 'var(--text-muted, #475569)' }}>No matching elements</div>}
            {matches.map((e) => (
              <button key={e.id} type="button" role="option" aria-selected="false" style={S.pickerItem} onClick={() => insertElementLink(e)} data-element-id={e.id}>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{labelOf(e)}</span>
                <span style={{ color: 'var(--text-light, #94a3b8)' }}>{e.type}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {notice && <div style={S.notice} role="status" data-testid="doc-notice">{notice}</div>}

      {editable && mode === 'write' ? (
        <textarea
          ref={areaRef}
          style={S.area}
          value={text}
          onChange={(e) => setBody(e.target.value)}
          onBlur={flush}
          spellCheck
          placeholder="Write Markdown. Link an element with [text](#el=element-id) or use Link element."
          aria-label="Doc text (Markdown)"
          data-testid="doc-textarea"
        />
      ) : (
        <div style={S.preview} data-testid="doc-preview">
          {text.trim() ? <DocMarkdown markdown={text} knownIds={knownIds} onElementLink={followElementLink} maxBlocks={PREVIEW_MAX_BLOCKS} truncationNotice /> : <div style={{ color: 'var(--text-light, #94a3b8)', fontStyle: 'italic' }}>Empty doc.</div>}
        </div>
      )}

      <div style={S.foot}>
        <span>{(bytes / 1024).toFixed(1)} KB of {MAX_DOC_BYTES / 1024} KB</span>
        {!editable && <span>View only</span>}
      </div>
    </div>
  );
}
