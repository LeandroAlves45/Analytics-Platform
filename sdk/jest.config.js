/** @type {import('jest').Config} */
module.exports = {
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
  testEnvironment: 'node',

  // Onde procurar testes
  testMatch: ['<rootDir>/tests/**/*.test.ts'],

  // Cobertura mínima para o SDK
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },

  // Timeout de 10s — alguns testes de retry têm delays
  testTimeout: 10000,
};
