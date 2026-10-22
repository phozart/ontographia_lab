// components/diagram-studio/export/copyAsImage.js
// "Copy as image": render the selection, a frame, or the whole board with the existing PNG renderer (html-to-image, via
// exportFromCanvas) at 2x with padding on white, and put `image/png` on the clipboard. When the browser cannot write
// images to the clipboard (no ClipboardItem, blocked, Firefox without the flag) the PNG is downloaded instead and the
// toast says why. The renderer is imported dynamically, so none of this is in the initial canvas bundle.

import { postDocNotice } from '../elements/doc/docStore';

export const IMAGE_SCALE = 2;
export const IMAGE_PADDING = 24;

/** Decide what to render. A lone selected frame renders as a frame, any other selection as a selection, none = the board. */
export function resolveImageScope({ elements = [], selection } = {}) {
  const ids = (selection?.nodeIds || []).filter((id) => elements.some((e) => e.id === id));
  if (ids.length === 0) return { scope: 'canvas', label: 'board' };
  if (ids.length === 1) {
    const el = elements.find((e) => e.id === ids[0]);
    if (el && (el.type === 'frame' || el.isFrame)) return { scope: 'frame', frame: el, label: 'frame' };
  }
  return { scope: 'selection', selection: { nodeIds: ids, connectionIds: selection?.connectionIds || [] }, label: ids.length === 1 ? 'element' : 'selection' };
}

const fileBase = (s) => String(s || 'diagram').normalize('NFKD').replace(/[^\w\s.-]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'diagram';

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * @param {{elements: object[], connections?: object[], selection?: {nodeIds?: string[], connectionIds?: string[]}, name?: string}} o
 *   `selection` empty = the whole board.
 * @returns {Promise<{ok: boolean, method: 'clipboard'|'download'|null}>}
 */
export async function copyAsImage({ elements = [], connections = [], selection, name = 'diagram', render } = {}) {
  const target = resolveImageScope({ elements, selection });
  const doRender = async () => {
    const renderer = render || (await import('./exportRenderer')).exportFromCanvas;
    const res = await renderer('png', {
      scope: target.scope, elements, connections, selection: target.selection, frame: target.frame,
      padding: IMAGE_PADDING, background: 'white', scale: IMAGE_SCALE, name,
    });
    return res.content;
  };
  postDocNotice(`Rendering ${target.label}...`);
  let blob = null;
  const pending = doRender().then((b) => { blob = b; return b; });
  pending.catch(() => {}); // handled below; avoid an unhandled rejection if the clipboard path throws first
  const canWrite = typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write;
  if (canWrite) {
    try {
      // A promise inside the ClipboardItem keeps the user-gesture valid while the (slow) render runs (Safari needs it).
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': pending })]);
      postDocNotice(`Copied the ${target.label} as an image. Paste it into a mail, chat or document.`, 'success');
      return { ok: true, method: 'clipboard' };
    } catch { /* fall back to a download */ }
  }
  try {
    const b = blob || (await pending);
    saveBlob(b, `${fileBase(name)}-${target.label}.png`);
    postDocNotice(canWrite ? 'The browser blocked copying images, so the PNG was downloaded instead.' : 'This browser cannot copy images to the clipboard, so the PNG was downloaded instead.', 'info');
    return { ok: true, method: 'download' };
  } catch {
    postDocNotice('Could not create the image.', 'error');
    return { ok: false, method: null };
  }
}
