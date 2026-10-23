// lib/present/pptx/package.js
// Post-processing of the package pptxgenjs writes. pptxgenjs 4.0.1 repeats the paragraph properties (<a:pPr>) in front of
// EVERY run of a paragraph; the schema allows one, at the start (CT_TextParagraph: pPr?, then runs). PowerPoint can answer a
// package like that with a repair prompt, so every slide and notes part is rewritten to keep only the first <a:pPr> of
// each paragraph. fflate (already a dependency of the editor) reads and writes the zip; nothing here touches the network.

import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';

const PARAGRAPH = /<a:p>([\s\S]*?)<\/a:p>/g;
const PPR = /<a:pPr\b[^>]*?\/>|<a:pPr\b[\s\S]*?<\/a:pPr>/g;

/** Keep only the first <a:pPr> of each <a:p>, and only when it comes before the first run or break. Pure string work. */
export function dedupeParagraphProps(xml) {
  return xml.replace(PARAGRAPH, (whole, inner) => {
    let seen = false;
    const cleaned = inner.replace(PPR, (m, offset) => {
      if (!seen && offset === 0) {
        seen = true;
        return m;
      }
      return '';
    });
    return `<a:p>${cleaned}</a:p>`;
  });
}

const FIXED_PARTS = /^ppt\/(slides\/slide|notesSlides\/notesSlide|slideLayouts\/slideLayout|slideMasters\/slideMaster)\d+\.xml$/;

/**
 * @param {Uint8Array} bytes the .pptx from pptxgenjs
 * @returns {Uint8Array} the same package with the paragraph properties fixed
 */
export function fixPackage(bytes) {
  const files = unzipSync(bytes);
  const out = {};
  for (const [name, data] of Object.entries(files)) {
    out[name] = FIXED_PARTS.test(name) ? strToU8(dedupeParagraphProps(strFromU8(data))) : data;
  }
  return zipSync(out, { level: 6 });
}
