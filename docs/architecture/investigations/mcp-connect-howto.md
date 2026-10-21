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

| `board_read_region` | Part of a diagram in reading order: a frame, a selection, a rectangle or the area around one element. |

Resources: `ontographia://diagrams/{id}` (compact JSON), `ontographia://diagrams/{id}/mermaid`, `ontographia://catalog/{packId}`.

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

- Bearer tokens only; the web session cookie is ignored. Requests with an `Origin` header must come from this app's origin or one listed in `MCP_ALLOWED_ORIGINS` (command-line clients send no `Origin`).
- Limits: 120 requests per minute per token (at most 30 of them `diagram_apply_ops` writes), 256 KB request bodies, at most 10 messages per JSON-RPC batch, 50 items per list page.
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
