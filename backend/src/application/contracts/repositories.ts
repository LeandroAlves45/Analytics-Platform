// repositories.ts
//
// Este ficheiro define os contratos (interfaces) que as implementações
// de persistência devem cumprir. A camada application conhece apenas
// estas interfaces — nunca as implementações concretas (Drizzle, Redis, etc).

import { Metric } from '@domain/entities/Metric';

/** */
/**
 * Contrato para persistência e leitura de métricas brutas.
 * Implementado por DrizzleMetricsRepository na camada infra.
 */
export interface MetricsRepository {
  // Persiste uma métrica na base de dados.
  save(metric: Metric): Promise<void>;

  // Verifica se uma métrica com este requestId já foi guardada.
  // Usado para garantir que o mesmo request não é contado duas vezes.
  existsByRequestId(requestId: string): Promise<boolean>;

  // Devolve métricas recentes de um workspace num intervalo de minutos.
  // Usado pelos workers de agregação para calcular percentis.
  getRecent(workspaceId: string, minutes: number): Promise<Metric[]>;
}

/**
 * Contrato para o serviço de fila (BullMQ).
 * Implementado por BullMQAggregationService na camada infra.
 */
export interface AggregationQueueService {
  // Coloca um job na fila para agregar métricas deste workspace/endpoint.
  // O worker de agregação processa este job de forma assíncrona.
  scheduleAggregation(workspaceId: string, endpoint: string): Promise<void>;
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
