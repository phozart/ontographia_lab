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

That gives us: two kinds of versions (automatic *checkpoints* = the office's periodic microfilm; *named* versions = formal issues), immutability, restore-as-new-revision, and diff-by-identity (the same component on two sheets).

## Options considered

### A. When versions are created

| Option | Pros | Cons |
|--------|------|------|
| A1. Every save | Simple, complete | 1 s autosave → explosion; history unusable to humans |
| A2. Manual named only | Meaningful, small | Users forget; no safety net for accidental destruction |
| **A3. Named + throttled automatic checkpoints (chosen)** | Safety net + meaningful milestones | Needs throttle + retention rules |

### B. Storage

| Option | Pros | Cons |
|--------|------|------|
| **B1. Full JSONB snapshot per version (chosen)** | Restore/read is O(1); robust to content-schema evolution; trivially readable by agents; PostgreSQL TOAST compresses large JSONB automatically | Larger storage |
| B2. Forward/reverse diffs (JSON Patch) chain | Small | Reading version N replays a chain; one bad patch corrupts all later versions; patches break when the content schema changes; diffing needs materialization anyway |
| B3. Keyframe + diffs | Middle ground | Complexity not justified at current scale |

Rough cost: a 200-element diagram ≈ 100 KB JSON → ~20–35 KB after TOAST compression. With the retention below (≤ ~50 auto + named per diagram) that is ~1–2 MB per heavily edited diagram. Revisit B3 only if `pg_total_relation_size('diagram_versions')` becomes a real cost.

### C. Restore semantics

| Option | Chosen? |
|--------|---------|
| Overwrite and delete later versions | No — destructive |
| **Copy version content into the diagram and record a new version of kind `restore` referencing the source (chosen)** | Yes |

### D. Compare

| Option | Chosen? |
|--------|---------|
| Visual pixel/overlay diff | Later, UI only |
| **Structural diff by stable id (elements, connections, layers, groups): added / removed / changed (with changed field paths) (chosen)** | Yes — one pure module `lib/versions/diff.js`, used by the API, the UI and the MCP server |

## Decision

1. **Version kinds**: `auto` (checkpoint), `named` (user- or agent-created, has `label`, optional `description`), `restore` (created by a restore, has `restored_from_version_id`), `pre_restore` (automatic checkpoint of the head taken immediately before a restore when the head differs from the latest version).
2. **Automatic checkpoints are created server-side inside the content-write path** (the same transaction as `UPDATE diagrams`), never by the client. Rule: create an `auto` version when content changed (hash differs from the latest version) **and** the latest version is older than `VERSION_AUTO_INTERVAL` (default **10 min**). Because it is server-side, writes from the future socket server or an MCP agent produce history identically.
   - Consequence: the version captures the state *at the first save after the interval*, i.e. the start of an editing burst plus at most one save. To guarantee the *end* of a session is captured, the client additionally calls `POST /versions` with `kind:'auto'` on `beforeunload`/editor close (server applies the same hash dedupe; throttle is skipped for this "session end" checkpoint). See open question Q-V2.
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

- + Safety net with no user action; named versions give PMs/architects baselines; agents can checkpoint before bulk edits.
- + Restore is non-destructive and auditable; history is linear and easy to reason about.
- − Storage grows with full snapshots; bounded by retention and dedupe; monitored via table size.
- − The save path gains a transaction and a hash computation (~ms for typical content). Hash is computed on the canonicalized object already in memory.
- − Session-end checkpoint depends on the client reaching the server on unload (best effort); throttled auto checkpoints are the guarantee.
- Requires slice 0 (single PUT per save) first, otherwise snapshots store the malformed second write.
- Requires the migration mechanism in [data-model.md](../data-model.md).

## Not decided here

Retention numbers and whether version count is a pricing lever (Q-V1, Q-P1); version-level comments ("comment on Rev C") — not in scope; branches/forks ("duplicate from version" is cheap to add later as *create diagram from version content*).
