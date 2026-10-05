// jest.config.js
const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

// Shared options for every project
const common = {
  rootDir: __dirname,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  modulePathIgnorePatterns: ['<rootDir>/.next/'],
};

// Unit tests configuration
const unitConfig = {
  ...common,
  displayName: 'unit',
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: [
    '<rootDir>/__tests__/**/*.test.{js,jsx,ts,tsx}',
    '!<rootDir>/__tests__/e2e/**',
  ],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/', '<rootDir>/__tests__/e2e/'],
};

// E2E tests configuration (uses Node environment for Puppeteer)
const e2eConfig = {
  ...common,
  displayName: 'e2e',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/__tests__/e2e/**/*.test.{js,jsx,ts,tsx}'],
  testTimeout: 60000,
  globalSetup: '<rootDir>/__tests__/e2e/setup.js',
  globalTeardown: '<rootDir>/__tests__/e2e/teardown.js',
};

// Per-project configs do not inherit next/jest's SWC transform from the root,
// so build each project through createJestConfig individually.
module.exports = async () => ({
  collectCoverageFrom: [
    'components/**/*.{js,jsx}',
    'lib/**/*.{js,jsx}',
    'pages/**/*.{js,jsx}',
    '!**/node_modules/**',
  ],
  projects: [
    await createJestConfig(unitConfig)(),
    await createJestConfig(e2eConfig)(),
  ],
});
