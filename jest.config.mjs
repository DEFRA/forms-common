const { CI } = process.env

/**
 * Jest config
 * @type {Config}
 */
export default {
  displayName: '@defra/forms-common',
  maxWorkers: '50%',
  workerIdleMemoryLimit: '512MB',
  reporters: CI
    ? [['github-actions', { silent: false }], 'summary']
    : ['default', 'summary'],
  silent: true,
  clearMocks: true,
  resetModules: true,
  restoreMocks: true,

  // Configure test files and coverage
  testMatch: ['<rootDir>/src/**/*.test.{cjs,js,mjs}'],
  collectCoverageFrom: ['<rootDir>/src/**/*.{cjs,js,mjs}'],
  coverageDirectory: '<rootDir>/coverage',
  coveragePathIgnorePatterns: ['/node_modules/', '<rootDir>/dist/'],
  modulePathIgnorePatterns: ['<rootDir>/coverage/', '<rootDir>/dist/'],
  transform: {
    '^.+\\.(cjs|js|mjs)$': [
      'babel-jest',
      {
        browserslistEnv: 'node'
      }
    ]
  },

  // Enable Babel transforms for node_modules
  // See: https://jestjs.io/docs/ecmascript-modules
  transformIgnorePatterns: [
    `node_modules/(?!${[
      '@defra/hapi-tracing' // Supports ESM only
    ].join('|')}/)`
  ]
}

/**
 * @import { Config } from 'jest'
 */
