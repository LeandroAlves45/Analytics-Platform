/**
 * Testes de contrato para BullMQAggregationQueue.
 *
 * Verificamos a camada de idempotência ao nível da fila:
 * - jobId e deduplication.id devem ser idênticos (defesa em profundidade)
 * - TTL deve ser o intervalo convertido em milissegundos
 * - O payload deve conter windowStart como Date
 *
 * Se alguém alterar buildAggregationJobId ou as opções de deduplication
 * sem atualizar o outro, estes testes falham antes de chegar a produção.
 */

import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { BullMQAggregationQueue } from '@infra/queue/BullMQAggregationQueue';
import type { ScheduleAggregationRequest } from '@application/dto/AggregationDTO';
import { TEST_WORKSPACE_ID } from '../../../fixtures/metrics';

jest.mock('bullmq');

describe('BullMQAggregationQueue', () => {
  let mockAdd: jest.Mock;

  const BASE_REQUEST: ScheduleAggregationRequest = {
    workspaceId: TEST_WORKSPACE_ID,
    endpoint: '/api/users',
    method: 'GET',
    intervalMinutes: 5,
  };

  beforeEach(() => {
    mockAdd = jest.fn().mockResolvedValue(undefined);
    (Queue as jest.MockedClass<typeof Queue>).mockImplementation(
      () =>
        ({
          add: mockAdd,
          close: jest.fn().mockResolvedValue(undefined),
        }) as unknown as Queue
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('scheduleAggregation -> deduplication contract', () => {
    it('should pass identical jobId and deduplication.id to Queue.add', async () => {
      const service = new BullMQAggregationQueue({} as Redis);

      await service.scheduleAggregation(BASE_REQUEST);

      const [, , options] = mockAdd.mock.calls[0] as [
        unknown,
        unknown,
        { jobId: string; deduplication: { id: string } },
      ];
      expect(options.jobId).toBeDefined();
      expect(options.jobId).toBe(options.deduplication.id);
    });

    it('should set deduplication TTL to intervalMinutes in milliseconds', async () => {
      const service = new BullMQAggregationQueue({} as Redis);

      await service.scheduleAggregation({ ...BASE_REQUEST, intervalMinutes: 60 });

      const [, , options] = mockAdd.mock.calls[0] as [
        unknown,
        unknown,
        { deduplication: { ttl: number } },
      ];
      expect(options.deduplication.ttl).toBe(60 * 60 * 1_000);
    });

    it('should include windowStart as a Date in the enqueued payload', async () => {
      const service = new BullMQAggregationQueue({} as Redis);

      await service.scheduleAggregation(BASE_REQUEST);

      const [, payload] = mockAdd.mock.calls[0] as [unknown, { windowStart: unknown }];
      expect(payload.windowStart).toBeInstanceOf(Date);
    });

    it('should propagate errors thrown by Queue.add', async () => {
      mockAdd.mockRejectedValue(new Error('Redis unavailable'));
      const service = new BullMQAggregationQueue({} as Redis);

      await expect(service.scheduleAggregation(BASE_REQUEST)).rejects.toThrow('Redis unavailable');
    });

    it('should use explicit windowStart when provided instead of computing from current time', async () => {
      const explicitWindowStart = new Date('2026-01-01T14:00:00.000Z');
      const service = new BullMQAggregationQueue({} as Redis);

      await service.scheduleAggregation({ ...BASE_REQUEST, windowStart: explicitWindowStart });

      const [, payload] = mockAdd.mock.calls[0] as [unknown, { windowStart: unknown }];
      expect(payload.windowStart).toEqual(explicitWindowStart);
    });
  });
});
