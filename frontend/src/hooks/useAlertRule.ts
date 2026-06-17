/**
 * Hook React Query para uma regra individual.
 * GET /api/alert-rules/:id — ativado apenas quando id está definido (modo edição).
 *
 * Partilha o mesmo queryKey prefix que useAlertRules ([ALERT_RULES_KEY, id]).
 * Quando useUpdateAlertRule invalida [ALERT_RULES_KEY, id], este hook refaz o fetch
 * automaticamente — o formulário de edição fica sempre sincronizado após update.
 *
 * A asserção `id!` é segura porque `enabled: Boolean(id)` impede a queryFn
 * de correr quando id é undefined.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { fetchAlertRule } from '@/api/alerts';
import { ALERT_RULES_KEY } from '@/hooks/useAlertRules';
import type { AlertRule } from '@/types/alerts';

export function useAlertRule(id: string | undefined): UseQueryResult<AlertRule, Error> {
  return useQuery({
    queryKey: [ALERT_RULES_KEY, id],
    queryFn: () => fetchAlertRule(id!),
    // `enabled: false` evita pedido com id undefined durante mount do formulário
    enabled: Boolean(id),
    staleTime: 0,
    retry: 1,
  });
}
