// lib/thumbnail.js
// Shared (client + server) rules for diagram preview thumbnails.

export const MAX_THUMBNAIL_BYTES = 200 * 1024; // 200 KB cap on the stored data URL
export const THUMBNAIL_INTERVAL_MS = 5 * 60 * 1000; // capture at most once per 5 minutes
export const THUMBNAIL_WIDTH = 320;

const PNG_DATA_URL_RE = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/;

export function isValidThumbnail(value) {
  return (
    typeof value === 'string' &&
    value.length < MAX_THUMBNAIL_BYTES &&
    PNG_DATA_URL_RE.test(value)
  );
}

/** lastCapturedAt is a ms timestamp (0 = never). */
export function shouldCaptureThumbnail(lastCapturedAt, now = Date.now()) {
  return !lastCapturedAt || now - lastCapturedAt >= THUMBNAIL_INTERVAL_MS;
}
