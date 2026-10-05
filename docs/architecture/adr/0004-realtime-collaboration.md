# ADR-0004 — Real-time collaboration (decision record + prerequisites)

- Status: **Proposed — direction only**. Full design happens after Groups B and C ship.
- Group: D
- Personas: PM and Solution Architect co-editing in workshops; CX/UX running live mapping sessions; AI/MCP agent editing alongside humans without clobbering them.
- Primitive exposed: **shared live document per diagram** + **presence/awareness** (who is here, their cursor/selection).

## Context

- Hosting: one server (`lab.ontographia.com`), nginx → one Node process (Next.js standalone `server.js`), PostgreSQL 16 on the same host. No Redis, no managed services.
- Content is one JSONB blob; writes are whole-blob PUTs (ADR-0003 §7 adds revision preconditions as the interim safety net).
- Element/connection ids are client-generated strings.

## Real-world analogy

**A shared whiteboard in one room** vs **mailing a document around**. Today we mail the whole document and the last envelope to arrive wins (ADR-0003 adds "reject if someone mailed a newer one"). Real-time is everyone at the same whiteboard: each person moves their own sticky notes; two people grabbing the same note is rare and resolved by "last hand wins" *for that note's property*, not for the whole board. The board also shows who is standing where (presence).

So the unit of merging must be **an element's property**, not the document.

## Options

| Option | How | Fit for one Node server + PG | Risks |
|--------|-----|------------------------------|-------|
| **D1. Yjs CRDT + WebSocket provider (Hocuspocus, MIT) as a sidecar Node process; Y updates persisted in PostgreSQL; JSON snapshot materialized into `diagrams.content`** | Clients hold a Y.Doc; per-element Y.Maps merge automatically; awareness protocol gives presence | Good: single extra process, no new infra; nginx proxies `/collab` with WebSocket upgrade | CRDT doc grows (tombstones) → periodic compaction; JSON ↔ Y mapping layer to maintain; undo must move to `Y.UndoManager` |
| D2. Server-authoritative op log (Figma-style: server sequences property-level ops, LWW per property, clients rebase pending ops) | Custom protocol over WebSocket; `diagram_ops` table | Good | We'd build and maintain the protocol, offline handling, presence, reconnection — all of which Yjs already provides |
| D3. Hosted (Liveblocks, PartyKit, Ably, etc.) | Vendor SDK, vendor storage | No server work | Recurring cost, diagram content leaves our infrastructure, vendor coupling of the core data path; contradicts single-server hosting |
| D4. Stay with REST + revision preconditions + polling | No new runtime | Trivial | Not real-time; conflicts surface as 409s |

## Decision (direction)

**D1 — Yjs + Hocuspocus sidecar**, introduced after B and C:

- Y.Doc layout: `elements: Y.Map<id, Y.Map>`, `connections: Y.Map<id, Y.Map>`, `layers`, `groups` likewise; z-order as a fractional-index property per element (not array position) so concurrent reorders merge.
- The sidecar authenticates with a **short-lived collab ticket** issued by `POST /api/diagrams/{id}/collab-ticket` (signed, ~60 s, contains `userId`, `diagramId`), then calls the same `authorize(principal, diagramId, action)` from `lib/authz` on connect; viewers/commenters join read-only (server drops their updates). Role changes/revocations are pushed via PostgreSQL `LISTEN/NOTIFY` (`authz_changed` channel) so the sidecar disconnects or downgrades sessions immediately.
- Persistence: Y updates appended to `diagram_yupdates`; compacted into a snapshot periodically; on idle (e.g. 2 s debounce) the sidecar materializes JSON into `diagrams.content` through the **same server-side write path** that bumps `revision` and creates throttled versions (ADR-0001) — so REST reads, exports, versions, comments' anchor resolution and MCP keep working unchanged.
- REST `PUT content` remains for non-live clients (agents, imports); it is applied to the Y.Doc as a replace-by-id diff by the sidecar (detailed design later).
- D4 (revision preconditions) is the interim state and remains the fallback if the sidecar is down.

## Prerequisites B and C must get right now (so D isn't blocked)

| # | Prerequisite | Where |
|---|--------------|-------|
| P1 | **Ids stable and globally unique** for elements, connections, layers, groups (use `crypto.randomUUID()`; ids never rewritten on save/load; replace `el_<ms>_<idx>` / `frame_<ms>` patterns). Comment anchors and diffs depend on it too. | slice 0 ✓ — new ids are `<prefix>-<uuid v4>` (the prefix keeps ids valid in CSS/SVG selectors and readable); the legacy patterns remain only in already-stored data |
| P2 | **Content model is a set of entities keyed by id**, no derived global state that must be recomputed on every edit; ordering expressed as a property, not array position (can start by adding `z` alongside array order). | slice 0 (note), D |
| P3 | **Per-viewer state out of shared content**: `viewport` moves to per-user state (`user_settings` keyed by diagram) — shared content must not change when someone pans. | slice C-UI |
| P4 | **Annotations separate from content** (comments in their own tables). | ADR-0002 ✓ |
| P5 | **Versions created server-side** in the content write path, not by the client. | ADR-0001 ✓ |
| P6 | **`authorize()` is framework-free** (no `req/res`, no Next imports) and accepts non-session principals (ticket, agent). | ADR-0003 ✓ |
| P7 | **`revision` counter** on `diagrams`; every write path bumps it. | ADR-0003 §7 ✓ |
| P8 | **Grant changes emit an event** (`audit_events` insert + `NOTIFY authz_changed`) from one repository function, so a socket server can react. | ADR-0003 slice |
| P9 | nginx config allows WebSocket upgrade on a dedicated path; process manager can run a second Node process. | ops, at D |

## Consequences

- + Proven merge semantics and presence with no new infrastructure beyond one Node process.
- + B/C artifacts (versions, comments, grants, audit) need no redesign.
- − A second runtime to deploy and monitor; Y.Doc ↔ JSON mapping is new code to test thoroughly.
- − Local undo/redo moves to `Y.UndoManager` (per-user undo) — a visible behaviour change.
- Open: whether to support offline editing (Yjs allows it; product decision, Q-R1).
