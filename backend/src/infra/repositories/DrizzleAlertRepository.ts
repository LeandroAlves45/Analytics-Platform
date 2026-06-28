/**
 * Repositório Drizzle para alert_rules e alert_events.
 * Inclui queries de avaliação sobre metrics_5min para o motor de alertas.
 */

import { and, desc, eq, gte, inArray, isNull, isNotNull, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { AlertRule } from '@domain/entities/AlertRule';
import type { AlertRepository, CreateAlertEventData } from '@application/contracts/repositories';
import type {
  AlertEvaluationSnapshot,
  AlertEventOutputDTO,
  AlertRuleOutputDTO,
  ListAlertEventsInputDTO,
} from '@application/dto/AlertsDTO';
import type * as schema from '@infra/frameworks/database/schema';
import { alertRules, alertEvents, endpoints, metrics5min } from '@infra/frameworks/database/schema';
import { AppError } from '@shared/errors';
import { logger } from '@infra/frameworks/logging';

type Database = PostgresJsDatabase<typeof schema>;

export class DrizzleAlertRepository implements AlertRepository {
  constructor(private readonly db: Database) {}

  /** Colunas partilhadas para queries de alertRules+endpoints. Evita repetição nos 3 finders. */
  private readonly ruleSelectColumns = {
    id: alertRules.id,
    workspaceId: alertRules.workspaceId,
    endpointId: alertRules.endpointId,
    endpoint: endpoints.endpoint,
    method: endpoints.method,
    name: alertRules.name,
    description: alertRules.description,
    condition: alertRules.condition,
    threshold: alertRules.threshold,
    windowMinutes: alertRules.windowMinutes,
    slackWebhookUrl: alertRules.slackWebhookUrl,
    emailAddresses: alertRules.emailAddresses,
    status: alertRules.status,
    createdAt: alertRules.createdAt,
    updatedAt: alertRules.updatedAt,
  };

  /** Colunas partilhadas para queries de alertEvents+alertRules. Evita repetição nos 4 finders. */
  private readonly eventSelectColumns = {
    id: alertEvents.id,
    alertRuleId: alertEvents.alertRuleId,
    ruleName: alertRules.name,
    workspaceId: alertEvents.workspaceId,
    triggeredAt: alertEvents.triggeredAt,
    resolvedAt: alertEvents.resolvedAt,
    value: alertEvents.value,
    message: alertEvents.message,
    slackSent: alertEvents.slackSent,
    emailSent: alertEvents.emailSent,
  };

  /** Persiste uma nova regra de alerta e devolve o DTO enriquecido com dados do endpoint. */
  async save(rule: AlertRule): Promise<AlertRuleOutputDTO> {
    try {
      const [row] = await this.db
        .insert(alertRules)
        .values({
          id: rule.id,
          workspaceId: rule.workspaceId,
          endpointId: rule.endpointId,
          name: rule.name,
          description: rule.description,
          condition: rule.condition,
          threshold: rule.threshold,
          windowMinutes: rule.windowMinutes,
          slackWebhookUrl: rule.slackWebhookUrl,
          emailAddresses: rule.emailAddresses,
          status: rule.status,
          createdAt: rule.createdAt,
          updatedAt: rule.updatedAt,
        })
        .returning();

      const saved = await this.findById(row.id, row.workspaceId);

      if (!saved) {
        throw new AppError('Failed to save alert rule', 'INTERNAL_SERVER_ERROR', 500);
      }

      return saved;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      logger.error('alert_rule_save_failed', {
        alertRuleId: rule.id,
        error: error instanceof Error ? error.message : 'unknown',
      });

      throw new AppError('Failed to save alert rule', 'INTERNAL_SERVER_ERROR', 500, {
        cause: error as Error,
      });
    }
  }

  /** Atualiza os campos editáveis de uma regra existente. */
  async update(rule: AlertRule): Promise<AlertRuleOutputDTO> {
    try {
      await this.db
        .update(alertRules)
        .set({
          endpointId: rule.endpointId,
          name: rule.name,
          description: rule.description,
          condition: rule.condition,
          threshold: rule.threshold,
          windowMinutes: rule.windowMinutes,
          slackWebhookUrl: rule.slackWebhookUrl,
          emailAddresses: rule.emailAddresses,
          status: rule.status,
          updatedAt: rule.updatedAt,
        })
        .where(and(eq(alertRules.id, rule.id), eq(alertRules.workspaceId, rule.workspaceId)));

      const updated = await this.findById(rule.id, rule.workspaceId);

      if (!updated) {
        throw new AppError('Failed to update alert rule', 'INTERNAL_SERVER_ERROR', 500);
      }

      return updated;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError('Failed to update alert rule', 'INTERNAL_SERVER_ERROR', 500, {
        cause: error as Error,
      });
    }
  }

  /** Remove uma regra de alerta. Idempotente — não lança erro se a regra já não existir. */
  async delete(alertRuleId: string, workspaceId: string): Promise<void> {
    await this.db
      .delete(alertRules)
      .where(and(eq(alertRules.id, alertRuleId), eq(alertRules.workspaceId, workspaceId)));
  }

  /** Devolve uma regra com JOIN a endpoints, ou null se não existir. */
  async findById(alertRuleId: string, workspaceId: string): Promise<AlertRuleOutputDTO | null> {
    const rows = await this.db
      .select(this.ruleSelectColumns)
      .from(alertRules)
      .leftJoin(endpoints, eq(alertRules.endpointId, endpoints.id))
      .where(and(eq(alertRules.id, alertRuleId), eq(alertRules.workspaceId, workspaceId)))
      .limit(1);

    const row = rows[0];
    return row ? this.toRuleOutput(row) : null;
  }

  /** Devolve todas as regras de um workspace, ordenadas por data de criação descendente. */
  async findByWorkspace(workspaceId: string): Promise<AlertRuleOutputDTO[]> {
    const rows = await this.db
      .select(this.ruleSelectColumns)
      .from(alertRules)
      .leftJoin(endpoints, eq(alertRules.endpointId, endpoints.id))
      .where(eq(alertRules.workspaceId, workspaceId))
      .orderBy(desc(alertRules.createdAt));

    return rows.map((row) => this.toRuleOutput(row));
  }

  /** Devolve todas as regras com status='active' — usado pelo scheduler de avaliação. */
  async findActiveRules(): Promise<AlertRuleOutputDTO[]> {
    const rows = await this.db
      .select(this.ruleSelectColumns)
      .from(alertRules)
      .leftJoin(endpoints, eq(alertRules.endpointId, endpoints.id))
      .where(eq(alertRules.status, 'active'));

    return rows.map((row) => this.toRuleOutput(row));
  }

  /** Devolve o evento aberto mais recente para uma regra, ou null se não houver nenhum. */
  async findOpenEvent(alertRuleId: string): Promise<AlertEventOutputDTO | null> {
    const rows = await this.db
      .select(this.eventSelectColumns)
      .from(alertEvents)
      .innerJoin(alertRules, eq(alertEvents.alertRuleId, alertRules.id))
      .where(and(eq(alertEvents.alertRuleId, alertRuleId), isNull(alertEvents.resolvedAt)))
      .orderBy(desc(alertEvents.triggeredAt))
      .limit(1);

    const row = rows[0];
    return row ? this.toEventOutput(row) : null;
  }

  /**
   * Cria um evento de alerta e devolve o DTO completo com ruleName.
   * O evento é criado com slackSent/emailSent=false antes do envio da notificação
   * para garantir cooldown imediato. updateNotificationStatus corrige os flags depois.
   * ruleName é passado pelo caller para evitar o SELECT+JOIN pós-INSERT.
   */
  async createEvent(data: CreateAlertEventData): Promise<AlertEventOutputDTO> {
    const [inserted] = await this.db
      .insert(alertEvents)
      .values({
        alertRuleId: data.alertRuleId,
        workspaceId: data.workspaceId,
        value: data.value,
        message: data.message,
        slackSent: data.slackSent,
        emailSent: data.emailSent,
      })
      .returning({
        id: alertEvents.id,
        triggeredAt: alertEvents.triggeredAt,
      });

    return this.toEventOutput({
      id: inserted.id,
      alertRuleId: data.alertRuleId,
      ruleName: data.ruleName,
      workspaceId: data.workspaceId,
      triggeredAt: inserted.triggeredAt,
      resolvedAt: null,
      value: data.value,
      message: data.message,
      slackSent: data.slackSent,
      emailSent: data.emailSent,
    });
  }

  /** Marca um evento como resolvido ao registar a data de resolução. */
  async resolveEvent(eventId: string, resolvedAt: Date): Promise<void> {
    await this.db.update(alertEvents).set({ resolvedAt }).where(eq(alertEvents.id, eventId));
  }

  /** Lista eventos com filtros opcionais de regra, estado (open/resolved/all) e limite. */
  async listEvents(input: ListAlertEventsInputDTO): Promise<AlertEventOutputDTO[]> {
    const conditions = [eq(alertEvents.workspaceId, input.workspaceId)];

    if (input.alertRuleId) {
      conditions.push(eq(alertEvents.alertRuleId, input.alertRuleId));
    }

    if (input.eventStatus === 'open') {
      conditions.push(isNull(alertEvents.resolvedAt));
    } else if (input.eventStatus === 'resolved') {
      conditions.push(isNotNull(alertEvents.resolvedAt));
    }

    const limit = input.limit ?? 50;

    const rows = await this.db
      .select(this.eventSelectColumns)
      .from(alertEvents)
      .innerJoin(alertRules, eq(alertEvents.alertRuleId, alertRules.id))
      .where(and(...conditions))
      .orderBy(desc(alertEvents.triggeredAt))
      .limit(limit);

    return rows.map((row) => this.toEventOutput(row));
  }

  /**
   * Agrega metrics_5min na janela [now - windowMinutes, now).
   * Regra workspace-wide (sem endpoint/method) agrega todas as linhas do workspace.
   * A agregação é feita inteiramente no PostgreSQL para evitar transferência de N rows
   * para o Node.js — SUM/NULLIF calcula média ponderada de P95 e taxa de erro numa query.
   */
  async findEvaluationSnapshot(
    rule: AlertRuleOutputDTO,
    windowMinutes: number
  ): Promise<AlertEvaluationSnapshot> {
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1_000);

    const conditions = [
      eq(metrics5min.workspaceId, rule.workspaceId),
      gte(metrics5min.time, windowStart),
    ];

    if (rule.endpoint && rule.method) {
      conditions.push(eq(metrics5min.endpoint, rule.endpoint));
      conditions.push(eq(metrics5min.method, rule.method));
    }

    const [agg] = await this.db
      .select({
        totalCount: sql<number | null>`SUM(${metrics5min.count})`,
        total4xx: sql<number | null>`SUM(${metrics5min.status4xxCount})`,
        total5xx: sql<number | null>`SUM(${metrics5min.status5xxCount})`,
        weightedP95: sql<
          number | null
        >`SUM(${metrics5min.latencyP95} * ${metrics5min.count}) / NULLIF(SUM(${metrics5min.count}), 0)`,
      })
      .from(metrics5min)
      .where(and(...conditions));

    const totalCount = Number(agg?.totalCount ?? 0);
    const total4xx = Number(agg?.total4xx ?? 0);
    const total5xx = Number(agg?.total5xx ?? 0);
    const latencyP95 = Number(agg?.weightedP95 ?? 0);
    const errorRate = totalCount > 0 ? (total4xx + total5xx) / totalCount : 0;

    return {
      latencyP95,
      errorRate,
      status5xxCount: total5xx,
      sampleCount: totalCount,
    };
  }

  /**
   * Devolve snapshots para múltiplas regras em paralelo via Promise.all.
   * Regras sem dados de métricas na janela ficam ausentes do mapa retornado.
   *
   * Trade-off aceite: executa N queries (uma por regra) em paralelo em vez de
   * uma query única com CASE/GROUP BY. A query única seria mais eficiente com
   * muitas regras mas exigiria lógica complexa para filtros por endpoint/method.
   * Com o volume esperado (<100 regras activas) o custo de N queries paralelas
   * é negligenciável — revisitar se o número de regras crescer significativamente.
   */
  async findEvaluationSnapshotsBatch(
    rules: AlertRuleOutputDTO[]
  ): Promise<Map<string, AlertEvaluationSnapshot>> {
    if (rules.length === 0) {
      return new Map();
    }

    const result = new Map<string, AlertEvaluationSnapshot>();

    await Promise.all(
      rules.map(async (rule) => {
        const snapshot = await this.findEvaluationSnapshot(rule, rule.windowMinutes);
        if (snapshot.sampleCount > 0) {
          result.set(rule.id, snapshot);
        }
      })
    );

    return result;
  }

  /**
   * Devolve o evento aberto por ruleId numa única query com IN (...).
   * A deduplicação em JS mantém o evento mais recente por regra (ORDER BY triggeredAt DESC).
   * Regras sem evento aberto ficam ausentes do mapa retornado.
   */
  async findOpenEventsBatch(ruleIds: string[]): Promise<Map<string, AlertEventOutputDTO>> {
    if (ruleIds.length === 0) {
      return new Map();
    }

    const rows = await this.db
      .select(this.eventSelectColumns)
      .from(alertEvents)
      .innerJoin(alertRules, eq(alertEvents.alertRuleId, alertRules.id))
      .where(and(inArray(alertEvents.alertRuleId, ruleIds), isNull(alertEvents.resolvedAt)))
      .orderBy(desc(alertEvents.triggeredAt));

    const result = new Map<string, AlertEventOutputDTO>();

    for (const row of rows) {
      if (!result.has(row.alertRuleId)) {
        result.set(row.alertRuleId, this.toEventOutput(row));
      }
    }

    return result;
  }

  /**
   * Corrige slackSent/emailSent após o envio da notificação.
   * O evento é criado com false/false para garantir cooldown imediato;
   * este método actualiza os flags com o resultado real do envio.
   */
  async updateNotificationStatus(
    eventId: string,
    slackSent: boolean,
    emailSent: boolean
  ): Promise<void> {
    await this.db
      .update(alertEvents)
      .set({ slackSent, emailSent })
      .where(eq(alertEvents.id, eventId));
  }

  /** Mapeia uma row de alertRules+endpoints para AlertRuleOutputDTO. */
  private toRuleOutput(row: {
    id: string;
    workspaceId: string;
    endpointId: string | null;
    endpoint: string | null;
    method: string | null;
    name: string;
    description: string | null;
    condition: string;
    threshold: number;
    windowMinutes: number;
    slackWebhookUrl: string | null;
    emailAddresses: string[] | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }): AlertRuleOutputDTO {
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      endpointId: row.endpointId,
      endpoint: row.endpoint,
      method: row.method,
      name: row.name,
      description: row.description,
      condition: row.condition as AlertRuleOutputDTO['condition'],
      threshold: row.threshold,
      windowMinutes: row.windowMinutes,
      slackWebhookUrl: row.slackWebhookUrl,
      emailAddresses: row.emailAddresses ?? [],
      status: row.status as AlertRuleOutputDTO['status'],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /** Mapeia uma row de alertEvents+alertRules para AlertEventOutputDTO. */
  private toEventOutput(row: {
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
  }): AlertEventOutputDTO {
    return {
      id: row.id,
      alertRuleId: row.alertRuleId,
      ruleName: row.ruleName,
      workspaceId: row.workspaceId,
      triggeredAt: row.triggeredAt,
      resolvedAt: row.resolvedAt,
      value: row.value,
      message: row.message,
      slackSent: row.slackSent,
      emailSent: row.emailSent,
    };
  }
}
