/**
 * Use case para listar todos os eventos de Alerts
 */

import type { AlertRepository } from '@application/contracts/repositories';
import type { ListAlertEventsInputDTO, ListAlertEventsOutputDTO } from '@application/dto/AlertsDTO';

export class ListAlertEventsUseCase {
  constructor(private readonly alertRepository: AlertRepository) {}

  async execute(input: ListAlertEventsInputDTO): Promise<ListAlertEventsOutputDTO> {
    const events = await this.alertRepository.listEvents(input);

    return {
      workspaceId: input.workspaceId,
      events,
    };
  }
}
