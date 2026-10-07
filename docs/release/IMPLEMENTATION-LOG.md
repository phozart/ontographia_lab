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
