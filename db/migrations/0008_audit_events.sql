-- 0008_audit_events  (slice 5: append-only audit trail; ADR-0003 section 8, data-model.md)
-- Application code only INSERTs (no UPDATE/DELETE outside the retention job, 365 days, Q-A2).
-- diagram_id has no foreign key on purpose: events outlive deleted diagrams. No IP addresses or raw tokens are stored.
-- Purely additive and idempotent.

CREATE TABLE IF NOT EXISTS audit_events (
  id             BIGSERIAL PRIMARY KEY,
  occurred_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  actor_type     TEXT NOT NULL,
  actor_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  on_behalf_of   UUID REFERENCES users(id) ON DELETE SET NULL,
  action         TEXT NOT NULL,
  diagram_id     UUID,
  target         JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT audit_events_actor_type_check CHECK (actor_type IN ('user', 'link', 'agent', 'admin', 'system'))
);

CREATE INDEX IF NOT EXISTS idx_audit_diagram ON audit_events (diagram_id, occurred_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor   ON audit_events (actor_user_id, occurred_at DESC);
