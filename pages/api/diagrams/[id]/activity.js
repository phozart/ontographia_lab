// pages/api/diagrams/[id]/activity.js
// GET - the board's activity timeline (ADR-0006 5.3, 8): who did what and when, newest first, merged from edit
// sessions (human saves), agent edits, restores and named versions. activity.read (viewer and up: everyone who can read
// the board sees content activity). Sharing events are added only for callers who also hold audit.read (the owner).
// Display names only, never e-mail addresses. Read-only apart from an opportunistic prune of sessions older than 365 days.
// Query: limit (default 30, max 100), cursor (opaque, from a previous nextCursor).
// Response: { items: [{id, kind, at, endAt?, actor, onBehalfOf?, agent?, counts?, saves?, revision, compare?, version?}], nextCursor }

import { withDiagramAuth } from '../../../../lib/authz/next';
import { listActivity, pruneEditSessions } from '../../../../lib/activityRepository';

const PRUNE_EVERY_MS = 6 * 60 * 60 * 1000;
let lastPrune = 0;

const first = (v) => (Array.isArray(v) ? v[0] : v);

export default withDiagramAuth({ GET: 'activity.read' }, async (req, res, { diagram, capabilities }) => {
  const includeShare = Array.isArray(capabilities) && capabilities.includes('audit.read');
  const page = await listActivity(diagram.id, {
    limit: first(req.query.limit),
    cursor: first(req.query.cursor) || null,
    includeShare,
    headRevision: Number(diagram.revision),
  });

  if (Date.now() - lastPrune > PRUNE_EVERY_MS) {
    lastPrune = Date.now();
    Promise.resolve(pruneEditSessions()).catch(() => {});
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json(page);
});
