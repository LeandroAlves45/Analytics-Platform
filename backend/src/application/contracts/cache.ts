/**
 * Contratos de cache definidos na application layer.
 *
 * A application layer define o QUÊ o cache deve fazer, não o COMO.
 * A implementação concreta (Redis, in-memory, etc.) vive em infra/.
 *
 * Seguindo a Dependency Rule da Clean Architecture:
 * - Use cases dependem desta interface, não do ioredis
 * - A infra layer implementa esta interface com Redis
 * - Podemos trocar Redis por outro mecanismo sem tocar nos use cases
 */

import type { Metric } from '@domain/entities/Metric';

/**
 * Contrato para o serviço de cache de métricas.
 *
 * Todas as operações são assíncronas porque implementações reais
 * (Redis, Memcached) fazem I/O de rede.
 */
export interface MetricsCacheService {
  /**
   * Tenta ler métricas recentes do cache para um workspace e janela de tempo.
   *
   * @param workspaceId - UUID do workspace
   * @param minutes - Janela de tempo em minutos
   * @returns Array de métricas se cache hit, null se cache miss
   */
  getRecent(workspaceId: string, minutes: number): Promise<Metric[] | null>;

  /**
   * Guarda métricas recentes no cache para um workspace e janela de tempo.
   *
   * @param workspaceId - UUID do workspace
   * @param minutes - Janela de tempo em minutos
   * @param metrics - Array de métricas a guardar
   */
  setRecent(workspaceId: string, minutes: number, metrics: Metric[]): Promise<void>;

  /**
   * Invalida todas as entradas de cache para um workspace.
   *
   * Chamado após inserção de nova métrica para garantir que
   * a próxima leitura vai à base de dados e obtém dados frescos.
   *
   * @param workspaceId - UUID do workspace cujo cache deve ser invalidado
   */
  invalidate(workspaceId: string): Promise<void>;
}
