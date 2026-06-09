/**
 * Scheduler responsável por enfileirar jobs de agregação periodicamente.
 *
 * Responsabilidades deste scheduler:
 * 1. A cada intervalo configurado, consultar quais endpoints tiveram atividade recente
 * 2. Para cada endpoint ativo, enfileirar um job de agregação para cada granularidade
 *    suportada (5min, 1h, 1d)
 * 3. Gerir o ciclo de vida do timer (start/stop) para graceful shutdown
 */

import { logger } from '@infra/frameworks/logging';
import type { MetricsRepository } from '@application/contracts/repositories';
import type { AggregationQueueService } from '@application/contracts/repositories';

// Granularidades suportadas em minutos.
const AGGREGATION_INTERVALS_MINUTES = [5, 60, 1440] as const;

// Intervalo de execução do scheduler em milissegundos.
const SCHEDULER_INTERVAL_MS = 5 * 60 * 1_000; // 5 minutos.

export class AggregationScheduler {
  // Referência ao timer para permitir cancelamento do shutdown.
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly metricsRepository: MetricsRepository,
    private readonly aggregationQueueService: AggregationQueueService
  ) {}

  /**
   * Arranca o scheduler.
   *
   * Executa imediatamente uma vez (para não esperar 5 minutos no arranque)
   * e depois a cada SCHEDULER_INTERVAL_MS.
   */
  start(): void {
    if (this.timer !== null) {
      logger.warn('aggregation_scheduler_already_running');
      return;
    }

    logger.info('aggregation_scheduler_started', {
      intervalMs: SCHEDULER_INTERVAL_MS,
      granularities: AGGREGATION_INTERVALS_MINUTES,
    });

    // Execução imediata no arranque para cobrir a janela entre o último shutdown
    // e este arranque. Sem isto, perdemos até 5 minutos de agregações.
    void this.run();

    this.timer = setInterval(() => {
      void this.run();
    }, SCHEDULER_INTERVAL_MS);

    // unref() garante que o timer não impede o processo de terminar normalmente.
    this.timer.unref();
  }

  /**
   * Para o scheduler e cancela o timer.
   * Deve ser chamado no graceful shutdown em main.ts.
   */
  stop(): void {
    if (this.timer === null) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
    logger.info('aggregation_scheduler_stopped');
  }

  /**
   * Execução de um ciclo do scheduler.
   *
   * Descobre endpoints ativos nos últimos 5 minutos e enfileira
   * um job de agregação por granularidade para cada um.
   *
   * Erros são capturados e logados sem relançar -> um ciclo falhado
   * não deve parar o scheduler. O ciclo seguinte tentará novamente.
   */
  private async run(): Promise<void> {
    logger.info('aggregation_scheduler_run_started');

    try {
      // Usa a janela máxima dos intervalos suportados para descobrir todos os
      // endpoints que precisam de ser agregados em qualquer granularidade.
      // Sem isto, endpoints de baixo tráfego perdem as agregações horárias e diárias
      // quando ficam inativos por mais de 5 minutos entre ciclos do scheduler.
      const lookbackMinutes = Math.max(...AGGREGATION_INTERVALS_MINUTES);
      const activeEndpoints = await this.metricsRepository.getActiveEndpoints(lookbackMinutes);

      if (activeEndpoints.length === 0) {
        logger.info('aggregation_scheduler_no_active_endpoints_found');
        return;
      }

      logger.info('aggregation_scheduler_enqueuing_jobs', {
        endpointsCount: activeEndpoints.length,
        jobCount: activeEndpoints.length * AGGREGATION_INTERVALS_MINUTES.length,
      });

      // Para cada endpoint ativo, enfileira um job por granularidade.
      // Promise.allSettled() garante que um endpoint falhado não bloqueia o ciclo seguinte.
      const results = await Promise.allSettled(
        activeEndpoints.flatMap((endpoint) =>
          AGGREGATION_INTERVALS_MINUTES.map((intervalMinutes) =>
            this.aggregationQueueService.scheduleAggregation({
              workspaceId: endpoint.workspaceId,
              endpoint: endpoint.endpoint,
              method: endpoint.method,
              intervalMinutes,
            })
          )
        )
      );
      // Conta sucesso e falhas para observabilidade.
      const failed = results.filter((result) => result.status === 'rejected');

      if (failed.length > 0) {
        logger.warn('aggregation_scheduler_partial_failure', {
          total: results.length,
          failed: failed.length,
          errors: failed.map((result) => (result as PromiseRejectedResult).reason?.message),
        });
      }

      logger.info('aggregation_scheduler_run_completed', {
        total: results.length,
        succeeded: results.length - failed.length,
        failed: failed.length,
      });
    } catch (error) {
      // Erro inesperado -> log e continua para o próximo ciclo.
      logger.error('aggregation_scheduler_run_failed', {
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
  }
}
