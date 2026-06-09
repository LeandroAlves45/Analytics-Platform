/**
 * Implementação concreta do AggregationQueueService usando BullMQ.
 *
 * Esta classe é responsável por ENFILEIRAR jobs.
 *
 * Separação de responsabilidades:
 *  - BullMQAggregationQueue: coloca jobs na fila (producer)
 *  - AggregationWorker: consome e processa jobs da fila (consumer)
 */

import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { logger } from '@infra/frameworks/logging';
import type { AggregationQueueService } from '@application/contracts/repositories';
import type { ScheduleAggregationInput } from '@application/dto/AggregationDTO';

/**
 * Nome da queue partilhado entre producer e consumer.
 */
export const AGGREGATION_QUEUE_NAME = 'metrics_aggregation';

/**
 * Produtor da queue de agregação de métricas.
 *
 * Implementa AggregationQueueService da application layer.
 * Usa BullMQ para persistir jobs no Redis, garantindo que
 * mesmo que o worker esteja temporariamente indisponível,
 * os jobs não se perdem.
 */
export class BullMQAggregationQueue implements AggregationQueueService {
  private readonly queue: Queue<ScheduleAggregationInput>;

  constructor(redisClient: Redis) {
    // Instância a Queue BullMQ com o cliente Redis dedicado-
    // A Queue não processa jobs, apenas persiste no Redis.
    this.queue = new Queue<ScheduleAggregationInput>(AGGREGATION_QUEUE_NAME, {
      connection: redisClient,

      defaultJobOptions: {
        // Número de tentativas automáticas em caso de falha do worker.
        // 3 tentativas cobre falhas transitórias (timeout de BD, restart).
        attempts: 3,

        backoff: {
          // Backoff exponencial: 1s, 2s, 4s entre tentativas.
          type: 'exponential',
          delay: 1_000,
        },

        // Remove jobs completados após 1 hora para não acumular no Redis.
        // Jobs falhados são mantidos 24 horas para diagnóstico.
        removeOnComplete: { age: 3_600 },
        removeOnFail: { age: 86_400 },
      },
    });

    logger.info('aggregation_queue_initialized', { queue_name: AGGREGATION_QUEUE_NAME });
  }

  /**
   * Coloca um job de agregação na fila.
   *
   * O jobId é determinístico: combina workspaceId, endpoint, method e intervalo.
   * Isto garante que dois requests concorrentes para o mesmo endpoint
   * não geram dois jobs duplicados — BullMQ ignora o segundo add() com jobId igual.
   *
   * @param input - Dados do job: workspace, endpoint, method, intervalo
   */
  async scheduleAggregation(input: ScheduleAggregationInput): Promise<void> {
    // Constrói um jobId determinístico para idempotência da queue.
    // Se o mesmo endpoint enviar 100 métricas em 5 segundos, apenas
    // um job de agregação é enfileirado para essa janela de 5 minutos.
    const jobId = buildAggregationJobId(input);

    try {
      await this.queue.add(AGGREGATION_QUEUE_NAME, input, {
        // Deduplica jobs com o mesmo jobId numa janela de 5 minutos.
        // Se um job com este jobId já existir na queue (pendente ou em processamento),
        // o BullMQ ignora silenciosamente este add().
        deduplication: {
          id: jobId,
          ttl: input.intervalMinutes * 60 * 1_000, // TTL de 5 minutos.
        },
      });

      logger.info('aggregation_job_enqueued', {
        jobId,
        workspaceId: input.workspaceId,
        endpoint: input.endpoint,
        method: input.method,
        intervalMinutes: input.intervalMinutes,
      });
    } catch (error) {
      logger.error('aggregation_job_enqueue_failed', {
        jobId,
        workspaceId: input.workspaceId,
        endpoint: input.endpoint,
        error: error instanceof Error ? error.message : 'unknown',
      });

      // Re-lançamos para que o RecordMetricUseCase possa logar o warning.
      throw error;
    }
  }

  /**
   * Fecha a conexão com a Queue de forma controlada.
   * Deve ser chamado no graceful shutdown em main.ts.
   */
  async close(): Promise<void> {
    await this.queue.close();
    logger.info('aggregation_queue_closed');
  }
}

/**
 * Constrói um jobId determinístico para idempotência.
 *
 * Formato: agg:{workspaceId}:{endpoint}:{method}:{intervalMinutes}m
 * Exemplo: agg:uuid-123:/api/users:GET:5m
 *
 * A janela de 5 minutos garante que num dado ciclo de 5 minutos,
 * só existe um job de agregação por combinação workspace/endpoint/method.
 */
function buildAggregationJobId(input: ScheduleAggregationInput): string {
  // Trunca o timestamp actual para o início do intervalo actual.
  // Se agora forem 14:07, a janela de 5 min começa em 14:05.
  const windowsStart = Math.floor(Date.now() / (input.intervalMinutes * 60 * 1_000));

  return `agg:${input.workspaceId}:${input.endpoint}:${input.method}:${input.intervalMinutes}m:${windowsStart}`;
}
