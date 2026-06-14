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
import { computeMetricsWindow } from '@/lib/metrics-window';
import type { AggregationInterval } from '@/types/metrics';

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

  // Repõe todos os filtros para os valores default
  reset: () => void;
}

// Estado inicial -> intervalo 1h, janela das últimas 24 horas, sem filtros de endpoint
const DEFAULT_INTERVAL: AggregationInterval = '1h';
const initialWindow = computeMetricsWindow(DEFAULT_INTERVAL);

export const useDashboardStore = create<DashboardState>((set) => ({
  interval: DEFAULT_INTERVAL,
  from: initialWindow.from,
  to: initialWindow.to,
  selectedEndpoint: undefined,
  selectedMethod: undefined,

  // Quando o intervalo muda, atualiza o "from"
  setInterval: (interval) => {
    const window = computeMetricsWindow(interval);
    set({
      interval,
      from: window.from,
      to: window.to,
    });
  },

  // Filtro de endpoint -> undefined limpa o filtro (mostra todos os endpoints)
  setEndpoint: (endpoint) => set({ selectedEndpoint: endpoint }),

  // Filtro do método -> undefined limpa o filtro
  setMethod: (method) => set({ selectedMethod: method }),

  // Range de datas manual -> para um date range picker no futuro
  setDateRange: (from, to) => set({ from, to }),

  reset: () => {
    const window = computeMetricsWindow(DEFAULT_INTERVAL);
    set({
      interval: DEFAULT_INTERVAL,
      from: window.from,
      to: window.to,
      selectedEndpoint: undefined,
      selectedMethod: undefined,
    });
  },
}));
