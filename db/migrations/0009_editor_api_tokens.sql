-- 0009_editor_api_tokens  (MCP slice M2; docs/architecture/investigations/mcp-and-embedding.md Q-MCP2)
-- Allows api_tokens.role_cap = 'editor' so an agent can edit diagrams, and enforces at the database level that an
-- editor token always carries a non-empty diagram allowlist (smaller blast radius if the agent is steered by text
-- inside a diagram). viewer/commenter tokens are unchanged.
-- The api_tokens table is small and every existing row (viewer/commenter) satisfies both checks, so re-adding the
-- role check is instant under the runner's lock_timeout (15s) / statement_timeout (5min). Idempotent: guarded so the
-- file can be re-run.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'api_tokens_role_cap_check'
       AND pg_get_constraintdef(oid) LIKE '%editor%'
  ) THEN
    ALTER TABLE api_tokens DROP CONSTRAINT IF EXISTS api_tokens_role_cap_check;
    ALTER TABLE api_tokens ADD CONSTRAINT api_tokens_role_cap_check
      CHECK (role_cap IN ('viewer', 'commenter', 'editor'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'api_tokens_editor_requires_allowlist') THEN
    ALTER TABLE api_tokens ADD CONSTRAINT api_tokens_editor_requires_allowlist
      CHECK (role_cap <> 'editor' OR (diagram_ids IS NOT NULL AND cardinality(diagram_ids) > 0));
  END IF;
END $$;
