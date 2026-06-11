/**
 * Use case de leitura: lista endpoints/métodos activos num workspace.
 * Alimenta os filtros do dashboard (dropdown de endpoints).
 */

import { logger } from '@infra/frameworks/logging';
import type { MetricsRepository } from '@application/contracts/repositories';
import type {
  ListActiveEndpointsInputDTO,
  ListActiveEndpointsOutputDTO,
  ActiveEndpointDTO,
} from '@application/dto/MetricsQueryDTO';

export class ListActiveEndpointsUseCase {
  constructor(private readonly metricsRepository: MetricsRepository) {}

  async execute(input: ListActiveEndpointsInputDTO): Promise<ListActiveEndpointsOutputDTO> {
    const rows = await this.metricsRepository.getActiveEndpointsForWorkspace(
      input.workspaceId,
      input.minutes
    );

    const endpoints: ActiveEndpointDTO[] = rows.map((row) => ({
      endpoint: row.endpoint,
      method: row.method,
    }));

    logger.info('metrics_list_active_endpoints', {
      workspaceId: input.workspaceId,
      minutes: input.minutes,
      count: endpoints.length,
    });

    return {
      workspaceId: input.workspaceId,
      minutes: input.minutes,
      endpoints,
    };
  }
}
