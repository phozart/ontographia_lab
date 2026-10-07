// pages/api/diagrams/index.js
// List and create diagrams. withUserAuth requires an active signed-in user; listing is scoped to diagrams the
// caller owns (platform admins included, Q-S1) and creation records the caller as owner.

import { diagramRepository } from '../../../lib/diagramRepository';
import { memberRepository } from '../../../lib/memberRepository';
import { withUserAuth } from '../../../lib/authz/next';
import { validateDiagramContent } from '../../../lib/diagramContent';
import { validateMetadata } from '../../../lib/diagramMetadata';

export const config = { api: { bodyParser: { sizeLimit: '6mb' } } };

const toApi = (row, extra = {}) => ({ ...row, revision: Number(row.revision), ...extra });

async function handler(req, res, { user }) {
  if (req.method === 'GET') {
    const { type, domain_id, project_id, scope = 'owned' } = req.query;
    if (!['owned', 'shared', 'all'].includes(scope)) {
      return res.status(400).json({ error: 'scope must be owned, shared or all', code: 'VALIDATION_FAILED' });
    }

    // "owned" is the default and unchanged. "shared" = direct member grants (metadata only, with the caller's
    // role and the owner); platform admins get no extra diagrams (Q-S1).
    const owned = scope === 'shared'
      ? []
      : await diagramRepository.findAll({ type, domainId: domain_id, projectId: project_id }, user.id);
    if (scope === 'owned') return res.status(200).json(owned.map((d) => toApi(d)));

    const shared = scope === 'all' && (domain_id || project_id)
      ? [] // grouping columns are not exposed for shared metadata
      : await memberRepository.listSharedWith(user.id, { type });
    const items = [
      ...owned.map((d) => toApi(d, scope === 'all' ? { access: { role: 'owner' } } : {})),
      ...shared.map(({ role, ...d }) => toApi(d, { access: { role } })),
    ];
    items.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    return res.status(200).json(items);
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

  const metaError = validateMetadata(req.body);
  if (metaError) return res.status(400).json({ error: metaError, code: 'VALIDATION_FAILED' });

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
