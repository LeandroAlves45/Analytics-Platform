/**
 * Tipos de dados para as métricas do dashboard.
 * São usados no contexto de gráficos e KPI cards.
 * Os dados são obtidos do backend via API.
 */

/**
 * Os três intervalos de agregação suportados pelo backend.
 * Cada intervalo consulta uma tabela diferente:
 * 5m -> metrics_5min | 1h -> metrics_1h | 1d -> metrics_1d
 */
export type AggregationInterval = '5m' | '1h' | '1d';

/**
 * Um ponto da série temporal retornado por GET /api/metrics/aggregated.
 * Os campos numéricos são calculados pelo AggregateMetricsUseCase no backend.
 */
export interface AggregatedMetricPoint {
  time: string;

  endpoint: string;
  method: string;

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

  errorRate: number;
  throughputPerSec: number;
}

// Resposta completa de GET /api/metrics/aggregated
export interface AggregatedMetricsResponse {
  workspaceId: string;
  interval: AggregationInterval;
  from: string;
  to: string;
  series: AggregatedMetricPoint[];
}

// Um endpoint ativo no workspace -> retornado por GET /api/endpoints
export interface ActiveEndpoint {
  endpoint: string;
  method: string;
}

// Resposta completa de GET /api/endpoints
export interface ActiveEndpointsResponse {
  workspaceId: string;
  minutes: number;
  endpoints: ActiveEndpoint[];
}

// Parâmetros de query para GET /api/metrics/aggregated
// Usado pelo React Query para construir o URL da requisição
export interface MetricsQueryParams {
  from: string;
  to: string;
  interval: AggregationInterval;
  endpoint?: string;
  method?: string;
}

// Formato de erro normalizado retornado pelo backend
export interface ApiErrorDetail {
  field: string;
  message: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: ApiErrorDetail[];
}

// Wrapper de resposta de erro do backend
export interface ApiErrorResponse {
  error: ApiError;
}
