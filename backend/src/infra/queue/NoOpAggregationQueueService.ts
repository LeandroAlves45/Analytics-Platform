/**
 * Implementação stub do serviço de fila de agregação.
 * O padrão Null Object elimina verificações de null em todo o código
 * que depende de AggregationQueueService. Em vez de "if (queue) queue.schedule()",
 * o código chama sempre queue.scheduleAggregation() sem condições.
 *
 * Usado em:
 * - Testes de integração (elimina BullMQ como dependência de teste)
 * - Ambientes onde a fila não está configurada
 */

import { AggregationQueueService } from '@application/contracts/repositories';
import { ScheduleAggregationRequest } from '@application/dto/AggregationDTO';

export class NoOpAggregationQueueService implements AggregationQueueService {
  async scheduleAggregation(_input: ScheduleAggregationRequest): Promise<void> {
    // No-op: sem BullMQ neste contexto
  }
}
