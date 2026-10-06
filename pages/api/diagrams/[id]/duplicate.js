// pages/api/diagrams/[id]/duplicate.js
// POST - duplicate a diagram. Requires read access on the source (diagram.read); any active user may create a
// diagram, and the copy is owned by the caller.

import { diagramRepository } from '../../../../lib/diagramRepository';
import { validateDiagramContent } from '../../../../lib/diagramContent';
import { withDiagramAuth } from '../../../../lib/authz/next';

export default withDiagramAuth({ POST: 'diagram.read' }, async (req, res, { diagram, user }) => {
  const source = await diagramRepository.findById(diagram.id);
  if (!source) return res.status(404).json({ error: 'Diagram not found', code: 'NOT_FOUND' });

  // Content saved before validation existed may be unsafe or oversize: the copy gets the same checks as PUT.
  let warnings = [];
  let toCopy = source;
  if (source.content !== undefined && source.content !== null) {
    const check = validateDiagramContent(source.content);
    if (!check.ok) return res.status(check.status).json({ error: check.error, code: check.code });
    toCopy = { ...source, content: check.content };
    warnings = check.warnings;
  }

  const copy = await diagramRepository.duplicateDiagram(toCopy, user.email, user.id);
  return res.status(201).json({ ...copy, revision: Number(copy.revision), ...(warnings.length ? { warnings } : {}) });
});
