-- 0003_versions  (delivery-plan slice 2; data-model.md section 2; ADR-0001)
-- Extends the existing diagram_versions table (name and legacy columns kept) with version kinds, labels,
-- content hash / size / counts, the diagram revision captured, restore provenance and authorship by user id.
-- Purely additive and idempotent: no DROP/DELETE/TRUNCATE. Every ADD COLUMN is nullable or has a constant
-- default (metadata-only on PostgreSQL 11+, no table rewrite), so this is safe under the runner's
-- lock_timeout (15s) / statement_timeout (5min). Existing rows read as kind 'auto', created_via 'web'.
-- content_hash stays NULL for pre-existing rows (nothing ever wrote versions before slice 2): the application
-- treats a NULL hash as "differs", so the worst case is one extra version, never a lost one.

ALTER TABLE diagram_versions ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'auto';
ALTER TABLE diagram_versions ADD COLUMN IF NOT EXISTS label VARCHAR(120);
ALTER TABLE diagram_versions ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE diagram_versions ADD COLUMN IF NOT EXISTS content_hash CHAR(64);        -- sha256 hex of canonical content (viewport excluded)
ALTER TABLE diagram_versions ADD COLUMN IF NOT EXISTS size_bytes INTEGER;
ALTER TABLE diagram_versions ADD COLUMN IF NOT EXISTS element_count INTEGER;
ALTER TABLE diagram_versions ADD COLUMN IF NOT EXISTS connection_count INTEGER;
ALTER TABLE diagram_versions ADD COLUMN IF NOT EXISTS diagram_revision BIGINT;      -- diagrams.revision captured
ALTER TABLE diagram_versions ADD COLUMN IF NOT EXISTS restored_from_version_id UUID REFERENCES diagram_versions(id) ON DELETE SET NULL;
ALTER TABLE diagram_versions ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE diagram_versions ADD COLUMN IF NOT EXISTS created_via TEXT NOT NULL DEFAULT 'web';

-- CHECK constraints are added by name inside a guard so the file can be re-run (ADD CONSTRAINT has no IF NOT EXISTS).
-- Adding a CHECK validates existing rows; all of them satisfy it (kind 'auto', created_via 'web').
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'diagram_versions_kind_check') THEN
    ALTER TABLE diagram_versions ADD CONSTRAINT diagram_versions_kind_check
      CHECK (kind IN ('auto','named','restore','pre_restore'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'diagram_versions_created_via_check') THEN
    ALTER TABLE diagram_versions ADD CONSTRAINT diagram_versions_created_via_check
      CHECK (created_via IN ('web','api','agent','system'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'diagram_versions_named_has_label') THEN
    ALTER TABLE diagram_versions ADD CONSTRAINT diagram_versions_named_has_label
      CHECK (kind <> 'named' OR label IS NOT NULL);
  END IF;
END $$;

-- Best-effort link of legacy rows' email to the user id (display falls back to created_by when NULL)
UPDATE diagram_versions v
   SET created_by_user_id = u.id
  FROM users u
 WHERE v.created_by_user_id IS NULL AND lower(u.email) = lower(v.created_by);

CREATE INDEX IF NOT EXISTS idx_versions_diagram_created ON diagram_versions(diagram_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_versions_diagram_kind    ON diagram_versions(diagram_id, kind, created_at DESC);
