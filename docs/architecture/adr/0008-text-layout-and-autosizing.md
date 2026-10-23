# ADR-0008: Text layout and autosizing (one shared text-layout module for canvas, exports, diagram_show and agents)

- Status: **Accepted** (2026-10-22).
- Evidence: [text rendering audit](../investigations/text-rendering-audit.md) (1,870 nodes per creation path, 187 stencils × 10 label variants).
  - 57% of the cells have a defect.
  - Editor and MCP produce identical sizes.
  - Canvas, export and `diagram_show` lay out text three different ways.
- Owner verdict (2026-10-22): "Claude shows graphs way better directly, while the tool has text cut-offs, small text not aligned to the boxes, not autosized … a tool issue at its core."
- Builds on:
  - ADR-0007 (D5 text presets, 5.2 slide scale, 6.1 text box "height grows with the text", 7.6 self-hosted OFL fonts);
  - P2 `lib/present/textLayout.js`, which was written as "THE single boundary … when ADR-0008 lands, replace the body of `layoutText`";
  - `lib/render/diagramSvg.js` (AI-9a);
  - `lib/table/tableModel.js` (AI-4);
  - the export pipeline (`export/captureCanvas.js`).
- Personas:
  - **AI/MCP agent**: nodes it creates must come out the right size without guessing `w`/`h`.
  - **Solution Architect** and **CX/UX**: long capability and finding names, German and Japanese labels.
  - **PM**: exported decks and PNGs must match the canvas.
- Primitive exposed: **a text-fit mode per element** (`auto`, `auto-height`, `shrink`, `fixed`) on top of **one deterministic text-layout function**. There are no new stencils or templates.

## 1. Real-world analogy

**A typesetter with a type specimen book, and three kinds of paper.**

- A typesetter never guesses how long a line is. The specimen book lists the width of every letter in every face, so a galley set in the office and one set at the print shop break their lines in exactly the same places. That book is our **font-metric table**. The galley, the list of lines with their positions, is our **layout result**. Whoever prints it (the canvas, the PNG export, `diagram_show`, PowerPoint) prints the galley. They do not re-set the type.
- The paper the text goes on comes in three kinds:
  - An **envelope** is chosen to fit the letter. Most nodes work like this (`auto`).
  - A **sticky note** has a fixed size, so you write smaller, and if it still does not fit you write "…see back". This is `shrink`, with an overflow indicator and the full text on hover.
  - A **form field or road sign** has a fixed panel and a fixed type size. Overflow is truncated visibly, never silently. This is `fixed`.
- **House style** (type scale, margins) is decided once by the publisher, not by each typesetter. Today each of the roughly 60 `renderNode` functions is its own typesetter with its own type sizes (10 sizes, 19 line heights).

The analogy drives four decisions:

1. Measure once, with a shared table, before drawing anything.
2. Every renderer draws the same line list; none of them re-flows the text.
3. The box follows the text unless the user or the stencil says the box is fixed.
4. Overflow is always visible and recoverable.

## 2. Options for measurement

| Option                                                                      | How                                                                                             | Server/client agree?                                                       | Cost                                                         | Verdict                                                      |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| A. CSS layout in the browser, estimate on the server (today)                | the DOM wraps; server uses 0.52-0.56 em per char                                                | **No**: −45% to +130% error; even canvas vs export drift (audit section 4) | none                                                         | rejected: this is the bug                                    |
| B. `canvas.measureText` in the browser, table on the server                 | two measurement sources                                                                         | Mostly; lines differ at the margins (±1%)                                  | small                                                        | rejected: two code paths; boundary cases flip line breaks    |
| **C. Shared per-glyph advance tables everywhere** (isomorphic pure JS)      | tables generated from the self-hosted font files; the same code runs in Node and in the browser | **Yes, by construction** (identical input → identical lines)               | ~25-40 KB JSON; build script                                 | **chosen**                                                   |
| D. Real shaping on the server (headless Chrome, HarfBuzz WASM, node-canvas) | real fonts on the server                                                                        | Yes                                                                        | heavy new dependencies (several MB) or a browser per request | rejected for now; revisit only if C's accuracy is not enough |

**Measured accuracy of C** (Inter 500, 13 px, against Chrome; audit section 5):

- Latin and CJK: within 1.0%.
- Emoji: within 4%.
- Arabic: over-estimates by 20%. That is the safe direction (the box is a little roomy) and is caused by shaping.
- Kerning is ignored. The layout adds a slack of `0.02 × lineWidth + 1 px` per line so that real glyphs never touch the padding.

## 3. Decision

### 3.1 One module: `lib/text/` (pure, isomorphic, no DOM, no new dependencies)

```
lib/text/
  metrics/            generated JSON per face: unitsPerEm, ascender, descender, capHeight, advances{codepoint: units}
  fonts.js            fontKey -> face table; fallback classes (CJK, Hangul, emoji, RTL, other) with calibrated em widths
  segment.js          graphemes + line-break opportunities (Intl.Segmenter + rules in section 6)
  layout.js           layoutText(input) -> TextLayout   (memoized)
  fit.js              grow / shrink / fixed; textArea(shape, box) and boxForText(shape, textBox)
  policy.js           per-stencil text policy (slots, mode, min/max) read from the catalog
  tokens.js           type scale, line heights, paddings, min readable size (section 7)
  svg.js              textLayoutToSvg(layout) -> '<text>…<tspan>' string (diagram_show, SVG export, PPTX coordinates)
components/diagram-studio/text/
  TextBlock.js        <TextBlock layout/> : absolutely positioned line spans; overflow indicator; tooltip
  useTextLayout.js    hook: (element, slot) -> layout, memoized on (text, style, box, mode)
```

**Contract:**

```js
layoutText({
  text,                 // plain text; '\n' = hard break (Markdown handled by P2's caller, which passes runs/blocks)
  font: { key, size, weight, italic, lineHeight },   // key from the closed font list (ADR-0007 7.6)
  box: { width, height },                             // the text area (after padding and shape inset); height optional
  mode: 'auto' | 'auto-height' | 'shrink' | 'fixed',
  limits: { minWidth, maxWidth, maxLines, minSize },  // from the stencil policy
  align: 'start' | 'center' | 'end', valign: 'top' | 'middle' | 'bottom', dir: 'auto' | 'ltr' | 'rtl',
}) -> {
  lines: [{ text, x, y, width, dir, hyphen }],  // baseline-positioned in box coordinates
  width, height,            // the size the text needs (what auto mode sizes the box to)
  fontSize,                 // after shrink
  overflow: false | { hiddenLines, hiddenChars },   // never silent: callers must show the indicator
  breaks: { emergency: n }, // words broken because one word was wider than maxWidth
}
```

- **Determinism rule.** `layoutText` depends only on its input and the committed tables. The same input in Node and in Chrome returns deep-equal output. This is enforced by a parity test (section 11).
- **Drawing rule.** Renderers **never** re-wrap. On the canvas each line is a `<span style="white-space:pre">` positioned at `(x, y)` inside the slot. In SVG each line is a `<tspan x y>`. An export of the DOM therefore cannot drift: there is nothing left for the browser to flow.
- **Width tolerance.**
  - Glyphs in the real font can be up to 1% wider than the table says. That is absorbed by the slack in section 2.
  - Glyphs outside the table come from the fallback font: CJK, Arabic and emoji are drawn by the system font. They are measured with class widths calibrated by the generator in Chrome on macOS and Windows; the larger of the two is used.

### 3.2 Metric tables

- **Generator.** `scripts/build-font-metrics.js` uses puppeteer, which is already a dev dependency.
  1. Load each self-hosted woff2 from `public/fonts/` (P2: Inter, Source Serif 4, IBM Plex Sans and Mono, Lato, Montserrat, TASA Explorer).
  2. Measure every codepoint in the subset at 1000 px with `measureText`.
  3. Read the ascent and descent from `TextMetrics`.
  4. Write `lib/text/metrics/<family>-<weight>[-italic].json`.
- **Fallback classes.** The generator also calibrates the class widths: CJK ideographs and kana (≈1.0 em), Hangul, emoji (one value per grapheme cluster), Arabic, Hebrew, Thai, and "other".
- **Committed output.** The JSON is committed. A unit test fails if a woff2 file changes without the tables being regenerated (a hash in each JSON).
- **Fonts outside the closed list.** The ContextualToolbar font picker offers about 38 Google families today (`ContextualToolbar.js:60-120`). ADR-0007 Q-P11 moves the picker to the closed list. Until then a legacy family maps to the metric class of its nearest listed face (sans, serif or mono) plus 4% slack.

### 3.3 Where the size comes from

| Moment                                                              | Today                                                          | After                                                                                                                                          |
| ------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Editor creates a node (drop, click-to-place, quick-create, palette) | `stencil.defaultSize`                                          | `boxForText(policy, defaultLabel)`, never smaller than `defaultSize`                                                                           |
| User finishes editing a label                                       | grow-only height via a hidden div (`DiagramCanvas.js:345-375`) | re-fit by mode (`auto` grows **and shrinks** back toward `minWidth`; `auto-height` changes height only)                                        |
| MCP `add_element` without `w`/`h`                                   | `stencil.defaultSize` (`ops.js:263-267`)                       | `boxForText(policy, label)`                                                                                                                    |
| MCP `update_element` changes the label                              | size unchanged                                                 | re-fit if the element's mode is `auto` or `auto-height` and no `w`/`h` is given                                                                |
| `map_structure` (tree, mindmap, flow, grid, cluster)                | `defaultSize` passed to the layout (`structure.js:240-243`)    | each node is measured **before** layout, so layout engines get the true `{w, h}` (the Mermaid/ELK rule)                                        |
| `layout_apply`                                                      | positions only                                                 | positions only by default; new option `fitToText: true` re-fits first                                                                          |
| New op `fit_to_text {ids}` / editor action "Fit to text"            | none                                                           | re-fit the selection or the board; one undo step and one saved version                                                                         |
| Render of a stored element                                          | each pack improvises                                           | layout inside the **stored** box; if the text does not fit, apply `shrink` and then clamp with the indicator. **Rendering never writes data.** |

**Anchoring.** When a fit changes the box, the top-left corner stays where it is, matching today's behaviour and draw.io. On creation the box is centred on the drop point, as `placeAtPoint` does today. Layout engines position nodes after sizing, so anchoring does not matter there.

## 4. Text-fit modes and the Figma-style resize rule

`element.textFit` is a new flat field next to `fontSize`, `textAlign` and `verticalAlign`. When it is absent, the stencil default from `policy.js` applies.

| Mode          | Box                                                                                                                                       | Font                                                                                                          | Overflow                                            | Used by default for                                                                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auto`        | width grows from `minWidth` (the stencil default width) up to `maxWidth`, then wraps; height grows to fit, never below the default height | fixed (role size)                                                                                             | only past `maxLines` (default 8): clamp + indicator | rectangles, tasks, topics, TOGAF/ITIL/Capability/ProductDesign nodes, UML action/state/use-case, ERD attribute, CLD variable/stock, connection labels |
| `auto-height` | width fixed; height grows                                                                                                                 | fixed                                                                                                         | past `maxLines`                                     | text-block (P2 preset text), UML class/ERD entity name compartment, doc card title, table cells (existing 5-line clamp)                               |
| `shrink`      | fixed                                                                                                                                     | shrinks one step at a time down to `minSize` (11 px at 100%; P2 presets use their `MIN_READABLE`), then wraps | clamp + indicator                                   | sticky notes and colour cards (the paper does not grow), CLD loop markers, small fixed glyph shapes                                                   |
| `fixed`       | fixed                                                                                                                                     | fixed                                                                                                         | clamp + indicator                                   | frame, section, pool and lane titles (one line, ellipsis, tooltip), containers, persona header                                                        |

**Resize rule** (Figma's text-resizing model, which users already know):

- Dragging a width-only handle turns `auto` into `auto-height`.
- Dragging a height or corner handle turns it into `fixed`, except for stencils whose default is `shrink`, which stay `shrink`.
- "Fit to text" turns it back into `auto`.

This replaces today's grow-only resize with a predictable rule. A box the user sized by hand is never resized behind their back.

**`maxWidth` defaults** (house style; tokens in section 7): 240 px for nodes whose default width is ≤ 140; 1.6 × the default width otherwise; 320 px for mind-map central topics; 200 px for connection labels; and for external labels `max(2 × shape width, 120)`.

## 5. Shapes, slots and external labels

- **Slots.** Each renderer declares one or more slots, for example UML class = `name` (auto-height) + `members` (fixed, clamp), and TOGAF = `icon` + `label`. A slot is a rectangle in node coordinates. `policy.js` supplies the inset per shape:
  - rect: padding token;
  - ellipse/circle: inscribed rectangle, `w·0.707 × h·0.707`;
  - diamond: `w·0.5 × h·0.5`;
  - chevron: minus both points;
  - cylinder: body only;
  - with an icon: the icon column is subtracted.

  `boxForText` is the exact inverse, so a diamond grows the way Mermaid's does.

- **External labels.** Shapes ≤ 64 px (BPMN events and gateways, UML initial/final/decision, sticky markers, CLD cloud) keep the glyph small and put the label in an external slot below: wrap width `max(2w, 120)`, at most 3 lines, then clamp. The label's height is part of the element's **layout footprint**, so `structureLayout`, `placement` and `freeSpace` reserve room for it and labels stop colliding. This replaces `NodeLabels.js`'s `white-space: nowrap` and the 0.55 em `decisionLabelFits` heuristic.
- **Connection labels.** `auto`, maximum 200 px, wrapped. The background is the measured lines plus padding (it replaces `chars × 8`). The label is placed at the midpoint with the existing `findNonOverlappingLabelPosition`, now given real sizes.

## 6. Line-breaking rules (deterministic; the same in Node and in the browser)

1. **Hard breaks.** `\n` always breaks. Inline editors become a `<textarea>`: Enter commits, Shift+Enter inserts a newline (Miro and FigJam convention).
2. **Break opportunities.**
   - After spaces; after `-`, `–`, `/`, `·`, `|` and `_` when surrounded by letters; at U+200B (zero-width space).
   - At U+00AD (soft hyphen), which renders a visible `-`.
   - Between CJK ideographs and kana, from `Intl.Segmenter` word granularity, which Node and Chrome both get from ICU. Basic kinsoku applies: no break before `、。」』）！？ー` and no break after `「『（`.
   - Never inside a grapheme cluster, so emoji ZWJ sequences, flags and combining marks stay whole.
3. **Long words.** In `auto` mode the box first grows to fit the longest word (up to `maxWidth`). Only a word wider than `maxWidth` is broken, at the last grapheme that fits, and a visible hyphen is added (`breaks.emergency` counts these).
   - For `Kundenzufriedenheitsanalyse` at 14 px the box simply becomes 210 px wide, as it does in Mermaid.
   - Hyphenation dictionaries are _not_ bundled in v1 (Q-T4).
4. **Bidirectional text.**
   - `dir: 'auto'` picks the direction from the first strong character (Arabic, Hebrew, Syriac, Thaana and N'Ko ranges mean RTL).
   - Lines are broken in logical order. Each line is emitted with its `dir`. The renderer sets `direction` and `unicode-bidi: plaintext` on the canvas and `direction="rtl"` in SVG.
   - `align: 'start'` resolves per line.
5. **Whitespace.** Runs of spaces are collapsed except in `fixed` code slots (UML members, ERD types, which use the mono face). Trailing spaces never count toward the line width.
6. **Clamping.** Past `maxLines` or below the slot height, the last visible line ends in `…`. The layout reports `overflow`. `TextBlock` draws a small **overflow badge** (a "⋯" chip, bottom-right, in the accent colour), sets the full label as `title` on the canvas and as `<title>` in SVG, and the context toolbar offers "Fit to text".

## 7. House style: type scale, spacing and alignment tokens

One JS source of truth, `lib/text/tokens.js`, which the server needs. It is mirrored to CSS custom properties in `styles/diagram-studio-tokens.css`, and a unit test asserts the two are equal. Ten sizes become five roles:

| Role                                                             | Size / weight / line height                                    | Replaces                                                           |
| ---------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------ |
| `label` (node text)                                              | 14 / 500 / 1.3                                                 | 11, 12, 12.5, 13 px node labels                                    |
| `title` (container, frame, swimlane, compartment header)         | 14 / 600 / 1.25; frames scale `max(14, frameHeight/1080 × 28)` | 11-13 px titles; the fixed 13 px frame title on 1920 × 1080 slides |
| `caption` (external labels, connection labels, badges with text) | 12 / 500 / 1.3                                                 | 9-12 px                                                            |
| `meta` (stereotypes, types, «interface»)                         | 11 / 500 / 1.25                                                | 9-10 px                                                            |
| `emphasis` (mind-map central topic, persona name)                | 18 / 600 / 1.25                                                | 16-18 px                                                           |

- **Padding tokens.** `--ds-text-pad-s` 6, `-m` 10, `-l` 14. Nodes default to `m` on all four sides; cards, stickies and containers use `l`.
- **Alignment defaults.** Labels are centred both ways. Container titles are start/top. Cards are start/top. UML and ERD headers are centred.
- **Applies to every pack.** `textAlign`, `verticalAlign`, `fontSize`, `fontWeight` and `fontFamily` now apply to every pack, because every pack draws through `TextBlock`. Today 5 renderers read them.
- **Minimum size.** The minimum readable size is **11 px at 100% zoom** (WCAG does not set a minimum; this is house style). No role is smaller. `shrink` stops at 11.
- **Sticky notes.** They stop requesting the never-loaded "Patrick Hand" and use the board's body font (Q-T6).

**How P2 plugs in.**

- **Presets** (`title` … `number`, ADR-0007 D5) stay the way to style **text-block** content. Their sizes are the 1080-scale values P2 materialises.
- **The board theme** (`content.theme.fonts.{heading, body}`, `scale`) sets the font face of these roles: `title` and `emphasis` use the heading face, the others use the body face. `theme.scale` multiplies the role sizes.
- **`lib/present/textLayout.js`** keeps its signature and delegates to `lib/text/layout.js`. The Markdown walk (blocks, bullets, indents) stays in P2's file and calls `layoutText` per block. This deletes P2's `CHAR_WIDTH = 0.52`, the fifth estimate in the audit.
- **Tables.** `tableModel.js` keeps its `LAYOUT` row model but replaces `charWidth: 7` with `layoutText`, so table row heights become exact too.

## 8. Renderers and exports

| Consumer                                       | Change                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canvas packs (about 60 `renderNode` functions) | Draw the shape. Then, for each slot, `const layout = useTextLayout(element, slot)` and `<TextBlock layout/>`. Free-floating text styles, line clamp, `nowrap` and `overflow-wrap` are removed.                                                                                                                                                                                                                 |
| Default renderer (`DiagramCanvas.js:663-734`)  | Becomes the generic rect/ellipse/diamond `TextBlock` path.                                                                                                                                                                                                                                                                                                                                                     |
| Frames, sections, pools, lanes                 | Title slot, `fixed`, one line, ellipsis + tooltip. Rotated lane titles use the same layout with a rotation transform.                                                                                                                                                                                                                                                                                          |
| Connection labels                              | `auto` (section 5).                                                                                                                                                                                                                                                                                                                                                                                            |
| PNG/PDF export (html-to-image)                 | Unchanged pipeline. Lines are pinned spans, so the clone cannot re-flow. The overflow badge is drawn; there are no tooltips in rasters.                                                                                                                                                                                                                                                                        |
| `diagram_show` and the legacy `exportSVG`      | Both call `textLayoutToSvg(layout)` with the stored box and the same policy. Line breaks match the canvas exactly. Fonts: `font-family="Inter, -apple-system, …"`; an `<img>` SVG cannot load webfonts, so the system font draws the identical lines with up to about 4% width drift, absorbed by the slack. Shape fidelity (UML compartments, icons) is separate work and out of scope; slots make it easier. |
| PPTX (P4, later)                               | Each text box gets the box size from the layout and explicit line breaks with `fit: none`, as ADR-0007 8.3 already plans. PowerPoint then cannot re-wrap differently.                                                                                                                                                                                                                                          |

## 9. Migration

- **No data migration.** Stored `size`, `label`, `fontSize`, `textAlign` and `verticalAlign` keep their meaning.
- **At render time, from T1 on**, every existing element draws through the layout module inside its stored box. Overflow no longer spills: it wraps, then shrinks to 11 px, then clamps with the badge and tooltip. Most of the audit's OV, NW, BL, MW and EL cells disappear without anyone resizing anything. Rendering never writes, so opening an old board creates no autosave and no conflict with concurrent editors (ADR-0006).
- **Resizing old boards** happens only by explicit action:
  - "Fit to text" on a selection;
  - "Fit all to text" in the board menu (one undo step, one version, a toast with the count);
  - `fit_to_text` over MCP.
- **Edits.** An old element with no `textFit` gets the stencil default from its next label edit onward, so a box grows when its owner changes its text. That is the moment a user expects it.
- **Agent guidance.** `lib/mcp/guide.js` changes "keep each label short (under about 80 characters)" to "omit w/h; the lab sizes boxes to the text; use `\n` for deliberate line breaks".

## 10. Performance budget

| Operation                               | Budget                     | How                                                                                                                |
| --------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Layout of one label                     | ≤ 0.05 ms median           | Advance lookups and arithmetic. Measured: `measureText` for 30k words takes 27 ms; table lookups are cheaper.      |
| Initial render of a 5,000-element board | ≤ 60 ms total text layout  | LRU cache (10k entries) keyed by `hash(text) + fontKey + size + box + mode`, shared by canvas, minimap and exports |
| Pan and zoom                            | **0** layout calls; 60 fps | Layout is in canvas units; zoom stays one CSS transform. `TextBlock` is `memo`'d on the layout object.             |
| Typing in a label                       | ≤ 2 ms per keystroke       | Re-layout of one element; box growth batched per animation frame                                                   |
| Server `map_structure` with 1,000 nodes | ≤ 20 ms for layout         | Same module in Node; tables loaded once per process                                                                |
| Bundle                                  | ≤ 45 KB gzip added         | JSON tables for the closed font list, lazy-loaded per face in use                                                  |

**Level of detail** (part of T4). When a label would render below 5 screen px, a node renders its text as greeked bars: one rounded rect per line, using `layout.lines[i].width`. This removes thousands of text spans at overview zoom, and the bars are still exact because the layout is known.

## 11. Testing strategy (no new dependencies)

1. **Unit tests (Jest, `lib/text`).**
   - Line breaks for the audit corpus: the 10 variants plus edge cases (ZWJ emoji, soft hyphen, kinsoku, mixed LTR/RTL, a word longer than `maxWidth`, empty text, whitespace only).
   - `boxForText` round-trips per shape.
   - Mode transitions on resize.
   - Token CSS/JS equality.
   - Metric hash check.
2. **Parity test (e2e, puppeteer).** Run `layoutText` on the corpus in Node and in Chrome (the same module bundled), and assert the outputs are deep-equal. Also assert that every rendered line's real width (Range rects) is ≤ the slot width. This test catches table drift.
3. **Gallery geometry test (e2e).** The audit harness becomes `__tests__/e2e/text-gallery.test.js`: every stencil × the 10 variants × creation paths (editor default, `map_structure`, `apply_ops`). For each node it asserts:
   - no glyph outside the node box or slot, except declared external labels inside their footprint;
   - no hidden glyph without `overflow` + badge + tooltip;
   - font ≥ 11 px at 100%;
   - no mid-word break unless `breaks.emergency > 0`;
   - padding ≥ the token.

   These are **geometry assertions, not pixel diffs**, so the test is not flaky across font rasterisers and needs no pixelmatch or pngjs. Screenshots are written to `E2E_SHOTS_DIR` for human review only.

4. **Cross-renderer parity.** For the showcase board, compare the line texts in the canvas DOM, in `diagram_show` (parse `<tspan>`) and in `exportSVG`; they must be identical. For PNG export, check that the clone keeps the span positions.

## 12. Delivery slices (vertical; each ships behind no flag, because every slice only improves rendering)

**T1: the module, server sizing, and the four most-used packs.**

- Scope:
  - `lib/text/*` with tables for Inter 400/500/600/700, plus the generator script;
  - `TextBlock` and `useTextLayout`;
  - the default renderer, Core (rect, circle, diamond, text-block label path), StickyNotes (`shrink`), ProcessFlow (task, subprocess, events/gateways external labels, data object/store), MindMap (all topics);
  - `boxForText` in `ops.add_element`, `update_element` and `map_structure`;
  - the `fit_to_text` op;
  - the editor's create, edit and resize rules; the textarea editor;
  - guide text.
- Acceptance:
  - (a) `map_structure` with the 10 variants yields nodes whose sizes come from text and that pass the gallery assertions on these packs;
  - (b) the editor drop and the MCP path give the same size for the same label;
  - (c) the parity test is green;
  - (d) the default-renderer overflow is 0 in the gallery;
  - (e) no autosave on opening a legacy board.

**T2: the remaining packs.**

- Scope: CLD, UML/UMLClass, TOGAF, ITIL, CapabilityMap, ProductDesign, ERD; frames, sections, pools, lanes; connection labels; table `charWidth` replaced; P2 `textLayout.js` delegates.
- Acceptance: the gallery test is green for all 187 stencils × 10 variants × 3 paths; the type-scale tokens are used everywhere (lint check: no numeric `fontSize` literals in `packs/`, except the explicitly allowed icon glyphs).

**T3: exports and `diagram_show` parity, plus the regression suite.**

- Scope: `diagramSvg` and `exportSVG` draw `textLayoutToSvg`; the cross-renderer parity test; the full e2e gallery in CI (sharded per pack).
- Acceptance: the line texts are identical across canvas, PNG clone, `diagram_show` and `exportSVG` for the showcase board; there are no divergences in the audit's section 4 sense.

**T4: user controls and polish.**

- Scope:
  - a "Text fit" control (Auto / Fixed width / Shrink to fit / Fixed) in ContextualToolbar and PropertiesPanel;
  - font-size steps on the token scale plus a custom value;
  - the 3 × 3 alignment for all packs;
  - "Fit all to text" in the board menu;
  - the overflow badge opening the inline editor;
  - zoom level of detail (greeked text);
  - per-stencil remembered style (wire the uncalled `getStencilDefaultStyle`).
- Acceptance: the e2e test covers mode switching via resize handles; panning a 5,000-element board holds 60 fps in the existing perf harness (or a new puppeteer trace check, with frame time p95 ≤ 16.7 ms).

## 13. Open questions (recommended defaults)

> **Decision (2026-10-22):** the product owner approved this ADR with all recommended defaults (default label 14 px, auto-size max width 240 px or 1.6× default, existing boards only via explicit "Fit to text", no hyphenation dictionaries in v1, Latin Extended subsets in T1, drop "Patrick Hand", `layout_apply` re-fit opt-in, top-left anchor when growing, simplified text below 5 screen px). Build order T1 → T4, each verified with screenshots.

| #     | Question                                                                                                                   | Recommended default                                                                                                                       |
| ----- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Q-T1  | Should the default label size go from 13 to 14 px (the `label` role)? It makes boxes about 8% larger.                      | **Yes**. 14 is the smallest size that reads well at the common 70-80% working zoom.                                                       |
| Q-T2  | `maxWidth` for `auto` nodes                                                                                                | **240 px** (≤140-wide stencils), otherwise 1.6 × default width; mind-map central 320; connection labels 200                               |
| Q-T3  | Run "Fit all to text" automatically on existing boards?                                                                    | **No.** Render-time fixes plus an explicit action. Never move a user's layout silently.                                                   |
| Q-T4  | Bundle hyphenation dictionaries (a new dependency, for example TeX patterns for de and en, ~30-100 KB) for long compounds? | **Not in v1.** Grow first, then emergency-break with a hyphen. Revisit after T2 if German users complain.                                 |
| Q-T5  | Add Latin Extended subsets of the self-hosted fonts (Polish, Czech, Turkish and others)?                                   | **Yes, in T1** (≈ +10 KB per face): these glyphs currently fall back to a system font with class metrics.                                 |
| Q-T6  | Sticky-note handwriting font                                                                                               | **Drop "Patrick Hand"** (never loaded). Use the board body font. A handwriting face can be added to the closed list later (OFL "Caveat"). |
| Q-T7  | Should `layout_apply` re-fit by default?                                                                                   | **No.** `fitToText: true` is opt-in; the default stays positions-only, as documented.                                                     |
| Q-T8  | Anchor when a fit changes the box                                                                                          | **Top-left fixed**. On creation, centred on the drop point.                                                                               |
| Q-T9  | What does `shrink` do in exports when the text is still clamped?                                                           | Same as the canvas: the badge is drawn. A PDF gets no tooltip.                                                                            |
| Q-T10 | Greeked text at low zoom (T4)                                                                                              | **Yes**, below 5 screen px.                                                                                                               |

## 14. New dependencies

**None.**

- `Intl.Segmenter` is built into Node 16+ and every supported browser.
- puppeteer (already a dev dependency) generates the metric tables at build time and runs the e2e tests.
- The self-hosted OFL fonts come from P2.

Optional, behind a later owner decision: hyphenation patterns (Q-T4).

## 15. Consequences

- **Gains.**
  - Agent-created and human-created nodes come out the same and fit their text.
  - Layout engines stop overlapping long labels.
  - The canvas, PNG/PDF, `diagram_show` and later PPTX show the same lines.
  - One set of type tokens makes the board look designed instead of assembled.
- **Costs.**
  - A mechanical edit of about 60 `renderNode` functions (T1 and T2).
  - A metrics generator to keep in step with font files, enforced by the hash test.
  - Boxes grow, so dense hand-made boards may need "Fit all" or a manual tidy, which the user chooses.
- **Risks.**
  - Complex scripts (Arabic shaping, Indic) are over-estimated, giving roomy boxes. That is acceptable and visible, never clipped.
  - System fallback fonts differ between macOS and Windows. The generator calibrates on both and keeps the larger value.

## 16. As-built: slice T1 (2026-10-22)

Branch `feat/t1-text-layout`. T1 is the pure `lib/text/` module, the shared text component, the migrated default renderer, Core, StickyNotes, ProcessFlow and MindMap, server sizing for agents, `fit_to_text`, and the editor rules. T2 to T4 are untouched.

### 16.1 What shipped

| Area | Files |
| ---- | ----- |
| Engine (pure, isomorphic) | `lib/text/{tokens,fonts,segment,layout,policy,fit,autoFit}.js`, `lib/text/metrics/inter.json` |
| Metric generator | `scripts/build-font-metrics.js` (`--check` compares the font hashes); fonts `public/fonts/inter-latin-ext-{400,500,600,700}-normal.woff2` are new files (the font directory is served `immutable`, so new files never overwrite old ones) and are declared in `styles/fonts.css` with `unicode-range` |
| Canvas | `components/diagram-studio/text/{TextBlock,useTextLayout,fitActions}.js`, `styles/diagram-studio.css` (`.ds-text*`), `styles/diagram-studio-tokens.css` (`--ds-text-*`) |
| Renderers | `DiagramCanvas.js` default renderer and the `<textarea>` editors, `CorePack`, `ProcessFlowPack`, `StickyNotesPack`, `MindMapPack`, `NodeLabels` |
| Agents | `lib/mcp/{ops,structure,placement,server,guide}.js`, the `ontographia-lab` skill |
| P2 | `lib/present/textLayout.js` delegates to `lib/text/layout.js` (interface kept; the 0.52 em estimate is gone) |

### 16.2 Deviations from the design

1. **CJK breaks are rule based, not `Intl.Segmenter` word granularity.** ICU dictionaries differ between Node and Chrome, which would break the parity rule. Ideographs and kana break between any two characters with basic kinsoku. `Intl.Segmenter` is used for graphemes and, only for Thai, Lao, Khmer and Myanmar, for word boundaries.
2. **One table file for Inter** (400, 500, 600, 700; Latin and Latin Extended, 822 glyphs per weight, 15 KB, about 5 KB gzip). Which glyphs the font has comes from its `cmap` (parsed from the woff2), so system-fallback glyphs never enter the table (a first version that guessed from measurements did). Other families map to Inter plus 4% (sans, serif) or 0.6 em (mono). The fallback classes (CJK 1.0 em, emoji 1.15, Arabic 0.59 ...) were calibrated on macOS Chrome 148 only; Windows is not calibrated yet.
3. **Slash and hyphen breaks need three more characters after them**, so `req/s` is never split into `req/` and `s`.
4. **External labels** (events, gateway markers, data objects, markers, a divider's label) wrap at `max(2w, 120)` and at most 3 lines, and **widen up to 240 px for one long word** instead of breaking it. Only a word beyond 240 px is broken, with a hyphen.
5. **Inscribed shapes grow proportionally** (circle, ellipse, diamond keep their ratio; the smallest scale whose text rectangle holds the text at full size). The diamond text rectangle is the ADR's 0.5 x 0.5; pill topics use a 16 px side inset and a corner radius of at most 32.
6. **Creation.** `sizeForNewElement` is the one rule for `add_element`, `map_structure` and the editor. Only `w` given keeps the width and lets the height follow. `shrink` stencils (sticky notes) keep their size when the text fits at 11 px or more and grow only when it cannot.
7. **Label edits** re-fit a box that is "auto managed" (its size equals the auto fit of the previous label) in both directions and only grow a hand-sized box. This keeps the ADR's "never shrink a person's box" without storing a flag.
8. **`map_structure`** measures every new node before layout and reserves the footprint of an external label (the shape is centered above it). A node may pass `size {w, h}`. Explicit sizes go to the applier only when they differ from the stencil default (a 2 px divider is below the applier's minimum explicit size).
9. **`fit_to_text {ids | all: true}`** and `textFit` on `add_element` / `update_element`. `layout_apply fitToText` is not in T1 (`fit_to_text` then `layout_apply` does the same in two calls).
10. **Editor.** Both default editors are `<textarea>`s (Enter commits, Shift+Enter is a newline; the frame title stays a single-line input). The resize rule (width handle: auto to auto-height; height or corner: fixed; sticky notes stay shrink) is applied while dragging. "Fit to text" is a button in the contextual toolbar and two command-palette entries (selection, all, one undo step, a toast with the count). The board-menu entry is T4. The toolbar's font-size stepper stops at 11.
11. **Drawing.** `TextBlock` draws one block per label with one pinned `white-space: pre` span per line. Font, color and line height are set once on the block; the static rules live in the stylesheet. The text content keeps a space between lines. Decorative shapes with `showLabel: false` (the slide accent bar) still draw no label.
12. **Copy blocks on slides** (`lib/present/compose.js`): a copied shape's label font is the label role (14, not the old 13) times the copy scale, and never below 0.75 x the body preset (24 at 1080) so slide labels are comparable to body text; the shared layout shrinks or clamps inside a small box. This fixed the owner's complaint that copied boxes carried 11 px labels beside 32 px bullets.
13. **Review follow-ups.** (M1) Circles and ellipses hold a 0.78 x 0.58 text rectangle (the corner sits on the outline) and a single line may use 0.85 of the width, so "Approve" or "Inventory" stay whole in the default 80 px circle; a lone word is shrunk before it is hyphenated. (M2) Stored font sizes are clamped to 512 and `shrink` is a bisection on integer sizes (a 1e7 px font lays out in under 5 ms). (Perf) A left-to-right label is now a `div` with ONE text node (lines joined by newlines, `white-space: pre`), the weight and the role line height are classes, only per-node values are inline (position, width, font size, first-line offset, color), and the overflow popover exists only while the badge has focus; right-to-left lines keep a block span each. (A11y) The badge is a focusable button with the full text on focus, white on `#1f6f89` (5.6:1), and labels can be selected and copied. (Agents) `fit_to_text` with `ids` skips a locked element with a warning instead of failing the batch.
14. **Initial render of a 5,000-element board went from about 36 s to about 50 to 54 s** with T1 (about 60% more DOM per node). Both numbers are unacceptable and the regression is recorded as a separate performance item (virtualization or one pre-formatted block per label), not only T4.
15. `window.__dsTextStats()` exposes the layout cache counters for the performance checks.

### 16.3 Verification

**Defect matrix** (the audit harness re-run on the four T1 packs: 49 stencils x 10 label variants = 490 nodes per path, 1379 x 985 headless Chrome; `core/table` and `core/doc` excluded as in the audit).

| Path | Before (audit rules) | After |
| ---- | -------------------- | ----- |
| Editor, label typed (box sized by the editor rule) | 287 of 490 with a defect | **0** |
| MCP `map_structure`, no sizes | 287 | **0** |
| MCP `add_element`, no w/h | 287 | **0** |
| Legacy boards (stencil default sizes, render-time layout only) | 287 | **0** |

Before, by code: OV 152, NW 166, BL 80, ML 39, PD 19, SM 20, MW 15, CL 4, EL 4. After, there are zero of every code. Fonts after: 11 to 18 px, none below 11 (before: 9 and 10 px on 20 nodes). A clamp is no longer a defect: 51 cells (161 on legacy default sizes) end in an ellipsis with the badge and the full text as a tooltip ("indicated", the IN column of the harness). Under the audit's original, stricter definitions (any external label wider than its shape is BL, any ellipsis is TR) the editor, `map_structure` and `add_element` paths show 130 cells, which are the bounded external labels, the indicated clamps and the mind-map summary label beside its bracket; CL, EL, MW, ML, SM and PD are 0.

Screenshots (before from the audit run, after from this build): `t1/before/` and `t1/after/` in the session scratchpad, named `<path>-<pack>-z100-NN.png`.

**Parity.** `__tests__/e2e/text-layout.test.js` compares the lines Chrome drew with the lines `layoutForElement` computes in Node for the same stored element (equal). `__tests__/e2e/text-metrics.test.js` compares the tables with Chrome `measureText` for four weights and four sizes on ten strings including Polish, Czech, Turkish and German: worst case 0.50% (limit 1%).

**Acceptance (section 12, T1).** (a) `map_structure` with the 10 variants gives text-sized boxes that pass the gallery assertions; (b) the editor and the MCP path give the same size for the same label (unit test); (c) the parity test is green; (d) the default-renderer overflow is 0, also on legacy default sizes; (e) opening a legacy board writes nothing (no new revision and identical content after 6 s).

**Performance** (production build, headless Chrome shell, throwaway database, a busy laptop; numbers are for comparison, not absolute).

| Measure | Budget | Result |
| ------- | ------ | ------ |
| Layout of one label, cold | 0.05 ms median | 0.014 ms median, 0.036 ms p95 (Node) |
| 5,000 distinct labels, cold / cached | 60 ms | 119 ms / 10 ms (Node, jest transform); a real board has repeated labels |
| Layout calls while panning and zooming 5,000 elements | 0 | **0** (5,000 calls at load, 99.8% cache hits) |
| Server sizing of 1,000 nodes | 20 ms | 18 ms |
| Bundle | 45 KB gzip | 4.7 KB tables plus about 18 KB of unminified engine and component source (gzip), less after minification |
| 1,000 elements, time to all nodes | n/a | 223 to 280 ms, same as before (216 to 276 ms) |
| 5,000 elements, time to all nodes | n/a | 50 to 54 s, before 36 s (the DOM per node grows by about 60%: 4,270 to 6,870 elements per 1,000 rectangles) |
| Pan and zoom frame time, 5,000 elements | 16.7 ms p95 | about 300 ms median, same as before: the cost is the number of DOM nodes, not text; level of detail is T4 |

The 5,000-element initial render is slower in this environment because each label is now a few pinned spans. If that matters before T4, the next step is one pre-formatted block per label. It was not done because the per-line spans make the parity and geometry assertions exact.

### 16.4 Not verified or not done

- Windows and Safari font fallbacks (the CJK, emoji and Arabic class widths). Arabic and emoji boxes are roomy by design.
- A real claude.ai session driving `fit_to_text`.
- T2 packs keep their own text drawing; they only get the sizing rules (`policyFor` gives a generic policy of their shape). *(Done in T2, section 17.)*

## 17. As-built: slice T2 (2026-10-22)

Branch `feat/t2-text-layout`. T2 moves the remaining packs (TOGAF, ITIL, CapabilityMap, ProductDesign, ERD, UML, CLD), the shared label helpers, connection labels and table cells onto the shared module. T3 (export and `diagram_show` parity, regression suite) and T4 (controls, level of detail) are untouched. Frames, sections, pools and lanes were already on `layoutForTitle` since T1; T2 adds title-slot tests for every container-like stencil.

### 17.1 What shipped

| Area | Files |
| ---- | ----- |
| Policies | one file per pack, `lib/text/policies/{togaf,itil,capability-map,product-design,erd,uml-class,cld}.js`, merged by `lib/text/policy.js`; building blocks in `lib/text/policyKit.js`. Every one of the 138 stencils has an explicit entry (a test asserts it) |
| Slots | `layoutForSlot` and `layoutForList` (`lib/text/fit.js`), `SlotText` and `ListText` (`components/diagram-studio/text/useTextLayout.js`), `SvgTextBlock` (SVG twin of `TextBlock`), `titleBoxOf` honors `title.indent`, `externalBoxOf` honors `external.maxWidth` |
| Renderers | the seven pack files, `NodeLabels.js` (the `nowrap` single-line path and `SvgBelowLabel` are gone), the link card of StickyNotes |
| Connection labels | `lib/text/connectionLabel.js` (`connectionLabelLayout`, `endpointLabelLayout`), `connections/labels/{ConnectionLabel,EndpointLabel}.js`, `connections/Connection.js` (placement), `geometry/labelPositioning.js` |
| Tables | `lib/table/tableModel.js` (`cellLayout`, `headerLayout`; `LAYOUT.charWidth` is gone), `elements/table/TableNode.js`, `lib/table/tableSvg.js` |
| Lint | `__tests__/lib/packsTypeScale.test.js`: no numeric `fontSize`, CSS line clamp, `text-overflow`, `nowrap` or SVG `<text>` in `packs/` unless the line carries `ds-allow-text-style: why` (icon and emoji glyphs, a number in a badge) |

### 17.2 Deviations from the design

1. **Policies are per-pack files**, not one table, so each pack is edited in one place; `policyFor` is unchanged.
2. **Compartments.** A UML class or ERD entity policy describes the NAME compartment (members never size the node). Member lists are one mono 11 px line per member, cut with an ellipsis, rows beyond the box behind the badge (`layoutForList`); a member never wraps, so two members cannot be confused. ERD names use `auto` (a long word grows the width), not `auto-height`.
3. **Icons.** TOGAF, ITIL and capability cards reserve an icon column at the left (`inset.l`) and the label sits beside the icon, not under it. The oval motivation shapes use a rect with insets. Container headers use `title.indent`.
4. **Role sizes.** Labels are now 14 px (600 for TOGAF and ITIL), so editor and `map_structure` boxes grow about 8% compared with the 11 and 12 px they had. Legacy boxes keep their stored size and shrink to 11 px or clamp with the badge.
5. **CLD loop markers** are `shrink` with the badge (the in-code truncation `fitLoopLabel` is deleted); the loop arrow runs along the ring so the label has the whole inside. Flow, cloud and constant use an external label.
6. **Connection labels** are SVG (`SvgTextBlock`): at most 200 px and 3 lines, background = measured lines + padding (8 and 4 px). A clamped label ends in an ellipsis and carries the full text as `<title>` (SVG has no badge). Placement: the midpoint, moved by `findNonOverlappingLabelPosition` when it would overlap a node; it now tries rings scaled to the label size (up to 4) and treats every node (the two endpoints with a 14 px margin, others 6 px) as an obstacle.
7. **Tables.** Cell text is the shared layout at 12 px on the 17 px row line, at most 5 lines; row heights, the canvas and the SVG drawing (`diagram_show`) use the same lines. A word wider than a column is broken with a hyphen. A clamped cell shows an ellipsis and the full text as `title` (`data-text-overflow`). A select chip is one line (it used to count wrapped lines in the row height). The DOM text of a cell is now the pinned lines (a newline at each wrap), not the raw string.
8. **P2** already delegated in T1.
9. The full 187 stencils x 10 variants x 3 paths gallery test is T3. T2's acceptance is the audit harness (below) plus `__tests__/e2e/text-t2.test.js` (one MCP board per pack with long labels, a legacy board of every T2 stencil, connection labels, table cells) and the unit suites `textSlot`, `textT2Sizing`, `textT2Structure`, `textTitleSlots`, `connectionLabelText`, `tableCellText` and one component suite per pack group.

### 17.3 Verification

**Defect matrix** (audit harness on the seven T2 packs: 138 stencils x 10 variants = 1,380 nodes per path, 1379 x 985 headless Chrome; cells with at least one defect).

| Path | Before | After |
| ---- | ------ | ----- |
| Editor, label typed (box sized by the editor rule) | 355 | **0** |
| MCP `map_structure`, no sizes | 421 | **0** |
| Legacy boards (stencil default sizes) | 660 | **0** |

Before, editor path by code: CL 113, EL 113, OV 43, BL 19, NW 71, ML 116, SM 50, VA 3, PD 72. After there are zero of every code (spill, silent clipping, mid-word breaks, multi-line loss, padding under 3 px). No font is under 11 px (before: 9 and 10 px on 50 nodes). A clamp with its badge and tooltip is "indicated", not a defect: 127 cells on the editor and `map_structure` paths and 511 on legacy default sizes. External labels are bounded (at most `max(2w, 120)` wide, or 240 for one long word, at most 3 lines) and reserve their footprint in `map_structure`; the structure tests assert that boxes and footprints never overlap.

**TOGAF and ITIL labels no longer hug the bottom border.** Labels within 6 px of the bottom edge, before to after: TOGAF editor 70 to 0, legacy 236 to 0; ITIL editor 30 to 0, legacy 82 to 0. The smallest gap is now 7 px.

**Screenshots** (session scratchpad `t2/`): `before/<path>/<pack>/` and `after/<path>/<pack>/`, `z100-NN.png` and `z50-NN.png`; e2e screenshots in `t2/e2e-shots/`.

**Performance** (production build, 500 elements from every pack, 120 connections of which 60 are labelled, a busy laptop, best of the valid runs of three): time to all nodes 6.04 s on main and 6.13 s on this branch (+1.6%, within the run-to-run spread of about 8%); main-thread task time 5.4 s and 5.25 s. No extra layout calls while panning (labels are cached by the layout LRU).

### 17.4 Not verified or not done

- Windows and Safari font fallbacks; a real claude.ai session driving T2 stencils.
- Connection labels and table cells in PNG/PDF export were not compared pixel for pixel (T3).
- A table cell's copied DOM text contains the wrap newlines (the table copy and export actions copy the data, not the DOM).
## 18. As-built: slice T3 (2026-10-23)

Branch `feat/t3-text-parity`. T3 makes `diagram_show`, the thumbnails and overview, the data-driven SVG exporter and the live-canvas exports (PNG, SVG, PDF, deck PDF and PNG, Copy as image) draw the same lines as the canvas, and adds the geometry regression suite. T4 (controls, level of detail) is untouched; `lib/text/` changed additively only (`flowLines`, `forcesExternalLabel`, `svg.js`).

### 18.1 What shipped

| Area                                                 | Files                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One SVG text drawer                                  | `lib/text/svg.js`: `textLayoutToSvg(layout, origin, opts)` (one `<text>`, one `<tspan x y>` per layout line, `<title>` with the full text and an overflow chip for a clamped layout), `escapeXml`, `FONT_STACK`                                                                                                                                                                                                                                                                                                                                       |
| `diagram_show`, thumbnails, overview, slide previews | `lib/render/diagramSvg.js`: node labels, frame, section and container titles, external labels, doc cards, table titles, text presets and connection labels all come from `lib/text` (`layoutForElement`, `layoutForExternal`, `layoutForTitle`, `layoutForSlot`, `flowLines`, `connectionLabelLayout`). `wrapLabel` and every per-character estimate (0.56 em, 0.54 em, 7.8 px, 6.6 px, the 160-character cut, the 60-character connection cut) are gone. New options `ids` (data-id / data-text-block, for the parity suites) and `pin`              |
| Legacy SVG exporter                                  | `ExportManager.exportSVG` (version thumbnails and compare, and the no-canvas fallback) draws the stencil's text slot through `textLayoutToSvg`; connection labels use the measured label rectangle; the table title uses a slot                                                                                                                                                                                                                                                                                                                       |
| Bespoke label slots                                  | `components/diagram-studio/packs/labelSlots.js`: the label rectangles of the 17 stencils whose renderer draws the name outside the policy rectangle (UML class, abstract class, interface, enum, system boundary, swimlane, lifeline head; ERD entity, weak entity, view, junction header; TOGAF containers; ITIL CMDB; persona header). The pack renderers and `diagram_show` both read them, so there is one definition. `lib/text/policy.js` `forcesExternalLabel` records the exclusive gateway, whose renderer draws its label below the diamond |
| Fonts in exports                                     | `export/fontEmbed.js`: an export now carries only the faces its text uses (family, nearest weight, style; a `unicode-range` face such as Inter Latin Extended only when the text has a character in its range). The 500-element showcase SVG went from 31 embedded faces to 4. `exportRenderer` and `exportDeck` pass the cloned host                                                                                                                                                                                                                  |
| Tests                                                | see 18.3                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

### 18.2 Deviations from the design

1. **The live-canvas PNG / SVG / PDF pipeline is unchanged.** The audit's R7 ("exports re-layout") was already closed by T1 and T2: every label is a pinned `white-space: pre` span, so the html-to-image clone has nothing to re-flow. T3 verifies that (below) and fixes what the audit could not see: exports embedded every font face of the app (about 40 woff2 files) and the data-driven exporter drew one 13 px `sans-serif` line. A true vector SVG export from the live canvas is not part of T3: the exported `.svg` is still the html-to-image `foreignObject` document (it opens in browsers, not in Illustrator or Inkscape).
2. **Fonts in an `<img>` SVG (`diagram_show`, thumbnails, overview).** An SVG shown through `<img src="data:...">` cannot load web fonts, and embedding Inter in every result would break the 96 KB cap. The text is drawn in `font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`. The layout measured Inter, so every line made only of glyphs from the Inter table is pinned to its measured width with `textLength` and `lengthAdjust="spacing"`: the system font spreads or tightens its letter spacing by the few percent it differs and the line keeps its extent, so nothing leaves its box. Pinning is conservative (review of PR #69): only `lengthAdjust="spacing"` is used, never glyph scaling, and a line is pinned only when even the widest plausible fallback (DejaVu or Verdana on Linux: about 10% wider than Inter on lowercase, 15% on capitals, digits and wide letters) would need at most 12% squeeze, so glyphs cannot touch; a line heavy in capitals or digits keeps its natural width instead. Lines with CJK, Arabic, emoji or other fallback glyphs (measured with calibrated class widths) and right-to-left lines are not pinned (spacing breaks Arabic joining); they use the room the table gave them. Texts with another `font-family` than Inter are not pinned either. `pin: false` turns it off.
3. **Doc cards and text presets are flowed by the browser in the editor** (rich text: bold, links, scrolling), so they are not pinned lines. `diagram_show` flows the same text with the shared layout at the canvas's size and line height (13 px / 1.5 for the card, the preset's size for presets) and the lines match on the showcase board (presets and the doc excerpt, bullets aside). A paragraph can still break one word differently where the real font is wider than the table by more than the 2% slack. Moving presets and docs onto pinned lines would lose inline formatting and is not planned.
4. **Connection labels** use the same measured rectangle as the canvas (`connectionLabelLayout`, at most 200 px, the room between the two nodes minus 8 px), but `diagram_show` places it at the midpoint of the two ports, not at the routed path's midpoint with the canvas's obstacle avoidance.
5. **Shape fidelity** (the generic six shapes, no icons, no UML compartments for members) is still out of scope, as the ADR says; only the main label of each stencil is compared. The member lists, stereotypes, icon badges and tab texts of the packs are not drawn by `diagram_show`.
6. **Overflow chip in SVG** is a dots chip at the bottom-right of the text box (the `.ds-text-badge` geometry) plus a `<title>` with the full text; a rotated title (swimlane header) has the `<title>` only.

### 18.3 Verification

**Regression suite (geometry assertions, no pixel diffs).**

| Suite                                                                         | What it asserts                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `__tests__/lib/textParity.test.js`                                            | for all 11 packs x every stencil x the 10 label variants, at the stored default size and at the editor's creation size: `diagram_show` draws exactly the lines, font size and positions (0.1 px) of `lib/text` (and of `labelSlots`); a clamp carries `<title>` and the chip                                                                                  |
| `__tests__/components/diagram-studio/textParityPacks.test.js`                 | for every stencil x variant x both sizes (3,780 renders): the pack's own `renderNode` (the editor's line list) equals `diagram_show` in lines and font size                                                                                                                                                                                                   |
| `__tests__/e2e/text-parity-gallery.test.js`                                   | in headless Chrome, 23 boards of up to 11 stencils x 10 variants (1,890 nodes): the DOM lines Chrome drew equal the shared layout and `diagram_show`, fonts equal, block position within 4 px, overflow flags equal                                                                                                                                           |
| `__tests__/e2e/text-parity.test.js`                                           | the showcase board (every pack, labelled connections, frame, table, doc, presets; long, CJK, Arabic and emoji labels): canvas blocks = the exported SVG's blocks (lines, size, left, top, width, badge) = `diagram_show` lines; text presets and the doc excerpt compared with the browser's own line breaks; exports through the real dialog (PNG, SVG, PDF) |
| `__tests__/lib/textSvg.test.js`, `fontEmbed.test.js`, `ExportManager.test.js` | the drawer (pinning, rtl, escaping, chip), face selection, the legacy exporter's lines                                                                                                                                                                                                                                                                        |

**Showcase board before and after** (1379 x 985, 41 elements, session scratchpad `t3/before` and `t3/after`; `t3/final` is the last run):

| Renderer                                 | Before                                                                                                                                                                                                                                                                                                                                                                                           | After                                                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Canvas                                   | reference                                                                                                                                                                                                                                                                                                                                                                                        | reference                                                                                           |
| Export PNG, SVG, PDF page, Copy as image | text identical to the canvas (clone of pinned lines); all 31 font faces embedded (SVG 4.6 MB)                                                                                                                                                                                                                                                                                                    | identical; 4 faces embedded (SVG 3.7 MB)                                                            |
| `diagram_show`                           | 15 labels broke differently from the canvas (`Customer Order Service` on one line, `Aggrega-te all inbound` vs the canvas's wrap, a 22-character label in a diamond overprinting its neighbours, multi-line labels flattened to one line, labels cut at 160 characters, connection labels at 60, a frame title over-printing, UML and ERD names on one shrunk line), labels outside their boxes | 0 differences in lines and font size; the long connection label wraps in the room between its nodes |
| Thumbnail, overview, slide preview       | same renderer as `diagram_show`                                                                                                                                                                                                                                                                                                                                                                  | same lines as the canvas (illegible at 320 px by nature)                                            |
| `exportSVG` (versions, compare)          | one 13 px `sans-serif` line per label                                                                                                                                                                                                                                                                                                                                                            | the stencil's lines, 14 px role size, overflow chip and `<title>`                                   |

In the first gallery run the check found 17 stencil types whose canvas label is not in the policy rectangle (UML class family, swimlane, system boundary, ERD entities, TOGAF containers, ITIL CMDB, persona header); `labelSlots.js` fixes that at the source. The jsdom twin of the gallery (`textParityPacks`) finds the same 17 plus `lifeline`.

**Performance** (production build, headless Chrome, 500 elements from every pack and 120 connections of which about 30 are labelled, the export dialog's PNG at 2x, wall time from the click to the downloaded file; a busy laptop, load average 13 to 19, three runs each): main 8.0, 6.7, 7.2 s; this branch 5.7, 5.9, 5.9 s. Not slower (the difference is mostly noise and load; face selection adds one `getComputedStyle` per text parent and removes the inlining of about 36 unused faces).

**Acceptance (section 12, T3).** The line texts are identical across canvas, PNG/SVG clone, `diagram_show` and `exportSVG` for the showcase board and for the 1,890-node gallery; no divergences in the audit's section 4 sense remain except the ones listed in 18.2.

### 18.4 Not verified or not done

- Windows and Safari font fallbacks (the `textLength` pin covers a different Latin system font on any platform in principle; it was only looked at on macOS Chrome 148).
- Opening the exported `foreignObject` SVG in non-browser tools; Firefox and Safari export.
- Opening a PDF in Acrobat (the page was rendered with macOS `sips`).
- `diagram_show` inside a real claude.ai session (the SVG was rendered as an `<img>` in headless Chrome).
- The pre-existing 5 ms timing assertion in `textLayout.test.js` ("hostile sizes") can fail on a loaded machine; it is not related to T3.
- **Hardening** (review of PR #69): `escapeXml` replaces lone surrogates with U+FFFD (they make `encodeURIComponent(svg)` throw in the version thumbnail, the dashboard thumbnail and the presentation panel); every colour that reaches an SVG attribute (`textLayoutToSvg` fill, the legacy exporter's element and connection colours) goes through `safeFill` (hex and rgb only) and ids and types in its data attributes are escaped.

### 18.5 Known limitations (for the next slice: diagram_show fidelity and budget)

- `diagram_show`'s default byte budget (`DEFAULT_MAX_SVG_BYTES`, 96 KB) already returns `svg: null` / `tooLarge` at about 500 elements (pre-existing). T3's per-line `<tspan>` output is about 27% larger than the old estimate-based output, so the limit is reached earlier. The next slice should raise or restructure the budget (for example a shorter markup per line, or a downscaled raster fallback) together with shape fidelity.
