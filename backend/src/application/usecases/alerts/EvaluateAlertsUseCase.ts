/**
 * Use case para avaliar todas as regras de alertas activas.
 *
 * Fluxo por ciclo (a cada 60s):
 *  1. Carregar todas as regras activas.
 *  2. Pré-carregar snapshots e eventos abertos em batch (2 queries fixas).
 *  3. Para cada regra: decidir trigger / auto-resolve / noop.
 */

import { AlertRule } from '@domain/entities/AlertRule';
import type { AlertRepository } from '@application/contracts/repositories';
import type { EvaluateAlertsOutputDTO } from '@application/dto/AlertsDTO';
import { TriggerAlertUseCase } from '@application/usecases/alerts/TriggerAlertUseCase';
import { logger } from '@infra/frameworks/logging';

export class EvaluateAlertsUseCase {
  constructor(
    private readonly alertRepository: AlertRepository,
    private readonly triggerAlertUseCase: TriggerAlertUseCase
  ) {}

  /**
   * Executa um ciclo de avaliação: carrega regras, pré-carrega métricas e eventos
   * em batch (2 queries fixas independentemente do número de regras), e avalia
   * cada regra para trigger ou auto-resolve.
   */
  async execute(): Promise<EvaluateAlertsOutputDTO> {
    const activeRules = await this.alertRepository.findActiveRules();

    if (activeRules.length === 0) {
      return { evaluatedRules: 0, triggeredCount: 0, resolvedCount: 0 };
    }

    // Pré-carregar snapshots e eventos abertos em batch para evitar N+1.
    // Ambas as queries correm em paralelo — Map<ruleId, valor>.
    const [snapshotMap, openEventMap] = await Promise.all([
      this.alertRepository.findEvaluationSnapshotsBatch(activeRules),
      this.alertRepository.findOpenEventsBatch(activeRules.map((r) => r.id)),
    ]);

    let triggeredCount = 0;
    let resolvedCount = 0;

    for (const ruleDto of activeRules) {
      const snapshot = snapshotMap.get(ruleDto.id);

      // Regra sem métricas na janela — nada a avaliar.
      if (!snapshot) {
        continue;
      }

      // AlertRuleOutputDTO é estruturalmente compatível com ReconstituteAlertRuleInput.
      const rule = AlertRule.reconstitute(ruleDto);

      const observedValue = rule.extractObservedValue(snapshot);
      const openEvent = openEventMap.get(rule.id) ?? null;
      const hasOpenEvent = openEvent !== null;

      if (rule.shouldTrigger(observedValue, snapshot.sampleCount, hasOpenEvent)) {
        const message = rule.buildTriggerMessage(observedValue);
        // Passa knownOpenEvent: null — confirma ao TriggerAlertUseCase que já
        // verificámos (batch) e não há evento aberto, evitando query redundante.
        await this.triggerAlertUseCase.execute({
          rule: ruleDto,
          observedValue,
          message,
          knownOpenEvent: null,
        });
        triggeredCount += 1;
        continue;
      }

      if (rule.shouldAutoResolve(observedValue, hasOpenEvent) && openEvent) {
        await this.alertRepository.resolveEvent(openEvent.id, new Date());
        resolvedCount += 1;

        logger.info('alert_auto_resolved', {
          alertRuleId: rule.id,
          eventId: openEvent.id,
          observedValue,
        });
      }
    }

    logger.info('alerts_evaluation_completed', {
      evaluatedRules: activeRules.length,
      triggeredCount,
      resolvedCount,
    });

    return {
      evaluatedRules: activeRules.length,
      triggeredCount,
      resolvedCount,
    };
  }
}
