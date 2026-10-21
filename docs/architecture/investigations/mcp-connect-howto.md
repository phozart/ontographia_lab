# Connect from Claude Code / Cursor (read-only MCP)

Slice M1 of [mcp-and-embedding.md](./mcp-and-embedding.md). The server is read-only and speaks stateless Streamable HTTP at `POST /api/mcp`.

## 1. Create a token

Open **Account > API tokens**, give the token a name, choose a role (viewer or commenter), an expiry, and optionally limit it to specific diagrams. Copy the secret (`ogl_...`) immediately: it is shown once and only a hash is stored. A token never has more access than you do, and never more than the role you chose. Revoking it in the same list takes effect on the next request.

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
- Limits: 120 requests per minute per token, 256 KB request bodies, at most 10 messages per JSON-RPC batch, 50 items per list page.
- `401` carries `WWW-Authenticate: Bearer realm="ontographia-mcp"` (plus `error="invalid_token"` and a reason for unknown, revoked or expired tokens). A diagram outside the token's access answers "not found".
- Protocol: the bundled SDK (`@modelcontextprotocol/sdk` 1.32.1) negotiates up to `2025-11-25`. A client asking for a newer revision is answered with `2025-11-25`. `Mcp-Method` / `Mcp-Name` headers are optional and, when sent, must match the body.
- The rate limiter is in-process; with several app instances the effective limit is per instance.
