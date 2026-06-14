/**
 * Gráfico de latência ao longo do tempo — três séries: p50, p95, p99.
 * Utiliza AreaChart do Recharts com:
 *   - Area fill com gradiente subtil sob p50 e p95
 *   - p99 como linha fina sem fill (mais ruidosa, menos destaque visual)
 *   - Tooltip customizado em DM Mono
 *   - Grid horizontal apenas, opacidade 4%
 *
 * Os dados são agrupados por janela temporal antes de renderizar.
 * A série da API tem múltiplos pontos por janela (um por endpoint+method),
 * pelo que é necessário calcular médias ponderadas antes de plotar.
 */

import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  type TooltipProps,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAggregatedMetrics } from '@/hooks/useAggregatedMetrics';
import { useDashboardStore } from '@/stores/dashboardStore';
import { formatAxisTime } from '@/lib/formatters';
import { QueryErrorPanel } from './QueryErrorPanel';
import type { AggregatedMetricPoint, AggregationInterval } from '@/types/metrics';

/**
 * Cores das séries -> valores hex do design system
 */
const COLORS = {
  p50: '#9b7fe8',
  p95: '#5bbcf7',
  p99: '#f97a4a',
} as const;

/**
 * Shape do ponto de dados após transformação de dados
 */
interface ChartPoint {
  time: string;
  p50: number;
  p95: number;
  p99: number;
}

/**
 * Agrupa a série por janela temporal e calcula médias ponderadas.
 * Média ponderada pelo count: endponts com mais tráfego têm mais peso
 * no valor agregado, o que representa melhor a experiência real do utilizador.
 */
function buildChartData(series: AggregatedMetricPoint[]): ChartPoint[] {
  // Primeira passagem: agrupar pontos pelo campo time
  const byTime = new Map<string, AggregatedMetricPoint[]>();
  for (const point of series) {
    const arr = byTime.get(point.time) ?? [];
    arr.push(point);
    byTime.set(point.time, arr);
  }

  // Segunda passagem: calcular médias ponderadas e ordenar cronologicamente
  return Array.from(byTime.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, points]) => {
      const total = points.reduce((sum, point) => sum + point.count, 0);

      // wavg: média ponderada de uma propriedade numérica de latência
      const wavg = (get: (point: AggregatedMetricPoint) => number): number =>
        total > 0
          ? Math.round(points.reduce((sum, point) => sum + get(point) * point.count, 0) / total)
          : 0;

      return {
        time,
        p50: wavg((p) => p.latencyP50),
        p95: wavg((p) => p.latencyP95),
        p99: wavg((p) => p.latencyP99),
      };
    });
}

/**
 * Tooltip customizado para o gráfico de latência
 * Recebe o interval via closure no componente pai para formatar o label de tempo.
 */
interface LatencyTooltipProps extends TooltipProps<number, string> {
  interval: AggregationInterval;
}

function LatencyTooltip({ active, payload, label, interval }: LatencyTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div
      style={{
        background: '#1e1e26',
        border: '1px solid rgba(255, 255, 255, 0.10)',
        borderRadius: '8px',
        padding: '8px 12px',
        minWidth: '130px',
      }}
    >
      {/* Label de tempo formatado consoante o intervalo */}
      <p
        style={{
          color: '#5a576a',
          fontSize: '10px',
          fontFamily: 'DM Sans, sans-serif',
          marginBottom: '6px',
        }}
      >
        {label ? formatAxisTime(label, interval) : ''}
      </p>

      {/* Uma linha por série com cor e valor em ms */}
      {payload.map((entry) => (
        <div
          key={String(entry.dataKey)}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '16px',
            marginBottom: '2px',
            fontFamily: 'DM Mono, monospace',
            fontSize: '11px',
          }}
        >
          <span style={{ color: '#8b8899' }}>{entry.name}</span>
          <span style={{ color: String(entry.color) }}>
            {typeof entry.value === 'number' ? entry.value : 0}ms
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Dot da legenda -> quadrado pequeno com a cor da série
 */
function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '2px',
          backgroundColor: color,
          display: 'block',
          flexShrink: 0,
        }}
        aria-hidden
      />
      <span className="text-[10px] text-meta font-sans">{label}</span>
    </div>
  );
}

export function LatencyChart() {
  const { data, isLoading, isError, error, refetch } = useAggregatedMetrics();
  const { interval } = useDashboardStore();

  const chartData = useMemo(
    () => (data?.series ? buildChartData(data.series) : []),
    [data?.series]
  );
  const hasData = chartData.length > 0;

  return (
    <Card>
      <CardHeader className="px-[14px] pt-[14px] pb-0">
        <div className="flex items-center justify-between">
          <CardTitle>Latency over time</CardTitle>
          {/* Legenda inline — identifica cada série pelo cor */}
          <div className="flex items-center gap-2.5">
            <LegendDot color={COLORS.p50} label="p50" />
            <LegendDot color={COLORS.p95} label="p95" />
            <LegendDot color={COLORS.p99} label="p99" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-2 pb-3 pt-3">
        {isError && (
          <QueryErrorPanel
            message={error?.message ?? 'Erro ao carregar latência'}
            onRetry={() => void refetch()}
          />
        )}

        {!isError && isLoading && (
          // Skeleton apenas no primeiro fetch — polling não mostra skeleton
          <div className="h-[160px] rounded bg-surface-card-hover animate-pulse" aria-hidden />
        )}

        {!isError && !isLoading && !hasData && (
          <div className="h-[160px] flex items-center justify-center">
            <p className="text-xs text-meta">Sem dados no período seleccionado</p>
          </div>
        )}

        {!isError && !isLoading && hasData && (
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <defs>
                {/* Gradiente de fill sob a linha p50 — roxo, muito subtil */}
                <linearGradient id="grad-latency-p50" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.p50} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={COLORS.p50} stopOpacity={0} />
                </linearGradient>

                {/* Gradiente de fill sob a linha p95 — azul, ainda mais subtil */}
                <linearGradient id="grad-latency-p95" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.p95} stopOpacity={0.12} />
                  <stop offset="95%" stopColor={COLORS.p95} stopOpacity={0} />
                </linearGradient>
              </defs>

              {/* Grid horizontal apenas — vertical aumenta ruído visual */}
              <CartesianGrid horizontal vertical={false} stroke="rgba(255, 255, 255, 0.04)" />

              <XAxis
                dataKey="time"
                tickFormatter={(v: string) => formatAxisTime(v, interval)}
                tick={{ fill: '#5a576a', fontSize: 10, fontFamily: 'DM Sans, sans-serif' }}
                tickLine={false}
                axisLine={false}
                // preserveStartEnd: mostra sempre o primeiro e último tick,
                // distribui os restantes uniformemente sem sobreposição
                interval="preserveStartEnd"
              />

              <YAxis
                tick={{ fill: '#5a576a', fontSize: 10, fontFamily: 'DM Mono, monospace' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${v}ms`}
                // width fixo evita que o eixo Y "salte" quando os valores mudam
                width={44}
                domain={['auto', 'auto']}
              />

              <Tooltip
                // Closure para passar o interval ao tooltip sem prop drilling via Recharts
                content={(props) => (
                  <LatencyTooltip
                    {...(props as TooltipProps<number, string>)}
                    interval={interval}
                  />
                )}
                cursor={{ stroke: 'rgba(255, 255, 255, 0.06)', strokeWidth: 1 }}
              />

              {/* p99 — sem fill, linha fina e semi-transparente.
                  Renderizado primeiro para ficar "atrás" das outras séries. */}
              <Area
                type="monotone"
                dataKey="p99"
                name="p99"
                stroke={COLORS.p99}
                strokeWidth={1}
                fill="none"
                dot={false}
                activeDot={{ r: 3, fill: COLORS.p99, strokeWidth: 0 }}
                opacity={0.7}
              />

              {/* p95 — fill com gradiente subtil */}
              <Area
                type="monotone"
                dataKey="p95"
                name="p95"
                stroke={COLORS.p95}
                strokeWidth={1.5}
                fill="url(#grad-latency-p95)"
                dot={false}
                activeDot={{ r: 3, fill: COLORS.p95, strokeWidth: 0 }}
              />

              {/* p50 — série principal, fill mais visível */}
              <Area
                type="monotone"
                dataKey="p50"
                name="p50"
                stroke={COLORS.p50}
                strokeWidth={1.5}
                fill="url(#grad-latency-p50)"
                dot={false}
                activeDot={{ r: 3, fill: COLORS.p50, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
