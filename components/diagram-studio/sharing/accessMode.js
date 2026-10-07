// components/diagram-studio/sharing/accessMode.js
import { capabilitiesFor } from '../../../lib/authz/policy';

// Maps the server's `access` block ({ role, source, capabilities[] } from GET /api/diagrams/{id}) to the editor's
// mode (ADR-0003 section 6). The UI only REFLECTS capabilities; the server enforces them on every request.

/**
 * @returns {'edit'|'comment'|'view'}
 * A missing access block means an older payload or a diagram being created: treated as edit (the server decides).
 * A present block without usable capabilities or role fails closed to view.
 */
export function accessMode(access) {
  if (!access) return 'edit';
  // The server always sends capabilities; a role-only block is expanded from the same policy table
  const caps = Array.isArray(access.capabilities) ? access.capabilities : capabilitiesFor(access.role);
  if (caps.includes('diagram.write')) return 'edit';
  if (caps.includes('comment.create')) return 'comment';
  return 'view';
}

export const canWrite = (access) => accessMode(access) === 'edit';
export const canCommentWith = (access) => accessMode(access) !== 'view';

/** Same profile with `editingPolicy.readOnly` forced on when the caller cannot write. */
export function applyAccessToProfile(profile, access) {
  if (!profile || canWrite(access)) return profile;
  return { ...profile, editingPolicy: { ...profile.editingPolicy, readOnly: true } };
}

export const ACCESS_NOTICE_TEXT = {
  changed: 'Your access to this diagram changed — you can no longer edit.',
  removed: 'Your access to this diagram was removed — you can no longer edit.',
  denied: 'The server refused to save this diagram — your latest changes were not saved.',
};

/**
 * Decides what a refused save (PUT 403/404) means once access has been re-fetched.
 * @param {{status:number, body?:object}|null} refetch result of GET /api/diagrams/{id} (null when it failed to complete)
 * @returns {{kind:'removed'|'changed'|'denied', access:object}}
 *  removed: 403/404 on re-read, access is gone; changed: still readable, new role cannot write;
 *  denied: still an editor (unexpected) so autosave must still stop to avoid a retry loop.
 */
export function resolveAccessAfterDenied(current, refetch) {
  if (!refetch || refetch.status === 403 || refetch.status === 404) {
    return { kind: 'removed', access: { role: null, source: null, capabilities: [] } };
  }
  if (refetch.status >= 200 && refetch.status < 300 && refetch.body?.access) {
    const access = refetch.body.access;
    return canWrite(access) ? { kind: 'denied', access: current } : { kind: 'changed', access };
  }
  return { kind: 'denied', access: current };
}
