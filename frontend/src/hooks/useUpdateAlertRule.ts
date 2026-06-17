/**
 * Mutation para atualizar regra existente.
 * Invalida tanto a lista como o detalhe — o formulário de edição usa queryKey [ALERT_RULES_KEY, id].
 */

import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { updateAlertRule } from '@/api/alerts';
import { ALERT_RULES_KEY } from '@/hooks/useAlertRules';
import type { AlertRule, UpdateAlertRuleInput } from '@/types/alerts';

interface UpdateAlertRuleVariables {
  id: string;
  input: UpdateAlertRuleInput;
}

export function useUpdateAlertRule(): UseMutationResult<
  AlertRule,
  Error,
  UpdateAlertRuleVariables
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }) => updateAlertRule(id, input),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: [ALERT_RULES_KEY] });
      void queryClient.invalidateQueries({ queryKey: [ALERT_RULES_KEY, variables.id] });
    },
  });
}
