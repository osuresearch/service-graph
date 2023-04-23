/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['dotenv/config'],
  projects: [
    {
      displayName: 'Federated gateway service',
      testEnvironment: 'node',
      transform: {
        '^.+\\.ts?$': 'ts-jest',
      },
      testMatch: [
        '<rootDir>/gateway/**/*.test.ts',
      ]
    },
    {
      displayName: 'Person service',
      testEnvironment: 'node',
      transform: {
        '^.+\\.ts?$': 'ts-jest',
      },
      testMatch: [
        '<rootDir>/person-service/**/*.test.ts',
      ]
    },
    {
      displayName: 'Search service',
      testEnvironment: 'node',
      transform: {
        '^.+\\.ts?$': 'ts-jest',
      },
      testMatch: [
        '<rootDir>/search-service/**/*.test.ts',
      ]
    }
  ]
};
