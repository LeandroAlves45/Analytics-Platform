module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }]
  },
  moduleNameMapper: {
    '^@domain/(.*)$': '<rootDir>/src/domain/$1',
    '^@application/(.*)$': '<rootDir>/src/application/$1',
    '^@infra/(.*)$': '<rootDir>/src/infra/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1'
  },
  // Executa setup.ts depois do framework Jest estar instalado.
  // Garante LOG_LEVEL=silent, TZ=UTC e jest.setTimeout antes de cada suite.
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/infra/frameworks/database/schema.ts',
  ],
  coverageThreshold: {
    './src/domain/**/*.ts': { statements: 100, functions: 100, lines: 100, branches: 100 },
    './src/application/usecases/**/*.ts': { statements: 100, functions: 100, lines: 100, branches: 100 },
  },
};
