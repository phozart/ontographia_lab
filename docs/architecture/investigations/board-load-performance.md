# Board load performance: thumbnails off the critical path, viewport culling, cheap wins

Status: implemented on `perf/board-load` (2026-10-22). Context: ADR-0008 section 16.2 measured 300 elements at about 2.2 s, 500 at 3.5 s, 2,000 at 14 s and 5,000 at 40 s to "all nodes exist". Goal: 300 to 500 elements interactive in under 1 s after the data arrives, 5,000 in under 5 s, pan and zoom smooth, no visual change for on-screen content.

## 1. How it is measured

`scripts/perf/board-load-bench.js` (seed: `scripts/perf/seedBoard.js`) creates a throwaway board of N mixed elements through the API (about 5% frames, 10% text presets, 5% docs (at most 150), 5% tables, the rest shapes, plus one connection per element), opens it in headless Chrome at 1379 x 985 against a production build (`next start`), and records:

| Column          | Meaning                                                                                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| first / settled | ms from navigation start to the first `[data-node-id]` / to the last change of the mounted node count (after the fix these are the same: the board appears in one commit) |
| data            | ms from navigation start until the diagram JSON has arrived (network + server; not something the client can shorten)                                                      |
| nodes           | mounted `[data-node-id]` at rest                                                                                                                                          |
| long            | total long-task time (ms) during load plus 8 s of idle                                                                                                                    |
| heap            | `usedJSHeapSize` in MB                                                                                                                                                    |
| puts            | thumbnail/autosave PUTs fired while opening                                                                                                                               |
| pan             | frame-to-frame time over 90 frames of wheel-panning (3,600 px, crossing several culling bands)                                                                            |

```
TEST_BASE_URL=http://localhost:3290 node scripts/perf/board-load-bench.js 300,500,2000,5000 3   # best of 3
```

The Mac was heavily loaded by other work while this was measured (load average 10 to 40, noted per row); every row is the best of 3. Absolute numbers are therefore pessimistic and noisy, the ratios are not.

## 2. Findings from profiling

1. **Thumbnail capture dominated.** `useThumbnailCapture` fired when `saveStatus.lastSaved` first had a value, and loading a board sets `lastSaved` from the stored `updated_at`, so every open captured a thumbnail with html-to-image (`renderPreview`, which clones the live canvas and copies the computed style of every DOM node: `setProperty` + `getPropertyValue`, cost proportional to DOM nodes). At 300 elements that was about 2 s of the 3 s; at 5,000 it blocked the main thread for 100 s (the clone doubled the node count to 10,000 and the heap reached 2.2 GB).
2. **Every node was rendered** whatever the viewport, and each `Node` called `useDiagram()`, so every viewport, selection or save-status change re-rendered all of them (the context value holds the viewport).
3. **Quadratic lookups** on load and on every render: `elements.find` per connection in `buildMindMapHierarchy` (181 ms at 5,000), the minimap (`find` per connection, a stencil lookup per element on every pan frame, 7,000 SVG nodes redrawn per frame), the `autoPorts` memo, `Connection` (two `find`s plus a full obstacle scan with stencil lookups per connection) and `CrossingIndicators`; `hasConnections={connections.some(...)}` per node.

## 3. What changed

### 3.1 Thumbnails (no html-to-image, never on open)

- `lib/thumbnail.js`: `createThumbnailScheduler`. The first `lastSaved` seen for a board is a baseline (open writes nothing). After an edit-save the capture is debounced (3 s quiet period, restarted by each further save), then scheduled with `requestIdleCallback` (timeout 10 s), then throttled to one per 5 minutes (a throttled capture re-arms for the remaining time, so the final state is still captured). Switching boards or unmounting drops anything pending.
- `components/diagram-studio/export/thumbnailRenderer.js`: renders `lib/render/diagramSvg.renderDiagramSvg` (content in, SVG string out; up to 5,000 elements, no byte cap) and rasterizes it to a 320 px PNG on a canvas. Cost grows with the number of elements, not with DOM nodes and computed styles. The result goes through the same PUT as before (`isValidThumbnail`, 200 KB cap), so the dashboard cards still update.
- Fidelity: the SVG path draws shapes, labels, connections, tables, docs and text presets like `diagram_show`; pack-specific decorations (UML compartments, ERD fields, icons) are not drawn. At 320 px that is not visible. `diagramSvg` now measures bytes without `Buffer` so it also runs in the browser.
- Side effect to know: a board that is only ever opened (never edited in the UI) gets no thumbnail until its first edit. Boards created through the API or MCP show the logo until then, as before for boards that were never opened.

### 3.2 Viewport culling

- `lib/render/viewportCulling.js` (pure, isomorphic): `visibleWorldRect`, `cullWorldRect` (the visible rectangle plus 1 viewport on every side, snapped outward to half-viewport steps so small pans return the identical rectangle), `cullElements` (box intersection with a 120-unit pad for external labels, handles, shadows, and a circle box for rotated elements; z-order preserved; `keepIds` always mounted), `cullConnections` (the bounding box of both endpoint boxes plus waypoints, so a line whose endpoints are both off-screen but which crosses the viewport still renders). Boards under 120 elements are never culled.
- `DiagramCanvas`: mounts `mountedElements` / `mountedConnections`. `Connection` still receives the FULL element list (endpoints, obstacle routing) and a shared `elementsById` map and `obstacleRects` list built once. Kept mounted regardless of position: selected nodes (when 100 or fewer), the dragged set, the element being edited, a connection source, selected and edited connections and the connections attached to any kept element.
- `Node` is `memo`ized; its props are primitives, the element object (identity-stable between edits) and identity-stable callbacks (latest-ref wrappers); the theme is a prop instead of a `useDiagram()` subscription. A pan or zoom re-renders no mounted node.
- `components/diagram-studio/canvasCulling.js`: a reference-counted hold. Anything that clones the live canvas DOM calls `suspendCulling(rect?)` (whole board, or just a world rectangle that is mounted on top of the viewport band), waits for the canvas to commit, and releases when done.

### 3.3 Per feature, with culling

| Feature                                                          | How it works with culling                                                                                                                                                                                                       |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Export PNG / JPEG / SVG / PDF dialog and preview                 | `exportRenderer.withHost` holds culling for the whole board (scope board), for the frame's rectangle (frame) or for the selection's bounds plus 800 (selection); the viewport scope needs nothing extra. Released in `finally`. |
| Copy as image (selection, frame, board), doc card copy           | goes through `exportFromCanvas`, so the same hold.                                                                                                                                                                              |
| Present mode                                                     | holds the union rectangle of all slide frames for as long as it is open and clones a slide only after the canvas has committed it.                                                                                              |
| Slide PDF and slide PNG export                                   | `exportDeckPdf` holds the union of the slide frames for the whole export; `exportSlidePng` holds that slide's frame.                                                                                                            |
| Frames as slides, frame navigator                                | the frame list comes from content (state), not DOM; jumping to a frame moves the viewport and the band follows.                                                                                                                 |
| Minimap / overview                                               | draws from state (all elements), unaffected; its own cost was cut (3.4).                                                                                                                                                        |
| Search, select all, copy/paste/delete, keyboard navigation, undo | operate on state (`elements`), not on mounted nodes; select-all of 5,000 selects all 5,000 and mounts only the part near the viewport.                                                                                          |
| Live highlight, agent focus rings, off-screen chip               | drawn from element bounds in state, unaffected.                                                                                                                                                                                 |
| `diagram_show`, thumbnails, MCP projections                      | render from content (`diagramSvg`), unaffected.                                                                                                                                                                                 |
| Editing, dragging, connecting                                    | the dragged set, the edited element, the connection source and the selection are kept mounted; the drag moves them by DOM transform as before (unmounted members of a big multi-selection are moved by state on drop).          |

### 3.4 Other cheap wins

- `find` per connection replaced by a `Map` in `buildMindMapHierarchy`, the `autoPorts` memo, `Minimap`, `CrossingIndicators` and `Connection` (optional `elementsById`); the per-connection obstacle scan (stencil lookups included) is computed once per element list.
- `hasConnections` from a precomputed id set (was `connections.some` per node, O(nodes x connections)).
- Minimap: the element extent is computed only when elements change, and the 1-rect-per-element SVG is memoized so a pan re-renders only the viewport rectangle.

## 4. Results

Baseline = `main` at 3692dac (T1), after = this branch, both production builds of the same machine, best of 3 per row.

| Elements | Baseline: nodes exist (s)                                            | Baseline: long tasks (s) | Baseline: heap (MB) | After: nodes exist (s)          | After: data arrived (s) | After: long tasks (s) | After: heap (MB) | After: mounted | After: pan p50 / p95 (ms)                                         |
| -------- | -------------------------------------------------------------------- | ------------------------ | ------------------- | ------------------------------- | ----------------------- | --------------------- | ---------------- | -------------- | ----------------------------------------------------------------- |
| 300      | 3.4 (load 24)                                                        | 2.7                      | 22                  | 0.31 (load 12) / 0.75 (load 32) | 0.11                    | 0.08 / 0.18           | 15               | 144            | 17 / 20                                                           |
| 500      | 5.9 (load 22)                                                        | 5.1                      | 84                  | 0.34 (load 11) / 0.65 (load 26) | 0.12                    | 0.11 / 0.16           | 19               | 144            | 17 / 33                                                           |
| 2,000    | 30.8 (load 30)                                                       | 27.6                     | 445                 | 0.61 (load 9) / 0.80 (load 22)  | 0.22                    | 0.21 / 0.29           | 38               | 144            | 21 / 73                                                           |
| 5,000    | 20 s to render, then 100+ s blocked by the thumbnail clone (load 38) | 110                      | 2,254               | 1.25 (load 12) / 2.06 (load 24) | 0.39                    | 0.46 / 0.41           | 63               | 144            | 48 / 147 (before 3.4 and the Minimap fix; 35 / 70 after, load 24) |

Reading the table: "nodes exist" is from navigation start, so it includes the HTTP round trip and the JSON download (`data`). Typical boards (300 to 500) are interactive about 0.2 s after the data arrives on an idle machine and under 0.7 s on a machine at load 25 to 30; 5,000 elements take 1.25 s (idle) to 2 s (loaded) in total, against the 40 s measured in ADR-0008. The "settled" time equals the "first" time: after the fix the board appears in one commit, and no thumbnail request is made while opening (`puts` 0; before: 1 at 300 and 500 elements, 3.8 s and 6.6 s after navigation).

Progression at 5,000 elements, load 24 to 40 (so only the ordering is meaningful): 7.2 s (culling and thumbnail only), 3.6 s (plus `find` to `Map`), 2.1 s (plus shared obstacles and the minimap memo).

## 5. Tests

- Unit: `viewportCulling` (rectangles, margin, snapping, rotation, several rectangles, connections crossing the view, waypoints, keep sets, small boards), `thumbnailScheduler` (not on open, once after an edit, debounced, idle, throttled, board switch), `useThumbnailCapture`.
- Component: `canvasCulling` (off-screen nodes are not mounted, pan mounts the new ones, a selected node stays, a hold mounts everything or one rectangle and release culls again, crossing connections render).
- E2E `board-load-perf.test.js`: 2,000-element board under a 5 s budget (best of 2) with only a band mounted and no PUT on open; pan to the far corner mounts `e1999`; select all + Delete + undo (autosave stores 0, then 2,000 elements); Export PNG of a 400-element board has the whole board's aspect ratio; Copy frame as image of a half off-screen frame is complete (all four children drawn); present mode shows all three slides of a deck whose frames are 6,000 units apart.
- Existing e2e suites run against the build: text-layout, presets-themes, slides, table, doc-copy-export, doc-card, live-merge (its stale `input` selector, left behind by T1's `textarea` label editor, is fixed in this PR), live-highlight.

## 6. Not done, and follow-ups

- `TableNode` and `DocCard` still read the whole diagram context (they re-render on a pan while mounted: about 3 ms per frame at 5,000 elements). Selecting only the scale would remove it.
- The minimap still draws one SVG node per element (about 7,000 DOM nodes at 5,000 elements). A canvas-drawn minimap would remove most of the remaining DOM.
- Dropping `html-to-image` from export is not attempted: exports need pack-faithful rendering (UML compartments, fonts), which only the DOM clone has. Culling is held off for the duration of an export instead.
- The 5,000-element export of the whole board clones 5,000 DOM nodes; that cost is inherent in the clone approach.

## 7. Review follow-ups (M1, L2, level of detail)

- **M1, thumbnail lost when leaving soon after an edit.** The scheduler now pre-renders the PNG 0.8 s after an edit-save (idle, once per burst; the renderer chunk is preloaded when the editor is idle) and sends it at the 3 s debounce. `flush()` runs on unmount, `pagehide` and `visibilitychange` to hidden: with a pre-rendered image the PUT is sent synchronously with `keepalive` (bodies under 60 KB; larger ones use a normal fetch, which survives a client-side route change). Still throttled to one per 5 minutes. A full page unload within about 1 s of an edit-save, before the pre-render finishes, can still lose the thumbnail (the render cannot be awaited while the page closes).
- **L2, contextual toolbar frame export.** "Export frame as SVG/PNG" now holds the frame's rectangle mounted (`suspendCulling(rectOfFrame(frame))`) while it clones. Finding, not fixed here: these two handlers clone `document.querySelector('.ds-canvas-area svg')`, which is the grid SVG, so the exported file contains only the grid, with or without culling; the Export dialog and Copy as image are the working paths. No e2e is possible for that handler until it is fixed.
- **Level of detail.** `OverviewLayer`: when the zoom is below 0.15, or more than 800 nodes would be mounted (and the board has 120 or more elements), no nodes or connections are mounted (except the selection, dragged, edited and connect-source ones). The board is drawn as one `<img>` of `renderDiagramSvg` output (blob URL, cached until elements, connections or theme change). A click is hit-tested by geometry (`hitTestElements`: topmost element, a frame only if nothing else is under the point) and selects the element, which mounts; selections over 100 elements are drawn as outline overlays; live highlight rings and agent focus are separate state-driven layers. Zooming in past the threshold hands back to node mounting. Captures (export, copy as image, present) disable the overview. Text in the overview is simplified by the SVG renderer, which is below 5 screen px at these zooms anyway.
- **Minimap at 1,000+ elements** is one `<path>` for all elements (no per-element double-click zoom, no connection lines), which removed the last 7,000 DOM nodes at 5,000 elements.

Fit-all style zoom-out (ctrl+wheel to the minimum zoom), then 60 frames of pan; best of 3, production build:

| Elements | Before (review) | Mounted after zoom-out | DOM nodes | Zoom-out to next frame | Pan p50 / p95 after zoom-out | Load: nodes exist | Load: pan p95 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2,000 | all nodes mounted | 0 | 450 | 39 ms | 17 / 18 ms | 0.40 s (load 7) | 32 ms |
| 5,000 | 60k DOM nodes, pan p95 1.8 s, one tab crash | 0 | 750 | 79 ms | 17 / 61 ms | 0.65 s (load 6) | 40 ms |

The one slow frame in the 5,000 zoomed-out pan is the first image raster after the zoom; the median stays at one 60 Hz frame. Benchmark: `board-load-bench.js` now also reports `zoomOut`.

## 8. Open view for boards far from the origin

Agent-built boards (`map_structure`) put content at about 0..5,300, while the canvas always opens at world 50,000, 50,000. Before culling such a board mounted every node off-screen (the user saw an empty canvas until "Fit"); with culling no node was mounted at all. The canvas now fits the content once per board when no element intersects the opening view (`DiagramCanvas`, `computeFitForCanvas`, max scale 1); boards whose content is in view open exactly as before, and deep links set their own view afterwards. The overview only ever follows the zoom (below 0.15) or the number of nodes that would mount, never the board's extent at normal zoom. Tests that measure every node of a board larger than the screen pan across it in tiles (`text-t2` legacy board); there is no bypass flag.
