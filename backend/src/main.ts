/**
 * Ponto de entrada principal do servidor
 * Configura e inicia o servidor Express
 */

import 'dotenv/config';

import { createApp, startServer } from '@infra/frameworks/express/app';
import { loadConfig } from '@infra/frameworks/config';
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

    // Cria a aplicação Express configurada
    const app = createApp();

    // Inicia o servidor HTTP na porta configurada
    startServer(app, config.PORT);

    // Graceful shutdown
    // Quando Ctrl+C ou SIGTERM é recebido, encerra o servidor
    process.on('SIGINT', () => {
      logger.info('server_shutting_down', { signal: 'SIGINT' });
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      logger.info('server_shutting_down', { signal: 'SIGTERM' });
      process.exit(0);
    });
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
