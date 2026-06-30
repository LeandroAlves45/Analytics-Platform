/**
 * Hook de logout — envia POST /api/auth/logout (cookie httpOnly vai automaticamente).
 * O backend revoga o token no Redis e limpa o cookie.
 * clearAuth() remove metadata do localStorage e access token da memória.
 */

import { useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import apiClient from '@/api/client';

export function useLogout() {
  const clearAuth = useAuthStore((state) => state.clearAuth);

  return useCallback(async () => {
    // Sem body — cookie httpOnly enviado automaticamente pelo browser
    try {
      await apiClient.post('/api/auth/logout');
    } catch {
      // Logout local sempre acontece mesmo que o servidor falhe
    } finally {
      clearAuth();
      window.location.href = '/login';
    }
  }, [clearAuth]);
}
