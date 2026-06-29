/**
 * Hook de logout — revoga o refresh token no servidor antes de limpar o estado local.
 * Garante que o token Redis não sobrevive ao logout.


import { useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import apiClient from '@/api/client';

export function useLogout() {
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  return useCallback(async () => {
    // Tenta revogar o token no servidor -> se falhar, faz logout local na mesma
    try {
      if (refreshToken) {
        await apiClient.post('/api/auth/logout', { refreshToken });
      }
    } catch {
      // Logout local sempre acontece independentemente do servidor
    } finally {
      clearAuth();
      window.location.href = '/login';
    }
  }, [refreshToken, clearAuth]);
}
*/
