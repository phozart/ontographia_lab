// lib/diagramMetadata.js
// Type checks for the optional metadata fields on create / update (tags, description, isTemplate).
// Pure. Returns an error message naming the field, or null when valid.

export const MAX_TAGS = 50;
export const MAX_TAG_LENGTH = 64;
export const MAX_DESCRIPTION_LENGTH = 2000;

// PostgreSQL text cannot hold U+0000 and other C0 controls are never meaningful in names, tags or notes.
// Names and tags: no controls at all (incl. tab and newline). Descriptions may contain tab, newline and carriage return.
const CONTROLS = /[\u0000-\u001f\u007f]/;
const CONTROLS_EXCEPT_WS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/** Error message for a diagram name containing control characters, else null (length and presence are checked by callers). */
export function validateName(name) {
  return typeof name === 'string' && CONTROLS.test(name) ? 'name must not contain control characters' : null;
}

export function validateMetadata(body) {
  const { tags, description, isTemplate } = body || {};
  if (tags !== undefined && tags !== null) {
    if (!Array.isArray(tags) || tags.length > MAX_TAGS
      || !tags.every((t) => typeof t === 'string' && t.length <= MAX_TAG_LENGTH && !CONTROLS.test(t))) {
      return `tags must be an array of at most ${MAX_TAGS} strings of at most ${MAX_TAG_LENGTH} characters, without control characters`;
    }
  }
  if (description !== undefined && description !== null
    && (typeof description !== 'string' || description.length > MAX_DESCRIPTION_LENGTH)) {
    return `description must be a string of at most ${MAX_DESCRIPTION_LENGTH} characters`;
  }
  if (typeof description === 'string' && CONTROLS_EXCEPT_WS.test(description)) {
    return 'description must not contain control characters';
  }
  if (isTemplate !== undefined && isTemplate !== null && typeof isTemplate !== 'boolean') {
    return 'isTemplate must be a boolean';
  }
  return null;
}
