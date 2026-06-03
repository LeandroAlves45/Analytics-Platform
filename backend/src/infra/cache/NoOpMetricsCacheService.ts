/**
 * Implementação stub do serviço de cache.
 * Será substituído por RedisMetricsCache no Passo 8.
 * Por enquanto, não faz nada (no-op).
 */

import { MetricsCacheService } from '@application/contracts/repositories';

export class NoOpMetricsCacheService implements MetricsCacheService {
  async invalidate(): Promise<void> {
    // No-op: não faz nada até termos Redis implementado
  }
}
