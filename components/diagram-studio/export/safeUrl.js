// components/diagram-studio/export/safeUrl.js
// Re-export: the implementation lives in lib/safeUrl.js so the server-side content validation
// (lib/diagramContent.js) and the client import sanitizer share one allow-list.
export { isSafeUrl, cssUrl, isUrlKey } from '../../../lib/safeUrl';
