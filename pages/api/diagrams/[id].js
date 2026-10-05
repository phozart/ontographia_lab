// pages/api/diagrams/[id].js
// Get, update, delete single diagram - Session-based authentication

import { diagramRepository } from '../../../lib/diagramRepository';
import { requireActiveUser } from '../../../lib/useAuth';
import { isValidThumbnail } from '../../../lib/thumbnail';
import { migrateDiagram } from '../../../components/diagram-studio/migrations/migrateDiagram';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHORT_ID_RE = /^LAB-\d{1,9}$/;
const MAX_NAME_LENGTH = 255;

export default async function handler(req, res) {
  // Require authenticated and active user
  const user = await requireActiveUser(req, res);
  if (!user) return;

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Diagram ID required' });
  if (typeof id !== 'string' || !(UUID_RE.test(id) || SHORT_ID_RE.test(id))) {
    return res.status(404).json({ error: 'Diagram not found' });
  }

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

      // Upgrade legacy element types on read; persisted on the next save
      return res.status(200).json({ ...diagram, content: migrateDiagram(diagram.content) });
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

      const name = req.body?.name;
      if (name !== undefined && name !== null) {
        if (typeof name !== 'string' || name.length > MAX_NAME_LENGTH) {
          return res.status(400).json({ error: `name must be a string of at most ${MAX_NAME_LENGTH} characters` });
        }
      }

      const thumbnail = req.body?.thumbnail;
      if (thumbnail !== undefined && thumbnail !== null && !isValidThumbnail(thumbnail)) {
        return res.status(400).json({ error: 'thumbnail must be a PNG data URL of at most 200 KB' });
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
    return res.status(500).json({ error: 'Internal server error' });
  }
}
