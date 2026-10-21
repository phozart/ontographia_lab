// lib/oauth/authorizeFlow.js
// Decision logic behind GET /oauth/authorize (ADR-0005 5.2). Framework-free so it can be tested without Next.js.
//
//   no `rid`  -> validate the client's request; store it; redirect to /oauth/authorize?rid=...  (or error)
//   `rid`     -> signed out: send to /login (relative callbackUrl only); signed in: bind to the user, show consent
//
// Only the opaque `rid` travels through the login detour; nothing from the original request is reflected.

import { validateAuthorizeRequest, parseScope } from './authorizeRequest';
import { getClient } from './clients';
import { consentCsrfToken } from './crypto';
import { errorRedirectUrl, CONSENT_ERRORS } from './consent';
import { listDiagramsForConsent } from './consentData';
import { createAuthorization, getOpenAuthorization, bindAuthorization, isUuid } from './repository';

const first = (v) => (typeof v === 'string' ? v : undefined);

/**
 * @param {{query: object, user: {id: string, email: string, name?: string, role?: string, status?: string}|null, deps?: object}} input
 * @returns {Promise<
 *   {type: 'redirect', destination: string} |
 *   {type: 'login', callbackUrl: string} |
 *   {type: 'error', code: string} |
 *   {type: 'consent', props: object}>}
 */
export async function runAuthorizeFlow({ query, user, deps = {} }) {
  const q = query || {};
  if (q.rid === undefined) {
    const v = await validateAuthorizeRequest(q, deps);
    if (!v.ok) {
      if (v.fatal) return { type: 'error', code: v.code };
      return { type: 'redirect', destination: errorRedirectUrl(v.redirectUri, v.error, v.description, v.state) };
    }
    const rid = await createAuthorization(v.request);
    if (!rid) return { type: 'error', code: 'busy' };
    return { type: 'redirect', destination: `/oauth/authorize?rid=${rid}` };
  }

  const rid = first(q.rid);
  if (!isUuid(rid)) return { type: 'error', code: 'expired' };
  const open = await getOpenAuthorization(rid);
  if (!open) return { type: 'error', code: 'expired' };
  if (!user) return { type: 'login', callbackUrl: `/oauth/authorize?rid=${rid}` };
  if (user.status !== 'active') return { type: 'error', code: 'inactive' };

  const bound = await bindAuthorization(rid, user.id);
  if (!bound.ok) return { type: 'error', code: bound.reason === 'limit' ? 'too_many_pending' : bound.reason === 'other_user' ? 'other_user' : 'expired' };

  const client = await getClient(open.client_id, deps);
  if (!client.ok) return { type: 'error', code: client.error };
  const scope = parseScope(open.requested_scope);
  if (!scope.ok) return { type: 'error', code: 'expired' };

  const e = first(q.e);
  return {
    type: 'consent',
    props: {
      rid,
      csrf: consentCsrfToken(rid, user.id),
      clientLabel: client.client.label,
      redirectHost: new URL(open.redirect_uri).host,
      account: { email: user.email, name: user.name || null },
      isAdmin: user.role === 'admin',
      ceiling: scope.ceiling,
      diagrams: await listDiagramsForConsent(user.id),
      formError: e && Object.prototype.hasOwnProperty.call(CONSENT_ERRORS, e) ? CONSENT_ERRORS[e] : null,
    },
  };
}
