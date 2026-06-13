/**
 * Ponto de entrada da aplicação React
 * Este ficheiro monta o componente raiz no elemento #root do index.html
 *
 * QueryClientProvider (React Query):
 *   Fornece o cliente de cache a todos os hooks useQuery da aplicação.
 *   Sem este provider, useAggregatedMetrics e useActiveEndpoints falham.
 *
 * StrictMode (React):
 *   Activa verificações adicionais em desenvolvimento.
 *   Em produção não tem efeito no comportamento.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import App from './App';

/**
 * Cria o cliente React Query com configuração global.
 * Estas configurações são defaults para todos os hooks useQuery da app —>
 * cada hook pode sobrescrever.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Por defeito, não refaz pedidos ao montar o componente se os dados já estão no cache.
      refetchOnMount: false,

      // Não retenta por defeito -> cada hook pode configurar o retry.
      retry: false,

      // Dados consideradis stale imediatamente
      staleTime: 0,
    },
  },
});

/**
 * Obtém o elemento root do DOM
 * O "!" diz ao TypeScript que temos a certeza que o elemento existe
 */
const rootElement = document.getElementById('root')!;

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
);
