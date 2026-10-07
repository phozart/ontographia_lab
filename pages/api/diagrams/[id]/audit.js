// pages/api/diagrams/[id]/audit.js
// GET - the diagram's audit events (sharing changes, version restores), newest first. Owner only (audit.read).

import { withDiagramAuth } from '../../../../lib/authz/next';
import { listAuditEvents } from '../../../../lib/audit';

export default withDiagramAuth({ GET: 'audit.read' }, async (req, res, { diagram }) => {
  const { limit, cursor } = req.query || {};
  const page = await listAuditEvents(diagram.id, { limit, cursor });
  return res.status(200).json(page);
});
