/**
 * Testes unitários dos use cases do sistema de alertas.
 *
 * Todos os repositórios e gateways são mockados — sem I/O real.
 * Mock padrão de findOpenEventsBatch devolve Map vazio (sem evento aberto),
 * permitindo que os testes de trigger avancem sem override.
 * Os testes de cooldown e auto-resolve fazem override explícito dos maps batch.
 */

import { CreateAlertRuleUseCase } from '@application/usecases/alerts/CreateAlertRuleUseCase';
import { UpdateAlertRuleUseCase } from '@application/usecases/alerts/UpdateAlertRuleUseCase';
import { DeleteAlertRuleUseCase } from '@application/usecases/alerts/DeleteAlertRuleUseCase';
import { ListAlertRulesUseCase } from '@application/usecases/alerts/ListAlertRulesUseCase';
import { GetAlertRuleUseCase } from '@application/usecases/alerts/GetAlertRuleUseCase';
import { ListAlertEventsUseCase } from '@application/usecases/alerts/ListAlertEventsUseCase';
import { TriggerAlertUseCase } from '@application/usecases/alerts/TriggerAlertUseCase';
import { EvaluateAlertsUseCase } from '@application/usecases/alerts/EvaluateAlertsUseCase';
import type { AlertRepository, EndpointRepository } from '@application/contracts/repositories';
import type { NotificationGateway } from '@application/contracts/gateways';
import { NotFoundError, ValidationError } from '@shared/errors';
import {
  BASE_ALERT_RULE_OUTPUT,
  BASE_ALERT_EVENT_OUTPUT,
  TEST_ALERT_RULE_ID,
  TEST_ENDPOINT_ID,
} from '../../../fixtures/alerts';
import { TEST_WORKSPACE_ID } from '../../../fixtures/metrics';

/** Snapshot padrão que excede o threshold (latencyP95 > 500). */
const DEFAULT_SNAPSHOT = {
  latencyP95: 600,
  errorRate: 0.02,
  status5xxCount: 1,
  sampleCount: 10,
};

function makeAlertRepository(
  overrides: Partial<jest.Mocked<AlertRepository>> = {}
): jest.Mocked<AlertRepository> {
  return {
    save: jest.fn().mockResolvedValue(BASE_ALERT_RULE_OUTPUT),
    update: jest.fn().mockResolvedValue(BASE_ALERT_RULE_OUTPUT),
    delete: jest.fn().mockResolvedValue(undefined),
    findById: jest.fn().mockResolvedValue(BASE_ALERT_RULE_OUTPUT),
    findByWorkspace: jest.fn().mockResolvedValue([BASE_ALERT_RULE_OUTPUT]),
    findActiveRules: jest.fn().mockResolvedValue([BASE_ALERT_RULE_OUTPUT]),
    // null = sem evento aberto — usado por TriggerAlertUseCase quando knownOpenEvent é undefined.
    findOpenEvent: jest.fn().mockResolvedValue(null),
    createEvent: jest.fn().mockResolvedValue(BASE_ALERT_EVENT_OUTPUT),
    resolveEvent: jest.fn().mockResolvedValue(undefined),
    listEvents: jest.fn().mockResolvedValue([BASE_ALERT_EVENT_OUTPUT]),
    // Single-rule snapshot mantido para compatibilidade com testes que o usem directamente.
    findEvaluationSnapshot: jest.fn().mockResolvedValue(DEFAULT_SNAPSHOT),
    // Batch: devolve snapshot que excede o threshold por omissão.
    findEvaluationSnapshotsBatch: jest
      .fn()
      .mockResolvedValue(new Map([[TEST_ALERT_RULE_ID, DEFAULT_SNAPSHOT]])),
    // Batch: sem eventos abertos por omissão — permite trigger sem override.
    findOpenEventsBatch: jest.fn().mockResolvedValue(new Map()),
    updateNotificationStatus: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeEndpointRepository(): jest.Mocked<EndpointRepository> {
  return {
    upsert: jest.fn().mockResolvedValue({
      id: TEST_ENDPOINT_ID,
      workspaceId: TEST_WORKSPACE_ID,
      endpoint: '/api/users',
      method: 'GET',
    }),
    findByWorkspaceEndpointMethod: jest.fn(),
  };
}

function makeNotificationGateway(): jest.Mocked<NotificationGateway> {
  return {
    sendAlert: jest.fn().mockResolvedValue({ slackSent: true, emailSent: false }),
  };
}

describe('CreateAlertRuleUseCase', () => {
  it('should create a rule and upsert endpoint when endpoint and method are provided', async () => {
    const alertRepository = makeAlertRepository();
    const endpointRepository = makeEndpointRepository();
    const useCase = new CreateAlertRuleUseCase(alertRepository, endpointRepository);

    await useCase.execute({
      workspaceId: TEST_WORKSPACE_ID,
      name: 'High p95 latency',
      condition: 'latency_p95',
      threshold: 500,
      endpoint: '/api/users',
      method: 'GET',
      slackWebhookUrl: 'https://hooks.slack.com/services/test',
    });

    expect(endpointRepository.upsert).toHaveBeenCalledWith(TEST_WORKSPACE_ID, '/api/users', 'GET');
    expect(alertRepository.save).toHaveBeenCalled();
  });

  it('should throw when endpoint is provided without method', async () => {
    const useCase = new CreateAlertRuleUseCase(makeAlertRepository(), makeEndpointRepository());

    await expect(
      useCase.execute({
        workspaceId: TEST_WORKSPACE_ID,
        name: 'Invalid',
        condition: 'latency_p95',
        threshold: 500,
        endpoint: '/api/users',
        slackWebhookUrl: 'https://hooks.slack.com/services/test',
      })
    ).rejects.toThrow(ValidationError);
  });

  it('should throw when endpoint does not start with slash', async () => {
    const useCase = new CreateAlertRuleUseCase(makeAlertRepository(), makeEndpointRepository());

    await expect(
      useCase.execute({
        workspaceId: TEST_WORKSPACE_ID,
        name: 'Invalid endpoint',
        condition: 'latency_p95',
        threshold: 500,
        endpoint: 'api/users',
        method: 'GET',
        slackWebhookUrl: 'https://hooks.slack.com/services/test',
      })
    ).rejects.toThrow(ValidationError);
  });

  it('should throw when method is invalid', async () => {
    const useCase = new CreateAlertRuleUseCase(makeAlertRepository(), makeEndpointRepository());

    await expect(
      useCase.execute({
        workspaceId: TEST_WORKSPACE_ID,
        name: 'Invalid method',
        condition: 'latency_p95',
        threshold: 500,
        endpoint: '/api/users',
        method: 'INVALID',
        slackWebhookUrl: 'https://hooks.slack.com/services/test',
      })
    ).rejects.toThrow(ValidationError);
  });

  it('should create a rule without endpoint when endpoint and method are omitted', async () => {
    const alertRepository = makeAlertRepository();
    const endpointRepository = makeEndpointRepository();
    const useCase = new CreateAlertRuleUseCase(alertRepository, endpointRepository);

    await useCase.execute({
      workspaceId: TEST_WORKSPACE_ID,
      name: 'Workspace-wide rule',
      condition: 'latency_p95',
      threshold: 500,
      slackWebhookUrl: 'https://hooks.slack.com/services/test',
    });

    expect(endpointRepository.upsert).not.toHaveBeenCalled();
    expect(alertRepository.save).toHaveBeenCalled();
  });
});

describe('UpdateAlertRuleUseCase', () => {
  it('should throw NotFoundError when rule does not exist', async () => {
    const alertRepository = makeAlertRepository({
      findById: jest.fn().mockResolvedValue(null),
    });
    const useCase = new UpdateAlertRuleUseCase(alertRepository, makeEndpointRepository());

    await expect(
      useCase.execute({
        workspaceId: TEST_WORKSPACE_ID,
        alertRuleId: '00000000-0000-4000-8000-000000000099',
        name: 'Updated',
      })
    ).rejects.toThrow(NotFoundError);
  });

  it('should throw when endpoint is null but method is non-null', async () => {
    const useCase = new UpdateAlertRuleUseCase(makeAlertRepository(), makeEndpointRepository());

    await expect(
      useCase.execute({
        workspaceId: TEST_WORKSPACE_ID,
        alertRuleId: BASE_ALERT_RULE_OUTPUT.id,
        endpoint: null,
        method: 'GET',
      })
    ).rejects.toThrow(ValidationError);
  });

  it('should throw when method is provided without endpoint', async () => {
    const useCase = new UpdateAlertRuleUseCase(makeAlertRepository(), makeEndpointRepository());

    await expect(
      useCase.execute({
        workspaceId: TEST_WORKSPACE_ID,
        alertRuleId: BASE_ALERT_RULE_OUTPUT.id,
        method: 'GET',
      })
    ).rejects.toThrow(ValidationError);
  });

  it('should throw when updated endpoint does not start with slash', async () => {
    const useCase = new UpdateAlertRuleUseCase(makeAlertRepository(), makeEndpointRepository());

    await expect(
      useCase.execute({
        workspaceId: TEST_WORKSPACE_ID,
        alertRuleId: BASE_ALERT_RULE_OUTPUT.id,
        endpoint: 'api/orders',
        method: 'POST',
      })
    ).rejects.toThrow(ValidationError);
  });

  it('should throw when updated method is invalid', async () => {
    const useCase = new UpdateAlertRuleUseCase(makeAlertRepository(), makeEndpointRepository());

    await expect(
      useCase.execute({
        workspaceId: TEST_WORKSPACE_ID,
        alertRuleId: BASE_ALERT_RULE_OUTPUT.id,
        endpoint: '/api/orders',
        method: 'INVALID',
      })
    ).rejects.toThrow(ValidationError);
  });

  it('should upsert endpoint when updating endpoint and method', async () => {
    const alertRepository = makeAlertRepository();
    const endpointRepository = makeEndpointRepository();
    const useCase = new UpdateAlertRuleUseCase(alertRepository, endpointRepository);

    await useCase.execute({
      workspaceId: TEST_WORKSPACE_ID,
      alertRuleId: BASE_ALERT_RULE_OUTPUT.id,
      endpoint: '/api/orders',
      method: 'POST',
    });

    expect(endpointRepository.upsert).toHaveBeenCalledWith(
      TEST_WORKSPACE_ID,
      '/api/orders',
      'POST'
    );
    expect(alertRepository.update).toHaveBeenCalled();
  });

  it('should throw when endpoint and method are inconsistently null', async () => {
    const useCase = new UpdateAlertRuleUseCase(makeAlertRepository(), makeEndpointRepository());

    await expect(
      useCase.execute({
        workspaceId: TEST_WORKSPACE_ID,
        alertRuleId: BASE_ALERT_RULE_OUTPUT.id,
        endpoint: '/api/users',
        method: null,
      })
    ).rejects.toThrow(ValidationError);
  });

  it('should clear endpoint when both endpoint and method are null', async () => {
    const alertRepository = makeAlertRepository();
    const useCase = new UpdateAlertRuleUseCase(alertRepository, makeEndpointRepository());

    await useCase.execute({
      workspaceId: TEST_WORKSPACE_ID,
      alertRuleId: BASE_ALERT_RULE_OUTPUT.id,
      endpoint: null,
      method: null,
    });

    expect(alertRepository.update).toHaveBeenCalled();
  });

  it('should apply optional field overrides when updating', async () => {
    const alertRepository = makeAlertRepository();
    const useCase = new UpdateAlertRuleUseCase(alertRepository, makeEndpointRepository());

    await useCase.execute({
      workspaceId: TEST_WORKSPACE_ID,
      alertRuleId: BASE_ALERT_RULE_OUTPUT.id,
      name: 'Renamed rule',
      description: 'Updated description',
      slackWebhookUrl: 'https://hooks.slack.com/updated',
      emailAddresses: ['alerts@example.com'],
    });

    expect(alertRepository.update).toHaveBeenCalled();
  });
});

describe('DeleteAlertRuleUseCase', () => {
  it('should delete an existing rule', async () => {
    const alertRepository = makeAlertRepository();
    const useCase = new DeleteAlertRuleUseCase(alertRepository);

    await useCase.execute({
      workspaceId: TEST_WORKSPACE_ID,
      alertRuleId: BASE_ALERT_RULE_OUTPUT.id,
    });

    expect(alertRepository.delete).toHaveBeenCalledWith(
      BASE_ALERT_RULE_OUTPUT.id,
      TEST_WORKSPACE_ID
    );
  });

  it('should throw NotFoundError when rule does not exist', async () => {
    const alertRepository = makeAlertRepository({
      findById: jest.fn().mockResolvedValue(null),
    });
    const useCase = new DeleteAlertRuleUseCase(alertRepository);

    await expect(
      useCase.execute({
        workspaceId: TEST_WORKSPACE_ID,
        alertRuleId: '00000000-0000-4000-8000-000000000099',
      })
    ).rejects.toThrow(NotFoundError);
  });
});

describe('ListAlertRulesUseCase', () => {
  it('should return rules for workspace', async () => {
    const alertRepository = makeAlertRepository();
    const useCase = new ListAlertRulesUseCase(alertRepository);

    const result = await useCase.execute({ workspaceId: TEST_WORKSPACE_ID });

    expect(result.rules).toHaveLength(1);
  });
});

describe('GetAlertRuleUseCase', () => {
  it('should return rule when found', async () => {
    const useCase = new GetAlertRuleUseCase(makeAlertRepository());

    const result = await useCase.execute({
      workspaceId: TEST_WORKSPACE_ID,
      alertRuleId: BASE_ALERT_RULE_OUTPUT.id,
    });

    expect(result.id).toBe(BASE_ALERT_RULE_OUTPUT.id);
  });

  it('should throw NotFoundError when rule does not exist', async () => {
    const alertRepository = makeAlertRepository({
      findById: jest.fn().mockResolvedValue(null),
    });
    const useCase = new GetAlertRuleUseCase(alertRepository);

    await expect(
      useCase.execute({
        workspaceId: TEST_WORKSPACE_ID,
        alertRuleId: '00000000-0000-4000-8000-000000000099',
      })
    ).rejects.toThrow(NotFoundError);
  });
});

describe('ListAlertEventsUseCase', () => {
  it('should return events for workspace', async () => {
    const useCase = new ListAlertEventsUseCase(makeAlertRepository());

    const result = await useCase.execute({ workspaceId: TEST_WORKSPACE_ID });

    expect(result.events).toHaveLength(1);
  });
});

describe('TriggerAlertUseCase', () => {
  it('should create event before sending notification', async () => {
    const alertRepository = makeAlertRepository();
    const notificationGateway = makeNotificationGateway();
    const useCase = new TriggerAlertUseCase(alertRepository, notificationGateway);

    const result = await useCase.execute({
      rule: BASE_ALERT_RULE_OUTPUT,
      observedValue: 600,
      message: 'threshold exceeded',
    });

    expect(alertRepository.createEvent).toHaveBeenCalled();
    expect(notificationGateway.sendAlert).toHaveBeenCalled();
    expect(alertRepository.updateNotificationStatus).toHaveBeenCalledWith(
      BASE_ALERT_EVENT_OUTPUT.id,
      true,
      false
    );
    expect(result.eventId).toBe(BASE_ALERT_EVENT_OUTPUT.id);
    expect(result.slackSent).toBe(true);
  });

  it('should still create event when notification fails', async () => {
    // Garante que o cooldown ativa mesmo com falha de rede na notificação.
    const alertRepository = makeAlertRepository();
    const notificationGateway = makeNotificationGateway();
    notificationGateway.sendAlert.mockRejectedValue(new Error('network error'));
    const useCase = new TriggerAlertUseCase(alertRepository, notificationGateway);

    const result = await useCase.execute({
      rule: BASE_ALERT_RULE_OUTPUT,
      observedValue: 600,
      message: 'threshold exceeded',
    });

    expect(alertRepository.createEvent).toHaveBeenCalled();
    // updateNotificationStatus não é chamado quando sendAlert falha.
    expect(alertRepository.updateNotificationStatus).not.toHaveBeenCalled();
    expect(result.eventId).toBe(BASE_ALERT_EVENT_OUTPUT.id);
    expect(result.slackSent).toBe(false);
    expect(result.emailSent).toBe(false);
  });

  it('should skip when open event already exists via findOpenEvent', async () => {
    const alertRepository = makeAlertRepository({
      findOpenEvent: jest.fn().mockResolvedValue(BASE_ALERT_EVENT_OUTPUT),
    });
    const notificationGateway = makeNotificationGateway();
    const useCase = new TriggerAlertUseCase(alertRepository, notificationGateway);

    const result = await useCase.execute({
      rule: BASE_ALERT_RULE_OUTPUT,
      observedValue: 600,
      message: 'threshold exceeded',
    });

    expect(result.eventId).toBe(BASE_ALERT_EVENT_OUTPUT.id);
    expect(alertRepository.createEvent).not.toHaveBeenCalled();
    expect(notificationGateway.sendAlert).not.toHaveBeenCalled();
  });

  it('should skip findOpenEvent when knownOpenEvent null is provided', async () => {
    // EvaluateAlertsUseCase passa knownOpenEvent: null após confirmar via batch
    // que não há evento aberto — evita query redundante.
    const alertRepository = makeAlertRepository();
    const notificationGateway = makeNotificationGateway();
    const useCase = new TriggerAlertUseCase(alertRepository, notificationGateway);

    await useCase.execute({
      rule: BASE_ALERT_RULE_OUTPUT,
      observedValue: 600,
      message: 'threshold exceeded',
      knownOpenEvent: null,
    });

    expect(alertRepository.findOpenEvent).not.toHaveBeenCalled();
    expect(alertRepository.createEvent).toHaveBeenCalled();
  });

  it('should skip trigger when knownOpenEvent DTO is provided', async () => {
    // Atalho de cooldown: chamador passou o evento aberto directamente.
    const alertRepository = makeAlertRepository();
    const notificationGateway = makeNotificationGateway();
    const useCase = new TriggerAlertUseCase(alertRepository, notificationGateway);

    const result = await useCase.execute({
      rule: BASE_ALERT_RULE_OUTPUT,
      observedValue: 600,
      message: 'threshold exceeded',
      knownOpenEvent: BASE_ALERT_EVENT_OUTPUT,
    });

    expect(alertRepository.findOpenEvent).not.toHaveBeenCalled();
    expect(alertRepository.createEvent).not.toHaveBeenCalled();
    expect(notificationGateway.sendAlert).not.toHaveBeenCalled();
    expect(result.eventId).toBe(BASE_ALERT_EVENT_OUTPUT.id);
  });
});

describe('EvaluateAlertsUseCase', () => {
  it('should trigger alert when threshold is exceeded', async () => {
    const alertRepository = makeAlertRepository();
    const triggerAlertUseCase = new TriggerAlertUseCase(alertRepository, makeNotificationGateway());
    const useCase = new EvaluateAlertsUseCase(alertRepository, triggerAlertUseCase);

    const result = await useCase.execute();

    expect(result.triggeredCount).toBe(1);
    expect(alertRepository.createEvent).toHaveBeenCalled();
    // Verifica que o batch foi usado (2 queries) em vez de N queries individuais.
    expect(alertRepository.findEvaluationSnapshotsBatch).toHaveBeenCalled();
    expect(alertRepository.findOpenEventsBatch).toHaveBeenCalled();
    expect(alertRepository.findEvaluationSnapshot).not.toHaveBeenCalled();
    expect(alertRepository.findOpenEvent).not.toHaveBeenCalled();
  });

  it('should auto-resolve when metric normalizes', async () => {
    const LOW_SNAPSHOT = {
      latencyP95: 100,
      errorRate: 0.01,
      status5xxCount: 0,
      sampleCount: 50,
    };
    const alertRepository = makeAlertRepository({
      findEvaluationSnapshotsBatch: jest
        .fn()
        .mockResolvedValue(new Map([[TEST_ALERT_RULE_ID, LOW_SNAPSHOT]])),
      findOpenEventsBatch: jest
        .fn()
        .mockResolvedValue(new Map([[TEST_ALERT_RULE_ID, BASE_ALERT_EVENT_OUTPUT]])),
    });
    const useCase = new EvaluateAlertsUseCase(
      alertRepository,
      new TriggerAlertUseCase(alertRepository, makeNotificationGateway())
    );

    const result = await useCase.execute();

    expect(result.resolvedCount).toBe(1);
    expect(alertRepository.resolveEvent).toHaveBeenCalled();
  });

  it('should not trigger when sample count is below minimum', async () => {
    const LOW_SAMPLES_SNAPSHOT = {
      latencyP95: 600,
      errorRate: 0.5,
      status5xxCount: 10,
      sampleCount: 5,
    };
    const alertRepository = makeAlertRepository({
      findEvaluationSnapshotsBatch: jest
        .fn()
        .mockResolvedValue(new Map([[TEST_ALERT_RULE_ID, LOW_SAMPLES_SNAPSHOT]])),
    });
    const useCase = new EvaluateAlertsUseCase(
      alertRepository,
      new TriggerAlertUseCase(alertRepository, makeNotificationGateway())
    );

    const result = await useCase.execute();

    expect(result.triggeredCount).toBe(0);
    expect(alertRepository.createEvent).not.toHaveBeenCalled();
  });

  it('should return zero counts when there are no active rules', async () => {
    const alertRepository = makeAlertRepository({
      findActiveRules: jest.fn().mockResolvedValue([]),
    });
    const useCase = new EvaluateAlertsUseCase(
      alertRepository,
      new TriggerAlertUseCase(alertRepository, makeNotificationGateway())
    );

    const result = await useCase.execute();

    expect(result.evaluatedRules).toBe(0);
    expect(result.triggeredCount).toBe(0);
    expect(result.resolvedCount).toBe(0);
    // Batch queries não devem ser chamadas com lista vazia.
    expect(alertRepository.findEvaluationSnapshotsBatch).not.toHaveBeenCalled();
  });

  it('should skip rule when snapshot is missing from batch', async () => {
    const alertRepository = makeAlertRepository({
      findEvaluationSnapshotsBatch: jest.fn().mockResolvedValue(new Map()),
    });
    const useCase = new EvaluateAlertsUseCase(
      alertRepository,
      new TriggerAlertUseCase(alertRepository, makeNotificationGateway())
    );

    const result = await useCase.execute();

    expect(result.evaluatedRules).toBe(1);
    expect(result.triggeredCount).toBe(0);
    expect(alertRepository.createEvent).not.toHaveBeenCalled();
  });
});
