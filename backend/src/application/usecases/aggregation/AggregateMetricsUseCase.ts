/**
 * Use case responsável por calcular agregações estatísticas
 * sobre métricas brutas de um workspace/endpoint numa janela de tempo.
 *
 * Invocado pelo AggregationWorker (infra layer) ao processar um job BullMQ.
 */

import { logger } from '@infra/frameworks/logging';
import type { MetricsRepository } from '@application/contracts/repositories';
import type { ScheduleAggregationInput, AggregationResult } from '@application/dto/AggregationDTO';

export class AggregateMetricsUseCase {
  constructor(private metricsRepository: MetricsRepository) {}

  async execute(input: ScheduleAggregationInput): Promise<AggregationResult> {
    const metrics = await this.metricsRepository.getRecent(
      input.workspaceId,
      input.intervalMinutes,
      {
        endpoint: input.endpoint,
        method: input.method,
        windowStart: input.windowStart,
      }
    );

    if (metrics.length === 0) {
      logger.info('aggregation_no_data', {
        workspaceId: input.workspaceId,
        endpoint: input.endpoint,
        method: input.method,
        intervalMinutes: input.intervalMinutes,
        windowStart: input.windowStart,
      });

      return {
        processedCount: 0,
        hasData: false,
        workspaceId: input.workspaceId,
        endpoint: input.endpoint,
        method: input.method,
        intervalMinutes: input.intervalMinutes,
        windowStart: input.windowStart,
      };
    }

    const latencies = metrics.map((metric) => metric.latencyMs).sort((a, b) => a - b);

    const latencyP50 = calculatePercentile(latencies, 50);
    const latencyP75 = calculatePercentile(latencies, 75);
    const latencyP95 = calculatePercentile(latencies, 95);
    const latencyP99 = calculatePercentile(latencies, 99);

    const latencyMin = latencies[0];
    const latencyMax = latencies[latencies.length - 1];
    const latencyAvg = latencies.reduce((sum, value) => sum + value, 0) / latencies.length;

    let status2xx = 0;
    let status3xx = 0;
    let status4xx = 0;
    let status5xx = 0;

    for (const metric of metrics) {
      const family = Math.floor(metric.statusCode / 100);

      if (family === 2) {
        status2xx++;
      } else if (family === 3) {
        status3xx++;
      } else if (family === 4) {
        status4xx++;
      } else if (family === 5) {
        status5xx++;
      }
    }

    logger.info('aggregation_calculated', {
      workspaceId: input.workspaceId,
      endpoint: input.endpoint,
      method: input.method,
      intervalMinutes: input.intervalMinutes,
      windowStart: input.windowStart,
      count: metrics.length,
      latencyP95,
      latencyP99,
    });

    return {
      processedCount: metrics.length,
      hasData: true,
      workspaceId: input.workspaceId,
      endpoint: input.endpoint,
      method: input.method,
      intervalMinutes: input.intervalMinutes,
      windowStart: input.windowStart,
      latencyP50,
      latencyP75,
      latencyP95,
      latencyP99,
      latencyAvg,
      latencyMin,
      latencyMax,
      status2xxCount: status2xx,
      status3xxCount: status3xx,
      status4xxCount: status4xx,
      status5xxCount: status5xx,
    };
  }
}

function calculatePercentile(sorted: number[], percentile: number): number {
  if (sorted.length === 1) {
    return sorted[0];
  }

  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const fraction = index - lower;

  return sorted[lower] + fraction * (sorted[upper] - sorted[lower]);
}
