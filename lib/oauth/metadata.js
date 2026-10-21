// lib/oauth/metadata.js
// Discovery documents (ADR-0005 section 5.1). Pure: derived from the configuration only.

import { getIssuer, getResourceUrl, OAUTH_SCOPES, OFFLINE_ACCESS } from './config';

/** RFC 9728 protected resource metadata for the MCP endpoint. */
export function protectedResourceMetadata() {
  return {
    resource: getResourceUrl(),
    authorization_servers: [getIssuer()],
    scopes_supported: [...OAUTH_SCOPES],
    bearer_methods_supported: ['header'],
    resource_name: 'Ontographia Lab',
  };
}

/** RFC 8414 authorization server metadata. No registration_endpoint: there is no dynamic client registration. */
export function authorizationServerMetadata() {
  const issuer = getIssuer();
  return {
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/api/oauth/token`,
    revocation_endpoint: `${issuer}/api/oauth/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true,
    scopes_supported: [...OAUTH_SCOPES, OFFLINE_ACCESS],
  };
}
