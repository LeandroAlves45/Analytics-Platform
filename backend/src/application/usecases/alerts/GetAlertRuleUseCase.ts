/**
 * Use case para obter uma regra de Alerts
 */

import type { AlertRepository } from '@application/contracts/repositories';
import type { GetAlertRuleInputDTO, AlertRuleOutputDTO } from '@application/dto/AlertsDTO';
import { NotFoundError } from '@shared/errors';

export class GetAlertRuleUseCase {
  constructor(private readonly alertRepository: AlertRepository) {}

  async execute(input: GetAlertRuleInputDTO): Promise<AlertRuleOutputDTO> {
    const rule = await this.alertRepository.findById(input.alertRuleId, input.workspaceId);

    if (!rule) {
      throw new NotFoundError('AlertRule', input.alertRuleId);
    }

    return rule;
  }
}
