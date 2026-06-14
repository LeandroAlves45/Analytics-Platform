/**
 * Tabela de endpoints activos com latência P95, contagem e barra relativa.
 *
 * Fonte de dados: useAggregatedMetrics, a série já contém dados por endpoint.
 * Derivar aqui evita um segundo pedido HTTP e mantém a tabela sincronizada
 * com o período e filtros activos no Zustand store.
 *
 * Ordenação: P95 descendente, os endpoints mais lentos aparecem primeiro.
 * Isto é intencional: num dashboard de observabilidade, o utilizador quer
 * ver rapidamente o que está a causar degradação de performance.
 */

import type { CSSProperties } from 'react';
import { useAggregatedMetrics } from '@/hooks/useAggregatedMetrics';
import { Badge } from '@/components/ui/badge';
import { formatLatency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { AggregatedMetricPoint } from '@/types/metrics';

/**
 * Tipos internos
 */
interface EndpointRow {
  endpoint: string;
  method: string;
  p95: number;
  count: number;
  errorRate: number;
}

// Variantes do Badge definidas
type MethodBadgeVariant = 'get' | 'post' | 'put' | 'delete';

/**
 * Funções de derivação
 */

/**
 * Mapeamento de método HTTP para variante do Badge.
 * PATCH usa o mesmo estilo visual que PUT (modificação de recurso).
 * Métodos não reconhecidos fazem fallback para 'get' (cor menos agressiva).
 */
const METHOD_BADGE: Record<string, MethodBadgeVariant> = {
  GET: 'get',
  POST: 'post',
  PUT: 'put',
  PATCH: 'put',
  DELETE: 'delete',
};

function getMethodVariant(method: string): MethodBadgeVariant {
  return METHOD_BADGE[method.toUpperCase()] ?? 'get';
}

/**
 * Agrega a série da API em rows por endpoint+method.
 * Cada row tem a latência P95 ponderada pelo count de cada janela temporal
 * — endpoints com mais tráfego têm mais peso no P95 agregado.
 * Retorna no máximo 8 rows (matches "8 active" badge no mockup).
 */
function buildEndpointRows(series: AggregatedMetricPoint[]): EndpointRow[] {
  // Agrupa pontos por chave única endpoint+method
  const byKey = new Map<string, AggregatedMetricPoint[]>();
  for (const point of series) {
    const key = `${point.method}::${point.endpoint}`;
    const arr = byKey.get(key) ?? [];
    arr.push(point);
    byKey.set(key, arr);
  }

  // Deriva a summary por endpoint
  const rows: EndpointRow[] = [];

  for (const [, points] of byKey) {
    const count = points.reduce((sum, p) => sum + p.count, 0);
    const errors = points.reduce((sum, p) => sum + p.status4xxCount + p.status5xxCount, 0);

    // P95 ponderado: soma(P95 * count) / soma(count)
    const p95 =
      count > 0
        ? Math.round(points.reduce((sum, p) => sum + p.latencyP95 * p.count, 0) / count)
        : 0;

    rows.push({
      endpoint: points[0].endpoint,
      method: points[0].method,
      p95,
      count,
      errorRate: count > 0 ? errors / count : 0,
    });
  }

  // Ordena por P95 descendente -> endpoints mais lentos primeiro
  return rows.sort((a, b) => b.p95 - a.p95).slice(0, 8);
}

/**
 * Estilo inline da barra de latência relativa.
 * A largura é proporcional ao P95 do endpoint em relação ao máximo da lista.
 */
function getBarFillStyle(p95: number, maxP95: number): CSSProperties {
  const pct = maxP95 > 0 ? (p95 / maxP95) * 100 : 0;
  const isSlow = pct > 66;

  return {
    width: `${pct}%`,
    height: '100%',
    borderRadius: '2px',
    background: isSlow
      ? 'linear-gradient(90deg, #9b7fe8, #f97a4a)' // purple → orange (lento)
      : 'linear-gradient(90deg, #9b7fe8, #5bbcf7)', // purple → blue (normal)
    transition: 'width 0.4s ease',
  };
}

/**
 * Componente principal
 */
export function EndpointsTable() {
  const { data, isLoading } = useAggregatedMetrics();

  const rows = data?.series ? buildEndpointRows(data.series) : [];
  // rows[0].p95 é o máximo porque a lista está ordenada por P95 desc
  const maxP95 = rows.length > 0 ? rows[0].p95 : 0;
  const hasData = rows.length > 0;

  return (
    <div className="rounded-card border border-border-default bg-surface-card p-[14px] flex flex-col gap-3">
      {/* ── Cabeçalho do painel ── */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-[#c8c6d8]">Top endpoints</h2>
        {hasData && <Badge variant="count">{rows.length} active</Badge>}
      </div>

      {/* ── Skeleton de primeiro carregamento ── */}
      {isLoading && (
        <div className="flex flex-col gap-3" aria-hidden="true">
          {[44, 56, 32, 68].map((w) => (
            <div key={w} className="flex items-center gap-2">
              <div className="h-4 w-8   rounded-badge bg-surface-card-hover animate-pulse" />
              <div
                className="h-3 flex-1 rounded      bg-surface-card-hover animate-pulse"
                style={{ width: `${w}%` }}
              />
              <div className="h-3 w-10  rounded      bg-surface-card-hover animate-pulse" />
              <div className="h-[3px] w-11 rounded   bg-surface-card-hover animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {/* ── Estado sem dados ── */}
      {!isLoading && !hasData && (
        <div className="flex items-center justify-center h-24">
          <p className="text-xs text-meta">Sem endpoints no período seleccionado</p>
        </div>
      )}

      {/* ── Linhas da tabela ── */}
      {!isLoading && hasData && (
        <div className="flex flex-col">
          {rows.map((row, idx) => (
            <div
              key={`${row.method}::${row.endpoint}`}
              className={cn(
                'flex items-center gap-2 py-[6px]',
                // Divisor subtil entre linhas — não na última linha
                idx < rows.length - 1 && 'border-b border-border-subtle'
              )}
            >
              {/* Method badge com cor semântica */}
              <Badge variant={getMethodVariant(row.method)}>{row.method}</Badge>

              {/* Path em DM Mono — truncado com ellipsis se muito longo */}
              <span
                className="font-mono text-[10px] text-label flex-1 truncate min-w-0"
                title={row.endpoint} // tooltip com path completo ao hover
              >
                {row.endpoint}
              </span>

              {/* Indicador de error rate — ponto vermelho se > 5% */}
              {row.errorRate > 0.05 && (
                <span
                  className="block w-1.5 h-1.5 rounded-full bg-danger shrink-0"
                  title={`Error rate: ${(row.errorRate * 100).toFixed(1)}%`}
                  aria-label={`Error rate elevado: ${(row.errorRate * 100).toFixed(1)}%`}
                />
              )}

              {/* Latência P95 em DM Mono — largura fixa para alinhamento */}
              <span className="font-mono text-[10px] text-meta shrink-0 w-[42px] text-right">
                {formatLatency(row.p95)}
              </span>

              {/* Barra de latência relativa */}
              {/* Container: fundo muito subtil, overflow hidden para o fill */}
              <div
                className="shrink-0"
                style={{
                  width: '44px',
                  height: '3px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  borderRadius: '2px',
                  overflow: 'hidden',
                }}
                aria-hidden="true"
              >
                <div style={getBarFillStyle(row.p95, maxP95)} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
