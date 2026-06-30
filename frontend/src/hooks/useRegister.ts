/**
 * Mutation hook para registo — persiste access token em memória e metadata em localStorage.
 * refreshToken nunca tratado em JS — chega via httpOnly cookie.
 */

import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { registerUser } from '@/api/auth';
import { useAuthStore } from '@/stores/authStore';
import type { RegisterInput } from '@/types/auth';

export function useRegister() {
  const setAuth = useAuthStore((state) => state.setAuth);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (input: RegisterInput) => registerUser(input),
    onSuccess: (data) => {
      setAuth({ accessToken: data.accessToken, user: data.user, workspace: data.workspace });
      navigate('/');
    },
  });
}
