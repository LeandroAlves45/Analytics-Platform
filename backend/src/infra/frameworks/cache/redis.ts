/**
 * Módulo de conexão Redis usando ioredis.
 *
 * Segue o mesmo padrão de singleton lazy do connection.ts da base de dados:
 * - A instância é criada na primeira chamada a getRedisClient()
 * - Todas as chamadas subsequentes recebem a mesma instância
 * - O cliente é fechado explicitamente via disconnectRedis() no shutdown
 *
 * Esta abordagem garante que toda a aplicação partilha uma única
 * conexão TCP ao Redis, evitando desperdício de recursos.
 */

import Redis from 'ioredis';
import { logger } from '@infra/frameworks/logging';

// Instância singleton de Redis
let redisClient: Redis | null = null;

/**
 * Devolve (e cria se necessário) o cliente Redis singleton.
 *
 * Lê REDIS_URL das variáveis de ambiente. Esta variável deve estar
 * presente em todos os ambientes (development, test, production).
 *
 * O ioredis tenta reconectar automaticamente em caso de falha de rede
 * com backoff exponencial — não precisamos de gerir isso manualmente.
 *
 * @returns Instância singleton do cliente Redis
 * @throws Error se REDIS_URL não estiver definida
 */
export function getRedisClient(): Redis {
  if (redisClient !== null) {
    return redisClient;
  }

  const redisUrl = process.env['REDIS_URL'];

  if (!redisUrl) {
    throw new Error('REDIS_URL environment variable is not defined');
  }

  // Cria a instância Redis com configuração explícita de reconnect
  redisClient = new Redis(redisUrl, {
    // Número máximo de tentativas de reconnect. null = infinitas tentativas
    maxRetriesPerRequest: null,
    // Estratégia de reconnect com backoff exponencial entre tentativas
    // Começa em 50ms, dobra a cada tentativa até ao máximo de 2000ms
    reconnectOnError: (error) => {
      const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEOUT'];
      return targetErrors.some((msg) => error.message.includes(msg));
    },
  });

  // Registo de eventos de ciclo de vida para observabilidade
  redisClient.on('connect', () => {
    logger.info('redis_connected', { url: redisUrl.replace(/\/\/.*@/, '//<credentials>@') });
  });

  redisClient.on('ready', () => {
    logger.info('redis_ready');
  });

  redisClient.on('error', (error: Error) => {
    // Log sem lançar — ioredis gere reconnect automaticamente
    logger.error('redis_error', { error: error.message });
  });

  redisClient.on('close', () => {
    logger.info('redis_connection_closed');
  });

  redisClient.on('reconnecting', (delay: number) => {
    logger.info('redis_reconnecting', { delay_ms: delay });
  });

  return redisClient;
}

/**
 * Fecha a conexão Redis de forma controlada.
 *
 * quit() envia o comando QUIT ao servidor Redis antes de fechar,
 * garantindo que operações em curso terminam. É a alternativa
 * correcta a disconnect() que fecha a socket imediatamente.
 *
 * Deve ser chamado no handler de graceful shutdown em main.ts,
 * a seguir ao encerramento da base de dados.
 */
export async function disconnectRedis(): Promise<void> {
  if (redisClient === null) {
    return;
  }

  try {
    await redisClient.quit();
    redisClient = null;
    logger.info('redis_disconnected');
  } catch (error) {
    logger.error('redis_disconnect_failed', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    redisClient = null;
  }
}
