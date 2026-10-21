# Layouts and stencils

## Layouts (`map_structure`; `layout_apply` has the same minus cluster)

- `tree`: top-down hierarchy. Root = first node with no incoming edge; list it first, edges parent to child. Default shape core/rectangle.
- `mindmap`: root in the middle, balanced on both sides. Default mind-map topics by depth (central, main, sub).
- `radial`: rings around a root. Same defaults as mindmap.
- `flow`: left to right along edges; cycles allowed. Default process-flow/task. Use gateways (for example `process-flow/exclusive-gateway`) for decisions.
- `grid`: rows and columns. Default sticky-notes/sticky-medium.
- `cluster` (`map_structure` only): groups become labelled frames, items gridded inside; ungrouped items stay loose. In `layout_apply`, `cluster` means `grid`.

In `layout_apply`, connections between the elements drive tree, mindmap, radial and flow.

## Anchors

- omit: free space right of all content
- `{near: elementId}`: beside that element (nearest free spot if taken)
- `{at: {x, y}}`: at a point (nearest free spot if taken)
- `{inFrame: frameId}`: fills the free area of a frame; the frame grows if needed

When building something related to existing content, anchor `near` the related element or frame. Never place on top of what the user made.

## Shape packs

Call `stencil_catalog` for the live list. Packs include core (frame, section, rectangle, circle, diamond), sticky-notes (sticky-small, sticky-medium, sticky-large and colored variants), mind-map (central-topic, main-topic, sub-topic, floating-topic, callout), process-flow (start-event, task, gateways), capability-map, uml-class, cld (causal loops), erd, itil, togaf, product-design. A type is written `pack/stencil`, for example `process-flow/task` or `sticky-notes/sticky-medium`. A misspelled type is rejected with the closest match.

Stencils have property fields; set them through `data` (string, number or boolean). Call `stencil_catalog` with `packId` for the field names.

## Conventions

- Raw items (interview quotes, ideas): sticky notes. Themes and sections: groups (frames).
- Label = short phrase. Detail, source, owner, severity go in `data`.
- Do not duplicate: use `existingId` when rearranging what is already on the board.
- Edge labels only when the relation is not obvious ("depends on", "owns").
