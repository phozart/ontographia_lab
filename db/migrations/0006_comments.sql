-- 0006_comments  (delivery-plan slice 4; data-model.md "comments"; ADR-0002)
-- Server-persisted, anchored comment threads. Purely additive and idempotent: only CREATE ... IF NOT EXISTS,
-- no DROP/DELETE/TRUNCATE, no change to existing tables. Comments are NOT part of diagrams.content and are not
-- versioned. Anchor attachment (attached / detached / canvas) is computed at read time against current content.
-- uuid_generate_v4() comes from the uuid-ossp extension created in 0001_baseline.

CREATE TABLE IF NOT EXISTS comment_threads (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  diagram_id          UUID NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
  anchor_type         TEXT NOT NULL CHECK (anchor_type IN ('canvas','element','connection')),
  anchor_target_id    VARCHAR(128),               -- element/connection id inside content; NULL for canvas
  anchor_x            DOUBLE PRECISION NOT NULL,  -- offset from element origin, or absolute canvas x
  anchor_y            DOUBLE PRECISION NOT NULL,
  fallback_x          DOUBLE PRECISION,           -- absolute position at creation (used when detached)
  fallback_y          DOUBLE PRECISION,
  status              TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  resolved_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at         TIMESTAMPTZ,
  created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at_revision BIGINT,
  last_activity_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((anchor_type = 'canvas') = (anchor_target_id IS NULL))
);

CREATE TABLE IF NOT EXISTS comments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id   UUID NOT NULL REFERENCES comment_threads(id) ON DELETE CASCADE,
  author_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  body        TEXT NOT NULL CHECK (char_length(body) <= 10000),
  created_via TEXT NOT NULL DEFAULT 'web' CHECK (created_via IN ('web','api','agent')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at   TIMESTAMPTZ,
  deleted_at  TIMESTAMPTZ                          -- soft delete; body set to '' on delete
);

CREATE INDEX IF NOT EXISTS idx_threads_diagram_status ON comment_threads(diagram_id, status, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_threads_anchor        ON comment_threads(diagram_id, anchor_target_id) WHERE anchor_target_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comments_thread       ON comments(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_author       ON comments(author_id, created_at DESC);
