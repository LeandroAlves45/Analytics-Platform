/**
 * Mutation para revogar API key —> invalida a lista após sucesso.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { revokeApiKey } from '@/api/apiKeys';
import { API_KEYS_KEY } from '@/hooks/useApiKeys';

export function useRevokeApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (apiKeyId: string) => revokeApiKey(apiKeyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [API_KEYS_KEY] });
    },
  });
}
