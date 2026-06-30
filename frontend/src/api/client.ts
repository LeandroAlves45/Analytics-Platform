/**
 * Cliente HTTP centralizado para comunicação com o backend.
 * Toda a comunicação HTTP do frontend passa por este ficheiro.
 */

import axios, { AxiosError } from 'axios';
import { ApiErrorResponse } from '@/types/metrics';
import { useAuthStore } from '@/stores/authStore';

/**
 * Cria a instância Axios com configuração base.
 */
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Timeout de 10 segundos
  timeout: 10_000,
  withCredentials: true,
});

/** Request interceptor — injecta access token em cada pedido autenticado */
apiClient.interceptors.request.use(async (config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** Evita múltiplos refreshes simultâneos (race condition entre requests paralelos). */
let isRefreshing = false;

/**
 * Fila de requests que falharam com 401 enquanto o refresh estava em curso.
 * Após refresh bem-sucedido, cada callback recebe o novo token e retenta o request.
 */
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}> = [];

function processQueue(error: unknown, token: string | null): void {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error as Error);
    } else {
      resolve(token!);
    }
  });
  failedQueue = [];
}

/** Response interceptor — refresh silencioso via cookie httpOnly em 401 */
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as typeof error.config & { _retry?: boolean };

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Endpoints de auth nunca fazem refresh -> logout direto para evitar loops infinitos
    if (originalRequest.url?.includes('/api/auth/')) {
      useAuthStore.getState().clearAuth();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    // Outro request já está a fazer refresh ->  encadear na fila
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((newToken) => {
        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      // Cookie httpOnly enviado automaticamente - sem body, sem refreshToken em JS
      const { data } = await apiClient.post<{ data: { accessToken: string } }>('/api/auth/refresh');
      const { accessToken } = data.data;

      useAuthStore.getState().setAccessToken(accessToken);
      processQueue(null, accessToken);

      originalRequest.headers = originalRequest.headers ?? {};
      originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      useAuthStore.getState().clearAuth();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

/**
 * Interceptor de resposta — normaliza erros do backend.
 * O backend retorna erros no formato: { error: { code, message, details } }
 *
 * Este interceptor captura AxiosError e lança um Error standard
 * com a mensagem do backend, preservando o código e os detalhes
 * em propriedades custom para consumo nos hooks.
 */
apiClient.interceptors.response.use(
  // Resposta com sucesso
  (response) => response,

  // Resposta com erro -> normaliza para ApiErrorResponse
  (error: AxiosError<ApiErrorResponse>) => {
    // Se o backend retornou uma resposta estruturada com o campo error
    if (error.response?.data?.error) {
      const apiError = error.response.data.error;

      // Cria um Error com a mensagem do backend como mensagem principal
      const normalizedError = new Error(apiError.message) as Error & {
        code: string;
        details?: ApiErrorResponse['error']['details'];
        status: number;
      };

      normalizedError.code = apiError.code;
      normalizedError.details = apiError.details;
      normalizedError.status = error.response.status;

      return Promise.reject(normalizedError);
    }

    // Erro de rede (sem resposta do servidor -> backend offline, timeout)
    if (error.code === 'ECONNABORTED' && error.message.includes('timeout')) {
      return Promise.reject(new Error('Request timeout -> backend did not respond in 10s'));
    }

    if (!error.response) {
      return Promise.reject(new Error('Network error -> could not reach the backend'));
    }

    // Qualquer outro erro Axios não previsto
    return Promise.reject(error);
  }
);

/**
 * Exporta a instância Axios configurada com o interceptor de resposta.
 */
export default apiClient;
