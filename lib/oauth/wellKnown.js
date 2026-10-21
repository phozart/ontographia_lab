// lib/oauth/wellKnown.js
// Handler factory for the public discovery documents (served from /.well-known/* by rewrites in next.config.js).
// Flag off: plain 404 (the feature does not exist). CORS: any origin may read these public documents.

import { isOAuthEnabled } from './config';

export function wellKnownHandler(build) {
  return function handler(req, res) {
    if (!isOAuthEnabled()) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, MCP-Protocol-Version');
      res.setHeader('Access-Control-Max-Age', '86400');
      res.status(204).end();
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, OPTIONS');
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.status(200).json(build());
  };
}
