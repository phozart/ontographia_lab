-- 0011_diagram_edit_sessions  (ADR-0006 slice LA-3: activity timeline)
-- One row per (diagram, human user, burst of saves): a save extends the person's open session when its last_at is less
-- than 10 minutes old, otherwise it opens a new one (written in the same transaction as the content UPDATE).
-- No content and no counts: Compare computes them on demand. Agent edits are not recorded here (one audit row each).
-- Retention 365 days (Q-LA3), pruned opportunistically by the application.
-- Additive and idempotent: one new table and two indexes, nothing existing is altered.

CREATE TABLE IF NOT EXISTS diagram_edit_sessions (
  id             BIGSERIAL PRIMARY KEY,
  diagram_id     UUID NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
  actor_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  first_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  save_count     INTEGER NOT NULL DEFAULT 1,
  revision_from  BIGINT NOT NULL,
  revision_to    BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_edit_sessions_diagram ON diagram_edit_sessions (diagram_id, last_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_edit_sessions_open ON diagram_edit_sessions (diagram_id, actor_user_id, last_at DESC);
