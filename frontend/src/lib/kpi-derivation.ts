/**
 * Derivação de KPIs a partir da série temporal agregada.
 * Lógica pura — testável sem React.
 */

import type { AggregatedMetricPoint } from '@/types/metrics';

export interface TrendResult {
  text: string;
  direction: 'up' | 'down' | 'neutral';
}

export interface KpiSummary {
  totalRequests: number;
  p95LatencyMs: number;
  errorRate: number;
  throughputPerSec: number;
  trends: {
    requests: TrendResult;
    latency: TrendResult;
    errorRate: TrendResult;
    throughput: TrendResult;
  };
}

export function computeTrend(values: number[]): TrendResult {
  if (values.length < 4) return { text: '- stable', direction: 'neutral' };

  const mid = Math.floor(values.length / 2);
  const firstHalf = values.slice(0, mid);
  const secondHalf = values.slice(mid);

  const firstAvg = firstHalf.reduce((sum, value) => sum + value, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, value) => sum + value, 0) / secondHalf.length;

  if (firstAvg === 0) return { text: '- stable', direction: 'neutral' };

  const pct = ((secondAvg - firstAvg) / firstAvg) * 100;

  if (Math.abs(pct) < 1.5) return { text: '- stable', direction: 'neutral' };

  const sign = pct > 0 ? '+' : '';
  return {
    text: `${sign}${pct.toFixed(1)}%`,
    direction: pct > 0 ? 'up' : 'down',
  };
}

export function deriveKpis(series: AggregatedMetricPoint[]): KpiSummary {
  if (series.length === 0) {
    const neutralTrend: TrendResult = { text: '- stable', direction: 'neutral' };
    return {
      totalRequests: 0,
      p95LatencyMs: 0,
      errorRate: 0,
      throughputPerSec: 0,
      trends: {
        requests: neutralTrend,
        latency: neutralTrend,
        errorRate: neutralTrend,
        throughput: neutralTrend,
      },
    };
  }

  let totalRequests = 0;
  let weightedP95Sum = 0;
  let totalErrors = 0;
  const windowThroughputs = new Map<string, number>();

  for (const point of series) {
    totalRequests += point.count;
    weightedP95Sum += point.latencyP95 * point.count;
    totalErrors += point.status4xxCount + point.status5xxCount;
    windowThroughputs.set(
      point.time,
      (windowThroughputs.get(point.time) ?? 0) + point.throughputPerSec
    );
  }

  const p95LatencyMs = totalRequests > 0 ? weightedP95Sum / totalRequests : 0;
  const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;
  const throughputValues = Array.from(windowThroughputs.values());
  const throughputPerSec =
    throughputValues.length > 0
      ? throughputValues.reduce((sum, value) => sum + value, 0) / throughputValues.length
      : 0;

  const sortedTimes = Array.from(windowThroughputs.keys()).sort();
  const pointsByTime = new Map<string, AggregatedMetricPoint[]>();

  for (const point of series) {
    const existing = pointsByTime.get(point.time) ?? [];
    existing.push(point);
    pointsByTime.set(point.time, existing);
  }

  const requestByWindow = sortedTimes.map((time) =>
    (pointsByTime.get(time) ?? []).reduce((sum, point) => sum + point.count, 0)
  );

  const latencyByWindow = sortedTimes.map((time) => {
    const pts = pointsByTime.get(time) ?? [];
    const total = pts.reduce((sum, point) => sum + point.count, 0);
    return total > 0
      ? pts.reduce((sum, point) => sum + point.latencyP95 * point.count, 0) / total
      : 0;
  });

  const errorRateByWindow = sortedTimes.map((time) => {
    const pts = pointsByTime.get(time) ?? [];
    const total = pts.reduce((sum, point) => sum + point.count, 0);
    const errors = pts.reduce((sum, point) => sum + point.status4xxCount + point.status5xxCount, 0);
    return total > 0 ? errors / total : 0;
  });

  const throughputByWindow = sortedTimes.map((time) => windowThroughputs.get(time) ?? 0);

  return {
    totalRequests,
    p95LatencyMs,
    errorRate,
    throughputPerSec,
    trends: {
      requests: computeTrend(requestByWindow),
      latency: computeTrend(latencyByWindow),
      errorRate: computeTrend(errorRateByWindow),
      throughput: computeTrend(throughputByWindow),
    },
  };
}
