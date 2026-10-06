-- 0002_diagram_identity_and_revision  (delivery-plan slice 1; data-model.md section 2)
-- Adds optimistic-concurrency + authorship columns and backfills diagrams.owner_id.
-- Purely additive and idempotent: no DROP/DELETE/TRUNCATE; the only data change is filling NULL owner_id.
-- Constant-default NOT NULL columns are metadata-only on PostgreSQL 11+ (no table rewrite), so this is safe
-- under the runner's lock_timeout (15s) and statement_timeout (5min).
--
-- Q-M1 (accepted): rows whose created_by matches no user (e.g. seed rows by 'admin') are assigned to the account
-- named by ADMIN_EMAIL (passed by scripts/migrate.js as the transaction-local setting app.admin_email); when that
-- account does not exist, to the oldest user with role 'admin'. Every such row is listed in the migration output.
-- If no admin account exists at all the rows keep owner_id NULL (nobody can open them) and are listed as well.

ALTER TABLE diagrams ADD COLUMN IF NOT EXISTS revision    BIGINT  NOT NULL DEFAULT 0;
ALTER TABLE diagrams ADD COLUMN IF NOT EXISTS version_seq INTEGER NOT NULL DEFAULT 0;
ALTER TABLE diagrams ADD COLUMN IF NOT EXISTS updated_by  UUID REFERENCES users(id) ON DELETE SET NULL;

-- Allocator for diagram_versions.version_number: continue after any existing versions
UPDATE diagrams d
   SET version_seq = v.max_version
  FROM (SELECT diagram_id, MAX(version_number) AS max_version FROM diagram_versions GROUP BY diagram_id) v
 WHERE v.diagram_id = d.id AND d.version_seq < v.max_version;

DO $$
DECLARE
  matched       INTEGER;
  assigned      INTEGER := 0;
  admin_email   TEXT := NULLIF(btrim(COALESCE(current_setting('app.admin_email', true), '')), '');
  admin_id      UUID;
  admin_source  TEXT;
  r             RECORD;
BEGIN
  -- 1. Owner by created_by (email), case-insensitive; an exact-case match wins if two accounts differ only by case
  UPDATE diagrams d
     SET owner_id = (
           SELECT u.id FROM users u
            WHERE lower(u.email) = lower(d.created_by)
            ORDER BY (u.email = d.created_by) DESC, u.created_at ASC, u.id ASC
            LIMIT 1)
   WHERE d.owner_id IS NULL
     AND EXISTS (SELECT 1 FROM users u WHERE lower(u.email) = lower(d.created_by));
  GET DIAGNOSTICS matched = ROW_COUNT;
  RAISE NOTICE '0002: owner_id set from created_by for % diagram(s)', matched;

  -- 2. Unmatched rows -> ADMIN_EMAIL account, else oldest admin user
  IF EXISTS (SELECT 1 FROM diagrams WHERE owner_id IS NULL) THEN
    IF admin_email IS NOT NULL THEN
      SELECT id INTO admin_id FROM users WHERE lower(email) = lower(admin_email) LIMIT 1;
      IF admin_id IS NOT NULL THEN admin_source := 'ADMIN_EMAIL (' || admin_email || ')'; END IF;
    END IF;
    IF admin_id IS NULL THEN
      SELECT id, 'oldest admin user (' || email || ')' INTO admin_id, admin_source
        FROM users WHERE role = 'admin' ORDER BY created_at ASC, id ASC LIMIT 1;
    END IF;

    FOR r IN SELECT id, short_id, name, created_by FROM diagrams WHERE owner_id IS NULL ORDER BY created_at, id LOOP
      IF admin_id IS NOT NULL THEN
        UPDATE diagrams SET owner_id = admin_id WHERE id = r.id;
        assigned := assigned + 1;
        RAISE NOTICE '0002: unmatched created_by=% -> % assigned to %', quote_literal(r.created_by), COALESCE(r.short_id, r.id::text), admin_source;
      ELSE
        RAISE NOTICE '0002: UNASSIGNED (no admin account found) created_by=% diagram % "%"', quote_literal(r.created_by), COALESCE(r.short_id, r.id::text), r.name;
      END IF;
    END LOOP;
    RAISE NOTICE '0002: % unmatched diagram(s) assigned to admin', assigned;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_diagrams_owner_updated ON diagrams(owner_id, updated_at DESC);
