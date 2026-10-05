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

let cached = null;

/** Collect font CSS for every stylesheet on the page (cached after the first success). */
export function getFontEmbedCSS(doc = document) {
  if (cached) return cached;
  cached = (async () => {
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
    const inlined = await Promise.all(faces.map(f => inlineFontUrls(f, loadAsDataUrl)));
    return inlined.filter(Boolean).join('\n');
  })().catch(() => { cached = null; return ''; });
  return cached;
}
