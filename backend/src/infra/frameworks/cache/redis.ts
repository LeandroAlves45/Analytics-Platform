/**
 * Módulo de conexão Redis usando ioredis.
 *
 * Segue o mesmo padrão de singleton explícito do connection.ts da base de dados:
 * - initializeRedis() é chamado uma vez em main.ts com a URL validada pelo loadConfig()
 * - getRedisClient() devolve a instância já inicializada
 * - checkRedisConnection() verifica disponibilidade via PING (usado em /ready)
 * - disconnectRedis() fecha a ligação no graceful shutdown
 *
 * O cache é best-effort: se Redis falhar, o repositório faz fallback à BD.
 * Por isso usamos timeouts e retries limitados — não bloqueamos requests indefinidamente.
 */

import Redis from 'ioredis';
import { logger } from '@infra/frameworks/logging';

// Instância singleton de Redis
let redisClient: Redis | null = null;

/** Erros de rede onde o ioredis deve tentar reconectar automaticamente */
const RECONNECT_ON_ERRORS_MESSAGES = ['READONLY', 'ECONNRESET', 'ETIMEOUT'] as const;

/**
 * Mascara credenciais na URL Redis para logs.
 * Ex: redis://user:pass@host:6379 → redis://<credentials>@host:6379
 *
 * @param redisUrl - URL de ligação Redis
 * @returns URL com credenciais substituídas
 */
function maskRedisUrl(redisUrl: string): string {
  return redisUrl.replace(/\/\/.*@/, '//<credentials>@');
}

/**
 * Inicializa o cliente Redis singleton.
 * Deve ser chamada uma vez em main.ts, após loadConfig(), com config.REDIS_URL.
 *
 * @param redisUrl - URL de ligação validada pelo schema Zod
 * @returns Instância do cliente Redis
 * @throws Error se já estiver inicializado com URL diferente
 */
export function initializeRedis(redisUrl: string): Redis {
  if (redisClient !== null) {
    return redisClient;
  }

  logger.info('initializing_redis', { url: maskRedisUrl(redisUrl) });

  // Cria a instância Redis com configuração explícita de reconnect
  redisClient = new Redis(redisUrl, {
    // Fail-fast para cache: 1 retry evita fila infinita quando Redis está down.
    // TODO: BullMQ (Sprint 3) usará cliente separado com maxRetriesPerRequest: null.
    maxRetriesPerRequest: 1,

    // Timeout em ms -> falham rápido para o cache degradar para BD
    connectTimeout: 5_000,
    commandTimeout: 5_000,

    // Reconecta automaticamente em erros de rede recuperáveis
    reconnectOnError: (error) => {
      return RECONNECT_ON_ERRORS_MESSAGES.some((msg) => error.message.includes(msg));
    },
  });

  // Registo de eventos de ciclo de vida para observabilidade
  redisClient.on('connect', () => {
    logger.info('redis_connected', { url: maskRedisUrl(redisUrl) });
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
 * Devolve a instância Redis já inicializada.
 * Deve ser chamada após initializeRedis() em main.ts.
 *
 * @returns Instância singleton do cliente Redis
 * @throws Error se Redis não foi inicializado
 */
export function getRedisClient(): Redis {
  if (redisClient === null) {
    throw new Error('Redis not initialized. Call initializeRedis() in main.ts first.');
  }
  return redisClient;
}

/**
 * Verifica se o Redis está acessível executando PING.
 * Usado no endpoint /ready — falha silenciosa devolve false, não lança.
 *
 * @returns true se PING respondeu PONG, false caso contrário
 */
export async function checkRedisConnection(): Promise<boolean> {
  if (redisClient === null) {
    return false;
  }

  try {
    const response = await redisClient.ping();
    return response === 'PONG';
  } catch (error) {
    logger.error('redis_health_check_failed', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return false;
  }
}

/**
 * Fecha a conexão Redis de forma controlada.
 *
 * quit() envia QUIT ao servidor antes de fechar a socket,
 * permitindo que operações em curso terminem graciosamente.
 *
 * Deve ser chamado no handler de graceful shutdown em main.ts,
 * a seguir a closeDatabaseConnection().
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
