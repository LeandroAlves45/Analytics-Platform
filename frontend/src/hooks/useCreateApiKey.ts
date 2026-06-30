/**
 * Mutation para criar API key —> invalida a lista após sucesso.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createApiKey } from '@/api/apiKeys';
import { useAuthStore } from '@/stores/authStore';
import { API_KEYS_KEY } from '@/hooks/useApiKeys';

export function useCreateApiKey() {
  const queryClient = useQueryClient();
  const workspaceId = useAuthStore((state) => state.workspace?.id);

  return useMutation({
    mutationFn: (name: string) => {
      if (!workspaceId) {
        return Promise.reject(new Error('Workspace not loaded'));
      }
      return createApiKey(workspaceId, name);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [API_KEYS_KEY] });
    },
  });
}
