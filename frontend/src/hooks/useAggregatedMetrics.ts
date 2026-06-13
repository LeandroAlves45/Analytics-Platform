/**
 * Hook React Query para a série temporal de métricas agregadas.
 * Encapsula o pedido GET /api/metrics/aggregated com polling automático.
 *
 * React Query não é apenas um "fetch wrapper". Gere:
 * - Cache: o resultado é guardado em memória e partilhado entre componentes
 * - Stale time: durante quanto tempo o dado é considerado fresco
 * - Refetch: quando refazer o pedido (polling, focus, reconnect)
 * - Estados: isLoading, isFetching, isError, data — prontos a usar
 *
 * O queryKey é o identificador do cache. Quando qualquer valor muda
 * (interval, from, to, endpoint, method), o React Query considera
 * que é um pedido diferente e faz um novo fetch.
 */

import { useQuery } from '@tanstack/react-query';
import { fetchAggregatedMetrics } from '@/api/metrics';
import { useDashboardStore } from '@/stores/dashboardStore';
import type { AggregatedMetricsResponse } from '@/types/metrics';

/**
 * Chave de cache -> exportada para permitir invalidação manual noutros contextos.
 */
export const AGGREGATED_METRICS_KEY = 'aggregatedMetrics';

export function useAggregatedMetrics() {
  // Lê os filtros do store Zustand
  // Quando qualquer filtro muda, este componente re-renderiza,
  // o queryKey muda, e o React Query faz um novo pedido
  const { interval, from, to, selectedEndpoint, selectedMethod, refreshTo } = useDashboardStore();

  return useQuery<AggregatedMetricsResponse, Error>({
    queryKey: [AGGREGATED_METRICS_KEY, interval, from, to, selectedEndpoint, selectedMethod],

    // queryFn: a função que faz o pedido ao backend
    queryFn: async () => {
      // Atualiza o "to" para o momento atual antes de fazer o pedido
      refreshTo();

      return fetchAggregatedMetrics({
        interval,
        from,
        to: new Date().toISOString(),
        endpoints: selectedEndpoint,
        method: selectedMethod,
      });
    },

    // Polling: refaz o pedido a cada 10 segundos.
    refetchInterval: 10_000,

    // Refaz o pedido quando o utilizador volta ao tab/janela do dashboard
    refetchOnWindowFocus: true,

    // staleTime: 0 -> os dados são considerados stale imediatamente (desatualizados)
    staleTime: 0,

    // Não retenta em caso de erro de validação (422) -> é um erro do cliente
    retry: (failureCount, error) => {
      const apiError = error as Error & { status?: number };

      if (apiError.status === 422) return false;

      return failureCount < 2;
    },
  });
}
