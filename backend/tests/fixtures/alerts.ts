/**
 * Fixtures partilhadas para testes do sistema de alertas.
 *
 * Cada constante representa um cenário canónico reutilizável nos testes
 * unitários e de integração. Alterar aqui afeta todos os testes que as importam
 * — adicionar novos campos à entidade requer atualização correspondente nestas
 * fixtures.
 */

import type { CreateAlertRuleInput } from '@domain/entities/AlertRule';
import type { AlertRuleOutputDTO, AlertEventOutputDTO } from '@application/dto/AlertsDTO';
import { TEST_WORKSPACE_ID } from './metrics';

export const TEST_ALERT_RULE_ID = 'aa0e8400-e29b-41d4-a716-446655440000';
export const TEST_ALERT_EVENT_ID = 'bb0e8400-e29b-41d4-a716-446655440001';
export const TEST_ENDPOINT_ID = 'cc0e8400-e29b-41d4-a716-446655440002';

/**
 * Input mínimo válido para criar uma regra de alerta.
 * Usa apenas Slack como canal (emailAddresses vazio) para manter o fixture
 * focado num único canal e não duplicar a cobertura de validação de email.
 */
export const BASE_ALERT_RULE_INPUT: CreateAlertRuleInput = {
  workspaceId: TEST_WORKSPACE_ID,
  name: 'High p95 latency',
  condition: 'latency_p95',
  threshold: 500,
  windowMinutes: 5,
  slackWebhookUrl: 'https://hooks.slack.com/services/T000/B000/XXXX',
  emailAddresses: [],
  status: 'active',
};

/**
 * Simula uma regra já persistida na BD — contém id e timestamps estáveis.
 * Usado para testar o caminho `reconstitute` sem gerar valores aleatórios.
 */
export const BASE_ALERT_RULE_PERSISTED = {
  ...BASE_ALERT_RULE_INPUT,
  id: TEST_ALERT_RULE_ID,
  createdAt: new Date('2026-06-01T00:00:00.000Z'),
  updatedAt: new Date('2026-06-01T00:00:00.000Z'),
};

/**
 * Shape serializado da resposta HTTP para uma regra de alerta.
 * Inclui campos calculados pelo repositório (endpoint, method) que não existem
 * na entidade de domínio mas são enviados na API.
 */
export const BASE_ALERT_RULE_OUTPUT: AlertRuleOutputDTO = {
  id: TEST_ALERT_RULE_ID,
  workspaceId: TEST_WORKSPACE_ID,
  endpointId: null,
  endpoint: null,
  method: null,
  name: 'High p95 latency',
  description: null,
  condition: 'latency_p95',
  threshold: 500,
  windowMinutes: 5,
  slackWebhookUrl: 'https://hooks.slack.com/services/T000/B000/XXXX',
  emailAddresses: [] as string[],
  status: 'active',
  createdAt: new Date('2026-06-01T00:00:00.000Z'),
  updatedAt: new Date('2026-06-01T00:00:00.000Z'),
};

/**
 * Representa um evento de alerta no estado "disparado" (resolvedAt = null).
 * Usado para testar cenários de cooldown e auto-resolve nos testes de
 * avaliação de alertas.
 */
export const BASE_ALERT_EVENT_OUTPUT: AlertEventOutputDTO = {
  id: TEST_ALERT_EVENT_ID,
  alertRuleId: TEST_ALERT_RULE_ID,
  ruleName: 'High p95 latency',
  workspaceId: TEST_WORKSPACE_ID,
  triggeredAt: new Date('2026-06-01T00:00:00.000Z'),
  resolvedAt: null,
  value: 600,
  message: 'threshold exceeded',
  slackSent: false,
  emailSent: false,
};

export const VALID_CREATE_ALERT_RULE_PAYLOAD = {
  name: 'High p95 latency',
  condition: 'latency_p95',
  threshold: 500,
  windowMinutes: 5,
  endpoint: '/api/users',
  method: 'GET',
  slackWebhookUrl: 'https://hooks.slack.com/services/T000/B000/XXXX',
};
