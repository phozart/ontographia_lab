// pages/api/diagrams/[id]/duplicate.js
// POST - duplicate a diagram the caller can access; the copy is owned by the caller.

import { diagramRepository } from '../../../../lib/diagramRepository';
import { requireActiveUser } from '../../../../lib/useAuth';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHORT_ID_RE = /^LAB-\d{1,9}$/;

export default async function handler(req, res) {
  const user = await requireActiveUser(req, res);
  if (!user) return;

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  if (typeof id !== 'string' || !(UUID_RE.test(id) || SHORT_ID_RE.test(id))) {
    return res.status(404).json({ error: 'Diagram not found' });
  }

  try {
    const { hasAccess, diagram } = await diagramRepository.checkAccess(id, user.email, user.role);
    if (!diagram) return res.status(404).json({ error: 'Diagram not found' });
    if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

    const copy = await diagramRepository.duplicateDiagram(diagram, user.email);
    return res.status(201).json(copy);
  } catch (err) {
    console.error('Diagram duplicate error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
