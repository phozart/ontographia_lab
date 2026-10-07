# ADR-0001 — Version history

- Status: **Proposed** (awaiting product-owner approval)
- Group: B (server-persisted collaboration artifacts)
- Personas: Solution Architect (ADR/dependency maps evolve; "what did the landscape look like at decision time?"), CX/UX (journey maps before/after a research round), PM (baseline vs. current plan), AI/MCP agent (read history, diff, checkpoint before bulk edits).
- Primitive exposed: **immutable, addressable snapshot of a diagram** + **structural diff between any two snapshots**.

## Context

- `diagram_versions(diagram_id, version_number, content, created_by)` and `diagramRepository.saveVersion/getVersions` exist but nothing calls them; no API, no UI.
- The editor autosaves with a 1 s debounce (`DiagramContext.js` autosave effect), so "one version per save" would mean hundreds of versions per session.
- Local undo/redo (`historyPast/historyFuture`) is in-memory, per tab, and reset on load. It is not history in the durable sense and stays separate.
- Content is a single JSONB blob, typically tens to a few hundred KB.

## Real-world analogy

An architect's **drawing register**: the working drawing on the desk changes constantly (autosave), but at meaningful moments a dated, numbered **issue** is filed in the drawer ("Rev C — issued for review"). Issues are never altered or destroyed; to go back, you take a copy of Rev B and put it on the desk — which itself becomes Rev E. Comparing revisions is laying two sheets on a light table and marking what moved, appeared or disappeared ("clouding").

That gives us: two kinds of versions (automatic _checkpoints_ = the office's periodic microfilm; _named_ versions = formal issues), immutability, restore-as-new-revision, and diff-by-identity (the same component on two sheets).

## Options considered

### A. When versions are created

| Option                                                   | Pros                               | Cons                                                   |
| -------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------ |
| A1. Every save                                           | Simple, complete                   | 1 s autosave → explosion; history unusable to humans   |
| A2. Manual named only                                    | Meaningful, small                  | Users forget; no safety net for accidental destruction |
| **A3. Named + throttled automatic checkpoints (chosen)** | Safety net + meaningful milestones | Needs throttle + retention rules                       |

### B. Storage

| Option                                           | Pros                                                                                                                                          | Cons                                                                                                                                                              |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **B1. Full JSONB snapshot per version (chosen)** | Restore/read is O(1); robust to content-schema evolution; trivially readable by agents; PostgreSQL TOAST compresses large JSONB automatically | Larger storage                                                                                                                                                    |
| B2. Forward/reverse diffs (JSON Patch) chain     | Small                                                                                                                                         | Reading version N replays a chain; one bad patch corrupts all later versions; patches break when the content schema changes; diffing needs materialization anyway |
| B3. Keyframe + diffs                             | Middle ground                                                                                                                                 | Complexity not justified at current scale                                                                                                                         |

Rough cost: a 200-element diagram ≈ 100 KB JSON → ~20–35 KB after TOAST compression. With the retention below (≤ ~50 auto + named per diagram) that is ~1–2 MB per heavily edited diagram. Revisit B3 only if `pg_total_relation_size('diagram_versions')` becomes a real cost.

### C. Restore semantics

| Option                                                                                                               | Chosen?          |
| -------------------------------------------------------------------------------------------------------------------- | ---------------- |
| Overwrite and delete later versions                                                                                  | No — destructive |
| **Copy version content into the diagram and record a new version of kind `restore` referencing the source (chosen)** | Yes              |

### D. Compare

| Option                                                                                                                                  | Chosen?                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Visual pixel/overlay diff                                                                                                               | Later, UI only                                                                           |
| **Structural diff by stable id (elements, connections, layers, groups): added / removed / changed (with changed field paths) (chosen)** | Yes — one pure module `lib/versions/diff.js`, used by the API, the UI and the MCP server |

## Decision

1. **Version kinds**: `auto` (checkpoint), `named` (user- or agent-created, has `label`, optional `description`), `restore` (created by a restore, has `restored_from_version_id`), `pre_restore` (automatic checkpoint of the head taken immediately before a restore when the head differs from the latest version).
2. **Automatic checkpoints are created server-side inside the content-write path** (the same transaction as `UPDATE diagrams`), never by the client. Rule: create an `auto` version when content changed (hash differs from the latest version) **and** the latest version is older than `VERSION_AUTO_INTERVAL` (default **10 min**). Because it is server-side, writes from the future socket server or an MCP agent produce history identically.
   - Consequence: the version captures the state _at the first save after the interval_, i.e. the start of an editing burst plus at most one save. To guarantee the _end_ of a session is captured, the client additionally calls `POST /versions` with `kind:'auto'` on `beforeunload`/editor close (server applies the same hash dedupe; throttle is skipped for this "session end" checkpoint). See open question Q-V2.
3. **Dedupe** by `content_hash` (SHA-256 of canonical JSON, excluding `viewport`): never store two consecutive versions with identical content.
4. **Numbering**: `version_number` is allocated from a per-diagram counter (`diagrams.version_seq`, incremented with `UPDATE … RETURNING`) inside the transaction — the current `MAX()+1` in `saveVersion` races.
5. **Restore** (role ≥ editor) is one transaction: lock diagram row → if head ≠ latest version, insert `pre_restore` → set `diagrams.content` = source content, bump `revision` → insert `restore` version → audit event `version.restore`. Never deletes anything. Comments are untouched (ADR-0002: element-anchored threads re-attach automatically if the restored content contains their element).
6. **Retention** (default, see Q-V1): `named`, `restore` and `pre_restore` are kept for the diagram's lifetime. `auto` versions are thinned by a periodic job: keep all from the last 24 h, then one per day for 30 days, then one per week; hard cap 100 `auto` per diagram. Versions are deleted with the diagram (`ON DELETE CASCADE`).
7. **List returns metadata only** (no `content`); fetching a single version returns content. Size and summary counts (`element_count`, `connection_count`) are stored at write time so the list is cheap.
8. **Compare**: `GET /versions/{a}/diff?against={b|head}` returns the structural diff. The UI can additionally overlay the two snapshots on the canvas (read-only), highlighting added/removed/changed ids — a later slice.
9. **Undo/redo stays client-local** and is not merged with server versions.

```mermaid
sequenceDiagram
  participant E as Editor
  participant API as PUT /api/diagrams/:id
  participant DB as PostgreSQL
  E->>API: PUT content (If-Match: revision)
  API->>DB: BEGIN; SELECT … FOR UPDATE
  API->>DB: UPDATE diagrams SET content, revision=revision+1
  alt hash changed AND latest version older than 10 min
    API->>DB: INSERT diagram_versions(kind='auto')
  end
  API->>DB: COMMIT
```

## Consequences

- - Safety net with no user action; named versions give PMs/architects baselines; agents can checkpoint before bulk edits.
- - Restore is non-destructive and auditable; history is linear and easy to reason about.
- − Storage grows with full snapshots; bounded by retention and dedupe; monitored via table size.
- − The save path gains a transaction and a hash computation (~ms for typical content). Hash is computed on the canonicalized object already in memory.
- − Session-end checkpoint depends on the client reaching the server on unload (best effort); throttled auto checkpoints are the guarantee.
- Requires slice 0 (single PUT per save) first, otherwise snapshots store the malformed second write.
- Requires the migration mechanism in [data-model.md](../data-model.md).

## Not decided here

Retention numbers and whether version count is a pricing lever (Q-V1, Q-P1); version-level comments ("comment on Rev C") — not in scope; branches/forks ("duplicate from version" is cheap to add later as _create diagram from version content_).

## As built — slice 2 (named versions + restore)

- Shipped: migration `0003_versions`, `lib/versions/contentHash.js` (canonical hash, viewport excluded), `lib/versionRepository.js` (every write under the diagram row lock), the versions API (see api-contracts section 3 "As built"), a History panel (title-bar menu -> "Version history...").
- Restore follows decision 5 exactly. Additions: restoring a version equal to the head is a no-op; the source content is re-validated with the normal content rules (a version that no longer validates answers 422 instead of poisoning the head).
- **Editor integration.** `DiagramContext.restoreFromVersion`: lock autosave -> flush unsaved local edits (they become the `pre_restore` snapshot instead of being lost; if the flush fails nothing is restored) -> `POST restore` with `If-Match` -> reload the head via `GET` (new content, new revision, undo history and selection reset). The server's `If-Match` check is the second line of defense: a stale autosave after a restore gets 409, never overwrites.
- **Preview.** A static SVG image generated from the version content by the export module's data-driven renderer (`ExportManager.exportSVG`), shown in an `<img>` (data URL). A live read-only canvas was rejected for now: `DiagramCanvas` and its hooks all read the single `DiagramContext`, and there is no "render other content read-only" mode until the sharing slice adds `readOnly`. Trade-off: simplified shapes (generic rect/ellipse/diamond + labels + straight connections), not pack-accurate. Content is allow-listed before it reaches the SVG markup. The compare slice (8) can replace this with an on-canvas overlay.
- Not in this slice (done in slice 3, below): automatic checkpoints, dedupe on the save path, pruning, `kind:'auto'` creation. Still later: diff (slice 8); owner-only version deletion (Q-V3, later); audit table (slice 5, until then `lib/audit.js` logs one `AUDIT {json}` line).

## As built — slice 3 (auto checkpoints + retention)

- **Where.** `diagramRepository.updateDiagram` runs the content `UPDATE` and `createAutoIfDue` (`lib/versionRepository.js`) in one transaction; the UPDATE row lock serializes concurrent saves. Rule exactly as decision 2: content hash (viewport excluded) differs from the latest version of any kind AND the latest version is older than `VERSION_AUTO_INTERVAL_MS` (10 min), or the diagram has no version yet. A failed compare-and-set, a metadata-only PUT and a thumbnail-only PUT never create a version. A checkpoint failure rolls the save back (history is never silently skipped).
- **Retention (Q-V1)** is prune-on-write, only after an `auto` version is created, bounded to one diagram and at most `PRUNE_SCAN_LIMIT` (1000) rows of metadata: `lib/versions/retention.js` `planRetention` (pure, clock injected) keeps all `auto` up to 24 h old, then the newest per UTC day up to 30 days, then the newest per UTC week (Monday start), then caps at 100 (oldest dropped first, the newest never). `named`, `restore` and `pre_restore` are never selected or deleted; naming an `auto` version turns it `named`, which exempts it. Constants in `lib/versions/policy.js`. An `auto` version that a `restore` row points to (`restored_from_version_id`) is never pruned, so restore provenance is not lost; such versions are excluded from planning and do not count toward the 100 cap (SQL-guarded in both the select and the delete). No migration (slice 2 indexes cover the queries).
- **Session end (Q-V2).** `POST /versions { kind: "auto", reason: "session_end" }` (editor, `version.create`): snapshots the saved head if its hash differs from the latest version, skipping the 10-minute throttle; `201 VersionMeta` or `200 { deduplicated: true, version }`. Rate limited to 6/min per user and diagram (429). The editor sends it with `fetch(..., { keepalive: true })` on `pagehide` and `visibilitychange -> hidden`, only for owner/editor, only when a save happened since load or the last checkpoint. It captures what is saved, not unsaved local edits (a keepalive PUT of a large body is not reliable); the existing unload save covers those on a best-effort basis.
- **History panel.** Shows `auto` versions (title "Autosave") with a "Show autosaves" toggle (default on) so named versions are not buried; no day grouping yet.
