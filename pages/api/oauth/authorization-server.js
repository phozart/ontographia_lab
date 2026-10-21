// pages/api/oauth/authorization-server.js
// RFC 8414 metadata; reached via the /.well-known/oauth-authorization-server rewrite (next.config.js).
import { wellKnownHandler } from '../../../lib/oauth/wellKnown';
import { authorizationServerMetadata } from '../../../lib/oauth/metadata';

export default wellKnownHandler(authorizationServerMetadata);
