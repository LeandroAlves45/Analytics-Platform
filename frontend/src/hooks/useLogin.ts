/**
 * Mutation hook para login — persiste access token em memória e metadata em localStorage.
 * refreshToken nunca tratado em JS — chega via httpOnly cookie.
 */

import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { loginUser } from '@/api/auth';
import { useAuthStore } from '@/stores/authStore';
import type { LoginInput } from '@/types/auth';

export function useLogin() {
  const setAuth = useAuthStore((state) => state.setAuth);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (input: LoginInput) => loginUser(input),
    onSuccess: (data) => {
      setAuth({ accessToken: data.accessToken, user: data.user, workspace: data.workspace });
      navigate('/');
    },
  });
}
