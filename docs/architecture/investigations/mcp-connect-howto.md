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

Resources: `ontographia://diagrams/{id}` (compact JSON), `ontographia://diagrams/{id}/mermaid`, `ontographia://catalog/{packId}`.

Diagram names, labels and descriptions are user-authored data. The tool descriptions tell the model not to treat them as instructions; hosts should still ask for confirmation before acting on anything derived from them.

## 4. Behavior worth knowing

- Bearer tokens only; the web session cookie is ignored. Requests with an `Origin` header must come from this app's origin or one listed in `MCP_ALLOWED_ORIGINS` (command-line clients send no `Origin`).
- Limits: 120 requests per minute per token, 256 KB request bodies, at most 10 messages per JSON-RPC batch, 50 items per list page.
- `401` carries `WWW-Authenticate: Bearer realm="ontographia-mcp"` (plus `error="invalid_token"` and a reason for unknown, revoked or expired tokens). A diagram outside the token's access answers "not found".
- Protocol: the bundled SDK (`@modelcontextprotocol/sdk` 1.32.1) negotiates up to `2025-11-25`. A client asking for a newer revision is answered with `2025-11-25`. `Mcp-Method` / `Mcp-Name` headers are optional and, when sent, must match the body.
- The rate limiter is in-process; with several app instances the effective limit is per instance.
