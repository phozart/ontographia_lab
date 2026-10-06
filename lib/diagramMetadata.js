// lib/diagramMetadata.js
// Type checks for the optional metadata fields on create / update (tags, description, isTemplate).
// Pure. Returns an error message naming the field, or null when valid.

export const MAX_TAGS = 50;
export const MAX_TAG_LENGTH = 64;
export const MAX_DESCRIPTION_LENGTH = 2000;

export function validateMetadata(body) {
  const { tags, description, isTemplate } = body || {};
  if (tags !== undefined && tags !== null) {
    if (!Array.isArray(tags) || tags.length > MAX_TAGS
      || !tags.every((t) => typeof t === 'string' && t.length <= MAX_TAG_LENGTH)) {
      return `tags must be an array of at most ${MAX_TAGS} strings of at most ${MAX_TAG_LENGTH} characters`;
    }
  }
  if (description !== undefined && description !== null
    && (typeof description !== 'string' || description.length > MAX_DESCRIPTION_LENGTH)) {
    return `description must be a string of at most ${MAX_DESCRIPTION_LENGTH} characters`;
  }
  if (isTemplate !== undefined && isTemplate !== null && typeof isTemplate !== 'boolean') {
    return 'isTemplate must be a boolean';
  }
  return null;
}
