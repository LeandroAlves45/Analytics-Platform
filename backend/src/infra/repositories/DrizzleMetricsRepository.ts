// DrizzleMetricsRepository.ts
//
// Implementação concreta do contrato MetricsRepository usando Drizzle ORM.
// Esta classe é o único sítio em todo o sistema que sabe como as métricas
// são fisicamente guardadas no PostgreSQL com TimescaleDB.

import { eq, gte, and } from 'drizzle-orm';
import type { Database } from '@infra/frameworks/database';

import { Metric } from '@domain/entities/Metric';
import { AppError } from '@shared/errors/AppError';
import { logger } from '@infra/frameworks/logging';
import { MetricsRepository } from '@application/contracts/repositories';
import { metricsRaw } from '@infra/frameworks/database/schema';

/**
 * Implementação concreta do contrato MetricsRepository usando Drizzle ORM.
 * Esta classe é o único sítio em todo o sistema que sabe como as métricas
 * são fisicamente guardadas no PostgreSQL com TimescaleDB.
 *
 * @implements {MetricsRepository}
 * @param {PostgresJsDatabase} db - A instância do banco de dados Drizzle.
 */
export class DrizzleMetricsRepository implements MetricsRepository {
  // Recebemos a instância da base de dados por injecção de dependências.
  constructor(private readonly db: Database) {}

  // Persiste uma métrica na tabela metrics_raw.
  // Se o requestId já existir (UNIQUE constraint), a base de dados lança erro
  // que é interceptado e tratado aqui como caso especial.
  async save(metric: Metric): Promise<void> {
    try {
      await this.db.insert(metricsRaw).values({
        // A coluna 'time' é a dimensão temporal da hypertable TimescaleDB.
        // Usamos o timestamp da entidade para preservar o momento exacto da medição.
        time: metric.timestamp,
        workspaceId: metric.workspaceId,
        apiKeyId: metric.apiKeyId,
        endpoint: metric.endpoint,
        method: metric.method,
        latencyMs: metric.latencyMs,
        statusCode: metric.statusCode,
        payloadSizeBytes: metric.payloadSizeBytes,
        requestId: metric.requestId,
        userAgent: metric.userAgent,
        ipAddress: metric.ipAddress,
      });

      logger.debug('metric_saved_to_db', {
        metric_id: metric.id,
        workspace_id: metric.workspaceId,
        request_id: metric.requestId,
      });
    } catch (error) {
      // Detectamos violação de UNIQUE constraint no requestId.
      const pgError = error as { code?: string };
      if (pgError.code === '23505') {
        logger.warn('metric_duplicate_request_id', {
          request_id: metric.requestId,
          workspace_id: metric.workspaceId,
        });
        // Não lançamos erro, a métrica já existe, o resultado é o mesmo.
        return;
      }

      // Qualquer outro erro de base de dados é crítico
      logger.error('metric_db_insert_failed', {
        request_id: metric.requestId,
        workspace_id: metric.workspaceId,
        error,
      });

      throw new AppError('Failed to save metric', 'INTERNAL_SERVER_ERROR', 500, {
        cause: error as Error,
      });
    }
  }

  // Verifica se uma métrica com este requestId já foi guardada.
  // Usado pelo use case para garantir idempotência antes de tentar o insert.
  // A query usa o índice UNIQUE em request_id, portanto é O(log n).
  async existsByRequestId(requestId: string): Promise<boolean> {
    try {
      const result = await this.db
        .select({
          // Seleccionamos apenas requestId para minimizar dados transferidos.
          requestId: metricsRaw.requestId,
        })
        .from(metricsRaw)
        .where(eq(metricsRaw.requestId, requestId))
        .limit(1);

      return result.length > 0;
    } catch (error) {
      logger.error('metric_existence_check_failed', {
        request_id: requestId,
        error,
      });

      throw new AppError('Failed to check metric existence', 'INTERNAL_SERVER_ERROR', 500, {
        cause: error as Error,
      });
    }
  }

  // Devolve métricas recentes de um workspace para um intervalo em minutos.
  // A query beneficia do índice composto (workspace_id, time DESC)
  async getRecent(workspaceId: string, minutes: number): Promise<Metric[]> {
    try {
      // Calculamos o timestamp mínimo a partir de agora menos o intervalo
      const since = new Date(Date.now() - minutes * 60 * 1000);

      const rows = await this.db
        .select()
        .from(metricsRaw)
        .where(and(eq(metricsRaw.workspaceId, workspaceId), gte(metricsRaw.time, since)))
        .orderBy(metricsRaw.time);

      // Convertemos cada linha da base de dados numa entidade Metric.
      // Este processo chama-se "hydration" — reidratamos os dados em objectos de domínio.
      return rows.map((row) => this.hydrateMetric(row));
    } catch (error) {
      logger.error('metric_get_recent_failed', { workspace_id: workspaceId, minutes, error });

      throw new AppError('Failed to retrieve recent metrics', 'INTERNAL_SERVER_ERROR', 500, {
        cause: error as Error,
      });
    }
  }

  // Converte uma linha da base de dados numa entidade Metric válida.
  // Valida integridade dos dados antes de construir a entity.
  private hydrateMetric(row: typeof metricsRaw.$inferSelect): Metric {
    // Validação defensiva: se dados críticos estão corrompidos no banco,
    // falha rápido e com mensagem clara (não deixa validação silenciosa do Metric)
    if (!row.workspaceId || !row.apiKeyId || !row.requestId) {
      logger.error('corrupted_metric_row', {
        workspace_id: row.workspaceId,
        api_key_id: row.apiKeyId,
        request_id: row.requestId,
      });
      throw new AppError('Corrupted metric data in database', 'INTERNAL_SERVER_ERROR', 500);
    }

    if (!Number.isFinite(row.latencyMs)) {
      logger.error('invalid_latency_in_db', {
        request_id: row.requestId,
        latency_value: row.latencyMs,
      });
      throw new AppError('Invalid latency in database record', 'INTERNAL_SERVER_ERROR', 500);
    }

    const metric = new Metric({
      workspaceId: row.workspaceId,
      apiKeyId: row.apiKeyId,
      endpoint: row.endpoint,
      method: row.method,
      latencyMs: row.latencyMs,
      statusCode: row.statusCode,
      payloadSizeBytes: row.payloadSizeBytes ?? undefined,
      requestId: row.requestId,
      userAgent: row.userAgent ?? undefined,
      ipAddress: row.ipAddress ?? undefined,
    });

    return metric;
  }
}
