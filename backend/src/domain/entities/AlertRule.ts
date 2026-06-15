/**
 * AlertRule é uma regra de alerta que define quando um alerta deve ser disparado.
 */

import { randomUUID } from 'node:crypto';
import { ValidationError } from '@shared/errors';
import { isValidUuid } from '@shared/validation/uuid';

/**
 * Condições suportadas pelo motor de alertas.
 * Valores alinhados com a coluna alert_rules.condition na BD.
 */
export const ALERT_CONDITIONS = ['latency_p95', 'error_rate', 'status_5xx_count'] as const;

export type AlertCondition = (typeof ALERT_CONDITIONS)[number];

export const ALERT_RULE_STATUSES = ['active', 'inactive'] as const;

export type AlertRuleStatus = (typeof ALERT_RULE_STATUSES)[number];

/**
 * Amostra mínima antes de disparar alerta.
 * Regra de negócio: abaixo disto o sinal estatístico é demasiado fraco.
 */
export const ALERT_MIN_SAMPLE_COUNT = 10;

export interface CreateAlertRuleInput {
  workspaceId: string;
  endpointId?: string | null;
  name: string;
  description?: string | null;
  condition: string;
  threshold: number;
  windowMinutes?: number;
  slackWebhookUrl?: string | null;
  emailAddresses?: string[] | null;
  status?: string;
}

export interface ReconstituteAlertRuleInput extends CreateAlertRuleInput {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Entidade AlertRule — define quando e como notificar sobre degradação de API.
 *
 * Responsabilidades:
 * - Validar invariantes na construção
 * - Expor lógica pura de trigger/resolve (sem I/O)
 * - Manter imutabilidade após criação
 */
export class AlertRule {
  readonly id: string;
  readonly workspaceId: string;
  readonly endpointId: string | null;
  readonly name: string;
  readonly description: string | null;
  readonly condition: AlertCondition;
  readonly threshold: number;
  readonly windowMinutes: number;
  readonly slackWebhookUrl: string | null;
  readonly emailAddresses: string[];
  readonly status: AlertRuleStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(
    input: CreateAlertRuleInput,
    persisted?: { id: string; createdAt: Date; updatedAt: Date }
  ) {
    AlertRule.validate(input);

    this.id = persisted?.id ?? randomUUID();
    this.workspaceId = input.workspaceId;
    this.endpointId = input.endpointId ?? null;
    this.name = input.name.trim();
    this.description = input.description?.trim() ?? null;
    this.condition = input.condition as AlertCondition;
    this.threshold = input.threshold;
    this.windowMinutes = input.windowMinutes ?? 5;
    this.slackWebhookUrl = input.slackWebhookUrl?.trim() ?? null;
    this.emailAddresses = input.emailAddresses ?? [];
    this.status = (input.status ?? 'active') as AlertRuleStatus;
    this.createdAt = persisted?.createdAt ?? new Date();
    this.updatedAt = persisted?.updatedAt ?? new Date();
  }

  static reconstitute(input: ReconstituteAlertRuleInput): AlertRule {
    return new AlertRule(input, {
      id: input.id,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
    });
  }

  isActive(): boolean {
    return this.status === 'active';
  }

  hasNotificationChannel(): boolean {
    return this.slackWebhookUrl !== null || this.emailAddresses.length > 0;
  }

  /**
   * Extrai o valor observado do snapshot de agregação conforme a condição da regra.
   */
  extractObservedValue(snapshot: {
    latencyP95: number;
    errorRate: number;
    status5xxCount: number;
  }): number {
    switch (this.condition) {
      case 'latency_p95':
        return snapshot.latencyP95;
      case 'error_rate':
        return snapshot.errorRate;
      case 'status_5xx_count':
        return snapshot.status5xxCount;
      default: {
        const _exhaustive: never = this.condition;
        return _exhaustive;
      }
    }
  }

  isThresholdExceeded(observedValue: number): boolean {
    return observedValue > this.threshold;
  }

  meetsMinimumSampleCount(sampleCount: number): boolean {
    return sampleCount >= ALERT_MIN_SAMPLE_COUNT;
  }

  /**
   * Cooldown: se já existe evento aberto, não dispara novamente.
   */
  shouldTrigger(observedValue: number, sampleCount: number, hasOpenEvent: boolean): boolean {
    if (!this.isActive()) {
      return false;
    }

    if (hasOpenEvent) {
      return false;
    }

    if (!this.meetsMinimumSampleCount(sampleCount)) {
      return false;
    }

    return this.isThresholdExceeded(observedValue);
  }

  /**
   * Auto-resolve quando a métrica normaliza abaixo do threshold.
   */
  shouldAutoResolve(observedValue: number, hasOpenEvent: boolean): boolean {
    if (!hasOpenEvent) {
      return false;
    }

    return !this.isThresholdExceeded(observedValue);
  }

  buildTriggerMessage(observedValue: number): string {
    switch (this.condition) {
      case 'latency_p95':
        return `Alert "${this.name}": p95 latency ${observedValue.toFixed(0)}ms exceeded threshold ${this.threshold}ms`;
      case 'error_rate':
        return `Alert "${this.name}": error rate ${(observedValue * 100).toFixed(2)}% exceeded threshold ${(this.threshold * 100).toFixed(2)}%`;
      case 'status_5xx_count':
        return `Alert "${this.name}": ${observedValue.toFixed(0)} server errors exceeded threshold ${this.threshold}`;
      default: {
        const _exhaustive: never = this.condition;
        return _exhaustive;
      }
    }
  }

  private static validate(input: CreateAlertRuleInput): void {
    AlertRule.validateRequired(input);
    AlertRule.validateCondition(input.condition);
    AlertRule.validateThreshold(input.condition, input.threshold);
    AlertRule.validateWindowMinutes(input.windowMinutes);
    AlertRule.validateNotificationChannels(input);
    AlertRule.validateStatus(input.status);
  }

  private static validateRequired(input: CreateAlertRuleInput): void {
    if (!isValidUuid(input.workspaceId)) {
      throw new ValidationError('Invalid alert rule data', [
        {
          field: 'workspaceId',
          value: input.workspaceId,
          message: 'workspaceId must be a valid UUID',
        },
      ]);
    }

    if (
      input.endpointId !== undefined &&
      input.endpointId !== null &&
      !isValidUuid(input.endpointId)
    ) {
      throw new ValidationError('Invalid alert rule data', [
        {
          field: 'endpointId',
          value: input.endpointId,
          message: 'endpointId must be a valid UUID',
        },
      ]);
    }

    if (!input.name || input.name.trim() === '') {
      throw new ValidationError('Invalid alert rule data', [
        { field: 'name', value: input.name, message: 'name is required' },
      ]);
    }
  }

  private static validateCondition(condition: string): void {
    if (!ALERT_CONDITIONS.includes(condition as AlertCondition)) {
      throw new ValidationError('Invalid alert rule data', [
        {
          field: 'condition',
          value: condition,
          message: 'condition must be one of the following: ' + ALERT_CONDITIONS.join(', '),
        },
      ]);
    }
  }

  private static validateThreshold(condition: string, threshold: number): void {
    if (!Number.isFinite(threshold)) {
      throw new ValidationError('Invalid alert rule data', [
        { field: 'threshold', value: threshold, message: 'threshold must be a finite number' },
      ]);
    }

    if (condition === 'error_rate') {
      if (threshold <= 0 || threshold > 1) {
        throw new ValidationError('Invalid alert rule data', [
          {
            field: 'threshold',
            value: threshold,
            message: 'error_rate threshold must be between 0 (exclusive) and 1 (inclusive)',
          },
        ]);
      }
      return;
    }

    if (threshold <= 0) {
      throw new ValidationError('Invalid alert rule data', [
        { field: 'threshold', value: threshold, message: 'threshold must be positive' },
      ]);
    }
  }

  private static validateWindowMinutes(windowMinutes: number | undefined): void {
    const value = windowMinutes ?? 5;

    if (!Number.isInteger(value) || value <= 0) {
      throw new ValidationError('Invalid alert rule data', [
        {
          field: 'windowMinutes',
          value: windowMinutes,
          message: 'windowMinutes must be a positive integer',
        },
      ]);
    }
  }

  /**
   * Pelo menos um canal de notificação é obrigatório para evitar regras silenciosas.
   */
  private static validateNotificationChannels(input: CreateAlertRuleInput): void {
    const hasSlack = !!input.slackWebhookUrl?.trim();
    const hasEmail = (input.emailAddresses?.length ?? 0) > 0;

    if (!hasSlack && !hasEmail) {
      throw new ValidationError('Invalid alert rule data', [
        {
          field: 'notification',
          message:
            'At least one notification channel is required (slackWebhookUrl or emailAddresses)',
        },
      ]);
    }

    if (input.emailAddresses) {
      for (const email of input.emailAddresses) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          throw new ValidationError('Invalid alert rule data', [
            { field: 'emailAddresses', value: email, message: 'Invalid email address' },
          ]);
        }
      }
    }
  }

  private static validateStatus(status: string | undefined): void {
    const value = status ?? 'active';

    if (!ALERT_RULE_STATUSES.includes(value as AlertRuleStatus)) {
      throw new ValidationError('Invalid alert rule data', [
        {
          field: 'status',
          value,
          message: 'status must be one of the following: ' + ALERT_RULE_STATUSES.join(', '),
        },
      ]);
    }
  }
}
