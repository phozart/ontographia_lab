// lib/diagramLimits.js
// Caps shared by the client import sanitizer (components/diagram-studio/export/diagramJson.js)
// and the server-side content validation (lib/diagramContent.js).

export const MAX_CONTENT_BYTES = 5 * 1024 * 1024; // 5 MB of serialized content
export const MAX_ELEMENTS = 5000;
export const MAX_CONNECTIONS = 10000;
export const MAX_COLLECTION = 1000; // layers / groups
export const MAX_DEPTH = 24;
export const FORBIDDEN_KEYS = Object.freeze(['__proto__', 'constructor', 'prototype']);
export const CONTENT_KEYS = Object.freeze(['elements', 'connections', 'layers', 'groups', 'viewport']);
