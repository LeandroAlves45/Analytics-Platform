/**
 * Configuração Jest com dois projectos separados:
 *
 * - unit: testes unitários rápidos, sem I/O real, sem BD, sem Redis
 * - integration: testes com BD PostgreSQL real, Supertest, mais lentos
 *
 * Separar os projectos permite:
 * 1. CI rápido: correr apenas unitários em PRs pequenos
 * 2. CI completo: correr integração em merge para main
 * 3. Desenvolvimento: `npm run test:unit` sem precisar de Docker
 */

module.exports = {
  // testTimeout ao nível global — não é uma opção válida a nível de projecto.
  // Aplica-se a todos os testes (unit + integration).
  testTimeout: 30000,

  // Quando não especificado, corre todos os projectos
  projects: [
    // -------------------------------------------------------------------
    // Projecto 1: Testes Unitários
    // Rápidos, sem dependências externas, sem BD, sem Redis
    // -------------------------------------------------------------------
    {
      displayName: 'unit',
      testEnvironment: 'node',
      // Apanha apenas ficheiros dentro de tests/unit
      testMatch: ['<rootDir>/tests/unit/**/*.test.ts'],
      transform: {
        '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
      },
      moduleNameMapper: {
        '^@domain/(.*)$': '<rootDir>/src/domain/$1',
        '^@application/(.*)$': '<rootDir>/src/application/$1',
        '^@infra/(.*)$': '<rootDir>/src/infra/$1',
        '^@shared/(.*)$': '<rootDir>/src/shared/$1',
      },
      setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
    },

    // -------------------------------------------------------------------
    // Projecto 2: Testes de Integração
    // Lentos, precisam de BD PostgreSQL real (Docker Compose)
    // globalSetup/globalTeardown inicializam BD uma vez para toda a suite
    // -------------------------------------------------------------------
    {
      displayName: 'integration',
      testEnvironment: 'node',
      // Apanha apenas ficheiros dentro de tests/integration
      testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
      transform: {
        '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
      },
      moduleNameMapper: {
        '^@domain/(.*)$': '<rootDir>/src/domain/$1',
        '^@application/(.*)$': '<rootDir>/src/application/$1',
        '^@infra/(.*)$': '<rootDir>/src/infra/$1',
        '^@shared/(.*)$': '<rootDir>/src/shared/$1',
      },
      // Setup específico de integração.
      setupFilesAfterEnv: ['<rootDir>/tests/integration/setup.ts'],
    },
  ],

  // Coverage recolhido globalmente quando se corre `npm test -- --coverage`
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/infra/frameworks/database/schema.ts',
  ],
  coverageThreshold: {
    './src/domain/**/*.ts': {
      statements: 100,
      functions: 100,
      lines: 100,
      branches: 100,
    },
    './src/application/usecases/**/*.ts': {
      statements: 100,
      functions: 100,
      lines: 100,
      branches: 100,
    },
  },
};
