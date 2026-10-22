// lib/diagramLimits.js
// Caps shared by the client import sanitizer (components/diagram-studio/export/diagramJson.js)
// and the server-side content validation (lib/diagramContent.js).

export const MAX_CONTENT_BYTES = 5 * 1024 * 1024; // 5 MB of serialized content
export const MAX_ELEMENTS = 5000;
export const MAX_CONNECTIONS = 10000;
export const MAX_COLLECTION = 1000; // layers / groups
export const MAX_DEPTH = 24;
export const FORBIDDEN_KEYS = Object.freeze(['__proto__', 'constructor', 'prototype']);
export const CONTENT_KEYS = Object.freeze(['elements', 'connections', 'layers', 'groups', 'presentations', 'viewport']);

// Presentations (ADR-0007 P1): content.presentations[] holds ordered references to slide frames plus speaker notes.
export const MAX_PRESENTATIONS = 20;
export const MAX_SLIDES = 200; // per presentation
export const MAX_NOTES_BYTES = 10 * 1024; // plain text per slide
export const MAX_PRESENTATION_TITLE = 200;

// Table element (core/table; docs/architecture/investigations/ai-canvas-via-mcp.md 3.1). Shared by the editor, the
// server validator (lib/table/tableSchema.js) and the MCP tools.
export const MAX_TABLE_COLUMNS = 50;
export const MAX_TABLE_ROWS = 500;
export const MAX_TABLE_CELLS = 20000;
export const MAX_TABLE_CELL_CHARS = 2000;
export const MAX_TABLE_BYTES = 512 * 1024; // serialized data.table
export const MAX_TABLE_OPTIONS = 50;
