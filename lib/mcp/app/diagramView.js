// lib/mcp/app/diagramView.js
// The MCP App view (`ui://ontographia/diagram-view.html`) for the `diagram_show` tool (spike, slice AI-9).
//
// One static, self-contained HTML page: no bundle, no dependency, no network. It speaks the MCP Apps postMessage
// dialect (spec 2026-01-26) directly instead of using @modelcontextprotocol/ext-apps, which keeps the lab free of a
// new dependency: ui/initialize -> ui/notifications/initialized, then it waits for ui/notifications/tool-result.
//
// Data path: the tool result's `_meta["ontographia/view"]` carries a server-rendered SVG (lib/render/diagramSvg.js).
// The view never authenticates to the lab and never fetches: the SVG is shown through <img src="data:image/svg+xml">,
// so even a hostile SVG could not run script or load anything. A page-level CSP meta tag repeats that
// (img-src data: only, connect-src none), on top of whatever CSP the host applies.
//
// Interaction (read-only v1): zoom (buttons, ctrl/cmd + wheel, pinch), pan (drag), fit, "Changes" (zoom to the
// highlighted agent change), fullscreen when the host offers it, and "Open in lab" through ui/open-link (the host
// opens the URL; the view itself never navigates).

export const DIAGRAM_VIEW_URI = 'ui://ontographia/diagram-view.html';
export const MCP_APP_MIME_TYPE = 'text/html;profile=mcp-app';
export const VIEW_META_KEY = 'ontographia/view';

const CSS = `
:root { color-scheme: light dark; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: transparent; }
body {
  font-family: var(--font-sans, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif);
  font-size: var(--font-text-sm-size, 14px);
  line-height: var(--font-text-sm-line-height, 1.4);
  color: var(--color-text-primary, #141413);
}
.app { display: flex; flex-direction: column; gap: 8px; padding: 10px; }
.head { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; min-width: 0; }
.title { font-weight: var(--font-weight-semibold, 600); font-size: var(--font-heading-sm-size, 14px); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.sub { color: var(--color-text-tertiary, #73726c); font-size: var(--font-text-xs-size, 12px); }
.stage {
  position: relative; overflow: hidden; height: 380px; touch-action: none; cursor: grab;
  border-radius: var(--border-radius-md, 8px);
  border: var(--border-width-regular, 1px) solid var(--color-border-tertiary, rgba(31,30,29,.15));
  background: #f8fafc;
}
.stage.dragging { cursor: grabbing; }
.stage img { position: absolute; left: 0; top: 0; transform-origin: 0 0; user-select: none; -webkit-user-drag: none; pointer-events: none; max-width: none; }
.msg { padding: 24px 12px; color: var(--color-text-secondary, #3d3d3a); text-align: center; }
.bar { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.bar .spacer { flex: 1; }
button {
  font: inherit; min-height: 32px; min-width: 32px; padding: 4px 10px; cursor: pointer;
  border-radius: var(--border-radius-md, 8px);
  border: var(--border-width-regular, 1px) solid var(--color-border-secondary, rgba(31,30,29,.3));
  background: var(--color-background-primary, #fff); color: var(--color-text-primary, #141413);
}
button.primary { background: var(--color-background-inverse, #141413); color: var(--color-text-inverse, #fff); border-color: transparent; }
button:focus-visible { outline: 2px solid var(--color-ring-info, #4FB3CE); outline-offset: 1px; }
button[hidden], .legend[hidden] { display: none; }
@media (pointer: coarse) { button { min-height: 44px; min-width: 44px; } }
.legend { display: flex; gap: 10px; flex-wrap: wrap; font-size: var(--font-text-xs-size, 12px); color: var(--color-text-secondary, #3d3d3a); }
.dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 4px; vertical-align: 0; }
.link { font-size: var(--font-text-xs-size, 12px); color: var(--color-text-tertiary, #73726c); word-break: break-all; }
`;

// Runs inside the sandboxed iframe. Plain ES2017, no imports. Every string from the result is set with textContent.
const SCRIPT = `
(function () {
  'use strict';
  var META_KEY = ${JSON.stringify(VIEW_META_KEY)};
  var PROTOCOL = '2026-01-26';
  var nextId = 1;
  var pending = {};
  var hostCaps = {};
  var view = null;
  var tf = { s: 1, x: 0, y: 0 };
  var $ = function (id) { return document.getElementById(id); };
  var stage = $('stage'); var img = $('img');

  function send(msg) { window.parent.postMessage(msg, '*'); }
  function request(method, params) {
    var id = nextId++;
    send({ jsonrpc: '2.0', id: id, method: method, params: params || {} });
    return new Promise(function (resolve, reject) { pending[id] = { resolve: resolve, reject: reject }; });
  }
  function notify(method, params) { send({ jsonrpc: '2.0', method: method, params: params || {} }); }

  window.addEventListener('message', function (ev) {
    if (ev.source !== window.parent) return;
    var m = ev.data;
    if (!m || m.jsonrpc !== '2.0') return;
    if (m.id !== undefined && m.id !== null && !m.method) {
      var p = pending[m.id]; delete pending[m.id];
      if (p) { if (m.error) p.reject(m.error); else p.resolve(m.result); }
      return;
    }
    if (m.method === 'ui/notifications/tool-result') return onResult(m.params || {});
    if (m.method === 'ui/notifications/host-context-changed') return applyContext(m.params || {});
    if (m.method === 'ui/resource-teardown' || m.method === 'ping') {
      if (m.id !== undefined) send({ jsonrpc: '2.0', id: m.id, result: {} });
      return;
    }
    if (m.id !== undefined && m.method) send({ jsonrpc: '2.0', id: m.id, error: { code: -32601, message: 'Method not found' } });
  });

  function applyContext(ctx) {
    if (ctx.theme === 'dark' || ctx.theme === 'light') document.documentElement.setAttribute('data-theme', ctx.theme);
    var vars = ctx.styles && ctx.styles.variables;
    if (vars && typeof vars === 'object') {
      Object.keys(vars).forEach(function (k) {
        var v = vars[k];
        var name = k.indexOf('--') === 0 ? k : '--' + k;
        if (/^--[a-z0-9-]{1,64}$/i.test(name) && typeof v === 'string' && v.length < 200 && !/url\\(|[;{}<>]/i.test(v)) {
          document.documentElement.style.setProperty(name, v);
        }
      });
    }
    if (ctx.displayMode) { document.documentElement.setAttribute('data-mode', ctx.displayMode); resizeStage(ctx.displayMode); }
  }

  function resizeStage(mode) {
    stage.style.height = mode === 'fullscreen' ? Math.max(320, window.innerHeight - 120) + 'px' : '';
    $('full').textContent = mode === 'fullscreen' ? 'Exit full screen' : 'Full screen';
    fit();
  }

  function setText(id, text) { $(id).textContent = text || ''; }

  function onResult(result) {
    var meta = (result._meta && result._meta[META_KEY]) || null;
    var sc = result.structuredContent || {};
    if (!meta || typeof meta !== 'object') {
      var t = (result.content || []).filter(function (c) { return c && c.type === 'text'; }).map(function (c) { return c.text; }).join('\\n');
      setText('title', result.isError ? 'Could not show the diagram' : 'Diagram');
      showMessage(t || 'Nothing to show.');
      return;
    }
    view = meta;
    setText('title', meta.title || 'Diagram');
    setText('sub', meta.subtitle || '');
    var legend = $('legend'); legend.textContent = '';
    var h = meta.highlight;
    if (h && h.summary) {
      var parts = [['added', h.summary.added], ['changed', h.summary.changed], ['removed', h.summary.removed]];
      var lead = document.createElement('span'); lead.textContent = h.label || 'Last agent change:'; legend.appendChild(lead);
      parts.forEach(function (p) {
        if (!p[1]) return;
        var s = document.createElement('span'); var d = document.createElement('span');
        d.className = 'dot'; d.style.background = (meta.colors && meta.colors[p[0]]) || '#888';
        s.appendChild(d); s.appendChild(document.createTextNode(p[1] + ' ' + p[0])); legend.appendChild(s);
      });
      legend.hidden = false;
    } else legend.hidden = true;
    $('changes').hidden = !(meta.highlightBox && meta.viewBox);
    $('open').hidden = !safeUrl(meta.openUrl);
    if (typeof meta.svg !== 'string' || !meta.svg) { showMessage(meta.message || 'The diagram is too large to draw here. Open it in the lab.'); return; }
    $('msg').hidden = true; stage.hidden = false;
    img.onload = function () { fit(); reportSize(); };
    img.alt = meta.alt || meta.title || 'Diagram';
    img.width = meta.viewBox.width; img.height = meta.viewBox.height;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(meta.svg);
    reportSize();
  }

  function showMessage(text) { stage.hidden = true; var m = $('msg'); m.hidden = false; m.textContent = text; reportSize(); }

  function safeUrl(u) { return typeof u === 'string' && /^https?:\\/\\/[^\\s]+$/i.test(u) ? u : null; }

  function apply() { img.style.transform = 'translate(' + tf.x + 'px,' + tf.y + 'px) scale(' + tf.s + ')'; }
  function zoomTo(rect) {
    if (!view || !view.viewBox) return;
    var W = stage.clientWidth, H = stage.clientHeight, vb = view.viewBox;
    var s = Math.min(W / rect.width, H / rect.height);
    s = Math.max(0.05, Math.min(s, 2));
    tf.s = s;
    tf.x = (W - rect.width * s) / 2 - (rect.x - vb.x) * s;
    tf.y = (H - rect.height * s) / 2 - (rect.y - vb.y) * s;
    apply();
  }
  function fit() { if (view && view.viewBox) zoomTo(view.viewBox); }
  function zoomAt(factor, cx, cy) {
    var s = Math.max(0.05, Math.min(tf.s * factor, 8));
    var k = s / tf.s;
    tf.x = cx - (cx - tf.x) * k; tf.y = cy - (cy - tf.y) * k; tf.s = s; apply();
  }

  $('zin').onclick = function () { zoomAt(1.25, stage.clientWidth / 2, stage.clientHeight / 2); };
  $('zout').onclick = function () { zoomAt(0.8, stage.clientWidth / 2, stage.clientHeight / 2); };
  $('fit').onclick = fit;
  $('changes').onclick = function () {
    var b = view && view.highlightBox; if (!b) return;
    var pad = Math.max(40, Math.max(b.width, b.height) * 0.15);
    zoomTo({ x: b.x - pad, y: b.y - pad, width: b.width + 2 * pad, height: b.height + 2 * pad });
  };
  $('open').onclick = function () {
    var u = safeUrl(view && view.openUrl); if (!u) return;
    request('ui/open-link', { url: u }).catch(function () { setText('linktext', u); $('linktext').hidden = false; });
  };
  $('full').onclick = function () {
    var mode = document.documentElement.getAttribute('data-mode') === 'fullscreen' ? 'inline' : 'fullscreen';
    request('ui/request-display-mode', { mode: mode }).then(function (r) { if (r && r.mode) { document.documentElement.setAttribute('data-mode', r.mode); resizeStage(r.mode); reportSize(); } }).catch(function () {});
  };

  stage.addEventListener('wheel', function (e) {
    if (!e.ctrlKey && !e.metaKey) return; // plain wheel scrolls the conversation
    e.preventDefault();
    var r = stage.getBoundingClientRect();
    zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  var drag = null;
  stage.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY, tx: tf.x, ty: tf.y }; stage.setPointerCapture(e.pointerId); stage.classList.add('dragging'); });
  stage.addEventListener('pointermove', function (e) { if (!drag) return; tf.x = drag.tx + e.clientX - drag.x; tf.y = drag.ty + e.clientY - drag.y; apply(); });
  function endDrag() { drag = null; stage.classList.remove('dragging'); }
  stage.addEventListener('pointerup', endDrag); stage.addEventListener('pointercancel', endDrag);
  stage.addEventListener('dblclick', function (e) { var r = stage.getBoundingClientRect(); zoomAt(1.6, e.clientX - r.left, e.clientY - r.top); });

  var lastH = 0;
  function reportSize() {
    var h = Math.ceil(document.documentElement.getBoundingClientRect().height);
    if (h && h !== lastH) { lastH = h; notify('ui/notifications/size-changed', { width: Math.ceil(document.documentElement.getBoundingClientRect().width), height: h }); }
  }
  if (window.ResizeObserver) new ResizeObserver(reportSize).observe(document.body);
  window.addEventListener('resize', function () { fit(); });

  request('ui/initialize', {
    protocolVersion: PROTOCOL,
    appInfo: { name: 'Ontographia diagram view', version: '0.1.0' },
    clientInfo: { name: 'Ontographia diagram view', version: '0.1.0' },
    appCapabilities: { availableDisplayModes: ['inline', 'fullscreen'] }
  }).then(function (res) {
    res = res || {};
    hostCaps = res.hostCapabilities || {};
    var ctx = res.hostContext || {};
    applyContext(ctx);
    var modes = ctx.availableDisplayModes || hostCaps.availableDisplayModes || [];
    $('full').hidden = !(modes.indexOf && modes.indexOf('fullscreen') >= 0);
    notify('ui/notifications/initialized', {});
    reportSize();
  }).catch(function () { showMessage('This host could not start the diagram view.'); });
})();
`;

const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; base-uri 'none'; form-action 'none'">
<title>Ontographia diagram</title>
<style>${CSS}</style>
</head>
<body>
<main class="app">
  <div class="head"><span class="title" id="title">Loading diagram…</span><span class="sub" id="sub"></span></div>
  <div class="legend" id="legend" hidden></div>
  <div class="stage" id="stage" hidden><img id="img" alt="" draggable="false"></div>
  <div class="msg" id="msg">Waiting for the diagram…</div>
  <div class="bar">
    <button id="zout" type="button" aria-label="Zoom out">−</button>
    <button id="fit" type="button">Fit</button>
    <button id="zin" type="button" aria-label="Zoom in">+</button>
    <button id="changes" type="button" hidden>Changes</button>
    <button id="full" type="button" hidden>Full screen</button>
    <span class="spacer"></span>
    <button id="open" class="primary" type="button" hidden>Open in lab</button>
  </div>
  <div class="link" id="linktext" hidden></div>
</main>
<script>${SCRIPT}</script>
</body>
</html>`;

export const DIAGRAM_VIEW_HTML = HTML;
