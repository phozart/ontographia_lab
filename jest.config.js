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

// Suites that create/drop throwaway PostgreSQL databases (or hit a real DB).
// They contend with each other when run in parallel, so they live in their own
// `db` project and `npm test` runs that project with --runInBand.
// Add new real-DB suites here (suites that mock lib/db belong in `unit`).
const dbTests = [
  '<rootDir>/__tests__/scripts/migrate.test.js',
  '<rootDir>/__tests__/scripts/migrate0002.test.js',
  '<rootDir>/__tests__/scripts/migrate0003.test.js',
  '<rootDir>/__tests__/scripts/migrate0007.test.js',
  '<rootDir>/__tests__/lib/memberRepository.test.js',
  '<rootDir>/__tests__/lib/versionRepository.test.js',
  '<rootDir>/__tests__/lib/apiTokensConcurrency.test.js',
];

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
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.next/',
    '<rootDir>/__tests__/e2e/',
    ...dbTests,
  ],
};

// DB-backed tests (run serially via `npm run test:db`)
const dbConfig = {
  ...unitConfig,
  displayName: 'db',
  testMatch: dbTests,
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/'],
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
    await createJestConfig(dbConfig)(),
    await createJestConfig(e2eConfig)(),
  ],
});
