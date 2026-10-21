-- 0010_oauth  (ADR-0005 slice O2: OAuth sign-in for the MCP server)
-- Additive and idempotent: three new tables, nothing existing is altered.
--   oauth_grants          a connected app: user x client x role cap x diagram allowlist (or all_diagrams for admins)
--   oauth_authorizations  a pending authorize request, then its one-time code (consumed_at: request decided;
--                         code_used_at: code redeemed, a second redemption revokes the grant)
--   oauth_tokens          opaque access and refresh tokens (SHA-256 only), refresh chain via parent_id
-- all_diagrams (owner decision 2026-10-21): an editor grant with no allowlist that covers every diagram the user can
-- edit through their live role, available to platform admins only (enforced at consent time and re-checked per request).

CREATE TABLE IF NOT EXISTS oauth_grants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  client_label VARCHAR(100) NOT NULL,
  redirect_uri TEXT NOT NULL,
  resource TEXT NOT NULL,
  scope TEXT NOT NULL,
  role_cap VARCHAR(20) NOT NULL,
  diagram_ids UUID[],
  all_diagrams BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_reason VARCHAR(30),
  CONSTRAINT oauth_grants_role_cap_check CHECK (role_cap IN ('viewer', 'commenter', 'editor')),
  CONSTRAINT oauth_grants_all_diagrams_editor_only CHECK (NOT all_diagrams OR (role_cap = 'editor' AND diagram_ids IS NULL)),
  CONSTRAINT oauth_grants_editor_requires_scope
    CHECK (role_cap <> 'editor' OR all_diagrams OR (diagram_ids IS NOT NULL AND cardinality(diagram_ids) > 0))
);
CREATE INDEX IF NOT EXISTS idx_oauth_grants_user ON oauth_grants (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS oauth_authorizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  state VARCHAR(1024),
  code_challenge CHAR(43) NOT NULL,
  resource TEXT NOT NULL,
  requested_scope TEXT,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  grant_id UUID REFERENCES oauth_grants(id) ON DELETE CASCADE,
  code_hash CHAR(64) UNIQUE,
  code_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  code_used_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_oauth_authorizations_user ON oauth_authorizations (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS oauth_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grant_id UUID NOT NULL REFERENCES oauth_grants(id) ON DELETE CASCADE,
  kind VARCHAR(10) NOT NULL CHECK (kind IN ('access', 'refresh')),
  token_hash CHAR(64) NOT NULL UNIQUE,
  parent_id UUID REFERENCES oauth_tokens(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_grant ON oauth_tokens (grant_id, kind, created_at DESC);
