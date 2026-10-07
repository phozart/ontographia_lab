// pages/api/diagrams/[id].js
// Get, update, delete a single diagram. Authorization (ADR-0003): withDiagramAuth resolves the caller's role
// on the diagram (404 when none, 403 when below the action's minimum) before this code runs.

import { diagramRepository } from '../../../lib/diagramRepository';
import { withDiagramAuth } from '../../../lib/authz/next';
import { validateDiagramContent } from '../../../lib/diagramContent';
import { validateMetadata } from '../../../lib/diagramMetadata';
import { isValidThumbnail } from '../../../lib/thumbnail';
import { migrateDiagram } from '../../../components/diagram-studio/migrations/migrateDiagram';

const MAX_NAME_LENGTH = 255;

// Content is capped at 5 MB (lib/diagramLimits, validated in lib/diagramContent); 6 MB leaves headroom
// rest of the body. Next's default body limit is 1 MB.
export const config = { api: { bodyParser: { sizeLimit: '6mb' } } };

const IF_MATCH_RE = /^(?:W\/)?"?(\d{1,15})"?$/;

/** pg returns BIGINT as a string; the API exposes revision as a number. */
function toApi(row, extra = {}) {
  return { ...row, revision: Number(row.revision), ...extra };
}

function setEtag(res, revision) {
  res.setHeader('ETag', `"${revision}"`);
}

async function handleGet(req, res, { diagram, role, source, capabilities }) {
  const full = await diagramRepository.findById(diagram.id);
  if (!full) return res.status(404).json({ error: 'Diagram not found', code: 'NOT_FOUND' });

  const body = toApi(full, {
    // Upgrade legacy element types on read; persisted on the next save
    content: migrateDiagram(full.content),
    access: { role, source, capabilities },
  });
  setEtag(res, body.revision);
  return res.status(200).json(body);
}

/**
 * Thumbnail-only PUT: a background preview refresh. Same permission as any edit (diagram.write; there is no
 * separate thumbnail action), but it ignores If-Match and never bumps revision, so it cannot cause a false 409
 * on the editor's next content save.
 */
async function handleThumbnailOnly(req, res, { diagram }) {
  const { thumbnail } = req.body;
  if (thumbnail !== null && !isValidThumbnail(thumbnail)) {
    return res.status(400).json({ error: 'thumbnail must be a PNG data URL of at most 200 KB', code: 'VALIDATION_FAILED' });
  }
  const row = await diagramRepository.updateThumbnail(diagram.id, thumbnail);
  if (!row) return res.status(404).json({ error: 'Diagram not found', code: 'NOT_FOUND' });
  return res.status(200).json({ id: row.id, revision: Number(row.revision) });
}

async function handlePut(req, res, ctx) {
  const { diagram, user } = ctx;
  const body = req.body || {};

  const keys = Object.keys(body).filter((k) => body[k] !== undefined);
  if (keys.length === 1 && keys[0] === 'thumbnail') return handleThumbnailOnly(req, res, ctx);

  const name = body.name;
  if (name !== undefined && name !== null) {
    if (typeof name !== 'string' || name.length > MAX_NAME_LENGTH) {
      return res.status(400).json({
        error: `name must be a string of at most ${MAX_NAME_LENGTH} characters`,
        code: 'VALIDATION_FAILED',
      });
    }
  }

  const metaError = validateMetadata(body);
  if (metaError) return res.status(400).json({ error: metaError, code: 'VALIDATION_FAILED' });

  if (body.thumbnail !== undefined && body.thumbnail !== null && !isValidThumbnail(body.thumbnail)) {
    return res.status(400).json({ error: 'thumbnail must be a PNG data URL of at most 200 KB', code: 'VALIDATION_FAILED' });
  }

  let expectedRevision = null;
  const ifMatch = req.headers && req.headers['if-match'];
  if (ifMatch !== undefined && ifMatch !== '') {
    const m = IF_MATCH_RE.exec(String(ifMatch).trim());
    if (!m) {
      return res.status(400).json({ error: 'If-Match must be a revision number', code: 'VALIDATION_FAILED' });
    }
    expectedRevision = Number(m[1]);
  }

  let data = body;
  let warnings = [];
  if (body.content !== undefined && body.content !== null) {
    const check = validateDiagramContent(body.content);
    if (!check.ok) return res.status(check.status).json({ error: check.error, code: check.code });
    data = { ...body, content: check.content };
    warnings = check.warnings;
  }

  const updated = await diagramRepository.updateDiagram(diagram.id, data, {
    expectedRevision,
    userId: user.id,
    actor: { userId: user.id, email: user.email, via: 'web' },
  });

  if (!updated) {
    // Compare-and-set failed (or the row vanished): report the current state so the client can offer a choice.
    const current = await diagramRepository.findById(diagram.id);
    if (!current) return res.status(404).json({ error: 'Diagram not found', code: 'NOT_FOUND' });
    return res.status(409).json({
      error: 'This diagram was changed by someone else since you opened it',
      code: 'REVISION_CONFLICT',
      current: { revision: Number(current.revision), updatedAt: current.updated_at, updatedBy: current.updated_by },
    });
  }

  const out = toApi(updated, warnings.length ? { warnings } : {});
  setEtag(res, out.revision);
  return res.status(200).json(out);
}

async function handleDelete(req, res, { diagram }) {
  await diagramRepository.deleteDiagram(diagram.id);
  return res.status(200).json({ success: true, id: diagram.id, shortId: diagram.short_id });
}

export default withDiagramAuth(
  { GET: 'diagram.read', PUT: 'diagram.write', DELETE: 'diagram.delete' },
  (req, res, ctx) => {
    if (req.method === 'GET') return handleGet(req, res, ctx);
    if (req.method === 'PUT') return handlePut(req, res, ctx);
    return handleDelete(req, res, ctx);
  }
);
