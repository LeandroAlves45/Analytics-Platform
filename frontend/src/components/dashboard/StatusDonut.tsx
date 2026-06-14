/**
 * Gráfico donut de distribuição de status HTTP.
 * Mostra a proporção de respostas 2xx / 4xx / 5xx no período seleccionado.
 *
 * Decisão de design: a legenda é renderizada manualmente (não via Recharts Legend)
 * para ter controlo total sobre o layout e a tipografia.
 * O label central em DM Mono mostra a percentagem de sucesso (2xx) — a métrica
 * mais relevante para uma vista rápida de saúde do sistema.
 */

import { PieChart, Pie, Cell, Label, Tooltip, type TooltipProps } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAggregatedMetrics } from '@/hooks/useAggregatedMetrics';
import type { AggregatedMetricPoint } from '@/types/metrics';

const STATUS_COLORS = {
  '2xx': '#3dd68c',
  '4xx': '#f97a4a',
  '5xx': '#ff6464',
} as const;

interface StatusSegment {
  name: '2xx' | '4xx' | '5xx';
  value: number; // contagem absoluta
  color: string;
  pct: string; // "96.1%" — sempre presente mesmo se 0%
}

/**
 * Agrega todas as séries numa lista de três segmentos.
 * Inclui sempre os três segmentos (mesmo com value: 0) para a legenda
 * ser consistente independentemente do estado do sistema.
 */
function buildStatusData(series: AggregatedMetricPoint[]): StatusSegment[] {
  const total2xx = series.reduce((sum, point) => sum + point.status2xxCount, 0);
  const total4xx = series.reduce((sum, point) => sum + point.status4xxCount, 0);
  const total5xx = series.reduce((sum, point) => sum + point.status5xxCount, 0);
  const total = total2xx + total4xx + total5xx;

  // Formata percentagem com 1 decimal, 0.0% quando sem dados
  const fmt = (n: number): string => (total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '0.0%');

  return [
    { name: '2xx', value: total2xx, color: STATUS_COLORS['2xx'], pct: fmt(total2xx) },
    { name: '4xx', value: total4xx, color: STATUS_COLORS['4xx'], pct: fmt(total4xx) },
    { name: '5xx', value: total5xx, color: STATUS_COLORS['5xx'], pct: fmt(total5xx) },
  ];
}
/**
 * Tooltip do donut -> aparece ao fazer hover num segmento
 */
function DonutTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;

  const entry = payload[0];
  const color = (entry.payload as StatusSegment)?.color ?? '#fff';

  return (
    <div
      style={{
        background: '#1e1e26',
        border: '1px solid rgba(255, 255, 255, 0.10)',
        borderRadius: '8px',
        padding: '6px 10px',
        fontFamily: 'DM Mono, monospace',
        fontSize: '11px',
        color,
      }}
    >
      {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString() : '0'} req
    </div>
  );
}

export function StatusDonut() {
  const { data, isLoading } = useAggregatedMetrics();

  // Segmentos sempre presentes para a legenda ser consistente
  const allSegments = data?.series ? buildStatusData(data.series) : buildStatusData([]);

  // Para o gráfico donut,  filtramos os segmentos com value: 0
  const hasData = (data?.series?.length ?? 0) > 0;
  const donutData = hasData
    ? allSegments.filter((s) => s.value > 0)
    : // Estado sem dados: segmento único cinzento para o donut não ficar vazio
      [{ name: '2xx' as const, value: 1, color: '#2a2a35', pct: '0.0%' }];

  // Percentagem 2xx para o label central
  const pct2xx = allSegments[0].pct;

  return (
    <Card>
      <CardHeader className="px-[14px] pt-[14px] pb-0">
        <CardTitle>Status distribution</CardTitle>
      </CardHeader>

      <CardContent className="px-[14px] pb-[14px] pt-3">
        {isLoading ? (
          <div className="h-[140px] rounded bg-surface-card-hover animate-pulse" aria-hidden />
        ) : (
          // Layout flex: donut à esquerda, legenda à direita
          <div className="flex items-center justify-center gap-5 h-[140px]">
            {/* Donut com dimensões fixas — PieChart exige width/height explícitos */}
            <div style={{ width: 110, height: 110, flexShrink: 0 }}>
              <PieChart width={110} height={110}>
                <Pie
                  data={donutData}
                  cx={55}
                  cy={55}
                  innerRadius={36}
                  outerRadius={50}
                  // Começa no topo (90°) e vai no sentido horário
                  startAngle={90}
                  endAngle={-270}
                  dataKey="value"
                  paddingAngle={hasData && donutData.length > 1 ? 2 : 0}
                  strokeWidth={0}
                >
                  {donutData.map((seg) => (
                    <Cell key={seg.name} fill={seg.color} />
                  ))}

                  {/* Label central: percentagem 2xx + rótulo "2xx" */}
                  <Label
                    position="center"
                    content={({ viewBox }) => {
                      // Recharts passa viewBox como PolarViewBox para Pie
                      const { cx = 55, cy = 55 } = (viewBox ?? {}) as {
                        cx?: number;
                        cy?: number;
                      };
                      return (
                        <g>
                          <text
                            x={cx}
                            y={cy - 5}
                            textAnchor="middle"
                            fill="#e8e6f0"
                            fontSize={13}
                            fontWeight={600}
                            fontFamily="DM Mono, monospace"
                          >
                            {hasData ? pct2xx : '—'}
                          </text>
                          <text
                            x={cx}
                            y={cy + 10}
                            textAnchor="middle"
                            fill="#5a576a"
                            fontSize={9}
                            fontFamily="DM Sans, sans-serif"
                          >
                            2xx
                          </text>
                        </g>
                      );
                    }}
                  />
                </Pie>

                {hasData && (
                  <Tooltip
                    content={(props) => (
                      <DonutTooltip {...(props as TooltipProps<number, string>)} />
                    )}
                  />
                )}
              </PieChart>
            </div>

            {/* Legenda manual — mostra sempre os três segmentos */}
            <div className="flex flex-col gap-2.5">
              {allSegments.map((seg) => (
                <div key={seg.name} className="flex items-center gap-2">
                  {/* Swatch colorido */}
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '2px',
                      background: seg.color,
                      display: 'block',
                      flexShrink: 0,
                    }}
                    aria-hidden
                  />
                  {/* Nome do segmento em DM Sans */}
                  <span className="text-[11px] text-label w-7 font-sans">{seg.name}</span>
                  {/* Percentagem em DM Mono, alinhada à direita */}
                  <span className="font-mono text-[11px] text-copy min-w-[40px] text-right">
                    {seg.pct}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
