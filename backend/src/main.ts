/**
 * Ponto de entrada principal do servidor
 * Configura e inicia o servidor Express
 */

import 'dotenv/config';

import { createApp, registerRoutes, startServer } from '@infra/frameworks/express/app';
import { bootstrap } from '@infra/frameworks/express/bootstrap';
import { loadConfig } from '@infra/frameworks/config';
import { closeDatabaseConnection } from '@infra/frameworks/database';
import { disconnectRedis } from '@infra/frameworks/cache/redis';
import { logger } from '@infra/frameworks/logging';

/**
 * Função principal que inicia o servidor
 * Inicializa o servidor Express e inicia o processo
 */
async function main(): Promise<void> {
  try {
    // Carrega configuração global
    const config = loadConfig();

    // Log: Inicialização do servidor
    logger.info('server_initializing', {
      node_version: process.version,
      environment: config.NODE_ENV,
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
