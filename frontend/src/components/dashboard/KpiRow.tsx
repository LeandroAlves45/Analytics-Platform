/**
 * KpiRow lê o hook de métricas e deriva os 4 valores KPI para os cards.
 * Este componente é o único ponto de contacto entre os dados da API e os KPI cards.
 * KpiCard é puramente apresentacional e não sabe de onde vêm os dados.
 *
 * Arquitectura de derivação:
 *   A série da API tem N pontos por janela temporal (um por endpoint+method).
 *   Antes de calcular os KPIs globais, é necessário agregar correctamente
 *   para não contar o mesmo pedido múltiplas vezes.
 */

import { useAggregatedMetrics } from '@/hooks/useAggregatedMetrics';
import { KpiCard } from './KpiCard';
import {
  formatCount,
  formatErrorRate,
  formatThroughput,
  formatLatencyParts,
} from '@/lib/formatters';
import type { AggregatedMetricPoint } from '@/types/metrics';

/**
 * Tipos internos de derivação
 */

interface TrendResult {
  text: string;
  direction: 'up' | 'down' | 'neutral';
}

interface KpiSummary {
  totalRequests: number;
  p95LatencyMs: number;
  errorRate: number; // 0 a 1
  throughputPerSec: number;
  trends: {
    requests: TrendResult;
    latency: TrendResult;
    errorRate: TrendResult;
    throughput: TrendResult;
  };
}

/**
 * Funções de derivação (privadas ao módulo)
 */

/**
 * Compara a primeira metade vs segunda metade de um array de valores.
 * Retorna a direcção e a percentagem de variação.
 * Threshold de 1.5%: variações menores são consideradas "stable" para evitar
 * ruído visual em métricas que oscilam ligeiramente por natureza.
 */
function computeTrend(values: number[]): TrendResult {
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

/**
 * Deriva os 4 valores KPI a partir da série temporal.
 * A série pode ter múltiplos pontos por janela temporal (um por endpoint+method).
 */
function deriveKpis(series: AggregatedMetricPoint[]): KpiSummary {
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

  // Totais globais — necessários para médias ponderadas
  let totalRequests = 0;
  let weightedP95Sum = 0;
  let totalErrors = 0;

  // Mapa de janela temporal —> throughput acumulado nessa janela
  // Usado para somar throughput de múltiplos endpoints ao mesmo tempo.
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

  // P95 ponderado pelo count: endpoints com mais tráfego têm mais peso.
  const p95LatencyMs = totalRequests > 0 ? weightedP95Sum / totalRequests : 0;

  // Error rate real: erros totais / pedidos totais
  const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;

  // Throughput médio: média dos totais por janela temporal
  const throughputValues = Array.from(windowThroughputs.values());
  const throughputPerSec =
    throughputValues.length > 0
      ? throughputValues.reduce((sum, value) => sum + value, 0) / throughputValues.length
      : 0;

  // Ordena as janelas temporais para calcular tendências
  const sortedTimes = Array.from(windowThroughputs.keys()).sort();

  // Agrupa os pontos da série por janela temporal para calcular métricas por janela
  const pointsByTime = new Map<string, AggregatedMetricPoint[]>();
  for (const point of series) {
    const existing = pointsByTime.get(point.time) ?? [];
    existing.push(point);
    pointsByTime.set(point.time, existing);
  }

  // Métricas por janela para calcular tendências
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

/**
 * Componente principal
 */
export function KpiRow() {
  // isLoading: true apenas no primeiro fetch (sem dados em cache)
  // isFetching: true em cada polling cycle, mas dados já existem
  // → só mostrar skeleton no isLoading, não no isFetching
  const { data, isLoading } = useAggregatedMetrics();

  // Deriva os KPIs apenas se houver dados
  const kpis = data?.series ? deriveKpis(data.series) : null;

  // Latência seprada em valor + unidade para display visual hierárquico
  const latencyParts = kpis ? formatLatencyParts(kpis.p95LatencyMs) : { value: '-', unit: 'ms' };

  return (
    <div className="grid grid-cols-4 gap-[10px]" role="region" aria-label="Métricas resumo">
      {/* ── Requests ── */}
      <KpiCard
        label="Requests"
        value={kpis ? formatCount(kpis.totalRequests) : '—'}
        accent="purple"
        isLoading={isLoading}
        delta={kpis ? { ...kpis.trends.requests, isPositiveWhenUp: true } : undefined}
      />

      {/* ── P95 Latency — única com unidade separada para hierarquia visual ── */}
      <KpiCard
        label="P95 Latency"
        value={latencyParts.value}
        unit={latencyParts.unit}
        accent="blue"
        isLoading={isLoading}
        delta={kpis ? { ...kpis.trends.latency, isPositiveWhenUp: false } : undefined}
      />

      {/* ── Error Rate ── */}
      <KpiCard
        label="Error Rate"
        value={kpis ? formatErrorRate(kpis.errorRate) : '—'}
        accent="orange"
        isLoading={isLoading}
        delta={kpis ? { ...kpis.trends.errorRate, isPositiveWhenUp: false } : undefined}
      />

      {/* ── Throughput ── */}
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
