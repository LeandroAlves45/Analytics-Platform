/**
 * Implementação concreta do contrato MetricsRepository usando Drizzle ORM.
 * Esta classe é o único sítio em todo o sistema que sabe como as métricas
 * são fisicamente guardadas no PostgreSQL com TimescaleDB.
 *
 * Foi adicionada integração com cache (MetricsCacheService).
 * O padrão utilizado é Cache-Aside:
 * - getRecent: verifica cache → se miss vai à BD e popula cache
 * - save: persiste na BD → invalida cache do workspace
 */

import { eq, gte, and } from 'drizzle-orm';
import type { Database } from '@infra/frameworks/database';

import { Metric, type HttpMethod } from '@domain/entities/Metric';
import { AppError } from '@shared/errors/AppError';
import { logger } from '@infra/frameworks/logging';
import type { MetricsRepository, MetricSaveResult } from '@application/contracts/repositories';
import type { MetricsCacheService } from '@application/contracts/cache';
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
  // O repositório recebe tanto a base de dados como o serviço de cache
  // por injecção de dependências. Nenhum dos dois é instanciado aqui.
  constructor(
    private readonly db: Database,
    private readonly cache: MetricsCacheService
  ) {}

  /**
   * Persiste uma métrica de forma idempotente e invalida o cache do workspace.
   *
   * A invalidação do cache ocorre APÓS a transação confirmar com sucesso.
   * Se a transação falhar, o cache não é tocado -> não há dados novos na BD.
   * Se a invalidação do cache falhar, o erro é silenciado pelo RedisMetricsCache
   * (ou ignorado pelo NoOpMetricsCacheService). A BD é a fonte de verdade.
   */
  async save(metric: Metric): Promise<MetricSaveResult> {
    let wasSaved = false;

    try {
      await this.db.transaction(async (tx) => {
        // Passo 1: tentar inserir o requestId na tabela de idempotência
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

        // Passo 2: inserir a métrica na hypertable
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

        wasSaved = true;
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

    if (wasSaved) {
      // Fire-and-forget: cache é best-effort e não deve atrasar a resposta HTTP.
      void this.cache.invalidate(metric.workspaceId).catch(() => {
        // silenciado: falha de cache não deve reverter uma escrita bem-sucedida
      });
    }

    return wasSaved ? 'saved' : 'duplicate';
  }

  /**
   * Verifica se um requestId já foi processado.
   * Não utiliza cache, a verificação de idempotência assenta no PRIMARY KEY da BD.
   * O cache-aside não se aplica aqui: o custo de um false negative seria inserir
   * uma métrica duplicada, o que viola a integridade dos dados.
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

  /**
   * Devolve métricas recentes de um workspace com estratégia Cache-Aside.
   *
   * Fluxo:
   * 1. Tentar cache (getRecent) → se hit, retornar imediatamente
   * 2. Se miss: ir à BD, obter métricas
   * 3. Popular cache com os resultados (setRecent)
   * 4. Retornar métricas
   *
   * Se o cache falhar em qualquer passo, o fluxo continua via BD sem erro.
   */
  async getRecent(workspaceId: string, minutes: number): Promise<Metric[]> {
    // Passo 1: verificar cache. .catch(() => null) garante fallback para a BD
    // se qualquer implementação de MetricsCacheService lançar inesperadamente.
    const cached = await this.cache.getRecent(workspaceId, minutes).catch(() => null);

    if (cached !== null) {
      // Cache hit: evitar a query à BD
      logger.debug('metrics_repository_cache_hit', {
        workspaceId,
        minutes,
      });
      return cached;
    }

    // Passo 2: cache miss -> ir à BD
    try {
      // Calculamos o timestamp mínimo a partir de agora menos o intervalo
      const since = new Date(Date.now() - minutes * 60 * 1000);

      const rows = await this.db
        .select()
        .from(metricsRaw)
        .where(and(eq(metricsRaw.workspaceId, workspaceId), gte(metricsRaw.time, since)))
        .orderBy(metricsRaw.time);

      const metrics = rows.map((row) => this.hydrateMetric(row));

      // Passo 3: popular cache para a próxima leitura
      // Se falhar, silencia o erro internamente
      await this.cache.setRecent(workspaceId, minutes, metrics);

      return metrics;
    } catch (error) {
      logger.error('metric_get_recent_failed', { workspaceId, minutes, error });

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
