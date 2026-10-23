// components/diagram-studio/export/fontEmbed.js
// Build @font-face CSS with fonts inlined as data URLs so exported PNG/SVG/PDF keep the app's fonts.
// html-to-image cannot read cross-origin stylesheets (e.g. Google Fonts) and logs errors, so we do it ourselves.

const FACE_RE = /(?:\/\*\s*([\w-]+)\s*\*\/\s*)?(@font-face\s*\{[^}]*\})/g;
const URL_RE = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;

/** Split CSS text into @font-face blocks; for commented subsets (Google Fonts) keep only `latin`. */
export function extractFontFaces(cssText, base) {
  const out = [];
  let m;
  FACE_RE.lastIndex = 0;
  while ((m = FACE_RE.exec(cssText))) {
    const subset = m[1];
    if (subset && subset !== 'latin') continue;
    out.push({ css: m[2], base });
  }
  return out;
}

/** Replace every url(...) in a font face with a data URL. Returns '' if any font fails to load. */
export async function inlineFontUrls({ css, base }, load) {
  const urls = [];
  css.replace(URL_RE, (full, q, url) => { if (!url.startsWith('data:')) urls.push(url); return full; });
  if (urls.length === 0) return css;
  try {
    const resolved = new Map();
    for (const u of new Set(urls)) {
      const abs = new URL(u, base).href;
      resolved.set(u, await load(abs));
    }
    return css.replace(URL_RE, (full, q, url) => (resolved.has(url) ? `url(${resolved.get(url)})` : full));
  } catch (e) {
    return '';
  }
}

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = reject;
  r.readAsDataURL(blob);
});

const dataUrlCache = new Map();
async function loadAsDataUrl(url) {
  if (!dataUrlCache.has(url)) {
    dataUrlCache.set(url, fetch(url).then(async (res) => {
      if (!res.ok) throw new Error(`font ${res.status}`);
      return blobToDataUrl(await res.blob());
    }));
  }
  try {
    return await dataUrlCache.get(url);
  } catch (e) {
    dataUrlCache.delete(url);
    throw e;
  }
}

// ---- Which faces an export needs (ADR-0008 T3): the exported file carries only the faces its text uses, not every face of the app
// (about 40 woff2 files, 900 KB, 1.2 MB as base64 in every SVG and PDF). A face is needed when its family appears in the
// font-family list of some text, its weight is the nearest the family has to the weight used, and (unicode-range faces, such as
// Inter's Latin Extended) when some character of the text lies in its range.

const unq = (v) => String(v || '').trim().replace(/^['"]|['"]$/g, '').toLowerCase();

/** {family, weight, style, ranges} of one @font-face rule's CSS text. */
export function parseFaceMeta(css) {
  const pick = (re) => { const m = re.exec(css); return m ? m[1].trim() : ''; };
  const family = unq(pick(/font-family\s*:\s*([^;}]+)/i));
  const w = pick(/font-weight\s*:\s*([^;}]+)/i);
  const weight = w === 'bold' ? 700 : w === 'normal' || !w ? 400 : parseInt(w, 10) || 400;
  const style = /italic|oblique/i.test(pick(/font-style\s*:\s*([^;}]+)/i)) ? 'italic' : 'normal';
  const rangeText = pick(/unicode-range\s*:\s*([^;}]+)/i);
  const ranges = rangeText
    ? rangeText.split(',').map((r) => r.trim().replace(/^U\+/i, '')).filter(Boolean).map((r) => {
      const [lo, hi] = r.split('-');
      if (lo.includes('?')) return [parseInt(lo.replace(/\?/g, '0'), 16), parseInt(lo.replace(/\?/g, 'F'), 16)];
      return [parseInt(lo, 16), parseInt(hi || lo, 16)];
    })
    : null;
  return { family, weight, style, ranges };
}

/**
 * @param {Array<{css: string}>} faces
 * @param {Set<string>|null} usage keys `family|weight|style` (family lower case) of the text; null = every face
 * @param {string} text all the text of the export (decides unicode-range faces)
 */
export function selectFaces(faces, usage, text = '') {
  if (!usage) return faces;
  const metas = faces.map((f) => ({ f, m: f.meta || parseFaceMeta(f.css) }));
  const byFamily = new Map();
  for (const x of metas) {
    if (!byFamily.has(x.m.family)) byFamily.set(x.m.family, []);
    byFamily.get(x.m.family).push(x);
  }
  const chosen = new Set();
  for (const key of usage) {
    const [family, weightStr, style] = key.split('|');
    const list = byFamily.get(family);
    if (!list) continue;
    const want = Number(weightStr) || 400;
    const ofStyle = list.some((x) => x.m.style === style) ? list.filter((x) => x.m.style === style) : list;
    const weights = [...new Set(ofStyle.map((x) => x.m.weight))];
    // CSS font matching, simplified: the exact weight, else the nearest (heavier first for 500 and up, lighter first below 400)
    const best = weights.reduce((a, b) => {
      const da = Math.abs(a - want);
      const db = Math.abs(b - want);
      if (db < da) return b;
      if (db === da) return want >= 500 ? Math.max(a, b) : Math.min(a, b);
      return a;
    }, weights[0]);
    for (const x of ofStyle) if (x.m.weight === best) chosen.add(x);
  }
  const cps = text ? new Set([...text].map((c) => c.codePointAt(0))) : null;
  return metas
    .filter((x) => chosen.has(x))
    .filter((x) => {
      if (!x.m.ranges || !cps) return true;
      for (const cp of cps) for (const [lo, hi] of x.m.ranges) if (cp >= lo && cp <= hi) return true;
      return false;
    })
    .map((x) => x.f);
}

/**
 * The fonts a host's text uses: `family|weight|style` keys plus all its text. Walks the text nodes once and reads the computed
 * style of each distinct parent element.
 */
export function collectFontUsage(root) {
  const usage = new Set();
  let text = '';
  const doc = root.ownerDocument || document;
  const view = doc.defaultView || window;
  const seen = new Set();
  const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.nodeValue;
    if (!t || !t.trim()) continue;
    text += t;
    const el = n.parentElement;
    if (!el || seen.has(el)) continue;
    seen.add(el);
    const cs = view.getComputedStyle(el);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    const style = /italic|oblique/i.test(cs.fontStyle) ? 'italic' : 'normal';
    for (const fam of String(cs.fontFamily).split(',')) usage.add(`${unq(fam)}|${weight}|${style}`);
  }
  return { usage, text };
}

let cachedFaces = null;

/** Every @font-face of the page (not yet inlined), cached after the first success. */
function getFaces(doc) {
  if (cachedFaces) return cachedFaces;
  cachedFaces = (async () => {
    const faces = [];
    for (const sheet of Array.from(doc.styleSheets)) {
      let rules = null;
      try { rules = sheet.cssRules; } catch (e) { rules = null; }
      if (rules) {
        for (const rule of Array.from(rules)) {
          if (rule.type === 5 /* CSSRule.FONT_FACE_RULE */) faces.push({ css: rule.cssText, base: sheet.href || doc.location.href });
        }
      } else if (sheet.href) {
        try {
          const res = await fetch(sheet.href);
          if (res.ok) faces.push(...extractFontFaces(await res.text(), sheet.href));
        } catch (e) { /* offline or blocked: fall back to system fonts */ }
      }
    }
    return faces.map((f) => ({ ...f, meta: parseFaceMeta(f.css) }));
  })().catch(() => { cachedFaces = null; return []; });
  return cachedFaces;
}

const inlined = new Map(); // face css -> inlined css (data URLs), so a repeated export does no work

/**
 * Font CSS for an export, fonts inlined as data URLs. With `host` (the cloned canvas) only the faces its text uses are
 * included; without it every face of the page.
 */
export async function getFontEmbedCSS(doc = document, host = null) {
  const faces = await getFaces(doc);
  const { usage, text } = host ? collectFontUsage(host) : { usage: null, text: '' };
  const picked = selectFaces(faces, usage, text);
  const out = await Promise.all(picked.map(async (f) => {
    if (!inlined.has(f.css)) inlined.set(f.css, inlineFontUrls(f, loadAsDataUrl));
    const css = await inlined.get(f.css);
    if (!css) inlined.delete(f.css); // a face that failed to load is tried again next time
    return css;
  }));
  return out.filter(Boolean).join('\n');
}
