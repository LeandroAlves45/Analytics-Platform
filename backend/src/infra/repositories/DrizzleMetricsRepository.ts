/**
 * Implementação concreta do contrato MetricsRepository usando Drizzle ORM.
 * Esta classe é o único sítio em todo o sistema que sabe como as métricas
 * são fisicamente guardadas no PostgreSQL com TimescaleDB.
 */

import { eq, gte, and } from 'drizzle-orm';
import type { Database } from '@infra/frameworks/database';

import { Metric, type HttpMethod } from '@domain/entities/Metric';
import { AppError } from '@shared/errors/AppError';
import { logger } from '@infra/frameworks/logging';
import { MetricsRepository } from '@application/contracts/repositories';
import { metricsRaw, metricIdempotencyKeys } from '@infra/frameworks/database/schema';

/**
 * Implementação concreta do contrato MetricsRepository usando Drizzle ORM.
 * Esta classe é o único sítio em todo o sistema que sabe como as métricas
 * são fisicamente guardadas no PostgreSQL com TimescaleDB.
 *
 * @implements {MetricsRepository}
 * @param {Database} db - Drizzle ORM Database instance.
 */
export class DrizzleMetricsRepository implements MetricsRepository {
  // Recebemos a instância da base de dados por injecção de dependências.
  constructor(private readonly db: Database) {}

  /**
   * Persiste uma métrica de forma idempotente usando transação atómica.
   *
   * Executa dois passos atómicos dentro de uma transação:
   * 1. `INSERT INTO metric_idempotency_keys (request_id) ON CONFLICT DO NOTHING RETURNING request_id`
   *    → Se `RETURNING` vier vazio: requestId já foi processado, retorna silenciosamente (idempotência)
   *    → Se `RETURNING` vier com a linha: novo requestId, prossegue para passo 2
   * 2. Se novo requestId: `INSERT INTO metrics_raw (...)` com todos os dados da métrica
   *
   * O `PRIMARY KEY` em `metric_idempotency_keys` actua como mutex distribuído,
   * garantindo que mesmo sob race conditions concorrentes, apenas uma métrica por
   * requestId é armazenada.
   *
   * @param metric - Instância de `Metric` válida a persistir
   * @throws {AppError} Com `code: 'INTERNAL_SERVER_ERROR'` em falha de BD inesperada
   * @returns Promise que resolve sem retorno (void)
   */
  async save(metric: Metric): Promise<void> {
    try {
      await this.db.transaction(async (tx) => {
        const inserted = await tx
          .insert(metricIdempotencyKeys)
          .values({ requestId: metric.requestId })
          .onConflictDoNothing()
          .returning({ requestId: metricIdempotencyKeys.requestId });

        if (inserted.length === 0) {
          // requestId já registado numa transação anterior -> idempotência garantida
          logger.warn('metric_duplicate_ignored', { request_id: metric.requestId });
          return;
        }

        await tx.insert(metricsRaw).values({
          time: metric.timestamp,
          workspaceId: metric.workspaceId,
          apiKeyId: metric.apiKeyId,
          endpoint: metric.endpoint,
          method: metric.method,
          latencyMs: metric.latencyMs,
          statusCode: metric.statusCode,
          payloadSizeBytes: metric.payloadSizeBytes ?? undefined,
          requestId: metric.requestId,
          userAgent: metric.userAgent ?? undefined,
          ipAddress: metric.ipAddress ?? undefined,
        });
      });
    } catch (error) {
      logger.error('metric_save_failed', {
        request_id: metric.requestId,
        workspace_id: metric.workspaceId,
        error,
      });
      throw new AppError('Failed to save metric', 'INTERNAL_SERVER_ERROR', 500, {
        cause: error as Error,
      });
    }
  }

  /**
   * Verifica se um `requestId` já foi processado.
   *
   * Consulta `metric_idempotency_keys` (tabela normal, não hypertable) usando o PRIMARY KEY.
   * O lookup é O(1) — extremamente eficiente comparado a varrer a hypertable `metrics_raw`
   * que pode ter milhões de linhas com retenção de 7 dias.
   *
   * **Nota sobre race conditions:**
   * Este método é usado como guarda no `RecordMetricUseCase` antes de chamar `save()`.
   * Dois pedidos concorrentes com o mesmo `requestId` podem ambos passar este check
   * antes de qualquer um chamar `save()`. A verdadeira proteção de idempotência
   * ocorre dentro de `save()` no PRIMARY KEY em transação.
   *
   * @param requestId - UUID do pedido a verificar
   * @returns `true` se já foi registado em `metric_idempotency_keys`, `false` caso contrário
   * @throws {AppError} Com `code: 'INTERNAL_SERVER_ERROR'` em falha de BD
   */
  async existsByRequestId(requestId: string): Promise<boolean> {
    try {
      const result = await this.db
        .select({
          // Seleccionamos apenas requestId para minimizar dados transferidos.
          requestId: metricIdempotencyKeys.requestId,
        })
        .from(metricIdempotencyKeys)
        .where(eq(metricIdempotencyKeys.requestId, requestId))
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
  // Delegação de validação: todas as regras de domínio (UUID format, HTTP method validity,
  // latency/statusCode ranges) são orquestradas por Metric.validate() no constructor.
  // hydrateMetric só é responsável por hydration + logs, não por re-validação.
  private hydrateMetric(row: typeof metricsRaw.$inferSelect): Metric {
    try {
      return Metric.reconstitute({
        workspaceId: row.workspaceId,
        apiKeyId: row.apiKeyId,
        endpoint: row.endpoint,
        method: row.method as HttpMethod,
        latencyMs: row.latencyMs,
        statusCode: row.statusCode,
        payloadSizeBytes: row.payloadSizeBytes ?? undefined,
        requestId: row.requestId,
        userAgent: row.userAgent ?? undefined,
        ipAddress: row.ipAddress ?? undefined,
        timestamp: row.time,
      });
    } catch (error) {
      // Se dados da BD violam invariantes de domínio, log e re-throw
      // Isto é exceção rara (data corruption) — não deve acontecer em produção.
      logger.error('corrupted_metric_row_in_db', {
        request_id: row.requestId,
        workspace_id: row.workspaceId,
        error: error instanceof Error ? error.message : 'unknown',
      });
      throw new AppError('Corrupted metric data in database', 'INTERNAL_SERVER_ERROR', 500, {
        cause: error as Error,
      });
    }
  }
}
