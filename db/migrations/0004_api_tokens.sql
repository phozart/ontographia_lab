-- 0004_api_tokens  (MCP slice M1; docs/architecture/investigations/mcp-and-embedding.md section 6)
-- Personal API tokens for non-interactive clients (the MCP endpoint). Only a SHA-256 hash of the secret is stored;
-- the plaintext is shown once at creation and cannot be recovered.
-- Purely additive and idempotent (new table, IF NOT EXISTS). No data is touched, so it is safe under the runner's
-- lock_timeout (15s) and statement_timeout (5min).

CREATE TABLE IF NOT EXISTS api_tokens (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          VARCHAR(100) NOT NULL,
  token_prefix  VARCHAR(16) NOT NULL,                      -- first characters of the secret, for display only
  token_hash    CHAR(64) NOT NULL,                         -- hex SHA-256 of the full secret
  role_cap      VARCHAR(20) NOT NULL DEFAULT 'viewer',     -- the token never exceeds this role on any diagram
  diagram_ids   UUID[],                                    -- NULL = every diagram the user can reach; else an allowlist
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_used_at  TIMESTAMP WITH TIME ZONE,
  expires_at    TIMESTAMP WITH TIME ZONE,                  -- NULL = never expires
  revoked_at    TIMESTAMP WITH TIME ZONE,
  CONSTRAINT api_tokens_role_cap_check CHECK (role_cap IN ('viewer', 'commenter'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_api_tokens_hash ON api_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_api_tokens_user ON api_tokens (user_id, created_at DESC);
