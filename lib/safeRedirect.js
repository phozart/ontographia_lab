// Only same-site relative paths are acceptable post-auth redirect targets.

 
const CONTROL_OR_BACKSLASH = /[\u0000-\u001f\u007f-\u009f\\]/;

export function safeRedirectPath(value, fallback = '/') {
  if (typeof value !== 'string') return fallback;
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  if (CONTROL_OR_BACKSLASH.test(value)) return fallback;

  let decoded;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return fallback;
  }
  if (decoded.startsWith('//') || CONTROL_OR_BACKSLASH.test(decoded)) return fallback;

  return value;
}
