/**
 * Use case para criar uma nova regra de Alerts
 */

import { AlertRule } from '@domain/entities/AlertRule';
import type { AlertRepository, EndpointRepository } from '@application/contracts/repositories';
import type { CreateAlertRuleInputDTO, AlertRuleOutputDTO } from '@application/dto/AlertsDTO';
import { VALID_HTTP_METHODS } from '@application/dto/AlertsDTO';
import { ValidationError } from '@shared/errors';
import { logger } from '@infra/frameworks/logging';

export class CreateAlertRuleUseCase {
  constructor(
    private readonly alertRepository: AlertRepository,
    private readonly endpointRepository: EndpointRepository
  ) {}

  async execute(input: CreateAlertRuleInputDTO): Promise<AlertRuleOutputDTO> {
    const hasEndpoint = input.endpoint !== undefined && input.endpoint !== null;
    const hasMethod = input.method !== undefined && input.method !== null;

    if (hasEndpoint !== hasMethod) {
      throw new ValidationError('Invalid alert rule data', [
        { field: 'endpoint', message: 'Endpoint and method must be provided together' },
      ]);
    }

    if (hasEndpoint && hasMethod) {
      if (!input.endpoint!.startsWith('/')) {
        throw new ValidationError('Invalid alert rule data', [
          { field: 'endpoint', value: input.endpoint, message: 'Endpoint must start with /' },
        ]);
      }

      if (!VALID_HTTP_METHODS.includes(input.method! as (typeof VALID_HTTP_METHODS)[number])) {
        throw new ValidationError('Invalid alert rule data', [
          { field: 'method', value: input.method, message: 'Invalid HTTP method' },
        ]);
      }
    }

    let endpointId: string | null = null;

    if (hasEndpoint && hasMethod) {
      const endpointRecord = await this.endpointRepository.upsert(
        input.workspaceId,
        input.endpoint!,
        input.method!
      );
      endpointId = endpointRecord.id;
    }

    const rule = new AlertRule({
      workspaceId: input.workspaceId,
      endpointId,
      name: input.name,
      description: input.description,
      condition: input.condition,
      threshold: input.threshold,
      windowMinutes: input.windowMinutes,
      slackWebhookUrl: input.slackWebhookUrl,
      emailAddresses: input.emailAddresses,
      status: input.status,
    });

    const saved = await this.alertRepository.save(rule);

    logger.info('alert_rule_created', {
      workspaceId: input.workspaceId,
      alertRuleId: saved.id,
      condition: saved.condition,
    });

    return saved;
  }
}
