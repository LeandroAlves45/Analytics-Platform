/**
 * Scheduler de avaliação de alertas — executa a cada 60 segundos.
 *
 * Diferente do AggregationScheduler (5 min + BullMQ), este ciclo é curto
 * porque apenas lê agregações existentes e compara com thresholds.
 */

import { logger } from '@infra/frameworks/logging';
import { EvaluateAlertsUseCase } from '@application/usecases/alerts/EvaluateAlertsUseCase';

const SCHEDULER_INTERVAL_MS = 60 * 1_000;

export class AlertEvaluationScheduler {
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly evaluateAlertsUseCase: EvaluateAlertsUseCase) {}

  /** Arranca o scheduler: dispara imediatamente e repete a cada 60 segundos. Idempotente — chamadas repetidas são ignoradas. */
  start(): void {
    if (this.timer !== null) {
      logger.warn('alert_evaluation_scheduler_already_running');
      return;
    }

    logger.info('alert_evaluation_scheduler_started', {
      intervalMs: SCHEDULER_INTERVAL_MS,
    });

    void this.run();

    this.timer = setInterval(() => {
      void this.run();
    }, SCHEDULER_INTERVAL_MS);

    this.timer.unref();
  }

  /** Para o scheduler e cancela o intervalo pendente. Idempotente — não lança erro se já estiver parado. */
  stop(): void {
    if (this.timer === null) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;

    logger.info('alert_evaluation_scheduler_stopped');
  }

  private async run(): Promise<void> {
    logger.info('alert_evaluation_scheduler_run_started');

    try {
      const result = await this.evaluateAlertsUseCase.execute();

      logger.info('alert_evaluation_scheduler_run_completed', result);
    } catch (error) {
      logger.error('alert_evaluation_scheduler_run_failed', {
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
  }
}
