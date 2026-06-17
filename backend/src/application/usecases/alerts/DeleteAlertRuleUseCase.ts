/**
 * Use case para deletar uma regra de Alerts
 */

import type { AlertRepository } from '@application/contracts/repositories';
import type { DeleteAlertRuleInputDTO } from '@application/dto/AlertsDTO';
import { NotFoundError } from '@shared/errors';
import { logger } from '@infra/frameworks/logging';

export class DeleteAlertRuleUseCase {
  constructor(private readonly alertRepository: AlertRepository) {}

  async execute(input: DeleteAlertRuleInputDTO): Promise<void> {
    const existing = await this.alertRepository.findById(input.alertRuleId, input.workspaceId);

    if (!existing) {
      throw new NotFoundError('AlertRule', input.alertRuleId);
    }

    await this.alertRepository.delete(input.alertRuleId, input.workspaceId);

    logger.info('alert_rule_deleted', {
      workspaceId: input.workspaceId,
      alertRuleId: input.alertRuleId,
    });
  }
}
