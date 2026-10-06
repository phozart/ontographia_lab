// pages/api/user/tokens/index.js
// Personal API tokens (MCP). Session-authenticated; a user can only see and create their own tokens.
//   GET  -> list (no secrets, no hashes)
//   POST -> create; the secret is in this response only, never retrievable again

import { withUserAuth } from '../../../../lib/authz/next';
import { authorize, AuthzError } from '../../../../lib/authz';
import { requireSameOrigin } from '../../../../lib/sameOrigin';
import { createToken, listTokens, validateTokenInput, TokenError } from '../../../../lib/apiTokens';

async function handler(req, res, { principal, user }) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    return res.status(200).json({ tokens: await listTokens(user.id) });
  }

  if (!requireSameOrigin(req, res)) return undefined;

  // JSON only: a cross-site HTML form cannot send this content type, which complements SameSite cookies.
  if (!/^application\/json\b/i.test(String(req.headers['content-type'] || ''))) {
    return res.status(415).json({ error: 'Content-Type must be application/json' });
  }
  const parsed = validateTokenInput(req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const input = parsed.value;

  if (input.diagramIds) {
    for (const id of input.diagramIds) {
      try {
        await authorize(principal, id, 'diagram.read');
      } catch (err) {
        if (err instanceof AuthzError) return res.status(400).json({ error: 'Allowlist contains a diagram you cannot access' });
        throw err;
      }
    }
  }

  try {
    const { token, record } = await createToken(user.id, input);
    return res.status(201).json({ token, record });
  } catch (err) {
    if (err instanceof TokenError) return res.status(409).json({ error: err.message, code: err.code });
    throw err;
  }
}

export default withUserAuth(handler, { methods: ['GET', 'POST'] });
