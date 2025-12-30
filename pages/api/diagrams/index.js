// pages/api/diagrams/index.js
// List and create diagrams - Session-based authentication

import { diagramRepository } from '../../../lib/diagramRepository';
import { requireActiveUser } from '../../../lib/useAuth';

export default async function handler(req, res) {
  // Require authenticated and active user
  const user = await requireActiveUser(req, res);
  if (!user) return;

  try {
    if (req.method === 'GET') {
      const { type, domain_id, project_id } = req.query;

      const diagrams = await diagramRepository.findAll(
        { type, domainId: domain_id, projectId: project_id },
        user.email,
        user.role
      );

      return res.status(200).json(diagrams);
    }

    if (req.method === 'POST') {
      const { type, name } = req.body || {};

      if (!type || !name) {
        return res.status(400).json({ error: 'type and name are required' });
      }

      try {
        const diagram = await diagramRepository.createDiagram(req.body, user.email);
        return res.status(201).json(diagram);
      } catch (err) {
        if (err.message.includes('Invalid type')) {
          return res.status(400).json({ error: err.message });
        }
        throw err;
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Diagrams API error', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
