/**
 * Entidade de domínio AlertRule.
 *
 * Encapsula a configuração de uma regra de alerta (condição, threshold, janela
 * temporal) e os canais de notificação a usar quando a condição é violada.
 * Toda a lógica de avaliação vive aqui — as camadas superiores nunca acedem
 * diretamente ao threshold; chamam shouldTrigger / shouldAutoResolve para que
 * as regras de negócio permaneçam num único lugar.
 */

import { randomUUID } from 'node:crypto';
import { ValidationError } from '@shared/errors';
import { isValidUuid } from '@shared/validation/uuid';

// Os valores têm de estar em sincronização com a coluna alert_rules.condition na BD.
export const ALERT_CONDITIONS = ['latency_p95', 'error_rate', 'status_5xx_count'] as const;

export type AlertCondition = (typeof ALERT_CONDITIONS)[number];

export const ALERT_RULE_STATUSES = ['active', 'inactive'] as const;

export type AlertRuleStatus = (typeof ALERT_RULE_STATUSES)[number];

// Abaixo deste número de amostras, a janela de observação tem dados insuficientes
// para que a métrica seja estatisticamente significativa — disparar um alerta
// produziria ruído em vez de sinal.
export const ALERT_MIN_SAMPLE_COUNT = 10;

/**
 * Input aceite pelas camadas superiores para criar uma nova regra.
 * `condition` é tipado como `string` (não `AlertCondition`) para que a interface
 * aceite input não validado vindo do HTTP ou dos use cases; o construtor da
 * entidade valida e restringe para o union permitido.
 */
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

/**
 * Input usado ao reidratar uma linha persistida da base de dados.
 * Traz o `id` estável e os timestamps que pertencem à BD e devem ser
 * preservados tal-e-qual, em vez de regenerados.
 */
export interface ReconstituteAlertRuleInput extends CreateAlertRuleInput {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Modela a configuração e a lógica de avaliação de uma regra de alerta.
 *
 * Decisões de design a ter em conta:
 * - **Imutável após construção**: todas as propriedades são `readonly`; sem setters.
 * - **Validação fail-fast**: `ValidationError` é lançado no construtor,
 *   nunca diferido para um `.validate()` chamado externamente.
 * - **Sem I/O**: `shouldTrigger` e `shouldAutoResolve` recebem todo o estado
 *   como argumentos, tornando a entidade testável sem stubs de infraestrutura.
 * - **Factory method `reconstitute`**: separa a hidratação da BD da criação,
 *   mantendo o segundo argumento `persisted` como detalhe interno.
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

  /**
   * @param persisted - Fornecido apenas por `reconstitute`. Partilhar um único
   *   construtor concentra a lógica de atribuição num só lugar; o argumento
   *   opcional distingue o caminho "nova entidade" (UUID gerado aleatoriamente)
   *   do caminho "carregada da BD" (id e timestamps preservados).
   */
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

  /**
   * Reidrata uma regra a partir de uma linha persistida na BD, preservando
   * `id` e timestamps. Preferir este método ao construtor direto ao carregar
   * dados de armazenamento — sinaliza a intenção e mantém `persisted` interno.
   */
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
        // Guarda de exaustividade: se uma nova condição for adicionada a
        // ALERT_CONDITIONS sem atualizar este switch, o TypeScript falha aqui
        // em tempo de compilação.
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
   * Guarda de cooldown: apenas um evento aberto por regra em simultâneo.
   * O chamador deve passar `hasOpenEvent = true` enquanto existir um evento de
   * alerta não resolvido para esta regra, impedindo que uma única violação
   * gere eventos duplicados.
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
   * Retorna `true` quando a métrica recupera abaixo do threshold enquanto ainda
   * existe um evento aberto. O chamador é responsável por fechar esse evento.
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

  // Pelo menos um canal é obrigatório para evitar regras "silenciosas" — que
  // avaliam corretamente mas nunca notificam ninguém quando disparam.
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
