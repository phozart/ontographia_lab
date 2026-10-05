-- 0001_baseline
-- Brings ANY existing database (empty, created from init.sql, or an older production volume that
-- was altered by lib/db.js#runMigrations / scripts/init-db.js) to the baseline schema.
-- Fully idempotent: every statement is IF NOT EXISTS / guarded, and it never rewrites existing data.
-- Replaces the unrecorded runtime migration formerly in lib/db.js (short_id add + backfill).
-- The runner records this file in schema_migrations.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------
-- users
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  image TEXT,
  provider VARCHAR(50),
  provider_id VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user',
  status VARCHAR(50) DEFAULT 'pending',
  password_hash TEXT,
  email_verified BOOLEAN DEFAULT FALSE,
  reset_token TEXT,
  reset_token_expires TIMESTAMP WITH TIME ZONE,
  accepted_terms BOOLEAN DEFAULT FALSE,
  accepted_terms_at TIMESTAMP WITH TIME ZONE,
  accepted_privacy BOOLEAN DEFAULT FALSE,
  accepted_privacy_at TIMESTAMP WITH TIME ZONE,
  subscription_tier VARCHAR(50) DEFAULT 'free',
  subscription_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES users(id),
  last_login TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Columns that older volumes may lack (previously added by scripts/init-db.js)
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS accepted_terms BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS accepted_terms_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS accepted_privacy BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS accepted_privacy_at TIMESTAMP WITH TIME ZONE;

-- ------------------------------------------------------------
-- diagrams, diagram_versions, diagram_shares
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS diagrams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  short_id VARCHAR(20) UNIQUE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL,
  description TEXT,
  content JSONB DEFAULT '{"nodes": [], "edges": [], "viewport": {"x": 0, "y": 0, "zoom": 1}}'::jsonb,
  thumbnail TEXT,
  tags TEXT[] DEFAULT '{}',
  is_template BOOLEAN DEFAULT false,
  domain_id UUID,
  project_id UUID,
  owner_id UUID REFERENCES users(id),
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- short_id: formerly added at runtime by lib/db.js#runMigrations
ALTER TABLE diagrams ADD COLUMN IF NOT EXISTS short_id VARCHAR(20) UNIQUE;

CREATE TABLE IF NOT EXISTS diagram_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  diagram_id UUID NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content JSONB NOT NULL,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(diagram_id, version_number)
);

CREATE TABLE IF NOT EXISTS diagram_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  diagram_id UUID NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
  shared_with VARCHAR(255) NOT NULL,
  permission VARCHAR(50) DEFAULT 'view',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(diagram_id, shared_with)
);

-- ------------------------------------------------------------
-- user_settings
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email VARCHAR(255) UNIQUE NOT NULL,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_diagrams_type ON diagrams(type);
CREATE INDEX IF NOT EXISTS idx_diagrams_short_id ON diagrams(short_id);
CREATE INDEX IF NOT EXISTS idx_diagrams_created_by ON diagrams(created_by);
CREATE INDEX IF NOT EXISTS idx_diagrams_owner ON diagrams(owner_id);
CREATE INDEX IF NOT EXISTS idx_diagrams_domain ON diagrams(domain_id);
CREATE INDEX IF NOT EXISTS idx_diagrams_project ON diagrams(project_id);
CREATE INDEX IF NOT EXISTS idx_diagram_versions_diagram ON diagram_versions(diagram_id);
CREATE INDEX IF NOT EXISTS idx_diagram_shares_diagram ON diagram_shares(diagram_id);
CREATE INDEX IF NOT EXISTS idx_diagram_shares_user ON diagram_shares(shared_with);
CREATE INDEX IF NOT EXISTS idx_user_settings_email ON user_settings(user_email);

-- ------------------------------------------------------------
-- Backfill short_id (LAB-n) ONLY for rows that have none, continuing after the highest
-- existing number so previously issued ids are never rewritten or duplicated.
-- ------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
  n INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(short_id FROM 5) AS INTEGER)), 0)
    INTO n
    FROM diagrams
   WHERE short_id ~ '^LAB-[0-9]{1,9}$';

  FOR r IN SELECT id FROM diagrams WHERE short_id IS NULL ORDER BY created_at ASC, id ASC LOOP
    n := n + 1;
    UPDATE diagrams SET short_id = 'LAB-' || n WHERE id = r.id;
  END LOOP;
END $$;
