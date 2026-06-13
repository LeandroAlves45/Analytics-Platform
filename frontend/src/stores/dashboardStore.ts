/**
 * Store Zustand para o estado dos filtros do dashboard.
 * Zustand é mais simples que Redux e não precisa de Provider wrapper.
 * O estado é global, qualquer componente pode ler ou atualizar os filtros.
 *
 * Arquitectura de dados:
 * Este store guarda os parâmetros de filtro que os hooks React Query
 * usam para construir os pedidos ao backend.
 * Quando um filtro muda, os hooks reagem automaticamente e fazem
 * um novo pedido com os parâmetros actualizados.
 */

import { create } from 'zustand';
import type { AggregationInterval } from '@/types/metrics';

/**
 * Calcula o timestamp "from" a partir do intervalo e da janela de tempo.
 * Esta função é usada para inicializar o store e para o botão "Last 24h".
 */
function computeFrom(interval: AggregationInterval): string {
  const now = new Date();

  // Cada intervalo tem uma janela de visualização recomendada:
  // 5m -> última hora (12 pontos de 5 min)
  // 1h -> últimas 24 horas (24 pontos de 1h)
  // 1d -> últimos 30 dias (30 pontos de 1d)
  const windowMs: Record<AggregationInterval, number> = {
    '5m': 60 * 60 * 1000,
    '1h': 24 * 60 * 60 * 1000,
    '1d': 30 * 24 * 60 * 60 * 1000,
  };

  return new Date(now.getTime() - windowMs[interval]).toISOString();
}

// Estrutura do estado do store
interface DashboardState {
  // Filtros do tempo
  interval: AggregationInterval;
  from: string;
  to: string;

  // Filtros de endpoint
  selectedEndpoint: string | undefined;
  selectedMethod: string | undefined;

  // Ações que os componentes podem chamar para atualizar o estado
  setInterval: (interval: AggregationInterval) => void;
  setEndpoint: (endpointIds: string | undefined) => void;
  setMethod: (method: string | undefined) => void;
  setDateRange: (from: string, to: string) => void;

  // Atualiza o campo "to" para "agora" -> chamado pelo polling
  // O React Query atualiza os dados, mas o "to" tem que avançar
  // para que o backend não retorne sempre a mesma janela
  refreshTo: () => void;

  // Repõe todos os filtros para os valores default
  reset: () => void;
}

// Estado inicial -> intervalo 1h, janela das últimas 24 horas, sem filtros de endpoint
const DEFAULT_INTERVAL: AggregationInterval = '1h';

export const useDashboardStore = create<DashboardState>((set) => ({
  interval: DEFAULT_INTERVAL,
  from: computeFrom(DEFAULT_INTERVAL),
  to: new Date().toISOString(),
  selectedEndpoint: undefined,
  selectedMethod: undefined,

  // Quando o intervalo muda, atualiza o "from"
  setInterval: (interval) =>
    set({
      interval,
      from: computeFrom(interval),
      to: new Date().toISOString(),
    }),

  // Filtro de endpoint -> undefined limpa o filtro (mostra todos os endpoints)
  setEndpoint: (endpoint) => set({ selectedEndpoint: endpoint }),

  // Filtro do método -> undefined limpa o filtro
  setMethod: (method) => set({ selectedMethod: method }),

  // Range de datas manual -> para um date range picker no futuro
  setDateRange: (from, to) => set({ from, to }),

  // Avança o "to" para o momento actual -> chamado pelo polling
  refreshTo: () => set({ to: new Date().toISOString() }),

  // Reset completo -> volta ao estado inicial
  reset: () =>
    set({
      interval: DEFAULT_INTERVAL,
      from: computeFrom(DEFAULT_INTERVAL),
      to: new Date().toISOString(),
      selectedEndpoint: undefined,
      selectedMethod: undefined,
    }),
}));
