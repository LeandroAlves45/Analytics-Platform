/**
 * Hook React Query para a lista de endpoints activos.
 * Corresponde a GET /api/endpoints
 *
 * Este hook tem comportamento diferente do useAggregatedMetrics:
 * - Polling mais lento: 60 segundos (a lista de endpoints muda raramente)
 * - staleTime mais alto: 30 segundos (dados considerados frescos por mais tempo)
 * - Sem filtros de endpoint/método (lista todos os endpoints activos)
 *
 * É usado pelo componente de filtros para popular o Select de endpoints,
 * e pela tabela de endpoints activos no dashboard.
 */

import { useQuery } from '@tanstack/react-query';
import { fetchActiveEndpoints } from '@/api/metrics';
import type { ActiveEndpointsResponse } from '@/types/metrics';

/**
 * Chave de cache -> exportada para permitir invalidação manual noutros contextos.
 */
export const ACTIVE_ENDPOINTS_KEY = 'activeEndpoints';

/**
 * minutes: janela de lookback —> default 1440 (24h)
 * O componente de filtros pode passar um valor diferente se necessário
 */
export function useActiveEndpoints(minutes: number = 1440) {
  return useQuery<ActiveEndpointsResponse, Error>({
    queryKey: [ACTIVE_ENDPOINTS_KEY, minutes],

    queryFn: () => fetchActiveEndpoints(minutes),

    // Polling a 60 segundos -> a lista de endpoints muda muito menos
    // frequentemente do que as métricas de latência e error rate
    refetchInterval: 60_000,

    // staleTime: 30 segundos -> evita refetches desnecessários
    staleTime: 30_000,

    // Retenta até 2 vezes em caso de erro de rede
    retry: 2,
  });
}
