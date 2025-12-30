// pages/api/user/settings.js
// API endpoint for user settings

import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { userSettingsRepository } from '../../../lib/userSettingsRepository';

export default async function handler(req, res) {
  try {
    // Get authenticated user
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userEmail = session.user.email;

    switch (req.method) {
      case 'GET': {
        // Get all settings for user
        const settings = await userSettingsRepository.getSettings(userEmail);
        return res.status(200).json(settings);
      }

      case 'PUT': {
        // Update all settings
        const settings = req.body;
        if (!settings || typeof settings !== 'object') {
          return res.status(400).json({ error: 'Invalid settings object' });
        }
        const result = await userSettingsRepository.upsertSettings(userEmail, settings);
        return res.status(200).json(result.settings);
      }

      case 'PATCH': {
        // Update a single setting
        const { key, value } = req.body;
        if (!key) {
          return res.status(400).json({ error: 'Setting key is required' });
        }
        const result = await userSettingsRepository.updateSetting(userEmail, key, value);
        return res.status(200).json(result.settings);
      }

      case 'DELETE': {
        // Reset all settings to defaults
        const result = await userSettingsRepository.resetSettings(userEmail);
        return res.status(200).json({
          message: 'Settings reset to defaults',
          settings: result.settings
        });
      }

      default:
        res.setHeader('Allow', ['GET', 'PUT', 'PATCH', 'DELETE']);
        return res.status(405).json({ error: `Method ${req.method} not allowed` });
    }
  } catch (error) {
    console.error('User settings API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
