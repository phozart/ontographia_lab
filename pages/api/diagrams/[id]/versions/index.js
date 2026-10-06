// pages/api/diagrams/[id]/versions/index.js
// GET  list versions (metadata only)            - version.read   (viewer)
// POST name the current state                    - version.create (editor)
// api-contracts.md section 3, ADR-0001. withDiagramAuth resolves the role first (404 no access / 403 too low).

import { withDiagramAuth } from '../../../../../lib/authz/next';
import { versionRepository, VERSION_KINDS } from '../../../../../lib/versionRepository';
import { actorFrom, badRequest, notFound, withVersionErrors } from '../../../../../lib/versions/http';

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

async function handleList(req, res, { diagram }) {
  const { kind, limit, cursor } = req.query;
  if (kind !== undefined && !VERSION_KINDS.includes(kind)) return badRequest(res, `kind must be one of ${VERSION_KINDS.join(', ')}`);
  if (limit !== undefined && !/^\d{1,4}$/.test(String(limit))) return badRequest(res, 'limit must be a positive integer');
  if (cursor !== undefined && typeof cursor !== 'string') return badRequest(res, 'invalid cursor');

  return withVersionErrors(res, async () => {
    const page = await versionRepository.list(diagram.id, {
      kind: kind ?? null,
      limit: limit === undefined ? undefined : Number(limit),
      cursor: cursor ?? null,
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(page);
  });
}

async function handleCreate(req, res, { diagram, user }) {
  const body = req.body;
  if (!isPlainObject(body)) return badRequest(res, 'Request body must be a JSON object');
  const kind = body.kind === undefined ? 'named' : body.kind;
  // Automatic / session-end checkpoints are server-side (slice 3); clients can only name versions here.
  if (kind !== 'named') return badRequest(res, "Only kind 'named' can be created through this endpoint");
  if (typeof body.label !== 'string') return badRequest(res, 'label is required (1 to 120 characters)');
  if (body.description !== undefined && body.description !== null && typeof body.description !== 'string') {
    return badRequest(res, 'description must be a string');
  }

  return withVersionErrors(res, async () => {
    const result = await versionRepository.createNamed(
      diagram.id,
      { label: body.label, description: body.description ?? null },
      actorFrom(user)
    );
    if (!result) return notFound(res, 'Diagram');
    if (!result.created) return res.status(200).json({ deduplicated: true, version: result.version });
    return res.status(201).json(result.version);
  });
}

export default withDiagramAuth(
  { GET: 'version.read', POST: 'version.create' },
  (req, res, ctx) => (req.method === 'GET' ? handleList(req, res, ctx) : handleCreate(req, res, ctx))
);
