/**
 * Hook React Query para a série temporal de métricas agregadas.
 * Encapsula o pedido GET /api/metrics/aggregated com polling automático.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { fetchAggregatedMetrics } from '@/api/metrics';
import { computeMetricsWindow } from '@/lib/metrics-window';
import { useDashboardStore } from '@/stores/dashboardStore';
import type { AggregatedMetricsResponse } from '@/types/metrics';

export const AGGREGATED_METRICS_KEY = 'aggregatedMetrics';

function shouldRetryMetricsQuery(failureCount: number, error: Error): boolean {
  const status = (error as Error & { status?: number }).status;
  if (status === 422) {
    return false;
  }
  return failureCount < 2;
}

export function useAggregatedMetrics(): UseQueryResult<AggregatedMetricsResponse, Error> {
  const { interval, selectedEndpoint, selectedMethod } = useDashboardStore();

  return useQuery({
    queryKey: [AGGREGATED_METRICS_KEY, interval, selectedEndpoint, selectedMethod],
    queryFn: (): Promise<AggregatedMetricsResponse> => {
      const { from, to } = computeMetricsWindow(interval);
      return fetchAggregatedMetrics({
        interval,
        from,
        to,
        endpoint: selectedEndpoint,
        method: selectedMethod,
      });
    },
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
    staleTime: 0,
    retry: shouldRetryMetricsQuery,
  });
}
