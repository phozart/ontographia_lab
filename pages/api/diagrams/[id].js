// pages/api/diagrams/[id].js
// Get, update, delete single diagram - Session-based authentication

import { diagramRepository } from '../../../lib/diagramRepository';
import { requireActiveUser } from '../../../lib/useAuth';

export default async function handler(req, res) {
  // Require authenticated and active user
  const user = await requireActiveUser(req, res);
  if (!user) return;

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Diagram ID required' });

  try {
    // GET - fetch single diagram
    if (req.method === 'GET') {
      const { hasAccess, diagram } = await diagramRepository.checkAccess(
        id,
        user.email,
        user.role
      );

      if (!diagram) {
        return res.status(404).json({ error: 'Diagram not found' });
      }

      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }

      return res.status(200).json(diagram);
    }

    // PUT - update diagram
    if (req.method === 'PUT') {
      const { hasAccess, diagram } = await diagramRepository.checkAccess(
        id,
        user.email,
        user.role
      );

      if (!diagram) {
        return res.status(404).json({ error: 'Diagram not found' });
      }

      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const updated = await diagramRepository.updateDiagram(diagram.id, req.body);
      return res.status(200).json(updated);
    }

    // DELETE - remove diagram
    if (req.method === 'DELETE') {
      const { hasAccess, diagram } = await diagramRepository.checkAccess(
        id,
        user.email,
        user.role
      );

      if (!diagram) {
        return res.status(404).json({ error: 'Diagram not found' });
      }

      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await diagramRepository.deleteDiagram(diagram.id);
      return res.status(200).json({ success: true, id: diagram.id, shortId: diagram.short_id });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Diagram API error', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
