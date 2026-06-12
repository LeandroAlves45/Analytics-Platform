/**
 * Setup global para testes de integração.
 *
 * Este ficheiro é executado pelo Jest antes de cada ficheiro de teste
 * de integração (setupFilesAfterEnv no jest.config.js).
 *
 * Responsabilidades:
 * - Inicializar BD PostgreSQL de teste uma única vez por suite
 * - Expor a app Express configurada para uso com Supertest
 * - Limpar tabelas antes de cada teste (isolamento total)
 * - Fechar conexões no final de toda a suite
 *
 * A app Express é criada sem iniciar servidor TCP.
 * Supertest faz pedidos directamente ao handler sem abrir portas.
 */

import 'dotenv/config';
import type { Express } from 'express';
import { sql } from 'drizzle-orm';

import { createApp, registerRoutes } from '@infra/frameworks/express/app';
import {
  initializeDatabase,
  closeDatabaseConnection,
  getDatabase,
} from '@infra/frameworks/database';
import { loadConfig } from '@infra/frameworks/config';
import { logger } from '@infra/frameworks/logging';

// Bootstrap alternativo para testes: usa NoOpMetricsCacheService em vez de Redis
// para eliminar dependência de Redis nos testes de integração
import { bootstrapForTesting } from './bootstrapTest';

// App Express partilhada por todos os testes de integração.
// Inicializada em beforeAll, usada em cada teste via getTestApp().
let testApp: Express | null = null;

/**
 * Devolve a app Express de teste.
 * Deve ser chamado dentro de beforeAll ou dentro dos testes,
 * nunca no top-level do módulo de teste.
 */
export function getTestApp(): Express {
  if (testApp == null) {
    throw new Error(
      'Test app not initialized. Make sure integration setup.ts is loaded via setupFilesAfterEnv.'
    );
  }
  return testApp;
}

// Inicializar BD e app uma única vez antes de todos os testes
beforeAll(async () => {
  // Silenciar logs durante testes para output limpo
  process.env['LOG_LEVEL'] = 'silent';
  // Garantir timezone consistente
  process.env['TZ'] = 'UTC';

  const config = loadConfig();

  // Costruir DATABASE_URL a partir das variáveis de ambiente
  const databaseUrl = `postgresql://${config.DATABASE_USER}:${config.DATABASE_PASSWORD}@${config.DATABASE_HOST}:${config.DATABASE_PORT}/${config.DATABASE_NAME}`;

  initializeDatabase(databaseUrl);

  // Criar app Express com bootstrap de teste (sem Redis)
  const app = createApp();
  const routers = bootstrapForTesting();
  registerRoutes(app, routers);

  testApp = app;

  logger.info('integration_test_setup_complete');
}, 30000);

/**
 * Limpar tabelas antes de cada teste para garantir isolamento total.
 *beforeEach em vez de afterEach: se um teste falhar a meio, as tabelas
 *ficam sujas mas o próximo teste começa sempre com estado limpo.
 */
beforeEach(async () => {
  const db = getDatabase();

  // TRUNCATE CASCADE garante que foreign keys não bloqueiam a limpeza.
  await db.execute(sql`TRUNCATE TABLE metrics_raw RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE metric_idempotency_keys RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE metrics_5min RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE metrics_1h RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE metrics_1d RESTART IDENTITY CASCADE`);
});

// Fechar conexão á BD após todos os testes
afterAll(async () => {
  await closeDatabaseConnection();
  testApp = null;
});
