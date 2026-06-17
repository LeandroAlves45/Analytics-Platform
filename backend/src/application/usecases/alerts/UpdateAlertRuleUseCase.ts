/**
 * Use case para atualizar uma regra de Alerts
 */

import { AlertRule } from '@domain/entities/AlertRule';
import type { AlertRepository, EndpointRepository } from '@application/contracts/repositories';
import type { UpdateAlertRuleInputDTO, AlertRuleOutputDTO } from '@application/dto/AlertsDTO';
import { VALID_HTTP_METHODS } from '@application/dto/AlertsDTO';
import { NotFoundError, ValidationError } from '@shared/errors';
import { logger } from '@infra/frameworks/logging';

export class UpdateAlertRuleUseCase {
  constructor(
    private readonly alertRepository: AlertRepository,
    private readonly endpointRepository: EndpointRepository
  ) {}

  async execute(input: UpdateAlertRuleInputDTO): Promise<AlertRuleOutputDTO> {
    const existing = await this.alertRepository.findById(input.alertRuleId, input.workspaceId);

    if (!existing) {
      throw new NotFoundError('AlertRule', input.alertRuleId);
    }

    const endpointProvided = input.endpoint !== undefined;
    const methodProvided = input.method !== undefined;

    if (endpointProvided !== methodProvided) {
      throw new ValidationError('Invalid alert rule data', [
        { field: 'endpoint', message: 'Endpoint and method must be provided together' },
      ]);
    }

    let endpointId = existing.endpointId;

    if (endpointProvided && methodProvided) {
      const bothNull = input.endpoint === null && input.method === null;

      if (bothNull) {
        // Limpar associação de endpoint explicitamente
        endpointId = null;
      } else if (
        input.endpoint !== null &&
        input.endpoint !== undefined &&
        input.method !== null &&
        input.method !== undefined
      ) {
        // Atualizar endpoint — ambos são strings
        if (!input.endpoint.startsWith('/')) {
          throw new ValidationError('Invalid alert rule data', [
            { field: 'endpoint', value: input.endpoint, message: 'Endpoint must start with /' },
          ]);
        }

        if (!VALID_HTTP_METHODS.includes(input.method as (typeof VALID_HTTP_METHODS)[number])) {
          throw new ValidationError('Invalid alert rule data', [
            { field: 'method', value: input.method, message: 'Invalid HTTP method' },
          ]);
        }

        const endpointRecord = await this.endpointRepository.upsert(
          input.workspaceId,
          input.endpoint,
          input.method
        );
        endpointId = endpointRecord.id;
      } else {
        // Um é null e o outro não — input inconsistente que passaria o XOR acima
        // mas chegaria aqui com valores contraditórios
        throw new ValidationError('Invalid alert rule data', [
          {
            field: 'endpoint',
            message:
              'Endpoint and method must both be null (to clear) or both be non-null strings (to update)',
          },
        ]);
      }
    }

    const rule = AlertRule.reconstitute({
      id: existing.id,
      workspaceId: existing.workspaceId,
      endpointId,
      name: input.name ?? existing.name,
      description: input.description !== undefined ? input.description : existing.description,
      condition: input.condition ?? existing.condition,
      threshold: input.threshold ?? existing.threshold,
      windowMinutes: input.windowMinutes ?? existing.windowMinutes,
      slackWebhookUrl:
        input.slackWebhookUrl !== undefined ? input.slackWebhookUrl : existing.slackWebhookUrl,
      emailAddresses:
        input.emailAddresses !== undefined ? input.emailAddresses : existing.emailAddresses,
      status: input.status ?? existing.status,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    });

    const updated = await this.alertRepository.update(rule);

    logger.info('alert_rule_updated', {
      workspaceId: input.workspaceId,
      alertRuleId: updated.id,
    });

    return updated;
  }
}
