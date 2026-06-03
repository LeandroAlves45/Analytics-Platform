/**
 * Implementação stub do serviço de fila de agregação.
 * Será substituído por BullMQAggregationService no Passo 7/9.
 * Por enquanto, não faz nada (no-op).
 */

import { AggregationQueueService } from '@application/contracts/repositories';

export class NoOpAggregationQueueService implements AggregationQueueService {
  async scheduleAggregation(): Promise<void> {
    // No-op: não faz nada até termos BullMQ implementado
  }
}
