/**
 * Hook React Query para listar regras de alerta.
 * GET /api/alert-rules — polling moderado porque regras mudam raramente.
 *
 * staleTime: 30s — evita refetch imediato após invalidação por mutation, reduzindo
 * pedidos redundantes quando o utilizador cria/edita uma regra.
 * refetchInterval: 60s — mantém a lista sincronizada para mudanças feitas noutras sessões.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { fetchAlertRules } from '@/api/alerts';
import type { AlertRulesListResponse } from '@/types/alerts';

export const ALERT_RULES_KEY = 'alertRules';

export function useAlertRules(): UseQueryResult<AlertRulesListResponse, Error> {
  return useQuery({
    queryKey: [ALERT_RULES_KEY],
    queryFn: fetchAlertRules,
    // Regras mudam só quando o utilizador edita -60s é suficiente.
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 2,
  });
}
