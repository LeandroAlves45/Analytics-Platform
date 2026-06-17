/**
 * Mutation para eliminar regra.
 * Invalida regras e eventos —> eventos órfãos desaparecem do histórico após cascade no backend.
 *
 * O backend responde 204 No Content sem corpo —> o tipo de retorno da mutation é void.
 * Não existe DeleteAlertRuleResponse; qualquer import desse tipo quebra o TypeScript.
 */

import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { deleteAlertRule } from '@/api/alerts';
import { ALERT_EVENTS_KEY } from '@/hooks/useAlertEvents';
import { ALERT_RULES_KEY } from '@/hooks/useAlertRules';

export function useDeleteAlertRule(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAlertRule,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [ALERT_RULES_KEY] });
      void queryClient.invalidateQueries({ queryKey: [ALERT_EVENTS_KEY] });
    },
  });
}
