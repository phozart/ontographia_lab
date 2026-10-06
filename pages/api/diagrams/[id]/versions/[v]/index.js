// pages/api/diagrams/[id]/versions/[v]/index.js
// GET   one version with its content           - version.read   (viewer)
// PATCH rename / describe                       - version.create (editor)
// There is deliberately no DELETE: versions are immutable; pruning is system-only (api-contracts section 3, Q-V3).

import { withDiagramAuth } from '../../../../../../lib/authz/next';
import { versionRepository } from '../../../../../../lib/versionRepository';
import { badRequest, notFound, parseVersionNumber, withVersionErrors } from '../../../../../../lib/versions/http';

const PATCHABLE = ['label', 'description'];

async function handleGet(req, res, { diagram }, number) {
  const version = await versionRepository.get(diagram.id, number);
  if (!version) return notFound(res);
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json(version);
}

async function handlePatch(req, res, { diagram }, number) {
  const body = req.body;
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return badRequest(res, 'Request body must be a JSON object');
  const keys = Object.keys(body);
  const unknown = keys.filter((k) => !PATCHABLE.includes(k));
  if (unknown.length) return badRequest(res, `Only ${PATCHABLE.join(' and ')} can be changed; versions are immutable`);
  if (keys.length === 0) return badRequest(res, 'Provide label and/or description');

  const patch = {};
  for (const k of keys) patch[k] = body[k];
  return withVersionErrors(res, async () => {
    const updated = await versionRepository.update(diagram.id, number, patch);
    if (!updated) return notFound(res);
    return res.status(200).json(updated);
  });
}

export default withDiagramAuth(
  { GET: 'version.read', PATCH: 'version.create' },
  async (req, res, ctx) => {
    const number = parseVersionNumber(req.query.v);
    if (number === null) return badRequest(res, 'Version number must be a positive integer');
    return req.method === 'GET' ? handleGet(req, res, ctx, number) : handlePatch(req, res, ctx, number);
  }
);
