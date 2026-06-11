/**
 * Worker BullMQ que consome jobs da queue de agregação de métricas.
 *
 * Arquitectura producer/consumer:
 *   BullMQAggregationQueue (producer) → Redis → AggregationWorker (consumer)
 *
 * Responsabilidades deste worker:
 * 1. Escutar a queue metrics-aggregation no Redis
 * 2. Para cada job, invocar AggregateMetricsUseCase para calcular estatísticas
 * 3. Persistir o resultado via AggregationRepository (contrato da application layer)
 * 4. Em caso de erro, relançar para que o BullMQ aplique o backoff e retry
 */

import { Worker, type Job } from 'bullmq';
import type { Redis } from 'ioredis';
import { logger } from '@infra/frameworks/logging';
import { AGGREGATION_QUEUE_NAME } from './BullMQAggregationQueue';
import type { AggregateMetricsUseCase } from '@application/usecases/aggregation/AggregateMetricsUseCase';
import type { AggregationRepository } from '@application/contracts/repositories';
import type { ScheduleAggregationInput } from '@application/dto/AggregationDTO';

export class AggregationWorker {
  private readonly worker: Worker<ScheduleAggregationInput>;

  constructor(
    private readonly aggregateMetricsUseCase: AggregateMetricsUseCase,
    private readonly aggregationRepository: AggregationRepository,
    redisClient: Redis
  ) {
    // Instancia o Worker BullMQ apontando para a mesma queue do producer.
    // O processor é chamado automaticamente para cada job consumido.
    this.worker = new Worker<ScheduleAggregationInput>(
      AGGREGATION_QUEUE_NAME,
      (job) => this.process(job),
      {
        connection: redisClient,

        // Número de jobs processados em paralelo por esta instância do worker.
        // 1 é o valor seguro para começar — evita race conditions na BD
        // enquanto o volume de dados ainda é baixo. Pode subir para 3-5 quando se justificar.
        concurrency: 1,
      }
    );

    // Registo de eventos de ciclo de vida do worker para observabilidade.
    this.worker.on('completed', (job) => {
      logger.info('aggregation_job_completed', {
        jobId: job.id,
        workspaceId: job.data.workspaceId,
        endpoint: job.data.endpoint,
        method: job.data.method,
        intervalMinutes: job.data.intervalMinutes,
      });
    });

    this.worker.on('failed', (job, error) => {
      logger.error('aggregation_job_failed', {
        jobId: job?.id,
        workspaceId: job?.data.workspaceId,
        endpoint: job?.data.endpoint,
        attemptsMade: job?.attemptsMade,
        error: error.message,
      });
    });

    this.worker.on('error', (error) => {
      // Erros de conexão Redis, o worker tenta reconectar automaticamente.
      logger.error('aggregation_worker_error', { error: error.message });
    });

    logger.info('aggregation_worker_started', {
      queue: AGGREGATION_QUEUE_NAME,
      concurrency: this.worker.concurrency,
    });
  }

  /**
   * Processor invocado pelo BullMQ para cada job consumido da queue.
   *
   * Se este método lançar erro, o BullMQ marca o job como falhado
   * e aplica o backoff exponencial configurado na BullMQAggregationQueue
   * (1s, 2s, 4s) até esgotar as 3 tentativas.
   * Após isso, o job entra no estado 'failed' (dead-letter).
   *
   * @param job - Job BullMQ com os dados de agregação no campo data
   */
  private async process(job: Job<ScheduleAggregationInput>): Promise<void> {
    logger.info('aggregation_job_processing', {
      jobId: job.id,
      workspaceId: job.data.workspaceId,
      endpoint: job.data.endpoint,
      method: job.data.method,
      intervalMinutes: job.data.intervalMinutes,
      windowStart: job.data.windowStart,
      attemptsMade: job.attemptsMade,
    });

    // BullMQ serializa os dados do trabalho como JSON, portanto os campos de data são retornados como ISO strings.
    // Reconstrução do windowStart como uma Date antes de passar para o use case.
    const input = {
      ...job.data,
      windowStart: new Date(job.data.windowStart as unknown as string),
    };

    const result = await this.aggregateMetricsUseCase.execute(input);

    await this.aggregationRepository.save(result);
  }

  /**
   * Fecha o worker de forma controlada.
   *
   * Aguarda que o job em curso termine antes de fechar a conexão Redis.
   * Deve ser chamado no graceful shutdown em main.ts, antes de disconnectRedis().
   */
  async close(): Promise<void> {
    await this.worker.close();
    logger.info('aggregation_worker_closed');
  }
}
