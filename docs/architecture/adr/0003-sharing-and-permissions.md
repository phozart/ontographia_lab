# ADR-0003 — Sharing and permissions

- Status: **Proposed**
- Group: C
- Personas: all. Solution Architect shares landscape maps across organisational boundaries (viewer/commenter for other teams); CX/UX shares journeys with stakeholders for review (commenter); PM co-edits plans (editor); AI/MCP agent acts with a delegated, capped role.
- Primitives exposed: **role** (ordered capability set), **grant** (principal → role on a resource), **share link** (bearer capability), **invitation** (pending grant for an email), **audit event**, and **one authorization function** usable by every server surface.

## Context

- Access today = `role==='admin'` or `diagrams.created_by === session email`, re-implemented in each route via `diagramRepository.checkAccess` (`lib/diagramRepository.js`), after `requireActiveUser` (`lib/useAuth.js`).
- `diagram_shares(shared_with VARCHAR, permission 'view'|'edit'|'admin')` exists, unused, keyed by a free-text name rather than a user id.
- Accounts require admin approval (`users.status = 'pending'` until approved). Any invite flow interacts with this gate.
- The editor already has a read-only mechanism (`profile.editingPolicy.readOnly`, `PROFILE_EMBEDDED_READONLY`).
- `domain_id` / `project_id` columns exist on `diagrams` for future grouping; not used.
- An SMTP transport is being added in `lib/email.js` (interface assumed: `sendEmail({to, subject, text, html})` — to be confirmed).

## Real-world analogy

**A house with keys and a guest list.** The owner holds the deed (exactly one owner). Named people get **keys cut for them** (grants) — a key for the front door only (viewer), one that also opens the study where the visitors' book lies (commenter), or a full key (editor). Keys are listed in a register and can be taken back. A **spare key under the doormat** (share link) lets in whoever finds it — you choose which doors it opens, and you can change the lock (revoke) at any time. An **invitation letter** is addressed to a named person: someone else holding the letter can't use it. The **visitors' book** records who was given or lost a key (audit). Later, the house may sit in an **apartment block** (workspace/project) whose residents get access by membership — a different key source, same doors.

This drives: ordered roles, multiple grant sources resolved to one effective role, links as revocable bearer capabilities, email-bound invitations, and an append-only audit.

## Options considered

### Role model
| Option | Notes |
|--------|-------|
| Binary (owner/admin only) — status quo | Blocks every collaboration story |
| **Ordered roles `viewer < commenter < editor < owner` with a fixed capability matrix (chosen)** | Matches user mental model (Docs/Figma/Miro); one comparison per check |
| Fine-grained ACL per action per user | Over-engineered now; the capability matrix is the extension point if custom roles are ever needed |

### Where enforcement lives
| Option | Notes |
|--------|-------|
| Per-route checks (status quo) | Drifts; easy to miss one route |
| PostgreSQL row-level security | Strong, but the app uses one DB role and raw SQL; RLS needs per-request `SET` and makes debugging harder — revisit if a second service writes to the DB directly |
| **One authorization module `lib/authz/` with a pure policy + a role resolver, wrapped for API routes (chosen)** | Framework-free, reusable from the socket server (ADR-0004) and MCP server |

### Link sharing
| Option | Notes |
|--------|-------|
| Public flag on the diagram | Not revocable without unpublishing; one link only |
| Signed stateless token (JWT/HMAC with expiry) | Cannot revoke individually without a denylist → becomes stateful anyway |
| **Random opaque token, stored hashed in `diagram_links`, with role, optional expiry, revocation (chosen)** | Revocation is immediate (looked up per request); multiple links per diagram (e.g. "review link for Team X") |

## Decision

### 1. Roles and capability matrix

| Action | viewer | commenter | editor | owner |
|--------|:-:|:-:|:-:|:-:|
| `diagram.read`, `diagram.export`, `version.read`, `comment.read` | ✓ | ✓ | ✓ | ✓ |
| `comment.create`, `comment.reply`, `thread.resolve`, `comment.edit_own`, `comment.delete_own` | | ✓ | ✓ | ✓ |
| `diagram.write` (content, name, description, tags), `version.create`, `version.restore` | | | ✓ | ✓ |
| `share.read` (see who has access) | | | ✓ | ✓ |
| `share.manage` (grant/change/revoke ≤ own role, invite, links) | | | ✓ see Q-S3 | ✓ |
| `comment.delete_any`, `diagram.delete`, `ownership.transfer`, `audit.read` | | | | ✓ |

The matrix lives in one file (`lib/authz/policy.js`) as data; it is the single place to change.

### 2. Principals and effective role

```ts
type Principal =
  | { kind: 'user';  userId: string; platformRole: 'user'|'admin'; status: 'active' }
  | { kind: 'link';  linkId: string; userId?: string }          // userId set when a signed-in user arrives via link
  | { kind: 'agent'; userId: string; tokenId: string; roleCap: Role } // MCP, future
```

`resolveRole(principal, diagramId)` = **max** over grant sources, then capped:
1. owner (`diagrams.owner_id`),
2. direct membership (`diagram_members`),
3. share link (`diagram_links`, not revoked, not expired) — only if the request carries that link token,
4. *(future)* project/workspace membership — added as another source, no change to callers,
5. agent: `min(role from 1–4 for userId, roleCap)`.

**Platform admins** do not get an implicit role on every diagram (see Q-S1, recommended): they keep user-management powers; access to someone else's diagram is an explicit, audited "support access" action granting temporary `viewer`. If the product owner prefers today's behaviour, it is one source in the resolver and every use is audited.

### 3. The single authorization function

```ts
// lib/authz/index.js — no req/res, no Next.js imports
authorize(principal: Principal, diagramRef: string /* uuid | LAB-n */, action: Action)
  : Promise<{ diagram: DiagramMeta; role: Role; source: GrantSource; capabilities: Action[] }>
// throws AuthzError { status: 404 | 403, code }
```

- **404 `NOT_FOUND`** when the diagram does not exist *or* the principal has no role at all (do not reveal existence).
- **403 `FORBIDDEN`** when the principal has a role but not the required action (e.g. viewer tries to save).
- API wrapper: `withDiagramAuth(action, handler)` → resolves principal from session (or link cookie), calls `authorize`, passes `{principal, diagram, role}` to the handler. Every diagram-scoped route uses it; a unit test enumerates `pages/api/diagrams/**` and fails if a handler is not wrapped.
- The same `authorize` is called by the collab socket server on connect (ADR-0004) and by the MCP server per tool call.

### 4. Sharing with a person

- **Existing active user** (email matches `users.email`): grant is created immediately in `diagram_members`; a notification email is sent (best effort). No accept step (Docs-style).
- **Email without an account, or a pending account**: a `diagram_invitations` row is created (email, role, inviter, token hash, expires in 14 days) and an invite email with a single-use link is sent. Accepting requires a signed-in session **whose email matches the invitation email** (case-insensitive); the token alone is not enough, so forwarded invitations don't leak access. On accept → `diagram_members` row, invitation marked accepted.
- **Approval gate interaction**: whether accepting an invitation auto-activates a pending account is a product decision (Q-S2; recommended: yes, the inviter vouches; audit records it).
- Grantors can grant at most their own role; only the owner can grant `editor` if Q-S3 resolves to "editors can share as viewer/commenter only".
- Limits: max members per diagram and invites per day per user (Q-P1); rate-limited.

### 5. Share links

- Token: 32 random bytes, base64url; only `sha256(token)` is stored. URL `/s/{token}`.
- Link role: `viewer` or `commenter` (never `editor` or `owner` — Q-S4). Commenting via link requires sign-in so comments have an author.
- Options: `expires_at` (default 30 days, "never" allowed — Q-S5), `requires_sign_in` (default **true**; anonymous view only if the instance setting `ALLOW_ANONYMOUS_LINKS` is enabled — Q-S6), label.
- Flow: `GET /s/{token}` (page) → server validates → sets an httpOnly, `SameSite=Lax`, `Secure`, path-scoped cookie carrying the token for that diagram → redirects to `/diagram/{id}`. Each API call re-validates the link row, so revocation/expiry is effective on the next request.
- Opening a link never creates a membership (the "key under the doormat" stays a doormat key). Owners see link usage (last used, use count) not visitor identities, unless the visitor is signed in (then `audit_events` records `link.used` with the user id — Q-A1).

### 6. UI surfacing

- `GET /api/diagrams/{id}` adds `access: { role, source, capabilities[] }`.
- The editor maps capabilities to the existing profile mechanism: no `diagram.write` → `editingPolicy.readOnly = true`, autosave disabled, a "View only" / "Can comment" pill in the top bar, comment tool enabled iff `comment.create`.
- Server always enforces; the UI only reflects.
- Share dialog (owner/editor): people with access (role dropdown, remove), pending invitations (resend/revoke), links (create, copy, expiry, revoke).
- Dashboard: "Shared with me" section (metadata only, no `content`).

### 7. Concurrency with more than one editor (needed before Group D)

- Add `diagrams.revision BIGINT` incremented on every content write.
- `PUT /api/diagrams/{id}` accepts `If-Match: "<revision>"` (or `baseRevision` in the body). Mismatch → **409 `REVISION_CONFLICT`** with the current revision and `updated_by`. Client shows "Someone else changed this diagram" with *Reload* or *Save my version as a copy*.
- Precondition is optional during rollout (old tabs keep working), then required once the client always sends it.
- Lightweight presence ("Alice is also editing") is deferred to Group D.

### 8. Audit

Append-only `audit_events(actor_type user|link|agent|admin|system, actor_user_id, on_behalf_of, action, diagram_id, target jsonb, created_at)`.
Logged: `share.grant|change|revoke`, `invite.send|accept|revoke`, `link.create|revoke|used` (signed-in only), `version.restore`, `diagram.delete`, `ownership.transfer`, `admin.support_access`. Not logged: content edits (versions cover them), reads (volume). Owner sees a diagram's sharing activity in the share dialog; admins see all. Retention: Q-A2.

### 9. Future workspaces/projects (not built)

`domain_id`/`project_id` stay as-is. When workspaces arrive they become an additional grant source in `resolveRole` (`workspace_members`, `project_members`) and a default-role field on the container — no changes to `authorize` callers, grant tables, or links. Ownership might later move from user to workspace (Q-S7) — `owner_id` stays a user for now.

## Consequences

- + One enforceable choke point; policy is data; reusable by socket and MCP servers.
- + Links are revocable and least-privilege; invitations can't be forwarded.
- − Every diagram-scoped request does 1–2 extra indexed lookups (members, link). Acceptable; can be cached per request.
- − Migration: backfill `owner_id` from `created_by`; replace `diagram_shares` (unused) with `diagram_members` + `diagram_links`; existing list/get/put/delete routes move to the wrapper (behaviour-preserving for owners).
- − Behaviour change if Q-S1 = "no implicit admin access" — admins lose silent access to all diagrams.

## As built (slice 5: sharing with existing users)

- **Grant source:** `diagram_members` is the second source in `lib/authz/index.js` (`source: 'member'`), skipped when the user is the owner. A row whose role is unknown or `owner` grants nothing; a database error propagates (500), never access. MCP tokens are capped with `min(role, roleCap)` and still honor the diagram allowlist for shared diagrams.
- **Rules (`lib/authz/policy.js`):** `canGrant(actor, role)` and `canModifyMember(actor, current, next|null)`. Owner grants/changes/revokes anything except `owner`; editors only viewer/commenter and cannot touch editors (Q-S3). The owner is never a member row: `409 OWNER_IMMUTABLE` on PUT/DELETE of the owner. Members can leave (DELETE on themselves) at any role.
- **Race safety:** role change and revoke are compare-and-set on the role the actor was authorized against (`409 CONFLICT` on a miss), so a concurrent change cannot widen an actor's reach.
- **Share by e-mail:** active accounts only (`404 USER_NOT_FOUND` for unknown or pending/suspended accounts, Q-S8), 20 attempts per user per hour counted per attempt (in-process limiter, like the other limiters), `409 ALREADY_MEMBER` / `ALREADY_OWNER`. Invitations are slice 7.
- **Revocation is immediate:** every request re-reads membership; there is no per-request cache. `NOTIFY authz_changed` is emitted by the same SQL statement as the write, payload `{diagramId, userId, change: grant|role|revoke, role}` (no e-mail addresses), for the future real-time server.
- **Audit:** `audit_events` rows are written for `share.grant|change|revoke` (self-leave marked `self: true`) and `version.restore`; ids only in `target`, no e-mails or IPs. Writes never fail the request (a failed insert logs `AUDIT_FAILED {...}`). `GET /audit` is owner-only. Retention (365 days, Q-A2) is not implemented yet.
- **Editor UI:** the server `access` block drives the mode: no `diagram.write` -> read-only profile, no save/autosave, "View only" pill; `comment.create` without write -> "Can comment" pill and the comment tool; the Share button shows for `share.read` (owner/editor).
- **Owner decisions (2026-10-07), as built:** (a) viewers may duplicate (`diagram.read`); (b) editors may change/revoke viewer and commenter members regardless of who granted them (`granted_by` is informational); (c) the owner's e-mail is not exposed to members: "Shared with me" (`listSharedWith`), `GET/PUT /api/diagrams/{id}` (`created_by`/`updated_by` reduced to the local part for non-owners, including the 409 `updatedBy`) and version authors return the name, falling back to the e-mail local part; the access list (owner/editor) keeps full addresses; (d) a grant made by an editor persists after that editor is removed or their account deleted (`granted_by` becomes null). `/members/{userId}` lowercases the id before comparing, so the owner (409) and self-leave checks hold for uppercase UUIDs.
- **Client-side read-only is enforced twice:** the UI guards palette drop/click-to-place, templates, command palette and the contextual toolbar when the profile is read-only, and `DiagramContext` refuses every local mutator (add/update/remove element and connection, layers, groups, delete/duplicate, undo/redo) without `diagram.write`, so no local-only state can exist. The server remains the authority (403).
- **Access changed while the editor is open:** a save answered 403/404 stops autosave, re-reads `GET /api/diagrams/{id}` (404/403 = access removed, otherwise the new role), switches the editor to read-only/comment mode and shows "Your access to this diagram changed" / "was removed" (no retry loop, no unhandled error). Unsaved local edits stay on screen but cannot be saved.
- **Accepted risk (TOCTOU):** authorization reads the actor's role once at request start. A concurrently demoted or revoked editor whose request is already past that check can complete that one write; the next request is denied. Accepted: the window is one request, and revocation stays compare-and-set where it matters (role changes).
