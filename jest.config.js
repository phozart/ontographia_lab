// jest.config.js
const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/', '<rootDir>/__tests__/e2e/'],
  modulePathIgnorePatterns: ['<rootDir>/.next/'],
  collectCoverageFrom: [
    'components/**/*.{js,jsx}',
    'lib/**/*.{js,jsx}',
    'pages/**/*.{js,jsx}',
    '!**/node_modules/**',
  ],
  // Projects configuration to support both unit tests and E2E tests
  projects: [
    // Unit tests configuration
    {
      displayName: 'unit',
      testEnvironment: 'jest-environment-jsdom',
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      testMatch: [
        '<rootDir>/__tests__/**/*.test.{js,jsx,ts,tsx}',
        '!<rootDir>/__tests__/e2e/**',
      ],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
      },
      testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/', '<rootDir>/__tests__/e2e/'],
    },
    // E2E tests configuration (uses Node environment for Puppeteer)
    {
      displayName: 'e2e',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/__tests__/e2e/**/*.test.{js,jsx,ts,tsx}'],
      testTimeout: 60000,
      globalSetup: '<rootDir>/__tests__/e2e/setup.js',
      globalTeardown: '<rootDir>/__tests__/e2e/teardown.js',
    },
  ],
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig);
