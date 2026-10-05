/**
 * E2E Test Global Teardown
 *
 * This file runs once after all E2E tests complete.
 * It can be used to cleanup resources, stop servers, etc.
 */

module.exports = async () => {
  console.log('\n[E2E Teardown] Cleaning up E2E test environment...');

  // Any cleanup logic goes here
  // For example:
  // - Stop dev server if started programmatically
  // - Clean up test database entries
  // - Remove temporary files

  console.log('[E2E Teardown] Cleanup complete.');
};
