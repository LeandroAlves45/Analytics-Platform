/**
 * Use case para listar todas as regras de Alerts
 */

import type { AlertRepository } from '@application/contracts/repositories';
import type { ListAlertRulesInputDTO, ListAlertRulesOutputDTO } from '@application/dto/AlertsDTO';

export class ListAlertRulesUseCase {
  constructor(private readonly alertRepository: AlertRepository) {}

  async execute(input: ListAlertRulesInputDTO): Promise<ListAlertRulesOutputDTO> {
    const rules = await this.alertRepository.findByWorkspace(input.workspaceId);

    return {
      workspaceId: input.workspaceId,
      rules,
    };
  }
}
