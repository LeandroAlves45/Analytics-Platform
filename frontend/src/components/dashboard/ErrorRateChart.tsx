/**
 * Gráfico de error rate (%) ao longo do tempo.
 * Agrega 4xx+5xx / count por janela temporal.
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
import { formatAxisTime, formatErrorRate } from '@/lib/formatters';
import { QueryErrorPanel } from './QueryErrorPanel';
import type { AggregatedMetricPoint } from '@/types/metrics';

const ERROR_RATE_COLOR = '#f97a4a';

interface ErrorRatePoint {
  time: string;
  rate: number;
}

function buildChartData(series: AggregatedMetricPoint[]): ErrorRatePoint[] {
  const byTime = new Map<string, AggregatedMetricPoint[]>();

  for (const point of series) {
    const arr = byTime.get(point.time) ?? [];
    arr.push(point);
    byTime.set(point.time, arr);
  }

  return Array.from(byTime.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, points]) => {
      const total = points.reduce((sum, point) => sum + point.count, 0);
      const errors = points.reduce(
        (sum, point) => sum + point.status4xxCount + point.status5xxCount,
        0
      );
      const rate = total > 0 ? errors / total : 0;
      return { time, rate: Math.round(rate * 1000) / 10 };
    });
}

interface ErrorRateTooltipProps extends TooltipProps<number, string> {
  interval: '5m' | '1h' | '1d';
}

function ErrorRateTooltip({ active, payload, label, interval }: ErrorRateTooltipProps) {
  if (!active || !payload?.length) return null;

  const rate = typeof payload[0]?.value === 'number' ? payload[0].value / 100 : 0;

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
        {label ? formatAxisTime(label, interval) : ''}
      </p>
      <span
        style={{
          color: ERROR_RATE_COLOR,
          fontFamily: 'DM Mono, monospace',
          fontSize: '11px',
        }}
      >
        {formatErrorRate(rate)}
      </span>
    </div>
  );
}

export function ErrorRateChart() {
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
        <CardTitle>Error rate over time</CardTitle>
      </CardHeader>

      <CardContent className="px-2 pb-3 pt-3">
        {isError && (
          <QueryErrorPanel
            message={error?.message ?? 'Erro ao carregar error rate'}
            onRetry={() => void refetch()}
          />
        )}

        {!isError && isLoading && (
          <div className="h-[120px] rounded bg-surface-card-hover animate-pulse" aria-hidden />
        )}

        {!isError && !isLoading && !hasData && (
          <div className="h-[120px] flex items-center justify-center">
            <p className="text-xs text-meta">Sem dados no período seleccionado</p>
          </div>
        )}

        {!isError && !isLoading && hasData && (
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="grad-error-rate" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={ERROR_RATE_COLOR} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={ERROR_RATE_COLOR} stopOpacity={0} />
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
                tickFormatter={(v: number) => `${v}%`}
                width={40}
                domain={[0, 'auto']}
              />

              <Tooltip
                content={(props) => (
                  <ErrorRateTooltip
                    {...(props as TooltipProps<number, string>)}
                    interval={interval}
                  />
                )}
                cursor={{ stroke: 'rgba(255, 255, 255, 0.06)', strokeWidth: 1 }}
              />

              <Area
                type="monotone"
                dataKey="rate"
                name="Error rate"
                stroke={ERROR_RATE_COLOR}
                strokeWidth={1.5}
                fill="url(#grad-error-rate)"
                dot={false}
                activeDot={{ r: 3, fill: ERROR_RATE_COLOR, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
