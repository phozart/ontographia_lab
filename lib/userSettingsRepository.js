// lib/userSettingsRepository.js
// Repository for user settings CRUD operations

import { query } from './db';

// Default settings for new users
// All packs enabled by default - users can customize via the pack manager
const DEFAULT_SETTINGS = {
  toolbarPosition: 'top',
  gridStyle: 'lines',
  showGrid: true,
  enabledPacks: ['core', 'process-flow', 'cld', 'uml-class', 'mind-map', 'product-design', 'erd', 'togaf', 'itil', 'capability-map'],
};

export const userSettingsRepository = {
  /**
   * Get settings for a user, creating defaults if not exists
   */
  async getSettings(userEmail) {
    if (!userEmail) return DEFAULT_SETTINGS;

    const result = await query(
      'SELECT settings FROM user_settings WHERE user_email = $1',
      [userEmail]
    );

    if (result.rows.length === 0) {
      // Create default settings for new user
      await this.upsertSettings(userEmail, DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    }

    // Merge with defaults to ensure all keys exist
    return { ...DEFAULT_SETTINGS, ...result.rows[0].settings };
  },

  /**
   * Update settings for a user (creates if not exists)
   */
  async upsertSettings(userEmail, settings) {
    if (!userEmail) {
      throw new Error('User email is required');
    }

    const result = await query(
      `INSERT INTO user_settings (user_email, settings, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_email)
       DO UPDATE SET settings = $2, updated_at = NOW()
       RETURNING *`,
      [userEmail, settings]
    );

    return result.rows[0];
  },

  /**
   * Update a single setting value
   */
  async updateSetting(userEmail, key, value) {
    if (!userEmail) {
      throw new Error('User email is required');
    }

    // Get current settings
    const current = await this.getSettings(userEmail);
    const updated = { ...current, [key]: value };

    return this.upsertSettings(userEmail, updated);
  },

  /**
   * Reset settings to defaults
   */
  async resetSettings(userEmail) {
    return this.upsertSettings(userEmail, DEFAULT_SETTINGS);
  },
};
