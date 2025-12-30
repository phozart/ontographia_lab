// components/diagram-studio/styling/StencilStyleManager.js
// Manages per-stencil style persistence
// - Session cache: localStorage (auto-saved on style changes)
// - User profile: database via API (saved explicitly via "Save as Default")

import { DEFAULT_STYLE } from './StyleConstants';

const SESSION_STORAGE_KEY = 'ds-stencil-styles-session';
const PROFILE_STORAGE_KEY = 'ds-stencil-styles-profile';
const SETTINGS_KEY = 'stencilStyles';

// In-memory caches
let sessionCache = null;  // Styles changed during this session
let profileCache = null;  // Styles saved to user profile

/**
 * Generate a unique key for a stencil type
 */
export function getStencilStyleKey(packId, stencilId) {
  return `${packId}:${stencilId}`;
}

// ============ SESSION CACHE (localStorage) ============

/**
 * Load session styles from localStorage
 */
function loadSessionCache() {
  if (typeof window === 'undefined') return {};
  if (sessionCache !== null) return sessionCache;

  try {
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    sessionCache = stored ? JSON.parse(stored) : {};
    return sessionCache;
  } catch (e) {
    console.warn('Failed to load session styles from localStorage:', e);
    sessionCache = {};
    return {};
  }
}

/**
 * Save session styles to localStorage
 */
function saveSessionCache() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionCache || {}));
  } catch (e) {
    console.warn('Failed to save session styles to localStorage:', e);
  }
}

/**
 * Cache a style for the current session (auto-save on style changes)
 * This is called automatically when user changes any style property
 */
export function cacheStencilStyle(packId, stencilId, style) {
  if (typeof window === 'undefined') return;

  const key = getStencilStyleKey(packId, stencilId);

  // Load current cache
  if (sessionCache === null) {
    loadSessionCache();
  }

  // Merge with existing style
  sessionCache[key] = {
    ...sessionCache[key],
    ...style,
    cachedAt: new Date().toISOString(),
  };

  // Save to localStorage immediately
  saveSessionCache();
}

/**
 * Get session-cached style for a stencil
 */
export function getSessionCachedStyle(packId, stencilId) {
  if (sessionCache === null) {
    loadSessionCache();
  }
  const key = getStencilStyleKey(packId, stencilId);
  return sessionCache[key] || null;
}

/**
 * Clear session cache (e.g., on logout or new session)
 */
export function clearSessionCache() {
  sessionCache = {};
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }
}

// ============ USER PROFILE (Database) ============

/**
 * Load profile styles from localStorage cache
 */
function loadProfileCacheFromStorage() {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(PROFILE_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (e) {
    console.warn('Failed to load profile styles from localStorage:', e);
    return {};
  }
}

/**
 * Save profile styles to localStorage cache
 */
function saveProfileCacheToStorage(styles) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(styles));
  } catch (e) {
    console.warn('Failed to save profile styles to localStorage:', e);
  }
}

/**
 * Fetch profile styles from user settings API
 */
async function fetchProfileFromAPI() {
  try {
    const response = await fetch('/api/user/settings', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (response.status === 401) {
      // Not authenticated
      return null;
    }

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const settings = await response.json();
    return settings[SETTINGS_KEY] || {};
  } catch (e) {
    console.warn('Failed to fetch profile styles from API:', e);
    return null;
  }
}

/**
 * Save profile styles to user settings API
 */
async function saveProfileToAPI(styles) {
  try {
    const response = await fetch('/api/user/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: SETTINGS_KEY,
        value: styles,
      }),
    });

    if (response.status === 401) {
      return false;
    }

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return true;
  } catch (e) {
    console.warn('Failed to save profile styles to API:', e);
    return false;
  }
}

/**
 * Initialize profile styles from API (call on app load)
 */
export async function initializeStencilStyles() {
  // Load session cache
  loadSessionCache();

  // Try to load profile from API
  const apiStyles = await fetchProfileFromAPI();

  if (apiStyles !== null) {
    // API successful, use API styles
    profileCache = apiStyles;
    saveProfileCacheToStorage(apiStyles);
  } else {
    // Fallback to localStorage cache
    profileCache = loadProfileCacheFromStorage();
  }

  return profileCache;
}

/**
 * Load profile styles synchronously (from cache only)
 */
export function loadProfileStylesSync() {
  if (profileCache !== null) {
    return profileCache;
  }
  profileCache = loadProfileCacheFromStorage();
  return profileCache;
}

/**
 * Save style to user profile (database) - called when user clicks "Save as Default"
 */
export async function saveStencilStyle(packId, stencilId, style) {
  if (typeof window === 'undefined') return;

  const key = getStencilStyleKey(packId, stencilId);

  // Load current profile
  if (profileCache === null) {
    profileCache = loadProfileCacheFromStorage();
  }

  // Merge with existing style
  profileCache[key] = {
    ...profileCache[key],
    ...style,
    savedAt: new Date().toISOString(),
  };

  // Save to localStorage cache
  saveProfileCacheToStorage(profileCache);

  // Save to API (database)
  const success = await saveProfileToAPI(profileCache);

  return success;
}

/**
 * Get saved profile style for a stencil
 */
export function getSavedStencilStyle(packId, stencilId) {
  if (profileCache === null) {
    profileCache = loadProfileCacheFromStorage();
  }
  const key = getStencilStyleKey(packId, stencilId);
  return profileCache[key] || null;
}

// ============ COMBINED GETTERS ============

/**
 * Get the effective style for a stencil
 * Priority: session cache > saved profile > stencil definition > global defaults
 */
export function getStencilDefaultStyle(packId, stencilId, stencilDef) {
  const session = getSessionCachedStyle(packId, stencilId);
  const profile = getSavedStencilStyle(packId, stencilId);

  // Merge with priority: session > profile > stencilDef > defaults
  return {
    color: session?.color || profile?.color || stencilDef?.color || DEFAULT_STYLE.color,
    styleVariant: session?.styleVariant || profile?.styleVariant || DEFAULT_STYLE.styleVariant,
    fontSize: session?.fontSize || profile?.fontSize || DEFAULT_STYLE.fontSize,
    fontWeight: session?.fontWeight || profile?.fontWeight || DEFAULT_STYLE.fontWeight,
    fontStyle: session?.fontStyle || profile?.fontStyle || DEFAULT_STYLE.fontStyle,
    textDecoration: session?.textDecoration || profile?.textDecoration || DEFAULT_STYLE.textDecoration,
    textAlign: session?.textAlign || profile?.textAlign || DEFAULT_STYLE.textAlign,
    verticalAlign: session?.verticalAlign || profile?.verticalAlign || DEFAULT_STYLE.verticalAlign,
    borderStyle: session?.borderStyle || profile?.borderStyle || DEFAULT_STYLE.borderStyle,
    borderWidth: session?.borderWidth ?? profile?.borderWidth ?? DEFAULT_STYLE.borderWidth,
    borderRadius: session?.borderRadius ?? profile?.borderRadius ?? DEFAULT_STYLE.borderRadius,
    borderColor: session?.borderColor ?? profile?.borderColor ?? DEFAULT_STYLE.borderColor,
    showShadow: session?.showShadow ?? profile?.showShadow ?? DEFAULT_STYLE.showShadow,
    showAccentBar: session?.showAccentBar ?? profile?.showAccentBar ?? DEFAULT_STYLE.showAccentBar,
    opacity: session?.opacity ?? profile?.opacity ?? DEFAULT_STYLE.opacity,
  };
}

/**
 * Check if a stencil has custom styles (either session or profile)
 */
export function hasCustomStyle(packId, stencilId) {
  const session = getSessionCachedStyle(packId, stencilId);
  const profile = getSavedStencilStyle(packId, stencilId);
  return session !== null || profile !== null;
}

/**
 * Check if a stencil has session-only changes (not saved to profile)
 */
export function hasSessionChanges(packId, stencilId) {
  return getSessionCachedStyle(packId, stencilId) !== null;
}

/**
 * Clear only the session cache for a specific stencil (keeps profile intact)
 * Used when resetting to default
 */
export function clearSessionStyleForStencil(packId, stencilId) {
  if (typeof window === 'undefined') return;

  const key = getStencilStyleKey(packId, stencilId);

  if (sessionCache === null) {
    loadSessionCache();
  }

  if (sessionCache[key]) {
    delete sessionCache[key];
    saveSessionCache();
  }
}

/**
 * Get the "reset" style for a stencil
 * Returns: user's saved profile style if exists, otherwise system defaults
 * This is what the stencil should reset to when user clicks "Reset to Default"
 */
export function getResetStyle(packId, stencilId, stencilDef) {
  const profile = getSavedStencilStyle(packId, stencilId);

  // If user has a saved profile style, use that as the default
  if (profile) {
    return {
      color: profile.color ?? stencilDef?.color ?? DEFAULT_STYLE.color,
      styleVariant: profile.styleVariant ?? DEFAULT_STYLE.styleVariant,
      fontSize: profile.fontSize ?? DEFAULT_STYLE.fontSize,
      fontWeight: profile.fontWeight ?? DEFAULT_STYLE.fontWeight,
      fontStyle: profile.fontStyle ?? DEFAULT_STYLE.fontStyle,
      textDecoration: profile.textDecoration ?? DEFAULT_STYLE.textDecoration,
      textAlign: profile.textAlign ?? DEFAULT_STYLE.textAlign,
      verticalAlign: profile.verticalAlign ?? DEFAULT_STYLE.verticalAlign,
      borderStyle: profile.borderStyle ?? DEFAULT_STYLE.borderStyle,
      borderWidth: profile.borderWidth ?? DEFAULT_STYLE.borderWidth,
      borderRadius: profile.borderRadius ?? DEFAULT_STYLE.borderRadius,
      borderColor: profile.borderColor ?? DEFAULT_STYLE.borderColor,
      showShadow: profile.showShadow ?? DEFAULT_STYLE.showShadow,
      showAccentBar: profile.showAccentBar ?? DEFAULT_STYLE.showAccentBar,
      opacity: profile.opacity ?? DEFAULT_STYLE.opacity,
    };
  }

  // No profile saved, return system defaults
  return {
    color: stencilDef?.color ?? DEFAULT_STYLE.color,
    styleVariant: DEFAULT_STYLE.styleVariant,
    fontSize: DEFAULT_STYLE.fontSize,
    fontWeight: DEFAULT_STYLE.fontWeight,
    fontStyle: DEFAULT_STYLE.fontStyle,
    textDecoration: DEFAULT_STYLE.textDecoration,
    textAlign: DEFAULT_STYLE.textAlign,
    verticalAlign: DEFAULT_STYLE.verticalAlign,
    borderStyle: DEFAULT_STYLE.borderStyle,
    borderWidth: DEFAULT_STYLE.borderWidth,
    borderRadius: DEFAULT_STYLE.borderRadius,
    borderColor: DEFAULT_STYLE.borderColor,
    showShadow: DEFAULT_STYLE.showShadow,
    showAccentBar: DEFAULT_STYLE.showAccentBar,
    opacity: DEFAULT_STYLE.opacity,
  };
}

/**
 * Clear saved style from profile for a specific stencil
 */
export async function clearStencilStyle(packId, stencilId) {
  if (typeof window === 'undefined') return;

  const key = getStencilStyleKey(packId, stencilId);

  // Clear from session
  if (sessionCache) {
    delete sessionCache[key];
    saveSessionCache();
  }

  // Clear from profile
  if (profileCache === null) {
    profileCache = loadProfileCacheFromStorage();
  }
  delete profileCache[key];
  saveProfileCacheToStorage(profileCache);
  await saveProfileToAPI(profileCache);
}

/**
 * Clear all saved stencil styles
 */
export async function clearAllStencilStyles() {
  if (typeof window === 'undefined') return;

  sessionCache = {};
  profileCache = {};

  localStorage.removeItem(SESSION_STORAGE_KEY);
  localStorage.removeItem(PROFILE_STORAGE_KEY);

  await saveProfileToAPI({});
}

// Legacy exports for compatibility
export { loadProfileStylesSync as loadStencilStyles };
export { loadProfileStylesSync as loadStencilStylesSync };
