-- 0007_diagram_members  (slice 5: sharing with existing users; ADR-0003, data-model.md)
-- Direct grants of a role on a diagram to a user. The owner stays on diagrams.owner_id (never a row here).
-- Purely additive and idempotent (new table + index, IF NOT EXISTS); no existing data is touched, so it is safe
-- under the runner's lock_timeout / statement_timeout. The unused legacy diagram_shares table is left in place.

CREATE TABLE IF NOT EXISTS diagram_members (
  diagram_id  UUID NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  role        TEXT NOT NULL,
  granted_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (diagram_id, user_id),
  CONSTRAINT diagram_members_role_check CHECK (role IN ('viewer', 'commenter', 'editor'))
);

-- "Shared with me" and the per-request role lookup
CREATE INDEX IF NOT EXISTS idx_members_user ON diagram_members (user_id, diagram_id);
