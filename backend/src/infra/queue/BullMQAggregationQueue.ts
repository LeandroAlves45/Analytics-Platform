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
import type {
  ScheduleAggregationInput,
  ScheduleAggregationRequest,
} from '@application/dto/AggregationDTO';
import { truncateToInterval } from '@shared/date-utils/truncate-to-interval';

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
    this.queue = new Queue<ScheduleAggregationInput>(AGGREGATION_QUEUE_NAME, {
      connection: redisClient,

      defaultJobOptions: {
        attempts: 3,

        backoff: {
          type: 'exponential',
          delay: 1_000,
        },

        removeOnComplete: { age: 3_600 },
        removeOnFail: { age: 86_400 },
      },
    });

    logger.info('aggregation_queue_initialized', { queue_name: AGGREGATION_QUEUE_NAME });
  }

  /**
   * Coloca um job de agregação na fila.
   *
   * windowStart é fixado aqui para que jobs atrasados persistam na janela correcta.
   * Quando input.windowStart é fornecido (ex: janela anterior), usa-o directamente.
   */
  async scheduleAggregation(input: ScheduleAggregationRequest): Promise<void> {
    const windowStart = input.windowStart ?? truncateToInterval(new Date(), input.intervalMinutes);
    const payload: ScheduleAggregationInput = { ...input, windowStart };
    const jobId = buildAggregationJobId(payload);

    try {
      await this.queue.add(AGGREGATION_QUEUE_NAME, payload, {
        jobId,
        deduplication: {
          id: jobId,
          ttl: input.intervalMinutes * 60 * 1_000,
        },
      });

      logger.info('aggregation_job_enqueued', {
        jobId,
        workspaceId: input.workspaceId,
        endpoint: input.endpoint,
        method: input.method,
        intervalMinutes: input.intervalMinutes,
        windowStart: windowStart.toISOString(),
      });
    } catch (error) {
      logger.error('aggregation_job_enqueue_failed', {
        jobId,
        workspaceId: input.workspaceId,
        endpoint: input.endpoint,
        error: error instanceof Error ? error.message : 'unknown',
      });

      throw error;
    }
  }

  async close(): Promise<void> {
    await this.queue.close();
    logger.info('aggregation_queue_closed');
  }
}

function buildAggregationJobId(input: ScheduleAggregationInput): string {
  const windowBucket = Math.floor(
    input.windowStart.getTime() / (input.intervalMinutes * 60 * 1_000)
  );

  // BullMQ rejeita ":" em jobId customizado (colide com o formato interno de
  // chaves Redis "bull:<queue>:<jobId>") — usa "_" como separador.
  return `agg_${input.workspaceId}_${input.endpoint}_${input.method}_${input.intervalMinutes}m_${windowBucket}`;
}
