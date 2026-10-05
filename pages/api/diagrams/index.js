// pages/api/diagrams/index.js
// List and create diagrams. withUserAuth requires an active signed-in user; listing is scoped to diagrams the
// caller owns (platform admins included, Q-S1) and creation records the caller as owner.

import { diagramRepository } from '../../../lib/diagramRepository';
import { withUserAuth } from '../../../lib/authz/next';
import { validateDiagramContent } from '../../../lib/diagramContent';
import { MAX_CONTENT_BYTES } from '../../../lib/diagramLimits';

export const config = { api: { bodyParser: { sizeLimit: Math.ceil(MAX_CONTENT_BYTES * 1.25) } } };

const toApi = (row, extra = {}) => ({ ...row, revision: Number(row.revision), ...extra });

async function handler(req, res, { user }) {
  if (req.method === 'GET') {
    const { type, domain_id, project_id } = req.query;

    const diagrams = await diagramRepository.findAll(
      { type, domainId: domain_id, projectId: project_id },
      user.id
    );

    return res.status(200).json(diagrams.map((d) => toApi(d)));
  }

  // POST
  const { type, name } = req.body || {};

  if (!type || !name) {
    return res.status(400).json({ error: 'type and name are required', code: 'VALIDATION_FAILED' });
  }

  if (typeof name !== 'string' || name.length > 255) {
    return res.status(400).json({
      error: 'name must be a string of at most 255 characters',
      code: 'VALIDATION_FAILED',
    });
  }

  let data = req.body;
  let warnings = [];
  if (data.content !== undefined && data.content !== null) {
    const check = validateDiagramContent(data.content);
    if (!check.ok) return res.status(check.status).json({ error: check.error, code: check.code });
    data = { ...data, content: check.content };
    warnings = check.warnings;
  }

  try {
    const diagram = await diagramRepository.createDiagram(data, user.email, user.id);
    return res.status(201).json(toApi(diagram, warnings.length ? { warnings } : {}));
  } catch (err) {
    if (err.message && err.message.includes('Invalid type')) {
      return res.status(400).json({ error: err.message, code: 'VALIDATION_FAILED' });
    }
    throw err;
  }
}

export default withUserAuth(handler, { methods: ['GET', 'POST'] });
