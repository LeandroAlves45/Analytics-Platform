/**
 * Use case de leitura: devolve série temporal de métricas agregadas
 * para alimentar gráficos do dashboard (latência, error rate, throughput).
 */

import { logger } from '@infra/frameworks/logging';
import { ValidationError } from '@shared/errors';
import type { AggregationReadRepository } from '@application/contracts/repositories';
import type {
  QueryAggregatedMetricsInputDTO,
  QueryAggregatedMetricsOutputDTO,
  AggregatedMetricPointDTO,
  AggregatedMetricRow,
} from '@application/dto/MetricsQueryDTO';
import { INTERVAL_TO_MINUTES } from '@application/dto/MetricsQueryDTO';

export class QueryAggregatedMetricsUseCase {
  constructor(private readonly aggregationReadRepository: AggregationReadRepository) {}

  async execute(input: QueryAggregatedMetricsInputDTO): Promise<QueryAggregatedMetricsOutputDTO> {
    if (input.from >= input.to) {
      throw new ValidationError('Invalid time range', [
        { field: 'from', message: 'from must be before to' },
        { field: 'to', message: 'to must be after from' },
      ]);
    }

    const rows = await this.aggregationReadRepository.findAggregatedMetrics(input);

    const intervalMinutes = INTERVAL_TO_MINUTES[input.interval];
    const windowSeconds = intervalMinutes * 60;

    const series = rows.map((row) => this.toPoint(row, windowSeconds));

    logger.info('metrics_query_aggregated', {
      workspaceId: input.workspaceId,
      interval: input.interval,
      from: input.from.toISOString(),
      to: input.to.toISOString(),
      pointCount: series.length,
    });

    return {
      workspaceId: input.workspaceId,
      interval: input.interval,
      from: input.from,
      to: input.to,
      series,
    };
  }

  /**
   * Converte linha da BD em ponto da série com campos derivados.
   * Valores nullable da BD são normalizados para 0 quando count > 0
   * (defesa em profundidade — o worker não deveria persistir nulls com count > 0).
   */
  private toPoint(row: AggregatedMetricRow, windowSeconds: number): AggregatedMetricPointDTO {
    const count = row.count;
    const errorCount = (row.status4xxCount ?? 0) + (row.status5xxCount ?? 0);

    return {
      time: row.time,
      endpoint: row.endpoint,
      method: row.method,
      count,
      latencyP50: row.latencyP50 ?? 0,
      latencyP75: row.latencyP75 ?? 0,
      latencyP95: row.latencyP95 ?? 0,
      latencyP99: row.latencyP99 ?? 0,
      latencyAvg: row.latencyAvg ?? 0,
      latencyMax: row.latencyMax ?? 0,
      latencyMin: row.latencyMin ?? 0,
      status2xxCount: row.status2xxCount ?? 0,
      status3xxCount: row.status3xxCount ?? 0,
      status4xxCount: row.status4xxCount ?? 0,
      status5xxCount: row.status5xxCount ?? 0,
      errorRate: count > 0 ? errorCount / count : 0,
      throughputPerSec: count / windowSeconds,
    };
  }
}
