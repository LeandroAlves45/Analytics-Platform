/**
 * DTOs para consulta de métricas agregadas (Read API).
 *
 * Separados de MetricsDTO.ts (ingestão) porque:
 * - Input/output de leitura têm shape diferente
 * - O dashboard consome séries temporais, não métricas individuais
 */

/** Granularidades suportadas pelo dashboard — mapeiam para metrics_5min / 1h / 1d */
export type AggregationInterval = '5m' | '1h' | '1d';

/**
 * Input do QueryAggregatedMetricsUseCase
 * Valores já validados e normalizados pelo controller (Zod)
 */
export interface QueryAggregatedMetricsInputDTO {
  workspaceId: string;

  // Início do intervalo de consulta (inclusivo)
  from: Date;

  // Fim do intervalo de consulta (exclusivo)
  to: Date;

  // Granularidade da série temporal
  interval: AggregationInterval;

  // Filtro opcional por endpoint
  endpoint?: string;

  // Filtro opcional por método
  method?: string;
}

/**
 * Um ponto da série temporal devolvida ao dashboard.
 * Inclui campos derivados calculados no use case (errorRate, throughputPerSec).
 */
export interface AggregatedMetricPointDTO {
  // Ínicio da janela de agregação
  time: Date;

  endpoint: string;
  method: string;

  // Total de requests na janela
  count: number;

  latencyP50: number;
  latencyP75: number;
  latencyP95: number;
  latencyP99: number;
  latencyAvg: number;
  latencyMin: number;
  latencyMax: number;

  status2xxCount: number;
  status3xxCount: number;
  status4xxCount: number;
  status5xxCount: number;

  // (status4xxCount + status5xxCount) / count — 0 quando count === 0
  errorRate: number;

  // count / duração_da_janela_em_segundos
  throughputPerSec: number;
}

/** Output do QueryAggregatedMetricsUseCase */
export interface QueryAggregatedMetricsOutputDTO {
  workspaceId: string;
  interval: AggregationInterval;
  from: Date;
  to: Date;
  series: AggregatedMetricPointDTO[];
}

/**
 * Input do ListActiveEndpointsUseCase
 */
export interface ListActiveEndpointsInputDTO {
  workspaceId: string;

  // Lookback em minutos -> default 1440 (1 dia)
  minutes: number;
}

/** Um endpoint ativo no workspace */
export interface ActiveEndpointDTO {
  endpoint: string;
  method: string;
}

/** Output do ListActiveEndpointsUseCase */
export interface ListActiveEndpointsOutputDTO {
  workspaceId: string;
  minutes: number;
  endpoints: ActiveEndpointDTO[];
}

/**
 *  Linha bruta lida da BD antes de calcular campos derivados
 * Usada internamente entre repositories e use cases
 */
export interface AggregatedMetricRow {
  time: Date;
  endpoint: string;
  method: string;
  count: number;
  latencyP50: number | null;
  latencyP75: number | null;
  latencyP95: number | null;
  latencyP99: number | null;
  latencyAvg: number | null;
  latencyMin: number | null;
  latencyMax: number | null;
  status2xxCount: number | null;
  status3xxCount: number | null;
  status4xxCount: number | null;
  status5xxCount: number | null;
}

/** Mapeamento intervak -> minutos - única fonte de verdade */
export const INTERVAL_TO_MINUTES: Record<AggregationInterval, number> = {
  '5m': 5,
  '1h': 60,
  '1d': 1440,
};
