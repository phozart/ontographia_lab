# Open questions — product-owner decisions

> **Decision (2026-10-05):** the product owner delegated these decisions; all recommended defaults below are **accepted** as the working baseline for implementation. Any of them can be revisited later — change the row and the corresponding policy constant.

Each item is genuinely a product/business decision. The design works with the **recommended default**; changing it is local (noted in "Impact").

## Priority — needed before the first C slice

| ID | Question | Recommended default | Impact if different |
|----|----------|---------------------|---------------------|
| **Q-S1** | Should platform admins keep implicit full access to every diagram? | **No.** Admins manage users; viewing someone's diagram is an explicit, time-boxed (24 h) "support access" (viewer), audited and visible to the owner. | Keep today's behaviour = one extra grant source in `resolveRole`; still audit every admin access to diagrams they don't hold a grant on. |
| **Q-S2** | Does accepting an invitation auto-activate a **pending** account (bypass admin approval)? | **Yes**, the inviter (an active user) vouches; audited as `invite.accept` with `activated: true`. Admins can still suspend. | If no: invitees wait in the approval queue; invitation shows "pending approval" to the inviter. |
| **Q-S3** | Can editors share, or only the owner? | Editors may share as **viewer/commenter**, and create view/comment links; only the owner grants `editor`. | One row in the policy matrix. |
| **Q-S6** | Anonymous (not signed-in) viewing through links? | **Off** at launch (`ALLOW_ANONYMOUS_LINKS=false`); links require any active account. Enable per instance later; per-link `requiresSignIn=false` only when enabled. | Anonymous view needs a read-only editor bundle path that works without a session, and is the main exposure surface — keep it opt-in. |
| **Q-S4** | Can links grant `editor`? | **No** (viewer/commenter only). | Editing via bearer link makes authorship and audit anonymous-ish; reconsider only with sign-in required. |
| **Q-S5** | Link expiry default and maximum? | Default **30 days**; "never" allowed for the owner; editors' links max 90 days. | Config constants. |

## Version history

| ID | Question | Recommended default | Impact |
|----|----------|---------------------|--------|
| Q-V1 | Auto-checkpoint interval and retention | 10 min interval; keep all for 24 h, daily for 30 days, weekly after; cap 100 `auto`/diagram; named versions forever | Constants in `lib/versions/policy.js`. |
| Q-V2 | Capture a checkpoint on editor close (session end)? | **Yes**, best-effort, deduped by hash. | Without it, up to 10 min of the last session isn't a version (the head still has it). |
| Q-V3 | May users delete named versions (e.g. accidentally saved sensitive content)? | **Owner only**, audited; restores pointing at it keep metadata. | Adds one route + `version.delete` action. |
| Q-V4 | Is "duplicate as new diagram from version" wanted? | Yes, later slice; cheap. | — |

## Comments

| ID | Question | Recommended default | Impact |
|----|----------|---------------------|--------|
| Q-C1 | Import existing localStorage comments? | **Yes**, one-time prompt for users with ≥ commenter; attributed to importer; then cleared. | If no: they stay local until the user clears storage; show a one-time notice. |
| Q-C2 | Who may resolve/reopen? Does a reply reopen? | Anyone with ≥ commenter; reply reopens. | Policy matrix row. |
| Q-C3 | Where to show threads whose element was deleted? | "Detached" group in the panel + faded marker at creation position. | Alternative (derive last position from newest version containing the element) costs a version scan. |
| Q-C4 | Mentioning someone without access | Mention does **not** grant access; UI offers "Share with @name?". | — |
| Q-C5 | Email notifications for replies/mentions — default on/off and batching | Mentions: on, immediate; replies on my threads: daily digest; per-user opt-out in settings. | Needs `lib/email.js` and a small outbox. |

## Audit, accounts, data

| ID | Question | Recommended default |
|----|----------|---------------------|
| Q-A1 | Record identities of signed-in users who open a share link? | Yes (`link.used`, once per user per link per day); owners see them. |
| Q-A2 | Audit retention | 365 days. |
| Q-M1 | Diagrams whose `created_by` matches no user (e.g. seed rows by `admin`) during `owner_id` backfill | Assign to the admin account from `ADMIN_EMAIL`; list them in the migration output. |
| Q-M2 | Diagram deletion: hard delete (today) or trash with 30-day restore? | Trash (soft delete) — consistent with "history is never destroyed"; separate slice. |
| Q-S7 | Should ownership ever belong to a workspace rather than a person? | Defer until workspaces exist; `owner_id` stays a user. |
| Q-S8 | Share-by-email reveals whether an address has an account (to users who can share). Acceptable? | Yes, with rate limiting (20 shares/hour/user). |

## Pricing / limits (Q-P1)

`users.subscription_tier` exists (`free|pro|enterprise`) but nothing reads it. Candidate levers, all enforceable at the repository layer: members per diagram, active links per diagram, named versions per diagram, auto-version retention window, comment notifications. **Recommended default:** no tier gating in B/C; apply generous global caps (50 members, 10 active links, 500 named versions per diagram) to protect the server; revisit with real usage.

## Real-time and agents

| ID | Question | Recommended default |
|----|----------|---------------------|
| Q-R1 | Offline editing in Group D? | No offline at first; read-only when disconnected. |
| Q-R2 | Is a second Node process on the server acceptable for Group D? | Yes (ADR-0004). |
| Q-AI1 | May agents manage sharing (grant/revoke)? | No in v1; agents read, comment, checkpoint and (if capped ≥ editor) edit. |
| Q-AI2 | Agent token role cap default | `commenter`. |
