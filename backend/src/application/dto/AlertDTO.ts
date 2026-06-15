/**
 * DTOs tipados para CRUD e avaliação de alertas
 */

import type { AlertCondition, AlertRuleStatus } from '@domain/entities/AlertRule';

export interface CreateAlertRuleInputDTO {
  workspaceId: string;
  name: string;
  description?: string | null;
  condition: AlertCondition;
  threshold: number;
  windowMinutes?: number;
  endpoint?: string;
  method?: string;
  slackWebhookUrl?: string | null;
  emailAddresses?: string[] | null;
  status?: AlertRuleStatus;
}

export interface UpdateAlertRuleInputDTO {
  workspaceId: string;
  alertRuleId: string;
  name?: string;
  description?: string | null;
  condition?: AlertCondition;
  threshold?: number;
  windowMinutes?: number;
  endpoint?: string | null;
  method?: string | null;
  slackWebhookUrl?: string | null;
  emailAddresses?: string[] | null;
  status?: AlertRuleStatus;
}

export interface DeleteAlertRuleInputDTO {
  workspaceId: string;
  alertRuleId: string;
}

export interface GetAlertRuleInputDTO {
  workspaceId: string;
  alertRuleId: string;
}

export interface ListAlertRulesInputDTO {
  workspaceId: string;
}

export interface ListAlertEventsInputDTO {
  workspaceId: string;
  alertRuleId?: string;
  limit?: number;
  // open = resolvedAt null; resolved = not null; all = sem filtro
  eventStatus?: 'open' | 'resolved' | 'all';
}

export interface AlertRuleOutputDTO {
  id: string;
  workspaceId: string;
  endpointId: string | null;
  endpoint: string | null;
  method: string | null;
  name: string;
  description: string | null;
  condition: AlertCondition;
  threshold: number;
  windowMinutes: number;
  slackWebhookUrl: string | null;
  emailAddresses: string[];
  status: AlertRuleStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListAlertRulesOutputDTO {
  workspaceId: string;
  rules: AlertRuleOutputDTO[];
}

export interface AlertEventOutputDTO {
  id: string;
  alertRuleId: string;
  ruleName: string;
  workspaceId: string;
  triggeredAt: Date;
  resolvedAt: Date | null;
  value: number;
  message: string | null;
  slackSent: boolean;
  emailSent: boolean;
}

export interface ListAlertEventsOutputDTO {
  workspaceId: string;
  events: AlertEventOutputDTO[];
}

/**
 * Snapshot de métricas agregadas usado pelo motor de avaliação.
 */
export interface AlertEvaluationSnapshot {
  latencyP95: number;
  errorRate: number;
  status5xxCount: number;
  sampleCount: number;
}

export interface TriggerAlertInputDTO {
  rule: AlertRuleOutputDTO;
  observedValue: number;
  message: string;
}

export interface TriggerAlertOutputDTO {
  eventId: string;
  slackSent: boolean;
  emailSent: boolean;
}

export interface EvaluateAlertsOutputDTO {
  evaluatedRules: number;
  triggeredCount: number;
  resolvedCount: number;
}
