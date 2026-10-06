// lib/authz/next.js
// Next.js API-route glue for the framework-free authorization core (lib/authz/index.js).
// Every handler under pages/api/diagrams/** must be exported through one of these wrappers;
// __tests__/authz/handlersWrapped.test.js enforces it.

import { requireActiveUser } from '../useAuth';
import { authorize, AuthzError } from './index';

/** Marker set on every wrapped handler (read by the "no unwrapped handler" test). */
export const AUTHZ_WRAPPED = Symbol.for('ontographia.authz.wrapped');

function mark(fn) {
  Object.defineProperty(fn, AUTHZ_WRAPPED, { value: true });
  return fn;
}

/** Session user (from requireActiveUser) -> authorization principal. */
export function principalFromUser(user) {
  return { kind: 'user', userId: user.id, platformRole: user.role || 'user', status: user.status };
}

function sendAuthzError(res, err) {
  return res.status(err.status).json({ error: err.message, code: err.code });
}

function sendFailure(res, err) {
  if (err instanceof AuthzError) return sendAuthzError(res, err);
  console.error('Diagram API error', err);
  return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL' });
}

function methodNotAllowed(res, allowed) {
  if (allowed.length) res.setHeader?.('Allow', allowed.join(', '));
  return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
}

/**
 * For routes that are not scoped to one diagram (list / create): requires an active signed-in user and
 * passes `{ principal, user }`. Per-diagram permission does not apply; the handler must scope its queries
 * to the principal.
 * @param {(req, res, ctx: {principal: object, user: object}) => Promise<void>} handler
 * @param {{methods?: string[]}} [opts] allowed methods (others -> 405)
 */
export function withUserAuth(handler, { methods } = {}) {
  return mark(async function authedHandler(req, res) {
    if (methods && !methods.includes(req.method)) return methodNotAllowed(res, methods);
    const user = await requireActiveUser(req, res);
    if (!user) return undefined;
    try {
      return await handler(req, res, { principal: principalFromUser(user), user });
    } catch (err) {
      return sendFailure(res, err);
    }
  });
}

/**
 * For routes scoped to one diagram (`req.query.id`, UUID or LAB-n).
 * 405 for methods not in the map; 401/403 from the session; 404 when the diagram does not exist or the
 * principal has no role on it; 403 when the role is below the action's minimum.
 * @param {Partial<Record<'GET'|'POST'|'PUT'|'PATCH'|'DELETE', string>>} actionByMethod
 * @param {(req, res, ctx: {principal: object, user: object, diagram: object, role: string, source: string, capabilities: string[]}) => Promise<void>} handler
 */
export function withDiagramAuth(actionByMethod, handler) {
  const methods = Object.keys(actionByMethod);
  return mark(async function diagramAuthedHandler(req, res) {
    const action = Object.prototype.hasOwnProperty.call(actionByMethod, req.method) ? actionByMethod[req.method] : null;
    if (!action) return methodNotAllowed(res, methods);
    const user = await requireActiveUser(req, res);
    if (!user) return undefined;
    try {
      const principal = principalFromUser(user);
      const id = req.query && req.query.id;
      const ctx = await authorize(principal, typeof id === 'string' ? id : '', action);
      return await handler(req, res, { ...ctx, principal, user });
    } catch (err) {
      return sendFailure(res, err);
    }
  });
}
