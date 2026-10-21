# Worked examples by role

The lab is a substrate: you choose the structure; the tools place it. These are patterns, not templates.

## Solution architect: services, capabilities, dependencies

1. `diagram_search` "payments" to find the board, then `diagram_get` (outline) for the current revision.
2. Decide nodes (services, with `data`: owner, tier), edges ("depends on", "publishes to"), groups per domain.
3. `map_structure` with `layout: "cluster"` (domains as frames) or `tree` for a capability breakdown; use stencils from `stencil_catalog` (capability-map, uml-class) if the user wants that notation.
4. `diagram_show`. For later tidying: `layout_apply` on one frame.

## CX / UX researcher: interview notes to insights, journeys

1. User pastes a link to a frame of sticky notes. `board_read_region` with the link (page with `next`).
2. Propose 4-7 themes and counts; wait for approval if ambiguous.
3. `map_structure`, `layout: "cluster"`, `existingId` for every note, one group per theme. Then `diagram_show`.
4. Insights: a second `map_structure` with `anchor: {near: <cluster frame id>}` adding insight notes (source quotes in `data`) linked to the themes.
5. Journey: `flow` with steps as nodes, one group per phase; pains and opportunities as notes with `data`.

## Product manager: features, outcomes, risks

1. Read the roadmap frame (`board_read_region`).
2. Outcomes at the root, features as children: `map_structure` with `tree`; risks as a separate call anchored `near` the tree.
3. Status changes later: `diagram_apply_ops` `update_element` with `data: {status: "done"}` on ids you read.
4. Stakeholder summary: answer in chat from the read, and `diagram_show` the region.

## New board from scratch

"Start a board for the onboarding journey." `diagram_create` (`name: "Onboarding journey"`), then `map_structure` with `baseRevision` = the returned `revision` (flow: steps as nodes, one group per phase), then `diagram_show` and share the `url`. The board is private to the user.

## Text to map ("map this summary")

User pastes meeting notes. Pick `mindmap` for themes or `flow` for steps, root first, short labels, details in `data`. `diagram_get` for the revision, `map_structure`, `diagram_show`, then list what you built.

## From a map to a table to a summary

"Draw the architecture in this text, put it in a table, then summarize it." `map_structure` (`cluster` by domain) for the graph; `diagram_get` (`format: "outline"` is cheap, `compact` has the ids) for the element ids; one `table_create` with a row per component (`Component`, `Tier` as select, `Instances` as number, `Critical` as boolean), each row's `elementId` set to the component's element id and `anchor: {near: <a component id>}`; `diagram_show`; then write the summary in your reply. After the board changes, `table_update` with `key: "Component"` refreshes the rows instead of duplicating them.

