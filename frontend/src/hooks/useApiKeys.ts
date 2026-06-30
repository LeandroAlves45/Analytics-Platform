/**
 * Hook React Query para a lista de API keys.
 */

import { useQuery } from '@tanstack/react-query';
import { fetchApiKeys } from '@/api/apiKeys';
import { useAuthStore } from '@/stores/authStore';

export const API_KEYS_KEY = 'apiKeys';

export function useApiKeys() {
  const workspaceId = useAuthStore((state) => state.workspace?.id);

  return useQuery({
    queryKey: [API_KEYS_KEY, workspaceId],
    queryFn: () => fetchApiKeys(workspaceId!),
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
  });
}
