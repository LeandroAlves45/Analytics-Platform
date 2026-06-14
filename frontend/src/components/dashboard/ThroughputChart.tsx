/**
 * Gráfico de throughput (req/s) ao longo do tempo.
 * Série única com fill gradiente azul — sem legenda (é a única série).
 *
 * O throughput por janela é a soma de throughputPerSec de todos os endpoints
 * ativos nessa janela. Representa o volume total de tráfego no sistema.
 */

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
import { formatAxisTime, formatThroughput } from '@/lib/formatters';
import type { AggregatedMetricPoint } from '@/types/metrics';

// Cor da série
const THROUGHPUT_COLOR = '#5bbcf7';

interface ThroughputPoint {
  time: string;
  rps: number; // req/s total da janela
}

/**
 * Agrega o throughput de todos os endpoints por janela temporal.
 * A soma representa o volume total de tráfego no sistema naquele momento.
 */
function buildChartData(series: AggregatedMetricPoint[]): ThroughputPoint[] {
  const byTime = new Map<string, number>();
  for (const point of series) {
    byTime.set(point.time, (byTime.get(point.time) ?? 0) + point.throughputPerSec);
  }

  return (
    Array.from(byTime.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      // Arredonda a 2 casas decimais para evitar precisão excessiva no tooltip
      .map(([time, rps]) => ({ time, rps: Math.round(rps * 100) / 100 }))
  );
}

/**
 * Tooltip customizado para throughput
 */
function ThroughputTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;

  const rps = typeof payload[0]?.value === 'number' ? payload[0].value : 0;

  return (
    <div
      style={{
        background: '#1e1e26',
        border: '1px solid rgba(255, 255, 255, 0.10)',
        borderRadius: '8px',
        padding: '6px 10px',
      }}
    >
      <p
        style={{
          color: '#5a576a',
          fontSize: '10px',
          fontFamily: 'DM Sans, sans-serif',
          marginBottom: '4px',
        }}
      >
        {label ?? ''}
      </p>
      <span
        style={{
          color: THROUGHPUT_COLOR,
          fontFamily: 'DM Mono, monospace',
          fontSize: '11px',
        }}
      >
        {formatThroughput(rps)}
      </span>
    </div>
  );
}

export function ThroughputChart() {
  const { data, isLoading } = useAggregatedMetrics();
  const { interval } = useDashboardStore();

  const chartData = data?.series ? buildChartData(data.series) : [];
  const hasData = chartData.length > 0;

  return (
    <Card>
      <CardHeader className="px-[14px] pt-[14px] pb-0">
        <CardTitle>Throughput (req/s)</CardTitle>
      </CardHeader>

      <CardContent className="px-2 pb-3 pt-3">
        {isLoading && (
          <div className="h-[120px] rounded bg-surface-card-hover animate-pulse" aria-hidden />
        )}

        {!isLoading && !hasData && (
          <div className="h-[120px] flex items-center justify-center">
            <p className="text-xs text-meta">Sem dados no período seleccionado</p>
          </div>
        )}

        {!isLoading && hasData && (
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <defs>
                {/* Gradiente de fill azul com fade para transparente */}
                <linearGradient id="grad-throughput" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={THROUGHPUT_COLOR} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={THROUGHPUT_COLOR} stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid horizontal vertical={false} stroke="rgba(255, 255, 255, 0.04)" />

              <XAxis
                dataKey="time"
                tickFormatter={(v: string) => formatAxisTime(v, interval)}
                tick={{ fill: '#5a576a', fontSize: 10, fontFamily: 'DM Sans, sans-serif' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />

              <YAxis
                tick={{ fill: '#5a576a', fontSize: 10, fontFamily: 'DM Mono, monospace' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => formatThroughput(v)}
                width={46}
                domain={['auto', 'auto']}
              />

              <Tooltip
                content={(props) => (
                  <ThroughputTooltip {...(props as TooltipProps<number, string>)} />
                )}
                cursor={{ stroke: 'rgba(255, 255, 255, 0.06)', strokeWidth: 1 }}
              />

              <Area
                type="monotone"
                dataKey="rps"
                name="Throughput"
                stroke={THROUGHPUT_COLOR}
                strokeWidth={1.5}
                fill="url(#grad-throughput)"
                dot={false}
                activeDot={{ r: 3, fill: THROUGHPUT_COLOR, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
