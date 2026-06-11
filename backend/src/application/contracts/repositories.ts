/**
 * Este ficheiro define os contratos (interfaces) que as implementações
 * de persistência devem cumprir. A camada application conhece apenas
 * estas interfaces -> nunca as implementações concretas (Drizzle, Redis, etc).
 */

import { Metric } from '@domain/entities/Metric';
import { ScheduleAggregationRequest, AggregationResult } from '@application/dto/AggregationDTO';
import type {
  QueryAggregatedMetricsInputDTO,
  AggregatedMetricRow,
} from '@application/dto/MetricsQueryDTO';

/**
 * Filtro opcional para leitura de métricas numa janela de agregação específica.
 * Quando presente, a query usa windowStart em vez de "últimos N minutos desde agora".
 */
export interface MetricsWindowFilter {
  endpoint: string;
  method: string;
  windowStart: Date;
}

/**
 * Resultado de uma tentativa de persistência idempotente.
 * - saved: métrica inserida na BD
 * - duplicate: requestId já existia (race ou retry)
 */
export type MetricSaveResult = 'saved' | 'duplicate';

/**
 * Representa um endpoint activo: combinação única de workspace/endpoint/method
 * que teve pelo menos uma métrica num dado intervalo de tempo.
 * Usado pelo AggregationScheduler para descobrir o que agregar.
 */
export interface ActiveEndpoint {
  workspaceId: string;
  endpoint: string;
  method: string;
}

/**
 * Contrato para persistência e leitura de métricas brutas.
 * Implementado por DrizzleMetricsRepository na camada infra.
 */
export interface MetricsRepository {
  // Persiste uma métrica na base de dados.
  save(metric: Metric): Promise<MetricSaveResult>;

  // Verifica se uma métrica com este requestId já foi guardada.
  // Usado para garantir que o mesmo request não é contado duas vezes.
  existsByRequestId(requestId: string): Promise<boolean>;

  // Devolve métricas recentes de um workspace num intervalo de minutos.
  // Com filter, restringe ao par endpoint/method e à janela [windowStart, windowStart + minutes).
  getRecent(workspaceId: string, minutes: number, filter?: MetricsWindowFilter): Promise<Metric[]>;

  // Devolve todos os pares únicos (workspaceId, endpoint, method) que tiveram
  // pelo menos uma métrica nos últimos `minutes` minutos.
  getActiveEndpoints(minutes: number): Promise<ActiveEndpoint[]>;

  // Devolve endpoints ativos de um workspace específico
  // Usado pelo dashboard para popular filtros de consulta
  getActiveEndpointsForWorkspace(workspaceId: string, minutes: number): Promise<ActiveEndpoint[]>;
}

/**
 * Contrato para o serviço de fila (BullMQ).
 * Implementado por BullMQAggregationService na camada infra.
 */
export interface AggregationQueueService {
  // Coloca um job na fila para agregar métricas do workspace/endpoint/método indicados.
  // O worker de agregação processa este job de forma assíncrona.
  // Recebe um DTO tipado em vez de parâmetros soltos para escalar sem breaking changes.
  scheduleAggregation(input: ScheduleAggregationRequest): Promise<void>;
}

/**
 * Contrato para persistência de resultados de agregação.
 * Implementado por DrizzleAggregationRepository na camada infra.
 */
export interface AggregationRepository {
  // Persiste um resultado calculado pelo AggregateMetricsUseCase.
  // Usa upsert idempotente —> retries do worker não geram duplicados.
  save(result: AggregationResult): Promise<void>;
}

/**
 * Contrato para validação de API Keys.
 * Implementado por DrizzleApiKeyRepository na camada infra.
 */
export interface ApiKeyRepository {
  // Devolve o workspaceId associado a esta API key (após verificar o hash).
  // Devolve null se a key não existir ou estiver revogada.
  findWorkspaceIdByKey(apiKey: string): Promise<string | null>;

  // Atualiza o campo last_used_at de uma API key.
  updateLastUsed(apiKey: string): Promise<void>;
}

/**
 * Contrato para leitura das tabelas de agregação (metrics_5min / 1h / 1d).
 * Separado de AggregationRepository (escrita) para respeitar CQS.
 */
export interface AggregationReadRepository {
  // Consulta métricas agregadas num intervalo de tempo.
  // Resultados ordenados por time asc.
  findAggregatedMetrics(input: QueryAggregatedMetricsInputDTO): Promise<AggregatedMetricRow[]>;
}
