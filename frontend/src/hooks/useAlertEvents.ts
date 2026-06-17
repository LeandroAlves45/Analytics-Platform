/**
 * Hook React Query para histórico de eventos com filtro de estado.
 * GET /api/alert-events?limit=&status=
 *
 * O queryKey inclui limit e status —> mudar o filtro na AlertEventsPage cria
 * uma nova entrada no cache, mantendo os dados anteriores enquanto o novo pedido corre.
 * Isso elimina o flash de "lista vazia" ao alternar entre Abertos/Resolvidos/Todos.
 *
 * refetchInterval: 30s —> alinhado com o scheduler de avaliação de alertas no backend
 * (ciclo de 60s), garantindo que eventos novos aparecem no máximo 30s após disparo.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { fetchAlertEvents } from '@/api/alerts';
import type { AlertEventsListResponse, AlertEventStatusFilter } from '@/types/alerts';

export const ALERT_EVENTS_KEY = 'alertEvents';

interface AlertEventsOptions {
  limit?: number;
  status?: AlertEventStatusFilter;
}

export function useAlertEvents(
  options: AlertEventsOptions = {}
): UseQueryResult<AlertEventsListResponse, Error> {
  const { limit = 20, status = 'all' } = options;

  return useQuery({
    queryKey: [ALERT_EVENTS_KEY, limit, status],
    queryFn: () => fetchAlertEvents({ limit, status }),
    // Eventos podem surgir a cada minuto (worker) -> polling alinhado com métricas.
    refetchInterval: 30_000,
    staleTime: 0,
    retry: 2,
  });
}
