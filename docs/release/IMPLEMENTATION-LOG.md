# Implementation log

One entry per merged slice of [docs/architecture/delivery-plan.md](../architecture/delivery-plan.md): PR title, slice/ADR references, branch, files changed, test result.
This is separate from the historical (Gate 6, aspirational) `CHANGELOG.md`.

---

## Slice 0 — Foundations

- **PR title:** `feat: slice 0 foundations - single PUT per save, uuid ids, migration runner`
- **Refs:** delivery-plan slice 0; ADR-0001 (prerequisite: single PUT before snapshots), ADR-0004 prerequisite P1 (stable unique ids), data-model.md §1 + `0001_baseline`.
- **Branch:** `feat/slice-0-foundations`
- **What changed**
  - **Single PUT per save.** `DiagramContext.saveDiagram` is the only writer. The editor page (`pages/diagram/[id].js`) no longer passes an `onSave` that issued a second PUT with `{elements, ..., diagram: <row>}` (that write nested a full copy at `content.diagram.content` and dropped `viewport`). Stored shape: `{elements, connections, layers, groups, viewport}`.
  - **Normalize on read.** New pure, idempotent `components/diagram-studio/migrations/normalizeContent.js` (`normalizeDiagramContent`) handles legacy `nodes`/`edges` and the nested double-write shape (recovers `viewport` from the nested copy). Used by `DiagramContext.setDiagram` and the save path. `createDiagram` default content is now canonical.
  - **Stable unique ids.** New `components/diagram-studio/utils/ids.js` (`generateId(prefix)` -> `<prefix>-<uuid v4>`; `crypto.randomUUID`, with `getRandomValues` fallback for non-secure contexts). All diagram-id generators replaced (context add/duplicate/group/layer, clipboard paste/duplicate, canvas create/sticky, drawing layer, frame copy, starter packs, template instantiate, pack registry). Existing ids untouched. Comment ids (ADR-0002 replaces them) and template/profile ids are out of scope.
  - **Migrations.** `db/migrations/0001_baseline.sql` (idempotent; safe on empty, `init.sql`-created and pre-ledger production DBs), `scripts/migrate.js` (ledger `schema_migrations` with sha256 checksums, advisory lock, per-file transaction), `npm run db:migrate` / `db:migrate:status`, `prestart` hook, `db:setup` includes migrate, Dockerfile copies the runner + migrations and runs `node scripts/migrate.js && exec node server.js`. `lib/db.js#runMigrations` removed. `init.sql` and `docker-compose.yml` unchanged.
- **Deviations from the docs:** none in intent. Details recorded in data-model.md ("As built"): connection retry, `status` command, checksum check before any apply, files may not contain `BEGIN`/`COMMIT`. `viewport` stays in shared content in this slice (ADR-0004 P3 moves it to per-user state in a later slice); note the editor never wrote a live viewport there, it only round-trips the stored value (default `{x:0,y:0,zoom:1}`).
- **Files changed:** `.gitignore`, `Dockerfile`, `package.json`, `README.md`, `db/migrations/0001_baseline.sql`, `scripts/migrate.js`, `lib/db.js`, `lib/diagramRepository.js`, `pages/diagram/[id].js`, `components/diagram-studio/{DiagramContext,DiagramStudio,DiagramCanvas,DrawingLayer}.js`, `components/diagram-studio/{hooks/interaction/useClipboard,packs/PackRegistry,templates/TemplateManager,ui/ContextualToolbar}.js`, `components/diagram-studio/utils/ids.js`, `components/diagram-studio/migrations/normalizeContent.js`, `docs/architecture/{README.md,data-model.md,adr/0004-realtime-collaboration.md}`, `docs/release/IMPLEMENTATION-LOG.md`; tests: `__tests__/components/diagram-studio/{normalizeContent,ids,savePath}.test.js`, `__tests__/pages/diagramEditorSave.test.js`, `__tests__/scripts/migrate.test.js`, `__tests__/e2e/diagram-studio.test.js` (section 9).
- **Tests:** unit 271/271 (baseline 236 + 35 new; the DB-backed migrate tests create and drop their own throwaway databases and are skipped when no database is configured); e2e 32/32 (31 + new "one save = one PUT" assertion via request interception); `npm run lint` 0 errors; `next build --webpack` OK. Runner also verified against the local dev DB (existing data, pre-ledger) and a simulated container layout (standalone output + copied runner).
---

## Slice 1 — Authorization core + revision (+ server-side content validation)

- **PR title:** `feat: slice 1 authorization core, revision / If-Match, server-side content validation`
- **Refs:** delivery-plan slice 1; ADR-0003 sections 1-3 and 7; api-contracts sections 1-2; data-model `0002`; open-questions Q-S1, Q-S3, Q-M1 (accepted defaults).
- **Branch:** `feat/slice-1-authz`
- **What changed**
  - **`lib/authz/`** — `policy.js` (role ladder viewer < commenter < editor < owner and the single action -> minimum-role table; `can`, `capabilitiesFor`, `maxRole`, `minRole`; deny by default), `index.js` (framework-free `authorize` / `resolveRole` / `AuthzError`; metadata only, never `content`; grant sources are a list so members/links/support-access slot in later), `next.js` (`withDiagramAuth`, `withUserAuth`; 405 for unmapped methods; handlers are tagged so a test can find unwrapped ones). No role -> 404 `NOT_FOUND` (same body as a missing diagram); role below the action -> 403 `FORBIDDEN`.
  - **Every handler under `pages/api/diagrams/**`** (`index.js`, `[id].js`, `[id]/duplicate.js`) is wrapped; `__tests__/authz/handlersWrapped.test.js` enumerates the folder and fails on any unwrapped default export (new routes are picked up automatically).
  - **Q-S1:** platform admins have no implicit access. `findAll` is scoped to `owner_id = <caller>` for everyone, so the admin dashboard lists the admin's own diagrams only. `checkAccess` is removed.
  - **Revision.** `GET /api/diagrams/{id}` returns `access {role, source, capabilities[]}`, numeric `revision` and an `ETag`. `PUT` honours an optional `If-Match` (quoted or bare) through an atomic compare-and-set `UPDATE`; stale -> 409 `REVISION_CONFLICT` with `current {revision, updatedAt, updatedBy}`; success increments `revision` and sets `updated_by`. A PUT whose body is only `thumbnail` (background preview refresh) needs `diagram.write`, ignores `If-Match` and does not touch `revision`/`updated_at`/`updated_by`, so it can never cause a false 409.
  - **Editor.** `DiagramContext.saveDiagram` sends `If-Match` and, on 409, pauses autosave and shows `SaveConflictDialog` ("Reload latest" / "Save my version as a copy").
  - **Server-side content validation** (`lib/diagramContent.js`, caps in `lib/diagramLimits.js`, URL allow-list moved to `lib/safeUrl.js` and re-exported for the client): canonical top-level keys only, array/object shapes, count caps (5000 elements, 10000 connections, 1000 layers/groups), depth <= 24, no `__proto__`/`constructor`/`prototype` keys at any depth, 5 MB content cap; violations -> 400 `VALIDATION_FAILED` (413 `PAYLOAD_TOO_LARGE` for size); unsafe URL-valued fields are stripped and reported in `warnings`. Applied to `POST /api/diagrams` and `PUT /api/diagrams/{id}`; routes raise the body-parser limit to 6.25 MB so the 5 MB cap is reachable.
  - **Migration `0002_diagram_identity_and_revision`.** `revision`, `version_seq`, `updated_by`; `owner_id` backfill from `created_by` (case-insensitive); unmatched rows -> `ADMIN_EMAIL` account (else the oldest admin) and listed in the migration output; `idx_diagrams_owner_updated`. Additive and idempotent. `scripts/migrate.js` now passes `ADMIN_EMAIL` as the transaction-local setting `app.admin_email` and prints `RAISE NOTICE` output.
- **Deviations from the docs:** (1) oversized content answers 413 (api-contracts) rather than 400. (2) Unsafe URLs are stripped with `warnings`, not rejected (a rejected autosave would lose work). (3) `[id].js` stays a single file instead of moving to `[id]/index.js` (Next serves `[id].js` next to `[id]/duplicate.js`). (4) `If-Match` only; the `baseRevision` body alternative from ADR-0003 is not implemented. (5) `owner_id IS NULL` (only possible when no admin exists at migration time) means nobody can open the diagram.
- **Tests:** policy matrix (every role x every action), `authorize`, wrapper, every endpoint row (owner / non-owner / admin / unauthenticated / 405 / malformed id), content validation per rule, thumbnail-between-saves, conflict dialog, migration 0002 on throwaway databases (including backfill, admin fallback, no-admin, idempotence).
- **Follow-ups (review):** duplicate now validates and sanitizes source content (400 / 413, `warnings`); `tags` / `description` / `isTemplate` validated on create and update (`lib/diagramMetadata.js`); URL stripping broadened to blocked schemes (`javascript:`, `vbscript:`, non-image `data:`) under any key, prose like "javascript: the good parts" untouched. **Operator:** diagrams with `owner_id IS NULL` after `0002` (UNASSIGNED in its output) are inaccessible; fix with `UPDATE diagrams SET owner_id = '<user-uuid>' WHERE owner_id IS NULL;` after verifying the list.

---

## Slice 2 — Named versions + restore

- **PR title:** `feat: slice 2 named versions + restore (History panel)`
- **Refs:** delivery-plan slice 2; ADR-0001 decisions 1, 3-5, 7 (as-built note appended); api-contracts section 3; data-model `0003`; open-questions Q-V1 (retention -> slice 3) and Q-V3 (owner-only delete -> later) at their accepted defaults.
- **Branch:** `feat/slice-2-versions`
- **What changed**
  - **Migration `0003_versions.sql`:** extends `diagram_versions` (kind, label, description, content_hash, size/counts, diagram_revision, restored_from_version_id, created_by_user_id, created_via) + indexes; additive, idempotent (guarded CHECK constraints), constant defaults only; legacy rows read as `auto`/`web`.
  - **`lib/versions/contentHash.js`**, **`lib/versionRepository.js`** (list/get/createNamed/update/restore; transactions under `SELECT ... FOR UPDATE`; race-free numbering), **`lib/audit.js`** (log-line seam until slice 5), **`lib/versions/http.js`**.
  - **API** (all wrapped with `withDiagramAuth`; actions `version.read` / `version.create` / `version.restore`): `GET/POST /api/diagrams/{id}/versions`, `GET/PATCH /versions/{v}`, `POST /versions/{v}/restore` (restore path per api-contracts, not a top-level `/restore`).
  - **Restore** creates `pre_restore` (only when the head is not already the latest version) then `restore`; nothing is deleted; `If-Match` honoured; no-op when the version equals the head.
  - **Editor:** History panel (`VersionHistoryPanel`: list, "Name current version", rename, static SVG preview, Restore with confirm dialog), opened from the title-bar menu; `DiagramContext.restoreFromVersion` (autosave lock, flush-first, reload head + revision).
- **Deviations from the docs:** (1) restore endpoint path follows api-contracts (`/versions/{v}/restore`). (2) `POST /versions` rejects `kind:'auto'` until slice 3. (3) Extra `unchanged` no-op response and `422 VERSION_CONTENT_INVALID`. (4) Preview is a static simplified SVG, not a live read-only canvas (rationale in ADR-0001 as-built). All recorded in api-contracts / data-model / ADR-0001.
- **Tests:** migration 0003 on throwaway DBs (existing data, constraints, idempotency, FK); repository on a throwaway DB (22: naming, dedupe, pagination, restore semantics incl. concurrency and lagging `version_seq`); API role matrix (owner/editor/commenter/viewer/no-access/unauthenticated per endpoint) + validation; editor restore (flush-first, no stale autosave, 409, failure paths); History panel; e2e `version-history.test.js` (name -> change -> preview -> restore -> server state; stale `If-Match` -> 409).
- **Operator note:** migration `0003` runs automatically before the app starts (`prestart` / container `CMD`); take a `pg_dump` first as for any migration; it only adds columns/indexes/constraints.


## Slice M1 — Read-only MCP server + personal API tokens

- **PR title:** `feat(mcp): read-only MCP server with personal API tokens`
- **Refs:** docs/architecture/investigations/mcp-and-embedding.md sections 4, 6 (M1), 7 (accepted defaults); ADR-0003 (agent principal).
- **Branch:** `feat/m1-mcp-readonly`
- **What changed**
  - **Migration `0004_api_tokens`** (additive, idempotent): `api_tokens` (SHA-256 hash of an `ogl_` secret, role cap viewer|commenter, optional diagram allowlist, expiry, revoke, last used).
  - **`lib/apiTokens.js`**: generate/hash/verify (revoked, expired, inactive user, malformed cap all refuse), create (max 20 active), list, revoke. Secret shown once.
  - **`lib/authz`**: agent principals honor `diagramScope` (allowlist; outside it is 404) and `authorizeMeta()` re-checks list rows without a query per row.
  - **`/api/mcp`** (`lib/mcp/http.js`): stateless Streamable HTTP via `@modelcontextprotocol/sdk` 1.32.1, bearer only (cookie ignored), Origin check, 405 for non-POST, 401 with `WWW-Authenticate`, per-token (120/min) and failed-auth (30/min per address) limits, 256 KB body limit, batch cap, optional `Mcp-Method`/`Mcp-Name` consistency check.
  - **Tools** (`lib/mcp/server.js`): `diagram_list`, `diagram_search`, `diagram_get` (compact / Mermaid / outline), `diagram_thumbnail`, `stencil_catalog`; resources `ontographia://diagrams/{id}`, `.../{id}/mermaid`, `ontographia://catalog/{packId}`. All annotated read-only; descriptions static; every diagram access goes through `authorize`/`authorizeMeta`.
  - **Projections** (`lib/mcp/projections.js`): compact JSON with stable ids, Mermaid with generated aliases and entity-escaped labels (also `%`, `{`, `}`), outline.
  - **Pure catalog**: stencil and connection-type data moved verbatim into `components/diagram-studio/packs/catalog/*.js` (no React); packs import it, rendering unchanged; a test asserts catalog equals the registered packs.
  - **UI/API**: Account page "API tokens" (create, list, two-step revoke, allowlist picker); `/api/user/tokens` and `/api/user/tokens/[id]` (session auth, own tokens only, JSON content type required).
  - `lib/rateLimit.js` `check(req, res, key?)` accepts an explicit bucket key. `jest.setup.js` guards the `window` mock so server suites can use the node environment.
- **Deviations from the doc:** one `stencil_catalog` tool (optional `packId`) instead of `catalog_list_packs`/`catalog_get_pack`; Mermaid resource URI is `/{id}/mermaid` (a `{id}.mmd` template is ambiguous with `{id}`); `diagram_list` has no `scope` input until sharing exists; SDK 1.32.1 negotiates up to 2025-11-25 (2026-07-28 not yet in the SDK); compact JSON measured about 2.8x smaller than raw on a synthetic 100-element flow (design target 3x; re-measure on real data).
- **Tests:** unit suites for tokens, authz scope, projections, server tools (through the MCP protocol), HTTP pipeline (real HTTP + SDK client), token API, account section, catalog parity. Live check against a throwaway database: token create via API, SDK client initialize/tools/resources, allowlist, revoke (401 immediately), expiry, Origin, 405, 413.
## Slice 4 — Server comments

- **PR title:** `feat: slice 4 server comments (threads, replies, resolve, detached anchors)`
- **Refs:** ADR-0002; api-contracts section 4; delivery-plan slice 4; Q-C1, Q-C2, Q-C3 (Q-C4/C5 are slice 9, not built).
- **Branch:** `feat/slice-4-comments`
- **What changed**
  - **Migration `0006_comments`** (additive, idempotent; number 0006 because 0004 = api_tokens and 0005 = sharing): `comment_threads`, `comments`, indexes per data-model.
  - **API** (all `withDiagramAuth`): `GET/POST /api/diagrams/{id}/threads`, `GET/PATCH .../threads/{t}`, `POST .../threads/{t}/comments`, `PATCH/DELETE .../comments/{c}`. Plain-text bodies <= 10 000 chars, soft delete, reply reopens, per-user create rate limit.
  - **`lib/commentRepository.js`**, `lib/comments/{validate,http,anchors,client,legacyImport}.js`.
  - **Editor:** `useComments` now uses the API (optimistic with rollback + error banner, refresh on focus and every 60 s); element-anchored markers follow their element; deleted element -> thread `detached` (faded dashed marker at the creation position + "Detached comments" group); restore that brings the element back re-attaches (derived at read time, no restore hook); one-time localStorage import prompt (Q-C1); bodies rendered as text.
  - Fixed: canvas comment clicks never passed an element id; context-menu "Add comment" passed a screen position.
- **Deviations from the docs:** attachment derived at read time rather than hooking version restore (documented in ADR-0002 as built); migration renumbered 0004 -> 0006; UI creates canvas/element anchors only (connection anchors supported by the API).
- **Tests:** API role matrix (owner/editor/commenter/viewer/no-access/unauthenticated x 7 endpoints) + validation + rate limit; repository on a throwaway DB (13: identity, scoping, attach/detach/re-attach, resolve/reopen/reply, edit/delete rules, hidden threads, pagination, cascades); anchors / import plan / validators; `useComments` + rendering (text not HTML); e2e with two browser sessions (create, persist, author identity, reply, move/detach/restore, resolve/reopen, import, delete, non-owner 404).
- **Deployment note:** migration `0006` runs automatically before the app starts (`prestart` / container `CMD`); take a `pg_dump` first as for any migration. It only creates two tables and four indexes.


## Slice 3 — Auto checkpoints + retention

- **PR title:** `feat: slice 3 auto checkpoints, session-end checkpoint and retention`
- **Refs:** delivery-plan slice 3; ADR-0001 decisions 2 and 6 (as-built note appended); api-contracts section 3; open-questions Q-V1 and Q-V2 at their accepted defaults.
- **Branch:** `feat/slice-3-checkpoints`
- **What changed:** `lib/versions/policy.js` (constants), `lib/versions/retention.js` (pure planner), `lib/versionRepository.js` (`createAutoIfDue`, `pruneAuto`, `createCheckpoint`, optional `created_at`), `lib/diagramRepository.js` (content PUT is now a transaction with the checkpoint), `pages/api/diagrams/[id].js` (passes actor), `pages/api/diagrams/[id]/versions/index.js` (`kind:auto` session end + rate limit), `DiagramContext.js` + `versions/versionsClient.js` (pagehide/visibility checkpoint), `VersionHistoryPanel.js` (autosave toggle). No migration.
- **Deviations:** none from the plan; the session-end checkpoint snapshots the saved head only (rationale in the ADR note).
- **Tests:** retention planner (24 h / daily / 30-day / weekly / cap-100 boundaries, fake clock), DB integration (100 saves in 1 minute gives 1 auto version, identical content never twice, throttle boundary, thumbnail/metadata/CAS-failure create nothing, session-end dedupe, prune never touches named/restore/pre_restore, cap), versions API (session-end 201/200/404/400/403/429), editor checkpoint events, History toggle.


## Slice 5 — Share with existing users, read-only mode, audit

- **PR title:** `feat: slice 5 share with existing users, read-only modes and audit trail`
- **Refs:** delivery-plan slice 5; ADR-0003 (as-built note appended); api-contracts section 5; open-questions Q-S1, Q-S3, Q-S8, Q-A2 at their accepted defaults.
- **Branch:** `feat/slice-5-sharing`
- **What changed:** migrations `0007_diagram_members` and `0008_audit_events` (0005 unused, 0006 is comments); `lib/authz/policy.js` (`canGrant`, `canModifyMember`), `lib/authz/index.js` (member grant source), `lib/memberRepository.js` (grants, access list, shared-with-me, `NOTIFY authz_changed`), `lib/audit.js` (real INSERT + paged reader), `pages/api/diagrams/[id]/{access,shares,audit}.js`, `members/[userId].js`, `pages/api/diagrams?scope=owned|shared|all`, restore now awaits a real audit row, `lib/mcp/{repository,server}.js` (list/search include shared diagrams; role cap and allowlist still re-checked per row), `components/diagram-studio/{sharing/accessMode.js,sharing/sharingClient.js,ui/ShareDialog.js}`, `DiagramContext.js` (no save/autosave without `diagram.write`), `DiagramStudio.js` / `TitleBar.js` ("View only" / "Can comment" pill, comment tool only with `comment.create`, Share button), `pages/diagram/[id].js` (read-only profile from capabilities), `pages/dashboard.js` ("Shared with me"), `lib/commentRepository.js` (author display name: profile name, else e-mail local part), `lib/features.js` (`sharing: true`).
- **Deviations from the docs:** migrations are numbered `0007`/`0008` (not `0005`/`0006`); `0007` creates only `diagram_members` (invitations and links arrive with slices 6/7) and the unused `diagram_shares` table is left in place instead of dropped; `message` on `POST /shares` is validated but unused until e-mail notifications exist; `GET /access` returns empty `invitations` and `links`; the 365-day audit retention job is not implemented yet (rows are only inserted).
- **Tests:** sharing rules (grant/modify matrix); member source in `authorize`; sharing API behavior (grant, role change, revoke, leave, owner immutable, Q-S3, rate limit, validation, conflicts); endpoint x role matrix over every diagram route (owner/editor/commenter/viewer/no-access/admin non-member/unauthenticated, denied calls must not reach the handler); repository, authorization, audit and NOTIFY against a throwaway database; migrations 0007/0008; MCP shared pre-filter; access-mode mapping; opt-in e2e with five browser contexts (`E2E_SHARING_USERS=1`).
- **Deployment note:** migrations `0007` and `0008` run automatically before the app starts (`prestart` / container `CMD`); take a `pg_dump` first as for any migration. They only add two tables and three indexes (idempotent, no data touched). From this release a diagram can be shared with existing active users by e-mail; platform admins still get no implicit access.


## Slice M2 — MCP agent edits (`diagram_apply_ops`)

- **PR title:** `feat(mcp): agent edits with diagram_apply_ops, editor tokens and server-side placement`
- **Refs:** docs/architecture/investigations/mcp-and-embedding.md sections 4.1, 4.5, 6 (M2), 7 (Q-MCP2, Q-MCP4, Q-MCP5, Q-AI1); delivery-plan M2; ADR-0001 / ADR-0003 as built.
- **Branch:** `feat/m2-mcp-edits`
- **What changed**
  - **Migration `0009_editor_api_tokens`** (idempotent, guarded): `api_tokens.role_cap` accepts `editor`; CHECK `api_tokens_editor_requires_allowlist` (editor => non-empty `diagram_ids`).
  - **Tokens**: `lib/apiTokens.js` (editor needs an allowlist at validation and at verification), `/api/user/tokens` (editor allowlist entries must be diagrams the user can edit), Account UI option "Editor (requires choosing diagrams)" with the restriction locked on.
  - **`lib/mcp/ops.js`** (pure atomic applier, closed op schemas, catalog-checked types, refs, limits, content validation), **`lib/mcp/placement.js`** (server-side placement; reuses `findFreePlacement`, `computeTemplatePlacement`, `LayoutEngine.hierarchicalLayout`).
  - **`diagramRepository.applyContentChange`**: one transaction with the revision check, the shared UPDATE, a pre-change version and an agent-attributed version (`created_via = 'agent'`).
  - **`diagram_apply_ops`** tool in `lib/mcp/server.js` (authorize `diagram.write`, editor + allowlist defense in depth, structured conflict / invalid-ops / rate-limit errors); 30 writes per minute per token (`rateLimit().consume`); `diagram_get` also reads element `properties` as `data`.
  - Docs: how-to "Let Claude edit a diagram" (`docs/architecture/investigations/mcp-connect-howto.md`), as-built section in the investigation doc, data-model note.
- **Deviations from the doc:** input field is `baseRevision` (not `ifRevision`); `diagram_create`, `layout_apply` and `version_*` tools are deferred; no realtime refresh of an open editor (its next save gets the existing 409 flow).
- **Tests:** layout engine, placement (no overlaps, frames, grid, 200 elements), ops (validation, atomicity, refs, limits), migration 0009 on a throwaway database, repository on a throwaway database (CAS, concurrent writers, versions, restore undoes the batch), tool through the MCP protocol with the real authz (viewer, commenter, editor without allowlist, outside allowlist, share revoked or downgraded, rate limit, budget), token validation / API / UI. Live check (port 3252, throwaway database): editor token created through the API, read, apply 3 elements + 2 connections without coordinates (rendered in the editor, no overlap), stale revision -> conflict, viewer and commenter and outside-allowlist denied, History lists the agent version.
- **Deployment note:** migration `0009` runs automatically before the app starts (`prestart` / container `CMD`); take a `pg_dump` first as for any migration. It swaps one CHECK constraint on the small `api_tokens` table and adds another; existing rows satisfy both. Roll out the migration before (or with) the new code: new code with an old schema cannot create editor tokens. Old code with the new schema is safe.

### Slice M2 review follow-ups (PR #39)

- **Branch:** `feat/m2-mcp-edits`. **Files:** `lib/mcp/placement.js` (spatial index, one occupied set, bounded search, overflow rows; hub-and-spoke layout), `lib/mcp/ops.js` (frame `membershipExplicit`, adopt on x/y inside a frame), `lib/diagramRepository.js` (`applyContentChange` computes before the transaction; audit row), `lib/versions/{policy,retention}.js`, `lib/versionRepository.js` (agent retention budget), `lib/mcp/server.js` (token id in actor), History panel and `versionUtils.js`, ADR-0001 as-built.
- **Behavior notes:** placement no longer runs under the row lock (revision re-checked under the lock); a child that does not fit its frame goes into rows below it instead of searching 61x61 cells per child. A shape added with x/y inside a frame and no `parent` joins that frame (editor `assignFrameOnCreate` rule); an explicit `parent` wins.
- **Tests:** placement time budget (200 children in a frame on 5000 elements) and hub-and-spoke layouts, agent retention budget and audit row on a throwaway database, ops frame membership, History panel labels and filter.

## Slice 8 — Compare versions

- **PR title:** `feat: slice 8 compare versions (structural diff, API, History panel summary, canvas overlay)`
- **REQ refs:** ADR-0001 decision D / decision 8 (compare), api-contracts section 3 (`GET .../diff`).
- **Branch:** `feat/slice-8-compare`
- **Files changed:** `lib/versions/diff.js` (new, pure), `pages/api/diagrams/[id]/versions/[v]/diff.js` (new), `lib/versionRepository.js` (`getHeadContent`), `components/diagram-studio/ui/CompareOverlay.js`, `ui/CompareSummary.js`, `versions/compareStore.js` (new), `ui/VersionHistoryPanel.js` (compare actions), `versions/versionsClient.js` (`getVersionDiff`), `DiagramStudio.js` (overlay + reveal), docs (ADR-0001 as-built, api-contracts section 3).
- **Deviations from the docs:** none in the contract path; `EntityChange` gained additive `label` and `bounds`; `fields` use logical names (`position`, `size`, `label`, `style`) instead of JSON paths such as `position.x`. Overlay only for compare-against-current. No migration.
- **Tests:** diff unit tests (add/remove/change for all four kinds, field grouping, jitter tolerance at 0.5 px, stable ordering, garbage input, no mutation); API tests (endpoint x role matrix incl. viewer/commenter allowed and no-access 404, IDOR, malformed `v`/`against`, 405); repository `getHeadContent` against a throwaway database; component tests (summary, read-only roles, overlay store, reveal, two-version compare, overlay colors/positions, pointer-events none, dismiss); e2e `version-compare.test.js` (owner and viewer in separate browser contexts; checks nothing is written).

## AI-2 — Live pickup and merge in the editor

- **PR title:** `feat: AI-2 live pickup and three-way merge in the editor`
- **REQ refs:** `docs/architecture/investigations/ai-canvas-via-mcp.md` section 6 (AI-2) and Q-AC11 (polling plus three-way merge now); fixes the human to human 409 problem that slice 5 sharing made reachable.
- **Branch:** `feat/ai-2-live-merge`
- **Files changed:** `lib/merge/threeWay.js` (new, pure `mergeContent`), `lib/versions/diff.js` (exports `valuesEqual`), `lib/versionRepository.js` (`latestAgentChangeSince`, `writerName`), `pages/api/diagrams/[id]/revision.js` (new probe), `components/diagram-studio/DiagramContext.js` (polling, `pickupRemote`, merge on 409, base tracking, notice), `components/diagram-studio/live/livePickup.js` (new helpers: content normalization shared with `setDiagram`, undo rebase, notice wording), `components/diagram-studio/ui/RemoteUpdateNotice.js` (new), design doc ("AI-2 as built"), api-contracts section 2.
- **Deviations from the design:** none in the approach. Plain polling (3 s visible, 30 s hidden) as the doc says. Detail decisions the doc left open are recorded in "AI-2 as built": remote delete vs local edit keeps the edit; local delete vs remote edit deletes; position and size are atomic units; undo history is rebased across a merge. Attribution to agents depends on M2 (PR #39) writing `created_via='agent'` versions. No migration.
- **Review follow-ups (same PR):** 409 awaits an in-flight pickup; label/endpoint editing defers pickup; name/description three-way merge; lazy undo rebasing (`rebaseSnapshot`, 20-pickup log); unique ids (`lib/dedupeIds.js`, `validateDiagramContent`, merge refuses duplicates); probe 403/404 handled like a refused save; dirty recomputed after an in-flight save; merge reads `liveRef`; group ids derived from `groupId`. Files: `DiagramContext.js`, `DiagramCanvas.js`, `live/livePickup.js`, `lib/merge/threeWay.js`, `lib/diagramContent.js`, `lib/dedupeIds.js`, `normalizeContent.js`, duplicate/restore paths, `livePickup*.test.js`, `mergeThreeWay.test.js`, `e2e/live-merge.test.js` (agent edit via real `diagram_apply_ops`, label typing, rename, slow pickup).
- **Tests:** 40 merge unit tests, revision API tests, editor integration tests with a mocked server (clean pickup writes nothing, dirty merge then save on the new revision, same-field conflict, 409 race merges and retries, fallback dialog, undo/redo after merge, hidden-tab backoff, Review agent change), repository tests on a throwaway database, endpoint x role matrix entry, and e2e `live-merge.test.js` with two browser contexts (clean pickup within 5 s, dirty merge with no dialog, same-field conflict notice).

## Slice AI-1 — Region read and "Copy link for Claude"

- **PR title:** `feat: slice AI-1 board_read_region MCP tool and "Copy link for Claude" focus link`
- **REQ refs:** `docs/architecture/investigations/ai-canvas-via-mcp.md` section 4.1 (`board_read_region`), section 5 (focus link), slice AI-1.
- **Branch:** `feat/ai-1-read-region`
- **Files changed:** `lib/focusLink.js` (new, pure build/parse/validate), `lib/mcp/regionSelect.js` (new, pure selection), `lib/mcp/regionTool.js` (new tool), `lib/mcp/server.js` (one registration line + import), `lib/mcp/projections.js` (`compactConnection` exported), `components/diagram-studio/ui/ContextMenu.js` and `DiagramStudio.js` (menu item, copy, visible link fallback, `?focus=` / `?region=` select-and-zoom), `docs/architecture/investigations/mcp-connect-howto.md`, design doc as-built section; tests `__tests__/lib/focusLink.test.js`, `mcpRegionSelect.test.js`, `mcpBoardReadRegion.test.js`, `mcpServer.test.js` (tool list).
- **Deviations from the doc:** see the as-built section of the design doc (no table/doc/comment tiers yet because those primitives do not exist; `around` and `region=` link added; frame vs element is decided by the server from the element, not by the link). No migration.
- **Tests:** link build/parse round trip and rejection cases; selection geometry (explicit `parentFrameId` only, nested frames, cycles, strict rectangle overlap, around + radius clamp, reading order, neighbourhood); MCP protocol tests with the real authz core (viewer/commenter/editor tokens, allowlist, other user's diagram and unknown ids both "not found", link vs id mismatch, paging with cursor bound to revision and focus, connection placement across pages, 256 KB budget).

## Slice AI-3 — map_structure, layout_apply, layouts and the canvas guide

- **PR title:** `feat: slice AI-3 map_structure and layout_apply MCP tools, radial/cluster/flow layouts and the canvas guide`
- **REQ refs:** `docs/architecture/investigations/ai-canvas-via-mcp.md` section 4.1 (`map_structure`, `layout_apply`), 4.3 (guide, prompts, limits), slice AI-3 (and the guide part of AI-8).
- **Branch:** `feat/ai-3-map-structure`
- **Files changed:** `lib/layout/structureLayout.js` and `lib/layout/freeSpace.js` (new, pure), `lib/mcp/structure.js` (validation and compile-to-ops), `lib/mcp/structureTool.js` (tool, resource and prompt registration), `lib/mcp/guide.js` (guide text), `lib/mcp/server.js` (shared `agentWrite` write path, used by `diagram_apply_ops` too; instructions), `lib/mcp/ops.js` (`opts.maxOps`, `MAX_STRUCTURE_OPS`), `lib/mcp/placement.js` (export `createBoxIndex`), tests `structureLayout`, `mcpStructure`, `mcpStructureTool`, additions to `mcpServer` and `diagramRepositoryAgentEdit`, docs (`ai-canvas-via-mcp.md` section 9, `mcp-connect-howto.md` section 6).
- **Deviations from the doc:** input names (`key`, `baseRevision`, `anchor`, layout `flow` instead of `layered`) and caps (200 nodes, 400 edges, 40 groups per call) are recorded in section 9 of the design doc. No migration, no new dependency, no LLM call.
- **Tests:** see section 9 (layout geometry on random structures, validation, compile-to-ops, anchors, `layout_apply`, performance, MCP protocol and authz, database version/audit/restore).

## Slice AI-9a — diagram_show MCP App (server-drawn SVG view)

- **PR title:** `feat: slice AI-9a diagram_show MCP App with a server-drawn board view, and a 120 KB MCP output budget`
- **Refs:** `docs/architecture/investigations/ai-canvas-via-mcp.md` section 10 (approved 2026-10-21, defaults Q-AV1 to Q-AV6); supersedes the draft spike PR 43.
- **Branch:** `feat/ai-9a-diagram-show`
- **Files changed:** `lib/render/diagramSvg.js` (renderer, coordinate clamps), `lib/mcp/app/diagramView.js` (static view HTML), `lib/mcp/showTool.js` (tool and `ui://` resource), `lib/mcp/server.js` (registration, instructions, text), `lib/mcp/regionTool.js` (focus shape export, budget text), `lib/mcp/projections.js` (`MAX_RESPONSE_BYTES` 256 to 120 KB, `oneLine` export), tests `diagramSvg`, `mcpDiagramShow`, `mcpServer`, docs (design doc 10.11, how-to section 7, mcp-and-embedding budget).
- **Deviations from the doc:** none in behavior; the shared output budget was lowered as the doc's own follow-up (10.5).
- **Not verified:** rendering in claude.ai, Desktop and mobile (needs the deployed remote connector, Q-AV7, auth designed separately).
- **Tests:** see design doc 10.11.



## Slice O1 — OAuth discovery and resource-server groundwork

- **PR title:** `feat: slice O1 OAuth discovery documents, Origin/OPTIONS handling and 401 resource_metadata for the MCP server`
- **REQ refs:** `docs/architecture/adr/0005-mcp-oauth.md` sections 5.1, 5.11, 7 (O1); owner approval of the `/.well-known/*` rewrites (Q-OA8).
- **Branch:** `feat/oauth-o1`
- **Files changed:** `lib/oauth/config.js`, `lib/oauth/metadata.js`, `lib/oauth/wellKnown.js`, `lib/oauth/verify.js` (new), `pages/api/oauth/protected-resource.js`, `pages/api/oauth/authorization-server.js`, `pages/oauth/authorize.js` (placeholder), `pages/api/mcp.js`, `lib/mcp/http.js`, `next.config.js` (rewrites only), `.env.example`, ADR-0005 section 10, `mcp-connect-howto.md`; tests `oauthMetadata`, `mcpHttpOauth`, `oauthVerifyDispatch`.
- **Deviations from the ADR:** none. Behavior with the flag off is unchanged apart from Origin normalization and `OPTIONS` from an allowed origin (both driven by `MCP_ALLOWED_ORIGINS`, empty by default).
- **Tests:** metadata documents against the SDK schemas, handlers (flag off 404, CORS, 405), rewrites, 401 challenge with and without the flag, Origin normalization and refusal cases, preflight, bearer dispatch.

## Slice O2 — OAuth authorization server core

- **PR title:** `feat: slice O2 OAuth authorization server for the MCP server (code + PKCE, refresh rotation, consent)`
- **REQ refs:** `docs/architecture/adr/0005-mcp-oauth.md` sections 5.2 to 5.10, 7 (O2) and the 2026-10-21 owner amendment (admin "Edit all boards I can edit").
- **Branch:** `feat/oauth-o2`
- **Files changed:** `db/migrations/0010_oauth.sql`; `lib/oauth/{crypto,clients,authorizeRequest,authorizeFlow,consent,consentData,consentEndpoint,repository,tokenEndpoint,serverEndpoint,verify}.js`; `pages/oauth/authorize.js`, `pages/api/oauth/{consent,token,revoke}.js`, `components/oauth/ConsentForm.js`; `lib/mcp/server.js` (write gate for the all-boards connection, credential in the actor), `lib/diagramRepository.js` (credential in the audit target), `pages/api/auth/reset-password.js` (revoke connections), `pages/login.js` (provider buttons keep the validated callback), `lib/rateLimit.js` (`unref` timer), `jest.config.js` (new db suites), ADR-0005 amendment and as-built; tests listed in the ADR.
- **Deviations from the ADR:** `code_used_at` column and the `exchange_failed` revoke reason; `all_diagrams` (owner amendment); per-grant and failure rate limits count failed attempts only; the pending-request cap is checked at bind time. No new dependency.
- **Tests:** see the ADR "O2" section: protocol negatives (unknown client, redirect mismatch, PKCE, code reuse and expiry, resource mismatch, state echo, open redirects via every parameter), refresh rotation, reuse, grace and idle expiry, consent rules and CSRF, authz parity between `ogl_` and `oga_` tokens, the admin all-boards cases, SDK `auth()` driver, and the browser end-to-end flow.

## Slice O3 — Connected apps and enabling OAuth

- **PR title:** `feat: slice O3 Connected apps (list and Disconnect), admin connection counts and claude.ai how-to`
- **REQ refs:** `docs/architecture/adr/0005-mcp-oauth.md` sections 5.7, 7 (O3).
- **Branch:** `feat/oauth-o3`
- **Files changed:** `lib/oauth/connectedApps.js`, `pages/api/user/connected-apps/{index,[id]}.js`, `components/account/ConnectedAppsSection.js`, `pages/account.js`, `pages/api/admin/users/index.js` and `pages/admin/users.js` (count column), `mcp-connect-howto.md` section 7, ADR as-built, e2e test; tests `ConnectedAppsSection`, `oauthConnectedApps` (db), e2e Disconnect.
- **Deviations from the ADR:** none. Turning the flag on in production and the owner's walk-through on claude.ai and mobile are deployment steps (see the PR's Deployment section), not code.
- **Tests:** list shapes and privacy (no secrets, names only for readable diagrams), Disconnect effect on access and refresh tokens, foreign and malformed ids, cross-origin refusal, audit row, UI (hidden when off, empty state, rows, expand, confirm, failure), browser e2e of Disconnect from the Account page.

## Slice LA-1 — Change highlight on live pickup

- **PR title:** `feat: slice LA-1 change highlight (rings on what others changed, edge chip, reduced motion, setting)`
- **REQ refs:** `docs/architecture/adr/0006-live-activity-and-presence.md` section 5.2, 9 (LA-1); owner approval 2026-10-21 (Q-LA4: highlight on by default, per-user toggle).
- **Branch:** `feat/la-1-highlight`
- **Files changed:** `lib/merge/threeWay.js` (`summary.remote.ids`), `components/diagram-studio/live/remoteHighlight.js` (new, pure geometry), `components/diagram-studio/ui/RemoteHighlight.js` (new: rings, ghosts, edge chip, lifecycle hook), `DiagramContext.js` (`remoteHighlight`, `clearRemoteHighlight`), `DiagramCanvas.js`, `DiagramStudio.js`, `ui/ContextMenu.js` (toggle), `styles/diagram-studio.css`; tests `mergeThreeWayIds`, `remoteHighlightGeometry`, `remoteHighlightPickup`, `RemoteHighlightUi`, `highlightSetting`, e2e `live-highlight`.
- **Deviations from the ADR:** the setting is the flat `user_settings` key `highlightRemoteChanges` (the ADR sketched `live.highlightChanges`; the existing settings are flat); ids cover elements and connections only (layers and groups are counted but have nothing to ring); a removed connection leaves no ghost; connections are drawn as a polyline through endpoint centers and waypoints (approximate for curved lines). No migration, no new dependency.
- **Tests:** unit for ids (added/changed/removed, local-only changes excluded, 500 cap), geometry (colors, ghosts, union bbox above 150, off-screen summary, pan target), pickup (5 ids lavender for an agent, cyan for a person, no PUT), components (fade vs reduced-motion classes, lifecycle timers, chip), e2e in two browser contexts plus a real `diagram_apply_ops` call.

## Slice AI-C — diagram_create (new private board from an agent)

- **PR title:** `feat(mcp): diagram_create tool (new private board owned by the user, allowlist updated atomically)`
- **Refs:** owner request 2026-10-21; `docs/architecture/investigations/mcp-and-embedding.md` ("As-built notes (diagram_create)"), ADR-0005 (all_diagrams, per-request admin re-check), Q-AI1 (agents do not manage sharing).
- **Branch:** `feat/mcp-diagram-create`
- **Files changed:** `lib/mcp/createTool.js` (new), `lib/mcp/server.js` (one registration line, instructions), `lib/mcp/guide.js`, `lib/diagramRepository.js` (`createDiagram` takes an optional transaction client; behavior unchanged without it), `jest.config.js` (db suite list), skill `skills/ontographia-lab/` (SKILL.md "new board" workflow, reference/tools, troubleshooting, examples), `mcp-connect-howto.md` (section 5a), `mcp-and-embedding.md` (as-built); tests `mcpDiagramCreate` (db), `mcpServer` (tool list).
- **Decisions:** editor-capped principals only; same creation path as `POST /api/diagrams` (no per-user quota exists, so none applies); private board; the creating credential's own allowlist gets the id in the same transaction (`ALLOWLIST_FULL` at 50, nothing created); 10 creates per hour per credential plus the shared write limit; audit `diagram.agent_create`; no initial version (the normal create path makes none).
- **Deviations from the doc sketch:** input is `{name, description?}` only (board type fixed to `infinite-canvas`, no `ops`/`layout`).
- **Tests:** role denial (viewer/commenter, personal and OAuth), allowlist append for this token/grant only, follow-up `map_structure`, admin `all_diagrams` create and edit, revoked/disconnected/suspended/demoted mid-request, rate limit, name and description validation, audit row without content, dashboard listing, atomicity.

## Slice LA-2 — Agent indicator

- **PR title:** `feat: slice LA-2 agent indicator (activity register, probe agents[], pill, read-focus box, tool name in audit)`
- **REQ refs:** `docs/architecture/adr/0006-live-activity-and-presence.md` section 5.1, 9 (LA-2); owner approval 2026-10-21 (Q-LA1: reads visible only to the acting user, writes to everyone).
- **Branch:** `feat/la-2-agent-indicator` (stacked on `feat/la-1-highlight`)
- **Files changed:** `lib/live/agentActivity.js` (new register), `lib/mcp/server.js` (`noteAgent`, `tool` through `agentWrite`), `lib/mcp/{regionTool,showTool,structureTool,repository}.js`, `lib/diagramRepository.js` (`tool` in the `diagram.agent_edit` target), `lib/oauth/repository.js` (`clientLabel` on the principal), `pages/api/diagrams/[id]/revision.js` (`agents[]`), `components/diagram-studio/ui/AgentIndicator.js` (new), `DiagramContext.js`, `DiagramCanvas.js`, `ui/TitleBar.js`; tests `agentActivity`, `mcpAgentActivity` (registry coverage), `revisionApi`, `AgentIndicator`, `agentsProbe`, `diagramRepositoryAgentEdit` (db), `oauthRepository` (db), e2e `agent-indicator`.
- **Deviations from the ADR:** the probe ETag stays `"<revision>"` when no agent is visible and becomes `"<revision>-a<time>"` otherwise (the ADR sketched `r<rev>-a<at>`); `forUser.id` is only present for the acting user; each item also carries `ageMs` (server-relative, so no client clock agreement is needed); the `tool` is passed to `applyContentChange` as its own option, not inside `actor`; `diagram_create` is classified non-board (a brand-new board nobody is watching). No migration, no new dependency.
- **Tests:** register states, TTL, LRU, privacy matrix and labels; every registered tool is classified and, for single-board tools, records exactly one entry after the access check and nothing when access is refused; probe payload with a query-count check (a caught-up probe still runs no query); pill/popover/focus-box components; e2e with two browser contexts and a real MCP agent (the viewer sees no read, both see the write, the pill turns muted after 20 s).

## Slice DX-1 — Doc copy (rich), .docx / .pdf export, table copy, doc scroll

- **PR title:** `feat: doc copy with formatting, .docx and .pdf export, formatted table copy, and doc scrolling`
- **REQ refs:** `docs/architecture/investigations/ai-canvas-via-mcp.md` section 11.7; owner request 2026-10-22.
- **Branch:** `feat/doc-copy-export`
- **Files changed:** `lib/doc/{docLinks,docHtml,docDocx,docPdf}.js`, `lib/clipboard/richCopy.js`, `lib/table/tableClipboard.js` (new); `components/diagram-studio/elements/doc/{docActions,docStore,DocPanel,DocPanelHost,DocCard}.js`, `elements/table/TableNode.js`, `DiagramCanvas.js` (context menu); `skills/ontographia-lab/SKILL.md`; `package.json` / lock (`docx` 9.13.0, MIT, 19 MB unpacked, dynamic import only; `fflate` 0.8.3 made direct), plus `lib/table/tableXlsx.js` and `export/copyAsImage.js` (Excel export, copy as image).
- **Tests:** unit (docHtml, docDocx, docPdf, tableClipboard, richCopy, components/docCopyExport) and e2e `doc-copy-export` (clipboard read-back, downloads, wheel scroll).

---

## Slice LA-3 — Activity panel

- **PR title:** `feat: slice LA-3 activity panel (edit sessions, GET /activity, Activity tab with Review and Compare)`
- **REQ refs:** `docs/architecture/adr/0006-live-activity-and-presence.md` sections 5.3, 7, 8, 9 (LA-3); owner approval 2026-10-21 (Q-LA2: everyone with read access sees content activity, sharing events owner only; Q-LA3: 365 days).
- **Branch:** `feat/la-3-activity-panel` (stacked on `feat/la-2-agent-indicator`)
- **Files changed:** `db/migrations/0011_diagram_edit_sessions.sql`, `lib/activity/sessions.js`, `lib/activityRepository.js`, `lib/diagramRepository.js` (session write in the save transaction), `lib/authz/policy.js` (`activity.read`), `pages/api/diagrams/[id]/activity.js`, `components/diagram-studio/activity/{ActivityTab,activityClient,activityUtils}.js`, `ui/VersionHistoryPanel.js` (tabs, `OPEN_ACTIVITY_EVENT`), `ui/TitleBar.js` (menu entry, pill wiring), `jest.config.js`, `docs/architecture/{data-model,api-contracts}.md`; tests `editSessions`, `migrate0011` (db), `activityRepository` (db), `activityApi`, `policy`, `endpointMatrix`, `activityUtils`, `ActivityTab`, `historyActivityTabs`, e2e `activity-panel`.
- **Deviations from the ADR:** retention is an opportunistic prune of edit sessions run from the activity endpoint (at most every 6 hours per process) because no audit retention job exists in the codebase yet (audit rows are not pruned by this PR); the agent edit label comes from the OAuth grant's `client_label` (personal tokens read "Personal token"); a session with no earlier version has no Compare link; "Compare with now" is exact only when the session is the board's newest state; `share` items cover `share.grant`, `share.change` and `share.revoke`. No new dependency.
- **Tests:** session bucketing (37 saves in 18 minutes = one row, a 12-minute pause = two, per-person sessions, rollback with the save, rename-only saves write none), the feed over three sources (ordering, cursor walk, names not e-mails, sanitized agent label, compare bounds with the approximate flag, three queries per page, p95 under 50 ms on 10,000 audit rows), role by endpoint matrix, components, and an e2e with an owner, an editor and a real MCP agent (Review opens the diff of exactly that edit, the owner sees sharing, a demoted viewer does not).

---

## Slice AI-5 — Doc card (with AI-5w doc tools)

- **PR title:** `feat: slice AI-5 doc card (Markdown document on the board, safe renderer, side-panel editor, doc_create / doc_update / doc_get)`
- **REQ refs:** `docs/architecture/investigations/ai-canvas-via-mcp.md` sections 3.2, 3.4, 4.1 (`doc_create`, `doc_update`, `doc_get`), 6 (AI-5, AI-5w), 7 (Q-AC1, Q-AC2 defaults) and the as-built section 11. Owner use case (2026-10-21): map a text, tabulate it, then write the summary on the board with links to the elements.
- **Branch:** `feat/ai-5-doc`
- **Files changed:** `lib/doc/{docHref,markdown,sanitize,docText,docElement}.js` (new, pure); `lib/diagramContent.js` (doc validation hook); `lib/mcp/{docTools,ops,projections,guide,server,structureTool}.js`; `lib/render/diagramSvg.js` (doc card in the server SVG); `lib/versions/diff.js` (`doc` field and line-level `docText`); `components/diagram-studio/elements/doc/*` (new: `DocMarkdown`, `DocCard`, `DocPanel`, `DocPanelHost`, `docStore`, `useDocImport`); `components/diagram-studio/{DiagramCanvas,DiagramStudio}.js`, `packs/CorePack.js`, `packs/catalog/core.js` (stencil `core/doc`), `ui/ShapeSidebar.js` (Doc button), `ui/CompareSummary.js`, `export/diagramJson.js` (import sanitizer); `skills/ontographia-lab/*`; docs (design section 11, `mcp-connect-howto.md` section 6b, `data-model.md`, `api-contracts.md`).
- **Deviations from the design:** the editor is a Markdown textarea with a toolbar and live preview, not Tiptap (evidence in design 11.1; storage is Markdown either way, so nothing migrates when a WYSIWYG editor is added); `doc_patch` was not added as a new op: `add_element` / `update_element` carry an optional `doc` field instead (smaller surface, same applier); `board_read_region` shows a doc's outline and `doc_get` reads the text (no `include: docs` tier); `collapsed` is implemented by resizing the card to its title bar. No new dependency, no migration.
- **Tests:** `docMarkdown`, `docModel`, `docDiffMerge`, `docSvg`, `mcpDocTools`, `diagramRepositoryAgentEdit` (db), `components/diagram-studio/docCard`, `diagramJson`, updated `mcpServer` / `mcpStructureTool`, and the browser test `__tests__/e2e/doc-card.test.js`.

## Slice AI-4 — Table element (editor, export, diff and merge, MCP tools)

- **PR title:** `feat: slice AI-4 table element (typed columns, inline editing, paste, CSV/JSON export, diff and merge) and table_create / table_update / table_get`
- **Refs:** `docs/architecture/investigations/ai-canvas-via-mcp.md` sections 3.1, 4.1, 6 (AI-4, AI-4w) and 11; owner use case 2026-10-21 (graph, then table, then summary): rows can link to board elements.
- **Branch:** `feat/ai-4-table`
- **Files changed:** `lib/table/{tableModel,tableSchema,tableCsv,tablePatch,tableMerge,tableDiff,tableSvg}.js` (new), `lib/mcp/tableTools.js` (new), `lib/merge/order.js` (new, extracted), `lib/merge/threeWay.js`, `lib/versions/diff.js`, `lib/diagramContent.js`, `lib/diagramLimits.js`, `lib/mcp/{ops,server,guide,projections,structure}.js` (`checkAnchor` exported), `lib/render/diagramSvg.js`, `components/diagram-studio/elements/table/*` (new), `packs/CorePack.js`, `packs/catalog/core.js`, `DiagramCanvas.js` (Table tool placement), `DiagramContext.js` (`addElement` gives a table its data), `DiagramStudio.js`, `ui/TitleBar.js`, `ui/CompareSummary.js`, `export/{ExportManager,captureCanvas,diagramJson}.js`, design doc section 11, `mcp-connect-howto.md` section 6a.
- **Deviations from the doc:** `baseRevision` and `anchor` (as AI-3) instead of `ifRevision` and `placement`; columns are given by name; the table lives in `element.data.table`; a row `elementId` link (owner use case, not in the original design); a gutter column of 40 px; a table is summarized, not truncated, in `diagram_get`; the `tabulate_region` prompt was added.
- **Not verified:** a real claude.ai session building a table (needs the deployed connector). The interaction was verified in headless Chrome against a throwaway database.
- **Tests:** see design doc section 11.
## Slice P1 — Slides, presentations, present mode, PDF/PNG export and deck MCP tools (ADR-0007)

- **PR title:** `feat(present): slice P1 slides, presentations, present mode, PDF/PNG export and deck MCP tools`
- **Refs:** `docs/architecture/adr/0007-presentations-and-visual-primitives.md` sections 5, 8.2, 9 and 11 (P1); owner approval of all recommended defaults 2026-10-22. Personas: AI/MCP agent (builds the deck), Solution Architect and CX/UX (review and readout decks), PM.
- **Branch:** `feat/p1-slides`
- **Files changed:** `lib/present/{presentationSchema,presentationModel,presentationPatch}.js` (new, pure), `lib/mcp/deckTools.js` (new), `lib/mcp/{ops,server,guide}.js` (`presentation_patch` op, `update_element` `aspect`, tool registration, guide v3 "Decks"), `lib/{diagramContent,diagramLimits,dedupeIds}.js`, `lib/versions/diff.js`, `lib/merge/threeWay.js`, `components/diagram-studio/present/*` (new: `PresentMode`, `PresentationPanel`, `PresentationHost`, `SlideFrameActions`, `presentKeys`, `presentStore`, `deckActions`, `exportDeck`, `slideClone`), `components/diagram-studio/{DiagramContext,DiagramCanvas,DiagramStudio}.js` (presentations state, `patchPresentation`, ratio-locked resize, host), `packs/CorePack.js` (slide frame look), `ui/{TitleBar,ContextualToolbar,CompareSummary,AgentIndicator}.js`, `migrations/normalizeContent.js`, `live/livePickup.js`, `export/diagramJson.js`; `skills/ontographia-lab/*` and the skill zip; ADR-0007 section 14.
- **Deviations from the design:** see ADR-0007 section 14 (own panel instead of a History tab, static clone for present mode, SVG thumbnails, `frameIds` on `slide_add`, no undo for deck edits). No new dependency, no migration.
- **Not verified:** a real claude.ai session building a deck (needs the deployed connector); full screen in Safari and Firefox; touch swipe on a real device. Everything else was run in headless Chrome against a throwaway database.
- **Tests:** unit and component (`presentationSchema`, `presentationPatch`, `presentationDiffMerge`, `mcpDeckTools`, `presentation`, `presentKeys`, `presentExport`, `presentationState`, updated `mcpServer` / `mcpAgentActivity`), db (`diagramRepositoryAgentEdit`: one version and one audit row per deck call, restore brings back the order), and `__tests__/e2e/slides.test.js` (6 tests).

## Slice P2 — Text presets, board theme, slide layouts, composition blocks, self-hosted fonts (ADR-0007)

- **PR title:** `feat(present): slice P2 text presets, board theme, layouts, composition blocks and self-hosted fonts`
- **Refs:** `docs/architecture/adr/0007-presentations-and-visual-primitives.md` sections 4 (D4, D5), 5.2, 6, 9 and 11 (P2); Q-P11 (fonts). Personas: AI/MCP agent (a presentable deck out of the box), Solution Architect, CX/UX, PM.
- **Branch:** `feat/p2-presets-themes`
- **Files changed:** `lib/present/{themes,textPreset,textLayout,layouts,compose,slideBuild,styleFields,alignToSlide}.js` (new, pure), `lib/mcp/slideCompose.js` (new), `lib/mcp/{ops,deckTools,docTools,guide,server}.js`, `lib/{diagramContent,diagramLimits}.js`, `lib/versions/diff.js`, `lib/render/diagramSvg.js`, `lib/doc/docElement.js`, `lib/table/{tableSchema,tablePatch,tableSvg}.js`, `components/diagram-studio/elements/text/*` (new), `components/diagram-studio/present/{DesignControls,PresentationPanel,PresentationHost,deckActions,PresentMode,exportDeck}.js`, `components/diagram-studio/{DiagramCanvas,DiagramContext}.js`, `components/diagram-studio/packs/{CorePack,colorUtils}.js`, `components/diagram-studio/elements/{table/TableNode,doc/DocCard,doc/DocMarkdown}.js`, `components/diagram-studio/ui/{ContextualToolbar,CompareSummary,AgentIndicator}.js`, `components/diagram-studio/{export/diagramJson,live/livePickup,migrations/normalizeContent}.js`, `public/fonts/*`, `styles/fonts.css`, `pages/{_app,_document}.js`, `skills/ontographia-lab/*` (and the rebuilt zip), ADR-0007 section 15.
- **Deviations from the design:** see ADR-0007 section 15 (no theme `scale`, two extra palette tokens, body 32 and caption 22, `slide_add {slides}`, a "Design" section in the panel, the font picker limited to the self-hosted list). New dependencies: none (OFL font files only).
- **Not verified:** a real claude.ai session building a themed deck (needs the deployed connector); Safari and Firefox. Everything else was run in headless Chrome against a throwaway database, including a screenshot of each of the five slides of an agent-built deck at 1379 x 985.
- **Tests:** unit and component (see ADR-0007 section 15), db (`diagramRepositoryAgentEdit`), and `__tests__/e2e/presets-themes.test.js` (2 tests).

## Slice T1 — Text layout and autosizing: the shared module, server sizing, `fit_to_text`, and the default renderer, Core, StickyNotes, ProcessFlow and MindMap (ADR-0008)

- **PR title:** `feat(text): slice T1 shared text layout, autosizing, fit_to_text and the default, Core, StickyNotes, ProcessFlow and MindMap renderers`
- **Refs:** `docs/architecture/adr/0008-text-layout-and-autosizing.md` sections 3 to 9 and 12 (T1); `docs/architecture/investigations/text-rendering-audit.md`; owner approval of all recommended defaults 2026-10-22. Personas: AI/MCP agent (boxes come out the right size without guessing `w`/`h`), Solution Architect and CX/UX (long labels, German and Japanese), PM (exports match the canvas, later slices).
- **Branch:** `feat/t1-text-layout`
- **Files changed:** `lib/text/*` and `lib/text/metrics/inter.json` (new, pure), `scripts/build-font-metrics.js` (new), `public/fonts/inter-latin-ext-*.woff2` (new files), `styles/{fonts,diagram-studio,diagram-studio-tokens}.css`, `next.config.js` (a comment only), `components/diagram-studio/text/*` (new), `components/diagram-studio/{DiagramCanvas,DiagramStudio,LeftPalette}.js`, `components/diagram-studio/ui/{ContextualToolbar,CommandPalette}.js`, `components/diagram-studio/packs/{CorePack,ProcessFlowPack,StickyNotesPack,MindMapPack,NodeLabels}.js`, `lib/mcp/{ops,structure,placement,server,guide}.js`, `lib/present/{textLayout,styleFields}.js`, `lib/render/diagramSvg.js` (passes the theme), `skills/ontographia-lab/*`, `jest.config.js` (db test registered), the ADR (Accepted, section 16 as-built).
- **Deviations from the design:** see ADR-0008 section 16.2 (rule-based CJK breaks, external labels widen for one long word, proportional growth of inscribed shapes, label-edit re-fit rule without a stored flag, no `layout_apply fitToText`, "Fit all" in the command palette instead of the board menu). New dependencies: none; new files: Inter Latin Extended woff2 under new names.
- **Verification:** the audit harness on the four packs, 490 nodes per path: 287 defective cells before, 0 after (editor, `map_structure`, `add_element`, legacy default sizes); clamps always carry a badge and a tooltip; no text below 11 px; the 5-slide P2 deck re-run (accent bar regression found and fixed: `showLabel: false`). Performance numbers in ADR section 16.3 (layout 0.014 ms per label cold, 0 layout calls while panning, 5,000-element initial render slower, level of detail is T4).
- **Not verified:** Windows and Safari font fallbacks; a real claude.ai session using `fit_to_text`.
- **Tests:** unit (`textSegment`, `textLayout`, `textMetrics`, `textFit`, `textServerSizing`, `presentTextLayout`, `textBlock`, updated `packRendering` / `stencilAudit` / `stencilTemplates`), db (`textFitToTextDb`: one agent version and one audit event per call, locked elements untouched), e2e (`text-metrics`: tables vs Chrome within 1%; `text-layout`: editor autosize, Shift+Enter, DOM lines equal Node lines, "Fit to text" in one undo step, legacy board writes nothing, `map_structure` long labels).

## Slice T2 — Text layout: the remaining packs, connection labels and table cells (ADR-0008)

- **PR title:** `feat(text): slice T2 TOGAF, ITIL, CapabilityMap, ProductDesign, ERD, UML and CLD renderers, connection labels and table cells on the shared text layout`
- **Refs:** `docs/architecture/adr/0008-text-layout-and-autosizing.md` sections 4, 5, 7, 8 and 12 (T2), as-built in section 17. Personas: AI/MCP agent (sizes for every pack), Solution Architect (TOGAF, ArchiMate, ERD, UML, capability maps), CX/UX (product design cards), PM.
- **Branch:** `feat/t2-text-layout`
- **Files changed:** `lib/text/{policy,policyKit,fit,tokens,connectionLabel}.js`, `lib/text/policies/*.js` (new, one per T2 pack), `components/diagram-studio/text/{useTextLayout,SvgTextBlock}.js`, `components/diagram-studio/packs/{TOGAF,ITIL,CapabilityMap,ProductDesign,ERD,UMLClass,CLD}Pack.js`, `NodeLabels.js`, `StickyNotesPack.js`, `MindMapPack.js`, `CorePack.js`, `components/diagram-studio/connections/{Connection,labels/*,geometry/labelPositioning}.js`, `components/diagram-studio/elements/table/TableNode.js`, `lib/table/{tableModel,tableSvg}.js`, `lib/mcp/guide.js`, the `ontographia-lab` skill, `styles/diagram-studio.css`.
- **Deviations from the design:** see ADR-0008 section 17.2 (per-pack policy files, compartment policies, icon columns, 14 px labels, SVG connection labels with `<title>`, hyphenated emergency breaks in table cells). No new dependency, no migration.
- **Verification:** the audit harness on the seven packs, 1,380 nodes per path: 355 (editor), 421 (`map_structure`) and 660 (legacy default sizes) defective cells before, 0 after; no text under 11 px; clamps carry a badge or tooltip; TOGAF and ITIL labels clear the bottom border (70 and 30 within 6 px before, 0 after). 500-element mixed board: +1.6% time to all nodes (noise about 8%).
- **Not verified:** Windows and Safari fallbacks; a real claude.ai session; PNG/PDF export parity (T3).
- **Tests:** unit and component (`textSlot`, `textT2Sizing`, `textT2Structure`, `textTitleSlots`, `packsTypeScale`, `connectionLabelText` x2, `tableCellText`, `textUml`, `textTogafItil`, `textProductCap`, `textCldErd`, updated `tableNode`, `reviewFixes`, `stencilTemplates`, `textBlock`), e2e `text-t2` (10 tests).

