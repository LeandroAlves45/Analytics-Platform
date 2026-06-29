/**
 * Estado global de autenticação.
 *
 * Estratégia de armazenamento (httpOnly cookie):
 * - accessToken: memória Zustand APENAS — perde-se em page refresh; interceptor restaura via cookie.
 * - refreshToken: httpOnly cookie gerido pelo backend — nunca acessível em JS.
 * - user + workspace: localStorage (chave 'analytics_auth_meta') — metadata não sensível.
 *
 * Fluxo em page refresh:
 * 1. hydrateFromStorage() restaura user/workspace → isAuthenticated=true (optimista)
 * 2. accessToken=null — primeiro request → 401
 * 3. Interceptor Axios → POST /api/auth/refresh (cookie enviado automaticamente)
 * 4. setAccessToken() armazena novo token em memória → request refeito → dados carregam
 */

import { create } from 'zustand';
import { jwtDecode } from 'jwt-decode';
import type { AuthUser, AuthWorkspace } from '@/types/auth';

const STORAGE_KEY = 'analytics_auth_meta';

/** Apenas metadate -> nunca tokens */
interface PersistedMeta {
  user: AuthUser;
  workspace: AuthWorkspace;
}

interface AuthState {
  /** Token JWT de curto prazo -> Apenas em memória, nunca em localStorage */
  accessToken: string | null;
  user: AuthUser | null;
  workspace: AuthWorkspace | null;
  isAuthenticated: boolean;
  setAuth: (data: { accessToken: string; user: AuthUser; workspace: AuthWorkspace }) => void;
  /** Atualiza apenas o accessToken em memória -> usado pelo interceptor após refresh silencioso */
  setAccessToken: (token: string) => void;
  clearAuth: () => void;
  hydrateFromStorage: () => void;
}

interface JwtClaims {
  exp: number;
  sub: string;
  workspaceId: string;
  email: string;
}

function loadMetaFromStorage(): PersistedMeta | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedMeta) : null;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  workspace: null,
  isAuthenticated: false,

  setAuth: ({ accessToken, user, workspace }) => {
    // Persiste apenas metadata -> nunca tokens
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, workspace }));
    set({ accessToken, user, workspace, isAuthenticated: true });
  },

  setAccessToken: (token) => {
    try {
      const { exp } = jwtDecode<JwtClaims>(token);
      const expired = Date.now() / 1000 > exp - 30;
      set({ accessToken: token, isAuthenticated: !expired });
    } catch {
      set({ accessToken: token, isAuthenticated: true });
    }
  },

  clearAuth: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ accessToken: null, user: null, workspace: null, isAuthenticated: false });
  },

  hydrateFromStorage: () => {
    const meta = loadMetaFromStorage();
    if (!meta) return;

    // Restaura user/workspace — accessToken=null até ao primeiro refresh silencioso.
    // isAuthenticated=true optimista: interceptor trata o 401 → refresh via cookie → retry.
    set({ user: meta.user, workspace: meta.workspace, isAuthenticated: true });
  },
}));
