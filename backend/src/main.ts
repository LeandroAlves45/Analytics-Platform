/**
 * Ponto de entrada principal do servidor.
 * Configura infra (BD + Redis), monta a app Express e regista graceful shutdown.
 *
 * Ordem de arranque:
 *   1. loadConfig()              — valida .env
 *   2. initializeDatabase        — pool PostgreSQL
 *   3. initializeRedis           — cliente ioredis para cache
 *   4. initializeBullMQRedis     — cliente ioredis dedicado ao BullMQ
 *   5. bootstrap()               — composition root
 *   6. startServer()             — aceita tráfego HTTP
 */

// Deve ser definido antes de qualquer import que use o threadpool do libuv
// (bcrypt, crypto, fs assíncrono). O default de 4 threads satura sob concorrência
// alta de bcrypt.compare (ex.: cache miss simultâneo em múltiplos workspaces),
// causando fila e p95 elevado. Cross-platform: independe do shell (PowerShell/bash).
process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE ?? '16';

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
  initializeBullMQRedis,
  checkRedisConnection,
  checkBullMQRedisConnection,
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
    // Passo 1: carregar e validar configuração
    const config = loadConfig();

    // Passo 2: inicializar base de dados
    const databaseURL = `postgresql://${config.DATABASE_USER}:${config.DATABASE_PASSWORD}@${config.DATABASE_HOST}:${config.DATABASE_PORT}/${config.DATABASE_NAME}`;
    initializeDatabase(databaseURL);
    const isDatabaseReady = await checkDatabaseConnection();

    if (!isDatabaseReady) {
      logger.error('database_not_ready_at_startup', {
        message: 'Cannot start server without database connection',
      });
      process.exit(1);
    }

    // Passo 3: inicializar cliente Redis de cache
    initializeRedis(config.REDIS_URL);

    // Health check opcional no arranque —> Redis down não impede o servidor de arrancar.
    // O cache degrada para BD (Cache-Aside); apenas registamos o aviso.
    const isRedisReady = await checkRedisConnection();
    if (!isRedisReady) {
      logger.warn('redis_not_ready_at_startup', {
        message: 'Cache will fall back to database until Redis is available',
      });
    }

    // Passo 4: inicializar cliente Redis dedicado ao BullMQ.
    // Mesmo padrão do cache Redis: aviso se indisponível, mas não bloqueia o arranque.
    initializeBullMQRedis(config.REDIS_URL);
    const isBullMQRedisReady = await checkBullMQRedisConnection();
    if (!isBullMQRedisReady) {
      logger.warn('bullmq_redis_not_ready_at_startup', {
        message: 'Aggregation workers will retry connection automatically',
      });
    }

    // Log: Inicialização do servidor
    logger.info('server_initializing', {
      node_version: process.version,
      environment: config.NODE_ENV,
      database_ready: isDatabaseReady,
      redis_ready: isRedisReady,
      bullmq_redis_ready: isBullMQRedisReady,
    });

    // Passo 5: composition root
    const { routers, lifecycle, stripeWebhookRouter } = bootstrap(
      config.METRICS_CACHE_TTL_SECONDS,
      config
    );
    const app = createApp(stripeWebhookRouter, config.CORS_ORIGIN);
    registerRoutes(app, routers);
    startServer(app, config.PORT);

    // Graceful shutdown —> ordem inversa ao arranque.
    //
    // 1. scheduler: para de enfileirar novos jobs
    // 2. worker: aguarda o job em curso terminar e fecha
    // 3. queue: fecha a ligação BullMQ
    // 4. database: fecha o pool de conexões (antes do Redis para não perder operações pendentes)
    // 5. redis: fecha ambos os clientes (cache + BullMQ)
    const shutdown = async (signal: string): Promise<void> => {
      logger.info('server_shutting_down', { signal });

      lifecycle.alertEvaluationScheduler.stop();
      lifecycle.aggregationScheduler.stop();
      await lifecycle.aggregationWorker.close();
      await lifecycle.aggregationQueue.close();
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
