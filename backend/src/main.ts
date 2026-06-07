/**
 * Ponto de entrada principal do servidor.
 * Configura infra (BD + Redis), monta a app Express e regista graceful shutdown.
 */

import 'dotenv/config';

import { createApp, registerRoutes, startServer } from '@infra/frameworks/express/app';
import { bootstrap } from '@infra/frameworks/express/bootstrap';
import { loadConfig } from '@infra/frameworks/config';
import {
  initializeDatabase,
  checkDatabaseConnection,
  closeDatabaseConnection,
} from '@infra/frameworks/database';
import {
  initializeRedis,
  checkRedisConnection,
  disconnectRedis,
} from '@infra/frameworks/cache/redis';
import { logger } from '@infra/frameworks/logging';

/**
 * Inicia o servidor Express com toda a infra inicializada.
 *
 * Ordem de arranque:
 *   1. loadConfig()        — valida .env (inclui REDIS_URL)
 *   2. initializeDatabase  — pool PostgreSQL
 *   3. initializeRedis     — cliente ioredis singleton
 *   4. bootstrap()         — composition root (usa getDatabase + getRedisClient)
 *   5. startServer()       — aceita tráfego HTTP
 */
async function main(): Promise<void> {
  try {
    // Carrega configuração global
    const config = loadConfig();
    const databaseURL = `postgresql://${config.DATABASE_USER}:${config.DATABASE_PASSWORD}@${config.DATABASE_HOST}:${config.DATABASE_PORT}/${config.DATABASE_NAME}`;
    initializeDatabase(databaseURL);
    const isDatabaseReady = await checkDatabaseConnection();

    // Inicializa Redis
    initializeRedis(config.REDIS_URL);

    // Health check opcional no arranque — Redis down não impede o servidor de arrancar.
    // O cache degrada para BD (Cache-Aside); apenas registamos o aviso.
    const isRedisReady = await checkRedisConnection();
    if (!isRedisReady) {
      logger.warn('redis_not_ready_at_startup', {
        message: 'Cache will fall back to database until Redis is available',
      });
    }

    // Log: Inicialização do servidor
    logger.info('server_initializing', {
      node_version: process.version,
      environment: config.NODE_ENV,
      database_ready: isDatabaseReady,
      redis_ready: isRedisReady,
    });

    const app = createApp();
    const routers = bootstrap();
    registerRoutes(app, routers);
    startServer(app, config.PORT);

    const shutdown = async (signal: string): Promise<void> => {
      logger.info('server_shutting_down', { signal });
      await closeDatabaseConnection();
      await disconnectRedis();
      process.exit(0);
    };

    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
  } catch (error) {
    // Log: Erro ao iniciar o servidor
    logger.error('server_startup_failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Exit com código de erro
    process.exit(1);
  }
}

// Executa a função principal
if (require.main === module) {
  main().catch((error) => {
    logger.error('uncaught_error', { error });
    process.exit(1);
  });
}

export { main };
