/**
 * Atalho para o widget do dashboard —> últimos eventos abertos.
 * Encapsula limit=5 e status=open para não repetir params em RecentAlertsWidget.
 *
 * Usa queryKey distinto de useAlertEvents ([ALERT_EVENTS_KEY, 'recent', 5]) para evitar
 * que o widget do dashboard e a AlertEventsPage partilhem o mesmo cache —> cada um
 * tem polling e filtros diferentes.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { fetchAlertEvents } from '@/api/alerts';
import { ALERT_EVENTS_KEY } from '@/hooks/useAlertEvents';
import type { AlertEventsListResponse } from '@/types/alerts';

const RECENT_OPEN_LIMIT = 5;

export function useRecentAlertEvents(): UseQueryResult<AlertEventsListResponse, Error> {
  return useQuery({
    queryKey: [ALERT_EVENTS_KEY, 'recent', RECENT_OPEN_LIMIT],
    queryFn: () => fetchAlertEvents({ limit: RECENT_OPEN_LIMIT, status: 'open' }),
    refetchInterval: 30_000,
    staleTime: 0,
    retry: 2,
  });
}
