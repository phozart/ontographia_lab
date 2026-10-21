// pages/api/diagrams/[id]/versions/[v]/diff.js
// GET structural diff of version {v} against `against` = head (default) | another version number - version.read (viewer)
// Read-only: never writes content, versions or audit rows. Both versions are looked up scoped to the authorized
// diagram, so a version number belonging to another diagram is a plain 404 (no IDOR).

import { withDiagramAuth } from '../../../../../../lib/authz/next';
import { versionRepository } from '../../../../../../lib/versionRepository';
import { diffContent } from '../../../../../../lib/versions/diff';
import { badRequest, notFound, parseVersionNumber } from '../../../../../../lib/versions/http';

export default withDiagramAuth({ GET: 'version.read' }, async (req, res, { diagram }) => {
  const number = parseVersionNumber(req.query.v);
  if (number === null) return badRequest(res, 'Version number must be a positive integer');

  const rawAgainst = req.query.against;
  let againstNumber = null; // null -> head
  if (rawAgainst !== undefined && rawAgainst !== 'head') {
    againstNumber = typeof rawAgainst === 'string' ? parseVersionNumber(rawAgainst) : null;
    if (againstNumber === null) return badRequest(res, 'against must be "head" or a positive version number');
  }

  const from = await versionRepository.get(diagram.id, number);
  if (!from) return notFound(res);

  let to = 'head';
  let toContent;
  if (againstNumber === null) {
    toContent = await versionRepository.getHeadContent(diagram.id);
    if (toContent === null) return notFound(res, 'Diagram');
  } else {
    const other = await versionRepository.get(diagram.id, againstNumber);
    if (!other) return notFound(res);
    to = { id: other.id, number: other.number };
    toContent = other.content;
  }

  const { changes, summary } = diffContent(from.content, toContent);
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ from: { id: from.id, number: from.number }, to, changes, summary });
});
