# ADR-0009: diagram_show fidelity and scale (the board in Claude looks like the lab, at any size)

- Status: **Accepted** (2026-10-24). Spike approved with all recommended defaults (Q-SF1 through Q-SF7). Slices F1–F4 approved; F5 deferred. Implemented in PR #72 (`feat/f1-show-fidelity`).
- Decision (2026-10-24): all open-question defaults approved as recommended — gzip+base64 transport (Q-SF1, requires Safari/iOS ≥16.4; plain SVG used whenever it fits); no drop shadows (Q-SF2); `detail: auto|full|overview` exposed (Q-SF3, default `auto`); region zoom by frame bbox (Q-SF4); no raster fallback (Q-SF5); picture budget 110k chars (Q-SF6); no pack rewrite now (Q-SF7).
- Owner request (2026-10-23): Claude's board view must look like the lab; the owner uses claude.ai as the main surface. Today `diagram_show` draws generic rectangles and circles in saturated colours, no stencil shapes (sticky notes, cylinders, actors, UML compartments, ERD rows, icons), connection labels at the port midpoint, and gives up (`svg: null`, `tooLarge`) at about 500 elements (ADR-0008 18.5).
- Builds on: [ai-canvas-via-mcp.md](../investigations/ai-canvas-via-mcp.md) section 10 (`diagram_show`, AI-9a: picture in `_meta`, `<img>` data URL, strict CSP), ADR-0008 (one shared text layout; T3 drew the same lines in `diagram_show`), ADR-0007 (themes, `resolveElementTokens`).
- Personas: **every persona that works from claude.ai** (Solution Architect, CX/UX, PM) sees the board they built; **AI/MCP agent**: one call shows the result of its edits, whatever the board size.
- Primitive exposed: none new for users. The renderer gains a **level of detail** (`detail: auto | full | overview`) and the view gains **regions** (zoom targets) that it opens through the host with the existing `diagram_show` focus vocabulary.

## 1. Real-world analogy

**A photocopy of the actual drawing, and a site map at the entrance.**

- Re-drawing a building from a description ("a box here, a circle there") never looks like the building. A photocopy does. The packs already know how to draw every stencil; the server should **copy their drawing**, not describe it again. Only the handwriting (text) is re-lettered, with the same typesetter (ADR-0008), because the copier cannot reproduce HTML text inside an image.
- A large campus is not shown as one A4 photocopy of every room. The entrance has a **site map**: buildings (frames) with readable names and their footprint; you walk to a building (zoom) to see its rooms. Large boards get an overview with regions, and the view zooms into a region with one more `diagram_show` call.
- Packing: a long letter goes in a **compressed envelope** (gzip), and the reader unpacks it (the view's `DecompressionStream`).

## 2. Evidence (measured 2026-10-23, this branch)

All sizes are characters of the JSON-encoded string in the tool result (what claude.ai's ~150,000-character limit counts). Session scratchpad `show-fidelity/` holds the screenshots and reports.

### 2.1 What the pack renderers emit (all 11 packs, 189 stencils, `react-dom/server` in Node)

| Finding                                                                                     | Number                                                                        |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Stencils whose `renderNode()` output is pure SVG                                            | **0 of 189** (every label is HTML: `TextBlock`)                               |
| Stencils that are SVG drawing + HTML text only                                              | 130 (69%)                                                                     |
| Stencils with styled HTML boxes (UML compartments, ERD header/rows, ITIL cards, task cards) | 44 (23%)                                                                      |
| Stencils drawn by the canvas's generic renderer (`renderNode` returns `undefined`)          | 15 (8%)                                                                       |
| Stencils whose look depends on stylesheet classes / CSS variables                           | 173 / 48                                                                      |
| `renderToStaticMarkup` cost                                                                 | 0.22 ms per element (1,890 renders in 421 ms)                                 |
| Raw SSR HTML per element                                                                    | 795 bytes (avg), plus the stylesheet it needs (`diagram-studio.css` is 87 KB) |

### 2.2 Options for stencil-faithful SVG

| Option                                                                                        | Bytes                                                                                                                | Visual match                                                                                                                                                                                | Cost / risk                                                                         | Verdict               |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------- |
| (a) SSR the pack, ship the HTML in `<foreignObject>`                                          | 795 B/element + stylesheet subset; CSS variables and classes must be inlined                                         | Exact in Chrome; `foreignObject` inside an `<img>` SVG is not reliable in WebKit (claude.ai iOS app, Safari) and cannot be verified here                                                    | Low code, high runtime risk, largest bytes                                          | **Rejected**          |
| (b) Declarative per-stencil shape spec shared by canvas and server                            | Smallest per element                                                                                                 | Exact once the canvas also uses it                                                                                                                                                          | Rewrite of ~7,000 lines of pack renderers (189 stencils); regressions on the canvas | Long-term option only |
| **(c) Hybrid "render the pack, keep its drawing, redraw its text"** (`lib/render/packArt.js`) | Showcase board 35.7k chars (old 35.3k); checkout board 18.3k (old 14.6k); large boards ~360 chars/element (old ~458) | Same SVG geometry as the canvas **by construction** (it is the pack's own output); HTML boxes converted from inline style + 30 transcribed classes; text from the shared layout (T3 drawer) | ~600 lines, no pack rewrite, no new dependency; a test keeps the converter complete | **Chosen**            |

How (c) works:

1. The pack's `renderNode()` is rendered with `react-dom/server` inside a `TextCaptureContext`. `TextBlock` (the only HTML text drawer, ADR-0008) hands over its layout and renders a placeholder. On the canvas no provider exists: nothing changes there (one `useContext` per text block).
2. React's markup is parsed (a 30-line tokenizer for React's own well-formed output) and converted:
   - `<svg>` subtrees are kept through an **allowlist** (elements, attributes, values: colours re-emitted as `#rrggbb`, `var(--x, fallback)` resolved, paths checked against a command alphabet, gradients and markers deduplicated across the picture, ids rewritten, filters dropped);
   - absolutely positioned HTML boxes become `<rect>`/`<line>`/`<ellipse>` from inline style plus `CLASS_STYLES` (the 30 pack classes of `styles/diagram-studio.css`), with the CSS box model (border-box, padding box as containing block, `translate(-50%)`), CSS `linear-gradient` as an SVG gradient;
   - text placeholders are drawn by `textLayoutToSvg` (ADR-0008 T3): the same lines and positions as the canvas.
3. Anything not understood is listed in `unhandled` and left out, never passed through. `__tests__/lib/packArt.test.js` renders every stencil x 4 label variants and requires an empty list (it found `.erd-field-spacer`, `.more`, a CLD `<marker>` and an ITIL gradient during the spike, all handled now).

Visual check (1379 x 985; canvas "Fit all" left, the new `diagram_show` picture right): `side-checkout.png`, `side-showcase.png`. Sticky notes with folded corner, cylinders, start/end events with their glyphs, the gateway's diamond, task cards with type icons, UML class compartments with members, ERD header + PK/FK rows, TOGAF layer colours with the component notation, the actor figure and the 3D node, frame, table and doc card all match. Remaining differences: no drop shadows, no frame-title chip, the table's column-type icons and the doc card's header buttons are not drawn.

### 2.3 Colours and theme

- The saturated look came from the generic renderer painting the stencil colour as fill for every stencil. With (c) each stencil uses its pack's own palette (pale TOGAF layer fills, white task cards with a tinted border, pastel stickies), exactly as on the canvas. Stencils that the canvas draws with the generic renderer (core rectangle, circle) are saturated **on the canvas too** (`element.color` is the fill); they stay as they are.
- App CSS tokens used by the packs (`--panel`, `--text-muted`, `--border`, ...) resolve to the light theme (`TOKENS`), as decided in Q-AV5 (the board keeps its light colours). Board themes (ADR-0007) apply through `resolveElementTokens` before the pack renders, as on the canvas.
- Connections use the canvas's colours: `--text-muted` line, the canvas arrow (10 x 7, `refX 9`), the label box (`--bg` fill, `--border` stroke, `--text` ink).

### 2.4 Connection labels

`labelPositioning.js` is pure and isomorphic. `lib/render/showSvg.js` repeats Connection.js's placement: the anchor is the routed path's midpoint by length (orthogonal) or `calculateMidLabelPosition` (15 px above), `placeMidLabel` keeps the label clear of the two endpoints (14 px margin) and of nearby nodes (6 px), a leader tick is drawn when it moved more than 36 px, and endpoint (cardinality) labels use `placeEndpointLabel`. In the spike the logic is a copy of the `useMemo` bodies in Connection.js; slice F3 moves it into one module both call.

### 2.5 Scale

Per-element cost on a realistic mixed board (`largeBoard`: frames of 120 mixed stencils from every pack, a third connected, a ninth of those labelled):

| Level                                                                  | Plain SVG          | gzip + base64         |
| ---------------------------------------------------------------------- | ------------------ | --------------------- |
| Old renderer (AI-9a/T3)                                                | ~458 chars/element | (not used)            |
| Full fidelity (packArt + compact markup + `<use>` reuse)               | ~360 chars/element | **~35 chars/element** |
| Overview (frames, simplified shapes, titles readable at the fit scale) | ~176 chars/element | **~14 chars/element** |

Capacity within the 110,000-character picture budget (largest board that fits, binary search):

| Level / transport       | Elements  |
| ----------------------- | --------- |
| Old renderer, plain     | ~240      |
| Full fidelity, plain    | 288       |
| **Full fidelity, gzip** | **3,266** |
| Overview, plain         | 605       |
| **Overview, gzip**      | **7,766** |

Render time (Node, laptop under load): full fidelity 2,000 elements 0.8 s, 3,000 elements 0.7 s, 5,000 elements 1.6 s; overview 5,000 elements 0.23 s.

Compact markup (all measured above): every element in its own coordinates in `<g transform="translate(x y)">`, the picture shifted so numbers stay short, one decimal, single-quoted attributes (no `\"` escaping in the JSON), `lengthAdjust="spacing"` left out (it is the default), identical drawings (same stencil, size, colours, data) defined once and reused with `<use href>` (2,000 elements: 18 symbols, 1,799 uses), gradients and markers deduplicated.

Things that were checked and excluded or qualified:

- **Compression inside a `data:` URL: not possible** (a data URL has no content encoding). **But the view can unpack**: the result carries `svgz` (base64 gzip) and the view inflates it with the browser's `DecompressionStream` (no network, allowed by the view's CSP; Chrome 80+, Firefox 113+, Safari/iOS 16.4+) before building the data URL. Verified in the MCP Apps reference host.
- **PNG/WebP rasterization: not recommended.** It is possible: `sharp` 0.35.5 (with librsvg 2.63) is already installed as Next's optional dependency, and it rendered the checkout board in 0.6 s. But it is not a declared dependency (it would need approval), the production image (`node:20-alpine`) has no fonts (text would be missing without a font package), a 1379-px WebP of the checkout board is 54k chars and of the 2,000-element overview 321k chars (over budget), and a raster cannot be zoomed. Vector + gzip beats it on every axis. There is no headless browser in production (unchanged, Q-MCP6).

### 2.6 The budget ladder (`renderForShow` in `lib/mcp/showTool.js`)

1. Full fidelity (if at most 3,500 elements in scope): plain SVG if it fits 110,000 chars, else gzip+base64 if that fits.
2. Else the overview, plain or gzip.
3. Else "too large", with the regions (frames) to zoom into.

`detail: "overview"` forces step 2; `"full"` skips the element-count check. The whole result stays under 130,000 chars (tests: 2,000 elements full fidelity gzip; 6,000 elements overview with 50 regions; the old 2,000-note/3,000-connection stress board).

### 2.7 Interaction in the view

- Overview results carry `regions` (frames: id, title, bbox, element count; a 3x3 or 4x4 grid of occupied tiles when there are no frames). The view outlines them on hover; a click (not a drag) hit-tests the region and sends a plain `tools/call diagram_show {id, focus: {bbox}, highlight: "none"}` through the host (MCP Apps: the host proxies the call; the result goes to the view, not to the model). **Back** returns to the previous picture. Regions are also keyboard buttons (Tab, Enter).
- Zooming uses the frame's **bbox**, not `frameId`: what the user sees inside the outline is what they get, even when the children do not carry `parentFrameId`.
- "Open in lab" (deep link) is unchanged.
- Verified in the reference host (`ext-apps/examples/basic-host`, headless Chrome): checkout board (result 19,623 chars), 2,000 elements full fidelity gzip (70,823 chars), 6,000 elements overview (101,176 chars, 50 regions), click on a frame -> host-mediated `diagram_show` with `focus.bbox` (52,020 bytes, 121 elements at full fidelity) -> Back. The view made no network request besides the host's. Screenshots: `host-checkout.png`, `host-large2000.png`, `host-large6000.png`, `host-large6000-zoomed.png`.

## 3. Decision

1. `diagram_show` draws every element with its **pack's own renderer** through `lib/render/packArt.js` (server-only), and every text with the shared layout. Elements the packs do not draw (frames, tables, docs, text presets, generic shapes) keep the existing building blocks of `diagramSvg.js`.
2. A new compact renderer `lib/render/showSvg.js` (browser-safe; the pack drawing comes in as `art`) produces the picture, the connection label placement of the canvas, the overview level and the regions. `renderDiagramSvg` (thumbnails, the canvas overview layer, slide previews, the parity suites) is unchanged.
3. The tool sends the cheapest transport that fits (plain, then gzip+base64) and steps down to the overview, then to "too large" with regions.
4. The view unpacks `svgz`, draws regions and zooms through host-mediated `diagram_show` calls.
5. No new dependency. No raster path.

## 4. Security

- Unchanged boundaries: the picture is an `<img>` data URL (no script, no external loads), the view's CSP stays at `img-src data:` / `connect-src 'none'`, the view sets text with `textContent`, and regions are plain numbers plus a title set with `textContent`.
- The converter is an allowlist: SVG elements (`g rect circle ellipse line polyline polygon path text tspan`, plus shared `linearGradient radialGradient marker stop`), attributes by kind (numbers, enums, colours, path alphabet, transform grammar). `style`, `class`, `href`, `on*`, `filter`, `mask`, `clip-path`, `<image>`, `<foreignObject>` and HTML form elements never pass. Paint `url(#...)` only to ids the converter created. Every user string is escaped by `escapeXml` (the T3 drawer).
- Test: every stencil of every pack with a hostile label, id, `data` and colours (`url(https://...)`, `expression(...)`, a `<script>`/`<foreignObject>` payload) yields strict XML with only allowlisted elements, no `on*`, `href`, `src`, `style` or external `url()`.
- Pack code runs on the server only through `renderToStaticMarkup` (no effects, no DOM); a renderer that throws falls back to the generic shape.

## 5. Slices

| #                 | Slice                                                                                                                                                                                                                                        | Done when (acceptance)                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F1**            | Harden the spike: `packArt`, `showSvg`, the ladder, the view's `svgz` + regions + Back; server instructions mention `detail`                                                                                                                 | Every stencil x 10 label variants converts with an empty `unhandled` list; the safety test above; the checkout and showcase boards reviewed side by side with the canvas (no missing decoration); 2,000 elements full fidelity and 6,000 elements overview under 130,000 chars; basic-host run (render, zoom into a region, Back, Open in lab, no view network request); **a manual check in claude.ai web and the iOS app** against the deployed lab (needs Q-AV7) |
| **F2**            | `CLASS_STYLES` generated from `styles/diagram-studio.css` (a build step or a checked-in generated module) with a drift test; the frame-title chip; table column icons and doc-card header glyphs; optional single shared soft shadow (Q-SF2) | Changing a pack class's border in the stylesheet fails the drift test until regenerated; showcase pixel-level review shows no remaining differences except shadows                                                                                                                                                                                                                                                                                                  |
| **F3**            | One label-placement module: `lib/render/connectionLabels.js` called by Connection.js and `showSvg`                                                                                                                                           | The canvas and `diagram_show` place every label of the showcase and a 200-connection board within 1 px (geometry test, as ADR-0008's parity suites)                                                                                                                                                                                                                                                                                                                 |
| **F4**            | Regions also in full-fidelity pictures above ~300 elements (zoom without the overview step); tiles for boards without frames tested on real boards                                                                                           | Clicking a frame in a 2,000-element full-fidelity picture opens it at full fidelity                                                                                                                                                                                                                                                                                                                                                                                 |
| **F5** (optional) | Use `packArt` for server-side thumbnails and version previews; evaluate `react-dom/server` in the browser for the canvas overview layer (bundle cost first)                                                                                  | Thumbnails show stencil shapes; bundle growth measured and accepted or rejected                                                                                                                                                                                                                                                                                                                                                                                     |

## 6. Open questions (recommended defaults)

| ID    | Question                                                                                         | Recommended default                                                                                                                                         |
| ----- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q-SF1 | gzip transport needs `DecompressionStream` (Safari/iOS 16.4+, Chrome 80+, Firefox 113+). Accept? | **Yes.** Plain SVG is used whenever it fits (up to ~290 elements), so only large boards depend on it; an old WebView gets a clear "open in the lab" message |
| Q-SF2 | Drop shadows                                                                                     | **Off** (bytes and paint time at 2,000 elements); revisit in F2 as one shared filter for boards under ~300 elements                                         |
| Q-SF3 | Expose `detail` (`auto`/`full`/`overview`) to the model?                                         | **Yes, default `auto`**                                                                                                                                     |
| Q-SF4 | Region zoom by `bbox` or by `frameId` membership                                                 | **bbox** (what is inside the outline)                                                                                                                       |
| Q-SF5 | Raster (PNG/WebP via `sharp`) as a fallback                                                      | **No** (undeclared dependency, no fonts in the Alpine image, over budget for large boards, not zoomable)                                                    |
| Q-SF6 | Picture budget                                                                                   | **110,000 chars** for the picture (whole result under 130,000), until the claude.ai check in F1 confirms how the limit counts `_meta`                       |
| Q-SF7 | Long-term, move the packs to a declarative shape spec (option b)?                                | **Not now.** (c) gives parity by construction for the drawing; reconsider only if the converter's class table keeps growing                                 |

## 7. Consequences

- `diagram_show` now imports every pack renderer and `react-dom/server` on the server (the MCP route). The production build (Turbopack) passes and `diagram_show` was smoke-tested on `next start`.
- A pack change that uses a new CSS feature on an HTML box fails `packArt.test.js` instead of silently losing a decoration.
- `TextBlock` reads one context; on the canvas the value is always null.
- The old `renderDiagramSvg` remains for the browser callers; two renderers share building blocks through `internals`.

## 8. Spike as built (2026-10-23)

- Code: `components/diagram-studio/text/textCapture.js` and one line in `TextBlock.js`; `lib/render/packArt.js` (converter); `lib/render/showSvg.js` (compact renderer, label placement, overview, regions); `lib/render/diagramSvg.js` exports `internals`; `lib/mcp/showTool.js` (`renderForShow`, `packPicture`, `detail`, view meta `svgz`/`regions`/`detail`/`diagramRef`); `lib/mcp/app/diagramView.js` (inflate, regions, Back, min zoom 0.002 for tall boards).
- Tests: `__tests__/lib/packArt.test.js` (coverage, safety, text = shared layout, checkout board), `__tests__/lib/mcpDiagramShow.test.js` (updated for single quotes and `detail`; the budget ladder), fixtures `__tests__/helpers/showFidelityBoard.js`; measurement harnesses `__tests__/spike/*.test.js` (skipped unless `OUT` is set).
- Verified: unit suite (one pre-existing timing flake in `textLayout.test.js`, ADR-0008 18.4), lint (0 errors), `NODE_ENV=production npm run build`, `next start` smoke call, the canvas on a throwaway DB, basic-host.
- Not verified: claude.ai web, Desktop and mobile (needs the deployed connector, Q-AV7); WebKit rendering of the picture; Windows fonts.
