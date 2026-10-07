# API contracts — Groups B and C

Status: **Proposed**; the authorization wrapper (section 1) and the `GET`/`PUT`/`DELETE /api/diagrams/{id}` rows of section 2 shipped in slice 1 (as built: `[id].js` was not moved to `[id]/index.js`; only the `If-Match` header is supported, not a `baseRevision` body field; content over 5 MB answers 413, other content violations 400 `VALIDATION_FAILED`, unsafe URL fields are stripped and reported in a `warnings` array; a PUT whose body is only `thumbnail` requires `diagram.write`, ignores `If-Match` and does not change `revision`). Pages-router layout: `pages/api/diagrams/[id].js` becomes `pages/api/diagrams/[id]/index.js` so nested routes can live beside it.

## Conventions

- JSON in/out. Auth = next-auth session cookie (or link cookie, §5). All routes require `status = 'active'` for user principals.
- `{id}` accepts a UUID or `LAB-n` (as today). Version ids accept UUID or `version_number`.
- Errors: `{ "error": "<human message>", "code": "<MACHINE_CODE>" }` — `error` keeps today's shape for existing clients; `code` is new.

| Status | code                   | When                                                                        |
| ------ | ---------------------- | --------------------------------------------------------------------------- |
| 400    | `VALIDATION_FAILED`    | Body/query invalid (`details` lists fields)                                 |
| 401    | `UNAUTHENTICATED`      | No session (or link requires sign-in)                                       |
| 403    | `ACCOUNT_INACTIVE`     | User pending/suspended                                                      |
| 403    | `FORBIDDEN`            | Principal has a role on the diagram but not this action                     |
| 404    | `NOT_FOUND`            | Diagram/child doesn't exist **or** principal has no role at all             |
| 409    | `REVISION_CONFLICT`    | `If-Match` revision ≠ current (`current: {revision, updatedAt, updatedBy}`) |
| 409    | `ALREADY_EXISTS`       | e.g. pending invitation for this email                                      |
| 410    | `GONE`                 | Link/invitation expired or revoked                                          |
| 422    | `NOT_ALLOWED_FOR_ROLE` | Granting a role above the grantor's, link role `editor`, etc.               |
| 429    | `RATE_LIMITED`         | `lib/rateLimit.js`                                                          |
| 413    | `PAYLOAD_TOO_LARGE`    | Content/comment over limit                                                  |

"Role" column = minimum role (ADR-0003 matrix). Lists use cursor pagination: `?limit=` (≤100, default 50) `&cursor=` → `{ items, nextCursor }`.

## 1. Authorization function (single choke point)

```ts
// lib/authz/policy.js — pure data + functions, no I/O
type Role = "viewer" | "commenter" | "editor" | "owner";
type Action =
  | "diagram.read"
  | "diagram.export"
  | "diagram.write"
  | "diagram.delete"
  | "version.read"
  | "version.create"
  | "version.restore"
  | "comment.read"
  | "comment.create"
  | "thread.resolve"
  | "comment.delete_any"
  | "share.read"
  | "share.manage"
  | "ownership.transfer"
  | "audit.read";
function can(role: Role | null, action: Action): boolean;
function capabilitiesFor(role: Role): Action[];
function maxRole(...roles: (Role | null)[]): Role | null;

// lib/authz/index.js — I/O, framework-free (usable by Next API, collab sidecar, MCP server)
type Principal =
  | { kind: "user"; userId: string; platformRole: "user" | "admin" }
  | { kind: "link"; linkTokenHash: string; userId?: string }
  | { kind: "agent"; userId: string; tokenId: string; roleCap: Role };
type GrantSource =
  | "owner"
  | "member"
  | "link"
  | "support_access" /* future: 'project' | 'workspace' */;

async function resolveRole(
  p: Principal,
  diagramId: string,
): Promise<{ role: Role | null; source: GrantSource | null }>;
async function authorize(
  p: Principal,
  diagramRef: string,
  action: Action,
): Promise<{
  diagram: DiagramMeta;
  role: Role;
  source: GrantSource;
  capabilities: Action[];
}>;
// throws AuthzError { status: 404, code: 'NOT_FOUND' } | { status: 403, code: 'FORBIDDEN' }

// lib/authz/next.js — adapter for API routes
function withDiagramAuth(
  actionByMethod: Partial<
    Record<"GET" | "POST" | "PUT" | "PATCH" | "DELETE", Action>
  >,
  handler: (
    req,
    res,
    ctx: { principal: Principal; diagram: DiagramMeta; role: Role },
  ) => Promise<void>,
): NextApiHandler; // 405 for methods not in the map
```

## 2. Diagrams (changed)

| Method & path                                | Role   | Change                                                                                                                                                                            |
| -------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/diagrams?scope=owned\|shared\|all` | —      | Returns **metadata only** (no `content`) + `access.role` per item. `shared` = member grants.                                                                                      |
| `GET /api/diagrams/{id}`                     | viewer | Adds `revision` and `access: { role, source, capabilities[] }`                                                                                                                    |
| `PUT /api/diagrams/{id}`                     | editor | Header `If-Match: "<revision>"` (optional during rollout, then required). Response adds `revision`. May create an `auto` version server-side (ADR-0001). 409 `REVISION_CONFLICT`. |
| `DELETE /api/diagrams/{id}`                  | owner  | Audited.                                                                                                                                                                          |

## 3. Versions (B)

| Method & path                                                 | Role   | Request                                                                                       | Response                                                                                                                                                                      |
| ------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/diagrams/{id}/versions?kind=&limit=&cursor=`        | viewer | —                                                                                             | `{ items: VersionMeta[], nextCursor }`                                                                                                                                        |
| `POST /api/diagrams/{id}/versions`                            | editor | `{ kind: 'named', label (1–120), description? }` or `{ kind: 'auto', reason: 'session_end' }` | `201 VersionMeta`; `200 { deduplicated: true, version: VersionMeta }` when content equals latest version (for `named`, the latest version is labelled instead of duplicating) |
| `GET /api/diagrams/{id}/versions/{v}`                         | viewer | —                                                                                             | `VersionMeta & { content }`                                                                                                                                                   |
| `PATCH /api/diagrams/{id}/versions/{v}`                       | editor | `{ label?, description? }` — naming an `auto` version turns it `named` (exempt from pruning)  | `VersionMeta`                                                                                                                                                                 |
| `POST /api/diagrams/{id}/versions/{v}/restore`                | editor | header `If-Match` optional                                                                    | `200 { diagram: { id, revision, updatedAt }, version: VersionMeta /* kind 'restore' */, preRestoreVersion?: VersionMeta }`                                                    |
| `GET /api/diagrams/{id}/versions/{v}/diff?against=head\|{v2}` | viewer | —                                                                                             | `VersionDiff`                                                                                                                                                                 |

```ts
type VersionMeta = {
  id: string;
  number: number;
  kind: "auto" | "named" | "restore" | "pre_restore";
  label: string | null;
  description: string | null;
  createdAt: string;
  createdBy: { id: string; name: string } | null;
  createdVia: "web" | "api" | "agent" | "system";
  sizeBytes: number;
  elementCount: number;
  connectionCount: number;
  restoredFrom: { id: string; number: number } | null;
};
type EntityChange = {
  id: string;
  kind: "element" | "connection" | "layer" | "group";
  change: "added" | "removed" | "changed";
  fields?: string[]; /* JSON paths, e.g. 'position.x', 'data.label' */
};
type VersionDiff = {
  from: { id; number };
  to: { id; number } | "head";
  changes: EntityChange[];
  summary: { added: number; removed: number; changed: number };
};
```

No `DELETE` on versions (immutable; pruning is system-only — Q-V3).

**As built (slice 2):**

- Shipped: `GET/POST /versions`, `GET/PATCH /versions/{v}`, `POST /versions/{v}/restore` (the restore path is the one above, not a top-level `/restore`). `GET .../diff` is slice 8. `{v}` is the integer `version_number`; malformed -> 400.
- `POST /versions` accepts only `kind: 'named'` (or no `kind`); `kind: 'auto'` is accepted only as `{ kind: 'auto', reason: 'session_end' }` (slice 3: snapshots the saved head if it differs from the latest version, throttle skipped, 6/min per user and diagram, `201 VersionMeta` or `200 { deduplicated: true, version }`); any other `auto` body is 400. Label is trimmed, 1-120 chars; description <= 2000 chars (blank -> null). Identical content to the latest version -> `200 { deduplicated: true, version }`: an `auto`/`named` latest version is promoted to `named` with the new label (an existing name is replaced); a `restore`/`pre_restore` latest keeps its kind and only gains the label.
- `PATCH` accepts only `label` / `description` (anything else, including `content` or `kind`, is 400). A named version cannot lose its label; naming an `auto` version needs a label. Action: `version.create` (editor).
- `POST .../restore`: `If-Match` optional; stale -> `409 REVISION_CONFLICT` with `current`. Restoring a version whose content already equals the head is a no-op: `200 { unchanged: true, diagram, version }` (no versions written, no audit event). A source whose content no longer passes content validation -> `422 VERSION_CONTENT_INVALID`. Success sets the `ETag` to the new revision and writes an audit log line (`AUDIT {...}`, `lib/audit.js`) until `audit_events` exists (slice 5).
- `createdBy` is `null` for system-created versions, otherwise `{ id, name }` where `id` may be `null` for legacy rows without a user id (name falls back to `created_by`).
- Lists send `Cache-Control: no-store`; `nextCursor` is opaque (base64url of the last number returned).

## 4. Comments (B)

| Method & path                                                                            | Role                                    | Request                                | Response                                                                                                          |
| ---------------------------------------------------------------------------------------- | --------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `GET /api/diagrams/{id}/threads?status=open\|resolved\|all&anchorTarget=&limit=&cursor=` | viewer                                  | —                                      | `{ items: Thread[], nextCursor }` (each with comments, newest 20; `anchorState` computed against current content) |
| `POST /api/diagrams/{id}/threads`                                                        | commenter                               | `{ anchor: Anchor, body (1–10000) }`   | `201 Thread`                                                                                                      |
| `GET /api/diagrams/{id}/threads/{t}`                                                     | viewer                                  | —                                      | `Thread` with all comments                                                                                        |
| `PATCH /api/diagrams/{id}/threads/{t}`                                                   | commenter                               | `{ status: 'open'\|'resolved' }`       | `Thread`                                                                                                          |
| `POST /api/diagrams/{id}/threads/{t}/comments`                                           | commenter                               | `{ body }` (reopens a resolved thread) | `201 Comment`                                                                                                     |
| `PATCH /api/diagrams/{id}/comments/{c}`                                                  | commenter + author                      | `{ body }`                             | `Comment`                                                                                                         |
| `DELETE /api/diagrams/{id}/comments/{c}`                                                 | author, or owner (`comment.delete_any`) | —                                      | `204` (soft delete)                                                                                               |

```ts
type Anchor =
  | { type: "canvas"; x: number; y: number }
  | {
      type: "element" | "connection";
      targetId: string;
      x: number;
      y: number /* offset */;
      fallbackX: number;
      fallbackY: number;
    };
type Thread = {
  id;
  diagramId;
  anchor: Anchor;
  anchorState: "attached" | "detached" | "canvas";
  status: "open" | "resolved";
  resolvedBy?;
  resolvedAt?;
  createdBy;
  createdAt;
  createdAtRevision;
  lastActivityAt;
  comments: Comment[];
  commentCount: number;
};
type Comment = {
  id;
  threadId;
  author: { id; name; image } | null;
  body: string /* '' if deleted */;
  createdVia: "web" | "api" | "agent";
  createdAt;
  editedAt?;
  deleted: boolean;
};
```

## 5. Sharing & permissions (C)

| Method & path                                      | Role                              | Request                                                                                    | Response                                                                                                                                                                 |
| -------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/diagrams/{id}/access`                    | editor (`share.read`)             | —                                                                                          | `{ owner: UserRef, members: [{ user: UserRef, role, grantedBy, createdAt }], invitations: [{ id, email, role, status, expiresAt }], links: LinkMeta[] }`                 |
| `POST /api/diagrams/{id}/shares`                   | `share.manage`                    | `{ email, role: 'viewer'\|'commenter'\|'editor', message? (≤500) }`                        | `201 { result: 'granted', member }` (active account) or `201 { result: 'invited', invitation }` (no/pending account). Sends email.                                       |
| `PUT /api/diagrams/{id}/members/{userId}`          | `share.manage`                    | `{ role }` (≤ grantor's role)                                                              | `200 member`                                                                                                                                                             |
| `DELETE /api/diagrams/{id}/members/{userId}`       | `share.manage`, or self ("leave") | —                                                                                          | `204`                                                                                                                                                                    |
| `POST /api/diagrams/{id}/invitations/{inv}/resend` | `share.manage`                    | —                                                                                          | `200` (rate-limited)                                                                                                                                                     |
| `DELETE /api/diagrams/{id}/invitations/{inv}`      | `share.manage`                    | —                                                                                          | `204` (status `revoked`)                                                                                                                                                 |
| `POST /api/invitations/accept`                     | signed-in user                    | `{ token }`                                                                                | `200 { diagramId, role }`; `403 INVITE_EMAIL_MISMATCH`; `410 GONE`                                                                                                       |
| `POST /api/diagrams/{id}/links`                    | `share.manage`                    | `{ role: 'viewer'\|'commenter', expiresAt?: ISO\|null, requiresSignIn?: boolean, label? }` | `201 { link: LinkMeta, url }` — **the token appears only in this response**                                                                                              |
| `PATCH /api/diagrams/{id}/links/{linkId}`          | `share.manage`                    | `{ expiresAt?, label? }`                                                                   | `LinkMeta`                                                                                                                                                               |
| `DELETE /api/diagrams/{id}/links/{linkId}`         | `share.manage`                    | —                                                                                          | `204` (revoke)                                                                                                                                                           |
| `GET /s/{token}` (page, not API)                   | anyone                            | —                                                                                          | Valid → sets link cookie, redirects to `/diagram/{id}`; needs sign-in → redirects to `/login?next=…`; invalid → 404 page; expired/revoked → "link no longer active" page |
| `POST /api/diagrams/{id}/transfer-ownership`       | owner                             | `{ userId }` (must be a member)                                                            | `200`; previous owner becomes `editor` (later slice)                                                                                                                     |
| `GET /api/diagrams/{id}/audit?limit=&cursor=`      | owner                             | —                                                                                          | `{ items: AuditEvent[], nextCursor }`                                                                                                                                    |
| `POST /api/admin/diagrams/{id}/support-access`     | platform admin                    | `{ reason }`                                                                               | `200` temporary viewer, audited (only if Q-S1 = recommended)                                                                                                             |

```ts
type UserRef = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
};
type LinkMeta = {
  id;
  role: "viewer" | "commenter";
  requiresSignIn: boolean;
  label: string | null;
  createdBy: UserRef;
  createdAt;
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
  useCount: number;
};
type AuditEvent = {
  id: number;
  occurredAt;
  actorType: "user" | "link" | "agent" | "admin" | "system";
  actor: UserRef | null;
  onBehalfOf: UserRef | null;
  action: string;
  target: object;
};
```

Note: `POST /shares` reveals whether an email has an active account to a user who already has `share.manage` on some diagram. Accepted trade-off (same as mainstream tools), mitigated by per-user rate limiting (Q-S8).

Link principal resolution: the link cookie is httpOnly, `Secure`, `SameSite=Lax`, scoped to the diagram, and carries the raw token; the server hashes it and looks it up on every request, so revocation/expiry takes effect immediately. If a session also exists, the effective role is `max(member role, link role)`.

## 6. AI/MCP agent surface (interface sketch, not in scope to build)

An MCP server (separate process or route) authenticates with a **personal access token** issued to a user (`api_tokens`, future) with a `roleCap` (e.g. `commenter`). Principal = `{ kind: 'agent', userId, tokenId, roleCap }`; effective role = `min(user's role on the diagram, roleCap)`. Every write records `created_via = 'agent'` and audit `actor_type = 'agent', on_behalf_of = userId`. Tools are thin wrappers over the same repository + `authorize` calls as REST:

| MCP tool                                                                       | Maps to                                                | Min role                        |
| ------------------------------------------------------------------------------ | ------------------------------------------------------ | ------------------------------- |
| `diagrams.list({ scope })`                                                     | `GET /api/diagrams`                                    | —                               |
| `diagrams.get({ id, version? })`                                               | diagram or version content                             | viewer                          |
| `diagrams.access({ id })`                                                      | `access` block of GET                                  | viewer                          |
| `versions.list({ id })` / `versions.diff({ id, from, to })`                    | §3                                                     | viewer                          |
| `versions.checkpoint({ id, label })`                                           | named version — recommended before any bulk agent edit | editor                          |
| `threads.list({ id, status, anchorTarget? })`                                  | §4 (includes `anchorState`)                            | viewer                          |
| `threads.create({ id, anchor, body })` / `threads.reply` / `threads.setStatus` | §4                                                     | commenter                       |
| `diagrams.update({ id, content, ifRevision })`                                 | `PUT` with `If-Match`                                  | editor (and `roleCap` ≥ editor) |

Sharing management is deliberately **not** exposed to agents in the first iteration (Q-AI1).
**As built (slice 4, section 4):**

- Routes: `GET/POST /threads`, `GET/PATCH /threads/{t}`, `POST /threads/{t}/comments`, `PATCH/DELETE /comments/{c}`; all wrapped with `withDiagramAuth` (actions `comment.read`, `comment.create`, `thread.resolve`, `comment.reply`, `comment.edit_own`, `comment.delete_own`; the handler additionally allows deleting others' comments when the role has `comment.delete_any`, i.e. owner). Non-members get 404, too-low roles 403.
- Edit is author-only (403 otherwise). Delete is idempotent and soft (`204`); a thread whose comments are all deleted is hidden (404 on GET, absent from lists) and cannot be replied to or resolved.
- Validation: `body` is plain text, kept verbatim, must be non-blank, no NUL; over 10 000 characters is `413 PAYLOAD_TOO_LARGE`. Anchor coordinates are finite numbers within +-1e7; `element`/`connection` anchors require `targetId` (1-128) and `fallbackX/Y`; a `canvas` anchor must not have `targetId`. `status` filter defaults to `open`; `limit` 1-100 (default 50), cursor is opaque.
- Thread/reply creation is rate limited per user (30/min, `429`). Lists send `Cache-Control: no-store`.
- `resolvedBy` is `{ id, name, image: null }`. `createdVia` is always `web` until the agent write tools exist.
