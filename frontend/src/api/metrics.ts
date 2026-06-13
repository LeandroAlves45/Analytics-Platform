/**
 * Funções de pedido HTTP para o domínio de métricas.
 * Estas funções são chamadas exclusivamente pelos hooks React Query.
 */

import apiClient from './client';
import type {
  AggregatedMetricsResponse,
  ActiveEndpointsResponse,
  MetricsQueryParams,
} from '@/types/metrics';

/**
 * Pede a série temporal agregada ao backend.
 * Corresponde a GET /api/metrics/aggregated
 * Os parâmetros são passados como query string pelo Axios automaticamente.
 *
 * ! Nota: o backend valida que from < to com Zod.
 * ! Se from >= to, retorna 422 com code: "VALIDATION_ERROR".
 * ! O interceptor em client.ts normaliza esse erro.
 */
export async function fetchAggregatedMetrics(
  params: MetricsQueryParams
): Promise<AggregatedMetricsResponse> {
  const response = await apiClient.get<{ data: AggregatedMetricsResponse }>(
    '/api/metrics/aggregated',
    { params }
  );
  // Backend envolve sempre a resposta em { data: ... }
  return response.data.data;
}

/**
 * Pede a lista de endpoints activos no workspace.
 * Corresponde a GET /api/endpoints
 * minutes: lookback em minutos — default 1440 (24h), max 10080 (7 dias)
 */
export async function fetchActiveEndpoints(
  minutes: number = 1440
): Promise<ActiveEndpointsResponse> {
  const response = await apiClient.get<{ data: ActiveEndpointsResponse }>('/api/endpoints', {
    params: { minutes },
  });
  // Backend envolve sempre a resposta em { data: ... }
  return response.data.data;
}
