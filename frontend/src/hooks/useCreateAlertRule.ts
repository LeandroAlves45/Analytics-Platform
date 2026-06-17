/**
 * Mutation para criar regra —> invalida a lista após sucesso
 * para a AlertsPage reflectir a nova regra sem refresh manual.
 */

import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { createAlertRule } from '@/api/alerts';
import { ALERT_RULES_KEY } from '@/hooks/useAlertRules';
import type { AlertRule, CreateAlertRuleInput } from '@/types/alerts';

export function useCreateAlertRule(): UseMutationResult<AlertRule, Error, CreateAlertRuleInput> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createAlertRule,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [ALERT_RULES_KEY] });
    },
  });
}
