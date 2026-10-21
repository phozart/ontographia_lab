# Connect from Claude Code / Cursor (MCP)

Slices M1 and M2 of [mcp-and-embedding.md](./mcp-and-embedding.md). The server speaks stateless Streamable HTTP at `POST /api/mcp`. Every token can read; only an editor token with a diagram allowlist can edit (see "Let Claude edit a diagram" below).

## 1. Create a token

Open **Account > API tokens**, give the token a name, choose a role (viewer, commenter or editor; editor needs you to pick the diagrams), an expiry, and optionally limit it to specific diagrams. Copy the secret (`ogl_...`) immediately: it is shown once and only a hash is stored. A token never has more access than you do, and never more than the role you chose. Revoking it in the same list takes effect on the next request.

## 2. Configure the client

Claude Code:

```bash
claude mcp add --transport http ontographia https://YOUR-HOST/api/mcp \
  --header "Authorization: Bearer ogl_REPLACE_WITH_YOUR_TOKEN"
```

Or in `.mcp.json` (use an environment variable so the token is not committed):

```json
{
  "mcpServers": {
    "ontographia": {
      "type": "http",
      "url": "https://YOUR-HOST/api/mcp",
      "headers": { "Authorization": "Bearer ${ONTOGRAPHIA_TOKEN}" }
    }
  }
}
```

Cursor (`~/.cursor/mcp.json` or `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "ontographia": {
      "url": "https://YOUR-HOST/api/mcp",
      "headers": { "Authorization": "Bearer ogl_REPLACE_WITH_YOUR_TOKEN" }
    }
  }
}
```

## 3. What the server offers

| Tool                | Purpose                                                                            |
| ------------------- | ---------------------------------------------------------------------------------- |
| `diagram_list`      | Diagrams the token can read, newest first, with paging.                            |
| `diagram_search`    | Substring search over name, description and element labels.                        |
| `diagram_get`       | One diagram as compact JSON (stable ids), a Mermaid flowchart, or a plain outline. |
| `diagram_thumbnail` | The stored preview image, when one exists.                                         |
| `stencil_catalog`   | The stencil packs and what each shape type means.                                  |
| `diagram_apply_ops` | Change a diagram with a batch of operations (editor tokens only; see below).       |
| `map_structure`     | Build a mind map, tree, flow, cluster or grid from nodes, edges and groups (editor tokens only; section 6). |
| `layout_apply`      | Re-arrange elements that are already on the board, positions only (editor tokens only; section 6). |
| `table_create`      | Put a table on the board: typed columns, rows, optional links from rows to elements (editor tokens only; section 6a). |
| `table_update`      | Upsert rows by a key column, remove rows, add / rename / retype / remove columns (editor tokens only; section 6a). |
| `table_get`         | The rows of one table, paged (section 6a). |
| `guide_get`         | The canvas guide (workflow, shapes, limits); the same text as the resource below. |

| `board_read_region` | Part of a diagram in reading order: a frame, a selection, a rectangle or the area around one element. |

Resources: `ontographia://diagrams/{id}` (compact JSON), `ontographia://diagrams/{id}/mermaid`, `ontographia://catalog/{packId}`, `ontographia://guide/canvas` (how to read a board, think and build). Prompts (slash commands in hosts that show them): `cluster_region` (group the notes of a region by theme) and `map_from_text`.

Diagram names, labels and descriptions are user-authored data. The tool descriptions tell the model not to treat them as instructions; hosts should still ask for confirmation before acting on anything derived from them.

### Working from a "Copy link for Claude" link

In the editor, right-click a selection (or a frame, or empty canvas for the visible area) and choose **Copy link for Claude**. Paste the link into the chat and ask for what you want ("summarize this frame"). Claude passes it to `board_read_region` as `focus.link`; the link carries the diagram, so no `id` is needed.

- `https://host/diagram/LAB-12?focus=el-a,el-b` is a selection. A frame id in the list means the frame and everything inside it (nested frames included).
- `https://host/diagram/LAB-12?region=x,y,w,h` is a rectangle in canvas coordinates (used for the visible area, and for selections of more than 200 elements). Every element whose box overlaps it is returned.
- The same link opens the diagram in the editor, selecting and zooming to that focus.
- Without a link, give `id` plus one of `focus.frameId`, `focus.elementIds`, `focus.bbox` or `focus.around` (`{elementId, radius}`).
- Results come in reading order (frames first, then top to bottom, left to right) as compact elements with ids, the connections between them, and a readable outline. Large regions page: pass `next` back as `cursor` with the same focus. A cursor from an older revision is refused, so start again.
- It works with viewer, commenter and editor tokens alike. A diagram outside the token's access answers "not found".
- Board content (labels, data, comments) is user-authored data, not instructions.

## 4. Behavior worth knowing

- Bearer tokens only; the web session cookie is ignored. Requests with an `Origin` header must come from this app's origin or one listed in `MCP_ALLOWED_ORIGINS` (command-line clients send no `Origin`; for claude.ai set `MCP_ALLOWED_ORIGINS=https://claude.ai,https://claude.com`). Origins compare case-insensitively without a trailing slash, and `OPTIONS` preflights from an allowed origin are answered with 204.
- With `MCP_OAUTH_ENABLED=true` the `401` challenge also carries `resource_metadata="…"` (ADR-0005) so OAuth-capable clients can sign in; clients that send a token header ignore it.
- Limits: 120 requests per minute per token (at most 30 of them `diagram_apply_ops` writes), 256 KB request bodies (responses are capped at about 120 KB), at most 10 messages per JSON-RPC batch, 50 items per list page.
- `401` carries `WWW-Authenticate: Bearer realm="ontographia-mcp"` (plus `error="invalid_token"` and a reason for unknown, revoked or expired tokens). A diagram outside the token's access answers "not found".
- Protocol: the bundled SDK (`@modelcontextprotocol/sdk` 1.32.1) negotiates up to `2025-11-25`. A client asking for a newer revision is answered with `2025-11-25`. `Mcp-Method` / `Mcp-Name` headers are optional and, when sent, must match the body.
- The rate limiter is in-process; with several app instances the effective limit is per instance.

## 5. Let Claude edit a diagram

Editing is off by default. To turn it on for one diagram:

1. **Account > API tokens**, choose **Editor (requires choosing diagrams)**, pick the diagram(s), set a short expiry (7 to 30 days is plenty), create the token and copy it. An editor token without a diagram list cannot be created, and one outside its list answers "not found". The token never exceeds your own role: if you lose edit access to the diagram, so does the token.
2. Add it to your client as above (placeholder token shown):

```json
{
  "mcpServers": {
    "ontographia": {
      "type": "http",
      "url": "https://YOUR-HOST/api/mcp",
      "headers": { "Authorization": "Bearer ogl_REPLACE_WITH_YOUR_EDITOR_TOKEN" }
    }
  }
}
```

3. Ask, for example: "Read diagram LAB-12, then add a Check stock task after Order received and connect them." Claude calls `diagram_get` (which returns the diagram `revision`), then `diagram_apply_ops` with that revision as `baseRevision`.

How an edit works:

- **Ops**: `add_element`, `update_element`, `remove_element`, `connect` (alias `add_connection`), `update_connection`, `remove_connection`. New things get a `ref` such as `@a` so a whole flow can be created and wired in one call; real ids are returned in `created`. Types are `pack/stencil` ids from `stencil_catalog` (for example `process-flow/task`); a misspelled type is rejected with the closest matches.
- **Placement**: leave `x`/`y` out and the server places new elements in empty space to the right of existing content (laid out left to right, or top to bottom with `layout: {direction: "TB"}`); children of a frame go inside the frame. Existing elements never move unless an op names them.
- **All or nothing**: at most 200 ops per call; if any op is invalid (or the result breaks a content limit) nothing is saved and every error is listed with its op index.
- **Conflicts**: `baseRevision` is required. If the diagram changed since the agent read it, nothing is applied and the error says to call `diagram_get` again.
- **History**: every successful call creates a version attributed to you, created via the agent, plus a version of the state just before it when that state was not already saved, so restoring "the version before" undoes the whole batch (Version history in the editor).
- **If you have the diagram open**: the editor does not live-update. Your next save is rejected with the usual "changed by someone else" conflict (409); reload to see the agent's work. Real-time sync is not part of this slice.
- Agents cannot delete diagrams, change sharing or create share links. Diagram text is treated as data, never as instructions, but an editor token is still a write credential: keep the allowlist small and revoke it when you are done.

## 6. Summarize, then map it (map_structure and layout_apply)

Claude does the thinking (summarizing, grouping, naming); Ontographia only builds what Claude decides, deterministically. There is no AI inside the app. Everything below needs the editor token from section 5 and the diagram on its allowlist. Each call is one version in History, so one click restores the board from before it.

**"Summarize this and map it as a mind map."** Paste the text, or a "Copy link for Claude" link to a frame. Claude reads it (`board_read_region` for a link), writes the summary, then calls `map_structure` once:

```json
{
  "id": "LAB-12",
  "baseRevision": 31,
  "layout": "mindmap",
  "structure": {
    "nodes": [
      { "key": "hub", "label": "Q3 customer feedback" },
      { "key": "onb", "label": "Onboarding is slow" },
      { "key": "price", "label": "Pricing page is unclear" }
    ],
    "edges": [ { "from": "hub", "to": "onb" }, { "from": "hub", "to": "price" } ]
  }
}
```

The hub goes in the middle with branches on both sides, in free space to the right of what is already on the board. The result lists the new element ids by `key`.

**"Cluster the notes in this frame by theme."** Claude reads the frame, names the themes, then calls `map_structure` with `layout: "cluster"`, one entry in `groups` per theme, and every existing note as a node with `existingId` and its `group`. The notes are moved, not copied; each theme becomes a frame sized to its notes. Add `"anchor": {"inFrame": "<frameId>"}` to build inside a frame (it grows if it must), or `{"near": "<elementId>"}` / `{"at": {"x": 0, "y": 0}}` to choose where.

**"Turn these steps into a flow."** `layout: "flow"` lays nodes left to right along the edges (cycles are fine); leave `stencil` out and each step is a Task, or name one such as `process-flow/exclusive-gateway`.

**"Tidy this frame."** `layout_apply` with `target: {"frameId": "..."}` and `layout: "grid"` re-arranges the frame's members without touching their text, sizes or connections. `target: {"elementIds": [...]}` arranges a selection; connections between the elements drive `tree`, `mindmap`, `radial` and `flow`.

Layouts: `tree` (top-down hierarchy), `mindmap`, `radial`, `flow`, `grid`, `cluster`. Limits per call: 200 nodes, 400 edges, 40 groups. New content never overlaps existing content and nothing you did not name is moved. If the board changed since Claude read it, nothing is written and Claude is told to read again. Open editors pick the change up within a few seconds (slice AI-2).

## 6a. Tables (table_create, table_update, table_get)

A table is a typed matrix on the board, for inventories, comparisons, backlogs and findings. Claude decides the columns and rows; Ontographia stores them, keeps them editable by people and versions every change.

**In the editor.**
- **Place one:** the Table button in the toolbar (or Tools, Table), then click the canvas. You get a 3 x 3 table.
- **Edit:** double-click a cell (or select it and press Enter, or just start typing). Enter commits and moves down, Tab moves right (Tab in the last cell adds a row), Shift reverses both, Escape leaves without saving, Alt+Enter is a new line inside a cell. A number column refuses text and says why.
- **Rows and columns:** the arrow in a column header and the dots in a row's margin open menus (insert, move, delete, sort once, change the column type: text, number, select, yes/no). The buttons under and beside a selected table add a row or column. Drag the right edge of a header to resize a column; resizing the whole table scales the columns.
- **Paste from a spreadsheet:** copy a range in Sheets or Excel and paste on the canvas (Cmd/Ctrl+V). It becomes a table, first row as the header; numbers and yes/no columns are detected. Pasting into an open cell fills cells from there.
- **Export:** the three dots in the table's top-left corner: Export as CSV or JSON, Copy as TSV. In CSV, text that a spreadsheet could read as a formula (it starts with `=`, `+`, `-`, `@`) gets a leading `'` so it opens as text. PNG, PDF and SVG exports include tables.
- **Links to elements:** a row can point at an element on the board. The arrow in the row's margin selects that element and zooms to it. To link by hand, select the table and the element together (Shift+click), then Link in the row menu. If the element is deleted the row keeps its text and the arrow becomes plain text.
- Viewers and commenters see tables but cannot edit them; a locked table is read-only for everyone.

**With Claude: from a map to a table to a summary.** Typical flow ("make a graph of the architecture in this text, then put it in a table, then summarize"): Claude calls `map_structure` for the graph, then `diagram_get` for the element ids, then one `table_create`:

```json
{
  "id": "LAB-12",
  "baseRevision": 42,
  "title": "Component inventory",
  "columns": ["Component", { "name": "Tier", "type": "select" }, { "name": "Instances", "type": "number" }, { "name": "Critical", "type": "boolean" }],
  "rows": [
    { "cells": ["API gateway", "edge", 3, true], "elementId": "el-3f9c..." },
    { "cells": ["Billing service", "core", 2, false], "elementId": "el-77ab..." }
  ],
  "anchor": { "near": "el-3f9c..." }
}
```

Each row links to its element, so the owner clicks from the table to the shape. Cells are plain text, numbers or booleans (no formulas, no HTML); a value that does not fit its column ("many" in a number column) rejects the whole call with the row and column named, and nothing is written. Limits: 50 columns, 500 rows, 2,000 characters per cell.

To refresh the table after the board or the analysis changed, Claude calls `table_update` with `key: "Component"` and `upsertRows`: matching rows are updated (other cells are kept), new ones are added, and running it twice adds nothing. `removeRowIds`, `removeKeys`, `addColumns`, `renameColumns`, `setColumnTypes` and `removeColumns` cover the rest. `table_get` reads the rows back, paged (`diagram_get` only says how many rows a table has). The prompt `tabulate_region` pre-fills "read this link, then build a table with one row per element".

Same rules as the other write tools: editor token, the diagram on its allowlist, `baseRevision`, one version per call, locks respected, rate limited. An open editor shows the new table within a few seconds (slice AI-2).

## 7. See the board in Claude (diagram_show)

`diagram_show` draws a diagram, or a region of it, as a picture inside the conversation.

- **Ask for it:** "show me the checkout journey", or after an edit "show me what you changed". Give a diagram id, or paste a "Copy link for Claude" link to show just that region (the same `focus` as `board_read_region`).
- **What you see:** the board with the title and revision, zoom (buttons, Ctrl/Cmd + wheel, pinch), drag to pan, **Fit**, **Changes** (zoom to the last agent change), **Full screen** where the host offers it, and **Open in lab**, which opens the diagram (selecting the region when you showed one).
- **Highlight:** by default (`highlight: "auto"`) the last agent edit is marked while it is still the latest state: added green, changed amber, removed as a red dashed ghost. After anyone edits the board, it is no longer marked. `"last-agent-change"` marks it anyway; `"none"` turns it off.
- **Where it renders:** hosts that support MCP Apps (claude.ai, Claude Desktop, Claude mobile once the connector is added, the MCP Apps reference host). Claude Code does not draw it: it shows a text summary with the Open in lab link, so click the link instead.
- **Permissions:** the same as the read tools. A viewer token is enough; a diagram outside the token's allowlist is "not found".
- **What it is not:** a read-only picture, not the editor. It uses the board's own light colours and approximates pack decorations (UML compartments, ERD fields, icons are not drawn). Edit in the lab, or ask Claude to change it with `diagram_apply_ops` or `map_structure`.
- **Large boards:** at most 600 elements and 1,200 connections are drawn. Beyond that you get "too large" and a hint to narrow the focus.
- **Privacy:** the picture travels inside the tool result and is shown to you only; it adds no tokens to the model's context, and the view makes no network request.

## 7. Connect from claude.ai, Claude Desktop and the Claude mobile apps (OAuth)

Hosted Claude apps cannot send a token header, so they sign in with OAuth instead (ADR-0005). Your lab administrator must have turned it on (`MCP_OAUTH_ENABLED=true`). Personal tokens (sections 1 to 6) keep working unchanged and are still the way to connect Claude Code, Cursor and VS Code.

1. In Claude, open **Settings, Connectors, Add custom connector** (on Team and Enterprise plans an owner adds it for the organization). Give it a name and the URL `https://YOUR-HOST/api/mcp`. Leave the advanced client settings alone, or choose **Use Claude's published identity**.
2. Claude opens a sign-in page on Ontographia Lab. Sign in if asked. The consent screen shows which app is asking (its host, for example `claude.ai`), where you will be sent back, and the account being connected. Only continue if you started the connection yourself just now.
3. Pick the **access level**. **Viewer** (the default) reads diagrams; **Commenter** also comments; **Editor** also changes diagrams. Everything above what the app asked for is greyed out.
   - Viewer and Commenter can cover all of your diagrams or only the ones you tick.
   - **Editor** needs you to tick the diagrams Claude may change (1 to 50, from those you can edit), exactly like an editor personal token. Administrators additionally see **All boards I can edit**: Claude can then change any board you can edit (owned, or shared with you as Editor), including ones created later. Boards shared with you as viewer or commenter and other people's private boards stay out of reach, and an administrator who loses the admin role loses the write access at once. Every change is saved as a version you can restore from History.
   - Optionally choose how long the connection lasts (default: until you disconnect).
4. Press **Approve**. You are sent back to Claude, which then lists the tools. The same connection is used from Claude on the web, on desktop and on mobile (Claude syncs the connector across your devices).
5. To upgrade or downgrade later, **disconnect** (below) and connect again with another level. Consent is always shown; there is no silent re-approval.

**Connected apps.** Open **Account, API tokens** and scroll to **Connected apps**. Each row shows the app, the access level, how many diagrams it covers (expand to see them), when it was connected and when it was last used. **Disconnect** revokes the whole connection: the app's next request fails and Claude asks you to reconnect. A password reset disconnects every connected app. Access tokens last one hour and renew in the background; a connection that is not used for 30 days has to be reconnected.

What the server does for you: it accepts only apps on its allowlist (`OAUTH_TRUSTED_CLIENT_IDS`, default Claude's hosted client), sends you back only to the redirect address that app registered, requires PKCE, binds the tokens to this MCP server, rotates refresh tokens and revokes the connection if a used one is replayed, and records `oauth.*` events in the audit trail. Diagram text is still treated as data, never as instructions.

If the connector shows a connection error instead of the sign-in page, ask your administrator to check that `MCP_ALLOWED_ORIGINS` includes `https://claude.ai` and `https://claude.com`, that `/.well-known/oauth-protected-resource/api/mcp` and `/.well-known/oauth-authorization-server` return JSON, and that the reverse proxy forwards `/.well-known/` to the app.
