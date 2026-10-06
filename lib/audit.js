// lib/audit.js
// Audit trail seam (data-model.md `audit_events`, delivery-plan slice 5). The table does not exist yet, so for now
// events are written as one structured log line ("AUDIT {json}"). Slice 5 replaces the body of recordAuditEvent
// with an INSERT; callers (e.g. version restore) do not change.
// Never throws: an audit failure must not fail the request that triggered it.

/**
 * @param {{action: string, actorUserId?: string|null, onBehalfOf?: string|null, diagramId?: string|null, target?: object}} event
 */
export function recordAuditEvent(event) {
  try {
    if (!event || typeof event.action !== 'string' || !event.action) return;
    const line = {
      occurredAt: new Date().toISOString(),
      action: event.action,
      actorUserId: event.actorUserId || null,
      onBehalfOf: event.onBehalfOf || null,
      diagramId: event.diagramId || null,
      target: event.target || {},
    };
    console.info(`AUDIT ${JSON.stringify(line)}`);
  } catch (_) {
    // swallow
  }
}
