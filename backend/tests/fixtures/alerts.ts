/**
 * Fixtures centralizadas de teste para alertas.
 */

import type { CreateAlertRuleInput } from '@domain/entities/AlertRule';
import { TEST_WORKSPACE_ID } from './metrics';

export const TEST_ALERT_RULE_ID = 'aa0e8400-e29b-41d4-a716-446655440000';

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

export const BASE_ALERT_RULE_PERSISTED = {
  ...BASE_ALERT_RULE_INPUT,
  id: TEST_ALERT_RULE_ID,
  createdAt: new Date('2026-06-01T00:00:00.000Z'),
  updatedAt: new Date('2026-06-01T00:00:00.000Z'),
};

export const TEST_ALERT_EVENT_ID = 'bb0e8400-e29b-41d4-a716-446655440000';
export const TEST_ENDPOINT_ID = 'cc0e8400-e29b-41d4-a716-446655440002';

export const BASE_ALERT_RULE_OUTPUT = {
  id: TEST_ALERT_RULE_ID,
  workspaceId: TEST_WORKSPACE_ID,
  endpointId: null,
  endpoint: null,
  method: null,
  name: 'High p95 latency',
  description: null,
  condition: 'latency_p95' as const,
  threshold: 500,
  windowMinutes: 5,
  slackWebhookUrl: 'https://hooks.slack.com/services/T000/B000/XXXX',
  emailAddresses: [] as string[],
  status: 'active' as const,
  createdAt: new Date('2026-06-01T00:00:00.000Z'),
  updatedAt: new Date('2026-06-01T00:00:00.000Z'),
};

export const BASE_ALERT_EVENT_OUTPUT = {
  id: TEST_ALERT_EVENT_ID,
  alertRuleId: TEST_ALERT_RULE_ID,
  workspaceId: TEST_WORKSPACE_ID,
  triggeredAt: new Date('2026-06-01T00:00:00.000Z'),
  resolvedAt: null,
  value: 600,
  message: 'threshold exceeded',
  slackSent: false,
  emailSent: false,
};
