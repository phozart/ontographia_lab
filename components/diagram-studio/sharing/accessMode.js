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
