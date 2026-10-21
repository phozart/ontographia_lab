// pages/api/diagrams/[id]/revision.js
// GET - cheap head probe for live pickup (AI-2, ai-canvas-via-mcp.md section 6): the editor polls this every few
// seconds instead of the full document. diagram.read (viewer and up: read-only viewers also see updates).
// Reads only the authorization metadata row that withDiagramAuth already loaded; the single extra query runs only
// when `?since=<revision>` is behind the head, to say whether an agent wrote in between.
// Response: { revision, updatedAt, updatedBy, agentChange: null | {versionNumber, previousVersionNumber, label} }
// `updatedBy` is a display name (profile name, else the e-mail local part; addresses are not shared, Q-S5c) and is
// only resolved when `since` is behind the head. Never writes anything.

import { withDiagramAuth } from '../../../../lib/authz/next';
import { versionRepository } from '../../../../lib/versionRepository';

export default withDiagramAuth({ GET: 'diagram.read' }, async (req, res, { diagram }) => {
  const revision = Number(diagram.revision);
  let since = null;
  if (req.query.since !== undefined) {
    const raw = Array.isArray(req.query.since) ? req.query.since[0] : req.query.since;
    if (!/^\d{1,15}$/.test(String(raw))) {
      return res.status(400).json({ error: 'since must be a revision number', code: 'VALIDATION_FAILED' });
    }
    since = Number(raw);
  }

  let agentChange = null;
  let updatedBy = null;
  if (since !== null && since < revision) {
    updatedBy = await versionRepository.writerName(diagram.updated_by);
    const change = await versionRepository.latestAgentChangeSince(diagram.id, since);
    if (change) agentChange = { versionNumber: change.number, previousVersionNumber: change.previousNumber, label: change.label };
  }

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('ETag', `"${revision}"`);
  return res.status(200).json({
    revision,
    updatedAt: diagram.updated_at instanceof Date ? diagram.updated_at.toISOString() : diagram.updated_at || null,
    updatedBy,
    agentChange,
  });
});
