/**
 * Cliente HTTP centralizado para comunicação com o backend.
 * Toda a comunicação HTTP do frontend passa por este ficheiro.
 *
 * Decisão de design: um único interceptor de resposta normaliza todos os erros
 * para o formato ApiError definido em src/types/metrics.ts.
 * Isso garante que os hooks e componentes nunca lidam com a estrutura
 * raw do axios (AxiosError) —> apenas com ApiError.
 */

import axios, { AxiosError } from 'axios';
import { ApiErrorResponse } from '@/types/metrics';

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
});

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
