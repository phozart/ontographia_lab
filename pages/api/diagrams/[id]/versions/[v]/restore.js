// pages/api/diagrams/[id]/versions/[v]/restore.js
// POST restore version [v] as the new head                         - version.restore (editor)
// Non-destructive (ADR-0001 decision 5): a `pre_restore` version keeps the old head when it is not already the
// latest version, the head becomes the source content (revision + 1), a `restore` version records it.
// Optional `If-Match: "<revision>"` rejects (409) when the head moved since the client last saw it.

import { withDiagramAuth } from '../../../../../../lib/authz/next';
import { versionRepository } from '../../../../../../lib/versionRepository';
import { recordAuditEvent } from '../../../../../../lib/audit';
import {
  actorFrom, badRequest, notFound, parseIfMatch, parseVersionNumber, sendError, withVersionErrors,
} from '../../../../../../lib/versions/http';

export default withDiagramAuth({ POST: 'version.restore' }, async (req, res, { diagram, user }) => {
  const number = parseVersionNumber(req.query.v);
  if (number === null) return badRequest(res, 'Version number must be a positive integer');
  const ifMatch = parseIfMatch(req);
  if (!ifMatch.ok) return badRequest(res, 'If-Match must be a revision number');

  return withVersionErrors(res, async () => {
    const result = await versionRepository.restore(diagram.id, number, actorFrom(user), { expectedRevision: ifMatch.revision });

    if (result.status === 'not_found') return notFound(res);
    if (result.status === 'conflict') {
      return res.status(409).json({
        error: 'This diagram was changed by someone else since you opened it',
        code: 'REVISION_CONFLICT',
        current: { revision: result.current.revision, updatedAt: result.current.updatedAt },
      });
    }
    if (result.status === 'unchanged') {
      res.setHeader('ETag', `"${result.diagram.revision}"`);
      return res.status(200).json({ unchanged: true, diagram: result.diagram, version: result.version });
    }
    if (result.status !== 'ok') return sendError(res, 500, 'INTERNAL', 'Internal server error');

    recordAuditEvent({
      action: 'version.restore',
      actorUserId: user.id,
      diagramId: diagram.id,
      target: {
        fromVersion: number,
        restoreVersion: result.version.number,
        preRestoreVersion: result.preRestoreVersion ? result.preRestoreVersion.number : null,
        revision: result.diagram.revision,
      },
    });

    res.setHeader('ETag', `"${result.diagram.revision}"`);
    const body = { diagram: result.diagram, version: result.version };
    if (result.preRestoreVersion) body.preRestoreVersion = result.preRestoreVersion;
    return res.status(200).json(body);
  });
});
