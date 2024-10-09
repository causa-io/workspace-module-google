/** @type {import('jest').Config} */
const config = {
  clearMocks: true,
  coverageDirectory: '../coverage',
  collectCoverageFrom: [
    '**/*.{js,ts}',
    '!**/index.ts',
    '!**/*.spec.ts',
    '!**/*.test.{ts,js}',
    '!./definitions/**/*.ts',
  ],
  rootDir: 'src',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['jest-extended/all'],
  testMatch: ['**/*.spec.ts'],
  extensionsToTreatAsEsm: ['.ts'],
  moduleFileExtensions: ['js', 'ts', 'json'],
  transform: {
    '^.+\\.(t|j)s?$': ['@swc/jest', { sourceMaps: 'inline' }],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};

export default config;
