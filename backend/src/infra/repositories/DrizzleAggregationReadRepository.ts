/**
 * Repositório de leitura para tabelas de agregação (metrics_5min / 1h / 1d).
 *
 * Complementar ao DrizzleAggregationRepository (escrita/upsert).
 * Responsabilidade única: SELECT com filtros temporais e de endpoint.
 */

import { and, eq, gte, lt, SQL } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '@infra/frameworks/database/schema';
import { metrics5min, metrics1h, metrics1d } from '@infra/frameworks/database/schema';
import { logger } from '@infra/frameworks/logging';
import { AppError } from '@shared/errors';
import type { AggregationReadRepository } from '@application/contracts/repositories';
import type {
  QueryAggregatedMetricsInputDTO,
  AggregatedMetricRow,
  AggregationInterval,
} from '@application/dto/MetricsQueryDTO';
import { INTERVAL_TO_MINUTES } from '@application/dto/MetricsQueryDTO';

type Database = PostgresJsDatabase<typeof schema>;

const INTERVAL_TO_TABLE = {
  '5m': metrics5min,
  '1h': metrics1h,
  '1d': metrics1d,
} as const satisfies Record<
  AggregationInterval,
  typeof metrics5min | typeof metrics1h | typeof metrics1d
>;

export class DrizzleAggregationReadRepository implements AggregationReadRepository {
  constructor(private readonly db: Database) {}

  async findAggregatedMetrics(
    input: QueryAggregatedMetricsInputDTO
  ): Promise<AggregatedMetricRow[]> {
    const table = INTERVAL_TO_TABLE[input.interval];

    const conditions: SQL[] = [
      eq(table.workspaceId, input.workspaceId),
      gte(table.time, input.from),
      lt(table.time, input.to),
    ];

    if (input.endpoint !== undefined) {
      conditions.push(eq(table.endpoint, input.endpoint));
    }

    if (input.method !== undefined) {
      conditions.push(eq(table.method, input.method));
    }

    try {
      const rows = await this.db
        .select({
          time: table.time,
          endpoint: table.endpoint,
          method: table.method,
          count: table.count,
          latencyP50: table.latencyP50,
          latencyP75: table.latencyP75,
          latencyP95: table.latencyP95,
          latencyP99: table.latencyP99,
          latencyAvg: table.latencyAvg,
          latencyMin: table.latencyMin,
          latencyMax: table.latencyMax,
          status2xxCount: table.status2xxCount,
          status3xxCount: table.status3xxCount,
          status4xxCount: table.status4xxCount,
          status5xxCount: table.status5xxCount,
        })
        .from(table)
        .where(and(...conditions))
        .orderBy(table.time);

      logger.debug('aggregation_read_query', {
        workspaceId: input.workspaceId,
        interval: input.interval,
        intervalMinutes: INTERVAL_TO_MINUTES[input.interval],
        rowCount: rows.length,
      });

      return rows;
    } catch (error) {
      logger.error('aggregation_read_query_failed', {
        workspaceId: input.workspaceId,
        interval: input.interval,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new AppError('Failed to query aggregated metrics', 'INTERNAL_SERVER_ERROR', 500, {
        cause: error,
      });
    }
  }
}
