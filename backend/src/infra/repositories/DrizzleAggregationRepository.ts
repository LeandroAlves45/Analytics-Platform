/**
 * Repositório de escrita para as tabelas de agregação de métricas.
 *
 * Responsabilidades:
 * - Receber um AggregationResult calculado pelo use case
 * - Determinar qual tabela usar com base no intervalMinutes
 * - Fazer upsert idempotente: se o job for processado duas vezes,
 *   a segunda execução actualiza a linha existente em vez de duplicar
 */

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '@infra/frameworks/database/schema';
import { metrics5min, metrics1h, metrics1d } from '@infra/frameworks/database/schema';
import { logger } from '@infra/frameworks/logging';
import { AppError } from '@shared/errors';
import type { AggregationResult } from '@application/dto/AggregationDTO';

// Tipo de instância Drizzle com o schema completo.
type Database = PostgresJsDatabase<typeof schema>;

// Mapeamento de intervalMinutes para a tabela correspondente.
const INTERVAL_TO_TABLE = {
  5: metrics5min,
  60: metrics1h,
  1440: metrics1d,
} as const;

type SupportedInterval = keyof typeof INTERVAL_TO_TABLE;

export class DrizzleAggregationRepository {
  constructor(private readonly db: Database) {}

  /**
   * Persiste um resultado de agregação na tabela correcta.
   *
   * Usa upsert (INSERT ... ON CONFLICT DO UPDATE) para garantir idempotência:
   * se o mesmo job for processado duas vezes pelo worker (retry após crash),
   * o segundo upsert actualiza os valores em vez de criar uma linha duplicada.
   *
   * @param result - Resultado calculado pelo AggregateMetricsUseCase
   * @throws AppError se intervalMinutes não corresponder a uma tabela suportada
   */
  async save(result: AggregationResult): Promise<void> {
    // Janela sem dados não são persistidas.
    if (!result.hasData) {
      logger.info('aggregation_skip_empty', {
        workspaceId: result.workspaceId,
        endpoint: result.endpoint,
        method: result.method,
        intervalMinutes: result.intervalMinutes,
      });
      return;
    }

    const table = this.resolveTable(result.intervalMinutes);

    // Calcula o início da janela temporal truncando o timestamp actual.
    // Ex: se agora são 14:07 e o intervalo é 5min, a janela começa em 14:05.
    const windowStart = truncateToInterval(new Date(), result.intervalMinutes);

    // Valores a inserir ou atualizar no upsert.
    const values = {
      time: windowStart,
      workspaceId: result.workspaceId,
      endpoint: result.endpoint,
      method: result.method,
      count: result.processedCount,
      latencyP50: result.latencyP50,
      latencyP75: result.latencyP75,
      latencyP95: result.latencyP95,
      latencyP99: result.latencyP99,
      latencyAvg: result.latencyAvg,
      latencyMin: result.latencyMin,
      latencyMax: result.latencyMax,
      status2xxCount: result.status2xxCount,
      status3xxCount: result.status3xxCount,
      status4xxCount: result.status4xxCount,
      status5xxCount: result.status5xxCount,
    };

    try {
      await this.db
        .insert(table)
        .values(values)
        .onConflictDoUpdate({
          // A constraint única é sobre (time, workspaceId, endpoint, method).
          target: [table.time, table.workspaceId, table.endpoint, table.method],
          set: {
            count: values.count,
            latencyP50: values.latencyP50,
            latencyP75: values.latencyP75,
            latencyP95: values.latencyP95,
            latencyP99: values.latencyP99,
            latencyAvg: values.latencyAvg,
            latencyMin: values.latencyMin,
            latencyMax: values.latencyMax,
            status2xxCount: values.status2xxCount,
            status3xxCount: values.status3xxCount,
            status4xxCount: values.status4xxCount,
            status5xxCount: values.status5xxCount,
          },
        });

      logger.info('aggregation_saved', {
        workspaceId: result.workspaceId,
        endpoint: result.endpoint,
        method: result.method,
        intervalMinutes: result.intervalMinutes,
        count: result.processedCount,
        windowStart: windowStart.toISOString(),
      });
    } catch (error) {
      logger.error('aggregation_save_failed', {
        workspaceId: result.workspaceId,
        endpoint: result.endpoint,
        intervalMinutes: result.intervalMinutes,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new AppError('Failed to save aggregation result', 'INTERNAL_SERVER_ERROR', 500, {
        cause: error,
      });
    }
  }

  /**
   * Devolve a tabela Drizzle correspondente ao intervalo em minutos.
   * @throws AppError se o intervalo não for suportado
   */
  private resolveTable(intervalMinutes: number) {
    const table = INTERVAL_TO_TABLE[intervalMinutes as SupportedInterval];

    if (!table) {
      throw new AppError(
        `Unsupported aggregation interval: ${intervalMinutes} minutes. Supported: 5, 60, 1440`,
        'INTERNAL_SERVER_ERROR',
        500
      );
    }

    return table;
  }
}

/**
 * Trunca um Date para o início do intervalo de agregação.
 *
 * Exemplos:
 *   truncateToInterval(14:07:33, 5)    → 14:05:00
 *   truncateToInterval(14:07:33, 60)   → 14:00:00
 *   truncateToInterval(14:07:33, 1440) → 00:00:00 (início do dia)
 *
 * @param date - Data a truncar
 * @param intervalMinutes - Intervalo em minutos (5, 60 ou 1440)
 */
function truncateToInterval(date: Date, intervalMinutes: number): Date {
  const ms = date.getTime();
  const intervalMs = intervalMinutes * 60 * 1_000;
  // Trunca para o último múltiplo inferior do intervalo com Math.floor.
  return new Date(Math.floor(ms / intervalMs) * intervalMs);
}
