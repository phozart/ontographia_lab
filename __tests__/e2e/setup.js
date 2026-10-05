/**
 * E2E Test Global Setup
 *
 * This file runs once before all E2E tests.
 * It can be used to start the dev server, set up test database, etc.
 */

module.exports = async () => {
  console.log('\n[E2E Setup] Preparing E2E test environment...');

  // Set environment variables for E2E tests
  process.env.E2E_TEST = 'true';
  process.env.TEST_BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3002';

  // Note: The Next.js dev server should be running before tests
  // You can either:
  // 1. Start it manually: npm run dev -- -p 3002
  // 2. Use a library like start-server-and-test
  // 3. Start it programmatically here (more complex)

  console.log('[E2E Setup] Environment prepared.');
  console.log('[E2E Setup] Ensure the app is running at http://localhost:3002');
  console.log('');
};
