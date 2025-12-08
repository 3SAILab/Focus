module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/electron/**/*.test.js'],
  collectCoverageFrom: [
    'electron/**/*.js',
    '!electron/**/*.test.js',
    '!**/node_modules/**'
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  testTimeout: 60000, // 60 seconds for E2E tests
};
