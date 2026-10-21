// lib/mcp/createTool.js
// MCP tool diagram_create: a new, private board ("new workspace") owned by the signed-in user (owner request 2026-10-21).
//
// - Only editor-capped principals may create (personal ogl_ editor tokens, OAuth editor grants incl. the admin
//   all_diagrams grant). Viewer / commenter: "role does not permit".
// - The board is made by the SAME repository function as POST /api/diagrams (diagramRepository.createDiagram: same type
//   as the dashboard's dialog, same short id (LAB-n), same initial content and revision, same name auto-numbering), with the
//   caller's user as owner. No sharing is granted (agents cannot manage sharing).
// - A credential restricted by an allowlist (personal token diagram_ids, OAuth grant diagram_ids) gets the new id appended
//   to ITS OWN list in the same transaction (never to another token or grant). An all_diagrams grant needs nothing.
// - The credential is re-checked under a row lock inside the transaction (not revoked or expired, user active, admin
//   role still held for all_diagrams), so a revocation that lands after authentication still wins.
// - Rate limit: 10 creates per hour per credential, on top of the shared write limiter.
// - Audit: one `diagram.agent_create` event (actor_type agent, on_behalf_of the user, credential id; no content), written
//   in the same transaction. The normal create path makes no initial version, so none is made here; the first agent edit
//   makes the versions (created_via 'agent').

import { z } from 'zod';
import { getClient } from '../db';
import { AuthzError } from '../authz';
import { diagramRepository } from '../diagramRepository';
import { validateMetadata, MAX_DESCRIPTION_LENGTH } from '../diagramMetadata';
import { MAX_ALLOWLIST } from '../apiTokens';
import { rateLimit } from '../rateLimit';
import { labOrigin } from './showTool';

export const CREATE_LIMIT_PER_HOUR = 10;
export const MAX_NAME_LENGTH = 255; // same as the UI dialog and POST /api/diagrams
export const BOARD_TYPE = 'infinite-canvas'; // what the dashboard's "New workspace" dialog creates

// Per process, like the other MCP limiters.
const defaultCreateLimiter = rateLimit({ interval: 60 * 60 * 1000, limit: CREATE_LIMIT_PER_HOUR, prefix: 'mcp-create' });

class CreateRefused extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const hasWholeBoardAccess = (principal) => principal.credential === 'oauth' && principal.allDiagrams === true && !principal.diagramScope;

/** Role gate (before anything is counted or written): editor-capped, and either an allowlist or the admin all-boards grant. */
function assertMayCreate(principal) {
  const scope = Array.isArray(principal.diagramScope) ? principal.diagramScope : null;
  if (principal.kind !== 'agent' || principal.roleCap !== 'editor' || !(hasWholeBoardAccess(principal) || (scope && scope.length > 0))) {
    throw new AuthzError(403, 'FORBIDDEN', 'Access denied');
  }
}

/** Lock the credential row and confirm it is still valid right now. Returns its current allowlist (null = none). */
async function lockCredential(client, principal) {
  if (principal.credential === 'oauth') {
    const { rows } = await client.query(
      `SELECT g.diagram_ids, g.all_diagrams, u.role AS user_role
         FROM oauth_grants g JOIN users u ON u.id = g.user_id
        WHERE g.id = $1 AND g.user_id = $2 AND g.role_cap = 'editor' AND g.revoked_at IS NULL
          AND (g.expires_at IS NULL OR g.expires_at > NOW()) AND u.status = 'active'
        FOR UPDATE OF g`,
      [principal.tokenId, principal.userId]
    );
    const row = rows[0];
    if (!row) throw new AuthzError(403, 'FORBIDDEN', 'Access denied');
    if (row.all_diagrams) {
      if (row.user_role !== 'admin') throw new AuthzError(403, 'FORBIDDEN', 'Access denied');
      return { allBoards: true, list: null };
    }
    return { allBoards: false, list: row.diagram_ids || [] };
  }
  const { rows } = await client.query(
    `SELECT t.diagram_ids
       FROM api_tokens t JOIN users u ON u.id = t.user_id
      WHERE t.id = $1 AND t.user_id = $2 AND t.role_cap = 'editor' AND t.revoked_at IS NULL
        AND (t.expires_at IS NULL OR t.expires_at > NOW()) AND u.status = 'active'
      FOR UPDATE OF t`,
    [principal.tokenId, principal.userId]
  );
  if (!rows[0]) throw new AuthzError(403, 'FORBIDDEN', 'Access denied');
  return { allBoards: false, list: rows[0].diagram_ids || [] };
}

/**
 * Create the board, extend the credential's own allowlist and record the audit event in ONE transaction.
 * @returns {Promise<object>} the diagrams row
 */
export async function createBoardForAgent(principal, { name, description, email }) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const cred = await lockCredential(client, principal);
    if (!cred.allBoards && cred.list.length >= MAX_ALLOWLIST) {
      throw new CreateRefused(
        'ALLOWLIST_FULL',
        `This connection's board list is full (${MAX_ALLOWLIST} boards), so it cannot take another one. Nothing was created. The user can disconnect and reconnect to choose boards again.`
      );
    }
    const row = await diagramRepository.createDiagram(
      { type: BOARD_TYPE, name, description: description || undefined },
      email,
      principal.userId,
      { client }
    );
    if (!cred.allBoards) {
      const table = principal.credential === 'oauth' ? 'oauth_grants' : 'api_tokens';
      const upd = await client.query(`UPDATE ${table} SET diagram_ids = array_append(diagram_ids, $1::uuid) WHERE id = $2`, [row.id, principal.tokenId]);
      if (upd.rowCount !== 1) throw new AuthzError(403, 'FORBIDDEN', 'Access denied');
    }
    await client.query(
      `INSERT INTO audit_events (actor_type, actor_user_id, on_behalf_of, action, diagram_id, target)
       VALUES ('agent', NULL, $1, 'diagram.agent_create', $2, $3::jsonb)`,
      [principal.userId, row.id, JSON.stringify({ tokenId: principal.tokenId || null, ...(principal.credential ? { credential: principal.credential } : {}), shortId: row.short_id })]
    );
    await client.query('COMMIT');
    return row;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { /* connection may be gone */ }
    throw err;
  } finally {
    client.release();
  }
}

const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };

export function registerCreateTool(server, { principal, repo, writeLimiter, createLimiter, origin, ok, failWith, wrap, ToolInputError }) {
  const limiter = createLimiter || defaultCreateLimiter;
  const base = labOrigin(origin);

  server.registerTool(
    'diagram_create',
    {
      title: 'Create a new board',
      description:
        'Create a new, empty, private board (workspace) owned by the user, named by you. Needs an editor connection. No one else is given access; ' +
        'sharing is done by the user in the lab. The new board is added to this connection\'s allowed boards automatically. ' +
        `At most ${CREATE_LIMIT_PER_HOUR} boards per hour per connection. Returns id, shortId, revision and an "Open in lab" url. ` +
        'Then build on it: map_structure or diagram_apply_ops with baseRevision set to the returned revision, and diagram_show to show it.',
      inputSchema: {
        name: z.string().max(1000).describe(`Board name (1-${MAX_NAME_LENGTH} characters). If you already own a board with this name, the lab numbers it "(1)", "(2)"`),
        description: z.string().max(10000).optional().describe(`Optional short description (up to ${MAX_DESCRIPTION_LENGTH} characters)`),
      },
      annotations: { title: 'Create a new board', ...WRITE },
    },
    wrap(async ({ name, description }) => {
      // Counted before authorization, like every agent write, so probing with a token that cannot write is limited too.
      if (writeLimiter) {
        const rate = writeLimiter.consume(principal.tokenId);
        if (!rate.success) {
          return failWith(`Write rate limit reached for this token. Retry in about ${rate.resetIn} seconds.`, { code: 'RATE_LIMITED', retryAfterSeconds: rate.resetIn });
        }
      }
      assertMayCreate(principal);
      const cap = limiter.consume(principal.tokenId);
      if (!cap.success) {
        return failWith(
          `Board creation limit reached: at most ${CREATE_LIMIT_PER_HOUR} new boards per hour per connection. Retry in about ${cap.resetIn} seconds.`,
          { code: 'RATE_LIMITED', retryAfterSeconds: cap.resetIn }
        );
      }

      const trimmed = typeof name === 'string' ? name.trim() : '';
      if (!trimmed) throw new ToolInputError('name is required');
      if (trimmed.length > MAX_NAME_LENGTH) throw new ToolInputError(`name must be at most ${MAX_NAME_LENGTH} characters`);
      const metaError = validateMetadata({ description });
      if (metaError) throw new ToolInputError(metaError);

      const email = await repo.getUserEmail(principal.userId);
      if (!email) throw new ToolInputError('The connected account could not be resolved.');
      let row;
      try {
        row = await createBoardForAgent(principal, { name: trimmed, description, email });
      } catch (err) {
        if (err instanceof CreateRefused) return failWith(err.message, { code: err.code });
        throw err;
      }
      // Later messages of the same request (a JSON-RPC batch) see the new board: the request's principal shares this array
      // with the server's write gate. The next request reads the stored allowlist afresh.
      if (Array.isArray(principal.diagramScope) && !principal.diagramScope.includes(row.id)) principal.diagramScope.push(row.id);
      const shortId = row.short_id;
      return ok({
        id: row.id,
        shortId,
        name: row.name,
        revision: Number(row.revision),
        ...(base ? { url: `${base}/diagram/${shortId}` } : { path: `/diagram/${shortId}` }),
        next: `The board is empty and private to the user. Build on it with map_structure or diagram_apply_ops using baseRevision ${Number(row.revision)}, then call diagram_show so the user sees it.`,
      });
    })
  );
}
