// pages/api/diagrams/[id]/duplicate.js
// POST - duplicate a diagram. Requires read access on the source (diagram.read); any active user may create a
// diagram, and the copy is owned by the caller.

import { diagramRepository } from '../../../../lib/diagramRepository';
import { withDiagramAuth } from '../../../../lib/authz/next';

export default withDiagramAuth({ POST: 'diagram.read' }, async (req, res, { diagram, user }) => {
  const source = await diagramRepository.findById(diagram.id);
  if (!source) return res.status(404).json({ error: 'Diagram not found', code: 'NOT_FOUND' });

  const copy = await diagramRepository.duplicateDiagram(source, user.email, user.id);
  return res.status(201).json({ ...copy, revision: Number(copy.revision) });
});
