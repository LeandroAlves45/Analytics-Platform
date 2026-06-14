/**
 * KpiRow lê o hook de métricas e deriva os 4 valores KPI para os cards.
 */

import { useMemo } from 'react';
import { useAggregatedMetrics } from '@/hooks/useAggregatedMetrics';
import { deriveKpis } from '@/lib/kpi-derivation';
import {
  formatCount,
  formatErrorRate,
  formatThroughput,
  formatLatencyParts,
} from '@/lib/formatters';
import { QueryErrorPanel } from './QueryErrorPanel';
import { KpiCard } from './KpiCard';

export function KpiRow() {
  const { data, isLoading, isError, error, refetch } = useAggregatedMetrics();

  const kpis = useMemo(() => (data?.series ? deriveKpis(data.series) : null), [data?.series]);

  const latencyParts = kpis ? formatLatencyParts(kpis.p95LatencyMs) : { value: '-', unit: 'ms' };

  if (isError) {
    return (
      <div className="rounded-card border border-border-default bg-surface-card" role="region">
        <QueryErrorPanel
          message={error?.message ?? 'Erro ao carregar métricas'}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-[10px]"
      role="region"
      aria-label="Métricas resumo"
    >
      <KpiCard
        label="Requests"
        value={kpis ? formatCount(kpis.totalRequests) : '—'}
        accent="purple"
        isLoading={isLoading}
        delta={kpis ? { ...kpis.trends.requests, isPositiveWhenUp: true } : undefined}
      />

      <KpiCard
        label="P95 Latency"
        value={latencyParts.value}
        unit={latencyParts.unit}
        accent="blue"
        isLoading={isLoading}
        delta={kpis ? { ...kpis.trends.latency, isPositiveWhenUp: false } : undefined}
      />

      <KpiCard
        label="Error Rate"
        value={kpis ? formatErrorRate(kpis.errorRate) : '—'}
        accent="orange"
        isLoading={isLoading}
        delta={kpis ? { ...kpis.trends.errorRate, isPositiveWhenUp: false } : undefined}
      />

      <KpiCard
        label="Throughput"
        value={kpis ? formatThroughput(kpis.throughputPerSec) : '—'}
        accent="green"
        isLoading={isLoading}
        delta={kpis ? { ...kpis.trends.throughput, isPositiveWhenUp: true } : undefined}
      />
    </div>
  );
}
