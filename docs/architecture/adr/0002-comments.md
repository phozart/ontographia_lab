# ADR-0002 — Comments (server-persisted, anchored threads)

- Status: **Proposed**
- Group: B
- Personas: CX/UX (research findings pinned to journey steps; review sessions), Solution Architect (questions on a specific service/dependency), PM (decisions and risks discussed in place), AI/MCP agent (post review findings, answer questions, resolve threads it raised).
- Primitive exposed: **comment thread anchored to a diagram element, connection, or canvas point**, with open/resolved lifecycle.

## Context

- `ui/CommentSystem.js#useComments` stores `{id, text, x, y, elementId, user, resolved, replies[]}` in `localStorage['comments-<diagramId>']`. Comments are invisible to anyone else, lost with browser data, and not tied to an identity.
- The UI already supports markers, threads, replies, resolve and delete; only persistence and identity are missing.
- Marker positions are absolute canvas coordinates, so an element-anchored comment does not follow its element.

## Real-world analogy

**Sticky notes on a printed blueprint during a design review.** A note is either stuck *onto a component* (it travels with that component if the sheet is redrawn) or stuck *on an empty area of the sheet* (it stays at that spot). Replies are written underneath. When the issue is settled the note is ticked "done" but kept in the review file. If the component is removed in a later redraw, the note does not vanish — the reviewer moves it to the margin ("this referred to the old cache service") so the discussion survives.

The review notes are **not part of the drawing**: a reviewer who may not redraw the sheet may still add notes, and redrawing does not erase notes.

## Options considered

| Option | Pros | Cons |
|--------|------|------|
| C1. Store comments inside `diagrams.content` | One fetch; versions capture them | Commenters would need content-write permission; every comment creates content churn and versions; conflicts with editors' saves; bloats real-time doc |
| **C2. Separate tables `comment_threads` + `comments` (chosen)** | Own permission (commenter role), own lifecycle, queryable across diagrams (agents: "all open threads"), no content churn | Second fetch; anchors reference content by id (soft reference) |
| C3. Generic "annotations" table for comments, tasks, reactions | Flexible | Premature; can be generalized later because threads are already a separate entity |

Anchoring:

| Option | Chosen? |
|--------|---------|
| Absolute coordinates only (status quo) | No — does not follow element |
| **Anchor = `{type: 'element' \| 'connection' \| 'canvas', targetId?, x, y}` where `x,y` is an offset from the element's origin for element anchors and absolute canvas coordinates for canvas anchors; plus `fallback_x/y` = last known absolute position (chosen)** | Yes |
| Anchor to a version | Not now — see "Relation to versions" |

## Decision

1. **Data**: `comment_threads(id, diagram_id, anchor_type, anchor_target_id, anchor_x, anchor_y, fallback_x, fallback_y, status open|resolved, resolved_by, resolved_at, created_by, created_at, created_at_revision)` and `comments(id, thread_id, author_id, body, created_at, edited_at, deleted_at, created_via)`. The first comment of a thread is a row in `comments` (no special "root" body on the thread). See [data-model.md](../data-model.md).
2. **Anchor resolution is a read-time projection**, not a stored state: on render (client) and on list (server, for agents) the anchor is resolved against current content:
   - `attached` — target id exists → marker at element origin + offset; marker follows moves/resizes.
   - `detached` — target id no longer exists → thread listed under "Detached" in the comments panel and drawn at `fallback_x/y` with a distinct style; **not auto-resolved, not deleted**. If a later edit or a version restore brings the id back, the thread re-attaches automatically.
   - `canvas` — absolute point.
   `fallback_x/y` is the absolute position at thread creation and is not kept in sync (content writes never touch comment tables — the two write paths stay independent). A detached thread primarily lives in the panel's "Detached" group; its canvas marker at the fallback point is a hint only. (Alternative: derive the last position from the newest version that still contains the element; see Q-C3.)
3. **Lifecycle**: `open → resolved → open` (reopen). Anyone with role ≥ commenter may resolve/reopen any thread (analogy: any reviewer can tick a note done; see Q-C2). Resolved threads are hidden on canvas by default, visible in the panel with a filter.
4. **Edit/delete**: authors may edit their own comment body (`edited_at` shown). Delete is **soft** (`deleted_at`, body cleared, "comment deleted" placeholder kept so replies remain coherent). Owner may soft-delete any comment (moderation). Deleting a thread = soft-deleting all its comments; a thread whose comments are all deleted is hidden.
5. **Identity**: `author_id` = `users.id`; `created_via` ∈ `web | api | agent` so agent-authored comments are visible as such (see MCP section in api-contracts.md).
6. **Mentions (later slice)**: body stays plain text; mentions are encoded as `@[display](user:<uuid>)` tokens and extracted into `comment_mentions(comment_id, user_id)` at write time. A mention of a user without access does **not** grant access; the UI offers "share with them?" (Q-C4). Notifications by email via `lib/email.js`, batched.
7. **Read/unread state (later slice)**: `comment_thread_reads(thread_id, user_id, last_read_at)`; unread = comments newer than `last_read_at`. Replaces the current `read` boolean on each message, which only makes sense for one user.
8. **Relation to versions**: comments are **not versioned** and **not restored**. Each thread stores `created_at_revision` (the diagram revision when it was opened) so the UI can offer "show the diagram as it was when this thread started" by opening the nearest version at or before that time. Restoring a version never deletes comments.
9. **Migration of localStorage comments**: on first load after release, if `localStorage['comments-<id>']` exists and the user has role ≥ commenter, the client offers a one-time import (posted through the normal create endpoints, attributed to the importing user, original timestamps not preserved), then clears the key. See Q-C1.
10. **Limits**: body ≤ 10 000 chars, plain text rendered as text (no HTML); per-user rate limit on create (reuse `lib/rateLimit.js`).

```mermaid
stateDiagram-v2
  [*] --> open: create thread (first comment)
  open --> resolved: resolve (role ≥ commenter)
  resolved --> open: reopen / reply
  note right of open: anchor state is computed at read time: attached | detached | canvas
```

Replying to a resolved thread reopens it (common expectation; Q-C2).

## Consequences

- + Commenters can participate without edit rights; comments survive edits, deletions and restores.
- + Threads are queryable across diagrams — enables "my open threads" and agent review loops.
- − Soft reference from thread to element id means referential integrity is by convention; therefore **element ids must be stable and globally unique** (ADR-0004 prerequisite P1).
- − Two fetches on editor load (content + threads). Acceptable; threads list is small and paginated server-side for large diagrams.
- − Real-time comment updates arrive with Group D; until then the client re-fetches threads on focus and every 60 s while the panel is open.
## As built — slice 4 (server comments)

- Shipped: migration `0006_comments` (data-model.md; renumbered from 0004 because 0004/0005 were taken), `lib/commentRepository.js`, the threads/comments API (api-contracts section 4 "As built"), `useComments` on the API (`components/diagram-studio/ui/useComments.js`), a "Detached comments" group, and the one-time localStorage import prompt.
- **Attachment is derived at read time, no restore hook.** `anchorState` is computed from the diagram's _current_ content ids: server side in `listThreads`/`getThread` (ids only, via `jsonb_array_elements`, never the whole content) and client side in `resolveMarker` (the marker position follows the element). Deleting an element, or a version restore that removes it, detaches its threads; a later edit or restore that brings the id back re-attaches them. Nothing is written to the comment tables by content writes or restores, so the two write paths stay independent and there is no restore code to keep in sync. Cost: one small extra query per list.
- Anchors created through the API are not checked against content (an autosave may not have reached the server yet when the first comment is posted); a bogus `targetId` simply reads as `detached`.
- Connection anchors are supported by the API and anchor-state logic; the UI creates `canvas` and `element` anchors only (a connection thread is drawn at its fallback position).
- The thread list returns the newest 20 comments of each thread plus `commentCount`; the editor loads the full thread when it is opened.
- Q-C1 import: offered to users who can comment; posts through the normal endpoints as the importer (replies and resolved state kept, timestamps not preserved), then clears the key. A failed import keeps the key (a retry can duplicate threads that were already posted). "Discard" clears the key without importing.
- Q-C2: any role >= commenter resolves/reopens; a reply reopens. Q-C3: detached threads are listed in the "Detached comments" group and drawn faded/dashed at their creation position. Q-C4/C5 (mentions, notifications) are slice 9, not built.
- Rate limit: 30 thread/reply creates per user per minute (in-memory `lib/rateLimit`, per instance).
- Existing bugs fixed on the way: canvas comment clicks never carried an element id (`dataset.elementId` vs `data-node-id`), and the context-menu "Add comment" passed a screen position object as canvas x.
