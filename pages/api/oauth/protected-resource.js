// pages/api/oauth/protected-resource.js
// RFC 9728 metadata; reached via the /.well-known/oauth-protected-resource[/api/mcp] rewrites (next.config.js).
import { wellKnownHandler } from '../../../lib/oauth/wellKnown';
import { protectedResourceMetadata } from '../../../lib/oauth/metadata';

export default wellKnownHandler(protectedResourceMetadata);
