/**
 * Implementação Null Object do contrato MetricsCacheService.
 *
 * O padrão Null Object fornece uma implementação que não faz nada,
 * eliminando a necessidade de verificar null/undefined nos use cases.
 *
 * Usos:
 * - Testes unitários onde o cache não é relevante para o cenário testado
 * - Ambiente de desenvolvimento quando Redis não está configurado
 * - Bootstrap antes do Redis estar disponível
 *
 * Nunca lança erros. getRecent devolve sempre null (cache miss),
 * setRecent e invalidate resolvem sem efeito.
 */

import type { MetricsCacheService } from '@application/contracts/cache';
import type { Metric } from '@domain/entities/Metric';

export class NoOpMetricsCacheService implements MetricsCacheService {
  // Devolve null para simular cache miss. O repositório vai buscar à BD.
  async getRecent(_workspaceId: string, _minutes: number): Promise<Metric[] | null> {
    return null;
  }

  // Não guarda nada. Sem efeito.
  async setRecent(_workspaceId: string, _minutes: number, _metrics: Metric[]): Promise<void> {
    return;
  }

  // Não invalida nada. Sem efeito.
  async invalidate(_workspaceId: string): Promise<void> {
    return;
  }
}
