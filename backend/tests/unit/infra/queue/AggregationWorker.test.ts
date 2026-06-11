/**
 * Testes unitários para AggregationWorker.
 *
 * Estratégia: o Worker BullMQ é substituído por um mock que captura
 * o processor passado ao constructor. Chamar capturedProcessor(job)
 * equivale a simular um job a ser consumido pelo BullMQ em produção.
 */

import { Worker, type Job } from 'bullmq';
import type { Redis } from 'ioredis';
import { AggregationWorker } from '@infra/queue/AggregationWorker';
import type { AggregateMetricsUseCase } from '@application/usecases/aggregation/AggregateMetricsUseCase';
import type { AggregationRepository } from '@application/contracts/repositories';
import type { ScheduleAggregationInput, AggregationResult } from '@application/dto/AggregationDTO';
import { TEST_WORKSPACE_ID } from '../../../fixtures/metrics';

jest.mock('bullmq');

type JobProcessor = (job: Job<ScheduleAggregationInput>) => Promise<void>;

describe('AggregationWorker', () => {
  let capturedProcessor: JobProcessor;
  let mockWorkerClose: jest.Mock;
  let mockUseCase: { execute: jest.Mock };
  let mockRepository: jest.Mocked<AggregationRepository>;

  const WINDOW_START = new Date('2026-01-01T10:00:00.000Z');

  const BASE_RESULT: AggregationResult = {
    workspaceId: TEST_WORKSPACE_ID,
    endpoint: '/api/users',
    method: 'GET',
    intervalMinutes: 5,
    windowStart: WINDOW_START,
    processedCount: 0,
    hasData: false,
  };

  beforeEach(() => {
    mockWorkerClose = jest.fn().mockResolvedValue(undefined);

    (Worker as jest.MockedClass<typeof Worker>).mockImplementation((_name, processor) => {
      capturedProcessor = processor as JobProcessor;
      return {
        on: jest.fn(),
        close: mockWorkerClose,
        concurrency: 1,
      } as unknown as Worker<unknown>;
    });

    mockUseCase = {
      execute: jest.fn().mockResolvedValue(BASE_RESULT),
    };

    mockRepository = {
      save: jest.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  function makeJob(windowStart: Date | string): Job<ScheduleAggregationInput> {
    return {
      id: 'job-1',
      data: {
        workspaceId: TEST_WORKSPACE_ID,
        endpoint: '/api/users',
        method: 'GET',
        intervalMinutes: 5,
        windowStart: windowStart as unknown as Date,
      },
      attemptsMade: 0,
    } as unknown as Job<ScheduleAggregationInput>;
  }

  function makeWorker(): AggregationWorker {
    return new AggregationWorker(
      mockUseCase as unknown as AggregateMetricsUseCase,
      mockRepository,
      {} as Redis
    );
  }

  describe('process() -> windowStart round-trip JSON deserialization', () => {
    it('should reconstruct windowStart as Date when BullMQ delivers an ISO string', async () => {
      // BullMQ serializa os dados do trabalho via JSON.stringify/parse, convertendo Date → ISO string.
      // O worker deve reconstruir a data antes de passar para o use case.
      makeWorker();

      await capturedProcessor(makeJob(WINDOW_START.toISOString()));

      const { windowStart } = mockUseCase.execute.mock.calls[0][0] as ScheduleAggregationInput;
      expect(windowStart).toBeInstanceOf(Date);
    });

    it('should produce the same timestamp whether windowStart arrives as Date or ISO string', async () => {
      makeWorker();

      await capturedProcessor(makeJob(WINDOW_START.toISOString()));
      const fromString = (mockUseCase.execute.mock.calls[0][0] as ScheduleAggregationInput)
        .windowStart;

      mockUseCase.execute.mockClear();

      await capturedProcessor(makeJob(WINDOW_START));
      const fromDate = (mockUseCase.execute.mock.calls[0][0] as ScheduleAggregationInput)
        .windowStart;

      expect(fromString.getTime()).toBe(fromDate.getTime());
    });
  });

  describe('process() -> orchestration', () => {
    it('should call the use case with the correct input', async () => {
      makeWorker();

      await capturedProcessor(makeJob(WINDOW_START));

      expect(mockUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: TEST_WORKSPACE_ID,
          endpoint: '/api/users',
          method: 'GET',
          intervalMinutes: 5,
        })
      );
    });

    it('should persist the aggregation result via the repository', async () => {
      makeWorker();

      await capturedProcessor(makeJob(WINDOW_START));

      expect(mockRepository.save).toHaveBeenCalledWith(BASE_RESULT);
    });

    it('should propagate use case errors so BullMQ can apply retry backoff', async () => {
      mockUseCase.execute.mockRejectedValue(new Error('db_connection_failed'));
      makeWorker();

      await expect(capturedProcessor(makeJob(WINDOW_START))).rejects.toThrow(
        'db_connection_failed'
      );
    });
  });

  describe('close()', () => {
    it('should delegate to the underlying BullMQ Worker', async () => {
      const worker = makeWorker();

      await worker.close();

      expect(mockWorkerClose).toHaveBeenCalled();
    });
  });
});
