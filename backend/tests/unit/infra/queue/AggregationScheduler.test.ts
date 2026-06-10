/**
 * Testes unitários para o AggregationScheduler
 */

import { AggregationScheduler } from '@infra/queue/AggregationScheduler';
import type {
  MetricsRepository,
  AggregationQueueService,
  ActiveEndpoint,
} from '@application/contracts/repositories';
import { TEST_WORKSPACE_ID } from '../../../fixtures/metrics';

async function waitForSchedulerRun(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function makeMockRepository(activeEndpoints: ActiveEndpoint[]): jest.Mocked<MetricsRepository> {
  return {
    save: jest.fn(),
    existsByRequestId: jest.fn(),
    getRecent: jest.fn(),
    getActiveEndpoints: jest.fn().mockResolvedValue(activeEndpoints),
  };
}

function makeMockQueue(): jest.Mocked<AggregationQueueService> {
  return {
    scheduleAggregation: jest.fn().mockResolvedValue(undefined),
  };
}

describe('AggregationScheduler', () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('run() -> queuing logic', () => {
    it('should queue 3 jobs per active endpoint (one per granularity)', async () => {
      const activeEndpoints: ActiveEndpoint[] = [
        { workspaceId: TEST_WORKSPACE_ID, endpoint: '/api/users', method: 'GET' },
      ];

      const repository = makeMockRepository(activeEndpoints);
      const queue = makeMockQueue();
      const scheduler = new AggregationScheduler(repository, queue);

      scheduler.start();
      await waitForSchedulerRun();

      expect(queue.scheduleAggregation).toHaveBeenCalledTimes(3);
    });

    it('should queue jobs with intervalMinutes correctly: 5, 60, 1440', async () => {
      const endpoint: ActiveEndpoint = {
        workspaceId: TEST_WORKSPACE_ID,
        endpoint: '/api/users',
        method: 'GET',
      };
      const repository = makeMockRepository([endpoint]);
      const queue = makeMockQueue();
      const scheduler = new AggregationScheduler(repository, queue);

      scheduler.start();
      await waitForSchedulerRun();

      const calledIntervals = queue.scheduleAggregation.mock.calls.map(
        (call) => call[0].intervalMinutes
      );

      expect(calledIntervals).toEqual(expect.arrayContaining([5, 60, 1440]));
    });

    it('should queue jobs for each active endpoint', async () => {
      const endpoints: ActiveEndpoint[] = [
        { workspaceId: TEST_WORKSPACE_ID, endpoint: '/api/users', method: 'GET' },
        { workspaceId: TEST_WORKSPACE_ID, endpoint: '/api/orders', method: 'POST' },
      ];
      const repository = makeMockRepository(endpoints);
      const queue = makeMockQueue();
      const scheduler = new AggregationScheduler(repository, queue);

      scheduler.start();
      await waitForSchedulerRun();

      expect(queue.scheduleAggregation).toHaveBeenCalledTimes(6);
    });

    it('should call getActiveEndpoints with the maximum supported interval (1440 min)', async () => {
      // Garante que o lookback usa Math.max dos intervalos e não um valor hardcoded.
      // Regressão: bug anterior usava getActiveEndpoints(5), o que fazia o scheduler
      // ignorar endpoints de baixo tráfego para as agregações horárias e diárias.
      const repository = makeMockRepository([]);
      const queue = makeMockQueue();
      const scheduler = new AggregationScheduler(repository, queue);

      scheduler.start();
      await waitForSchedulerRun();

      expect(repository.getActiveEndpoints).toHaveBeenCalledWith(1440);
    });

    it('should not queue jobs for inactive endpoints', async () => {
      const repository = makeMockRepository([]);
      const queue = makeMockQueue();
      const scheduler = new AggregationScheduler(repository, queue);

      scheduler.start();
      await waitForSchedulerRun();

      expect(queue.scheduleAggregation).not.toHaveBeenCalled();
    });

    it('should log error and not throw if getActiveEndpoints rejects', async () => {
      const repository = makeMockRepository([]);
      repository.getActiveEndpoints.mockRejectedValue(new Error('db_connection_failed'));
      const queue = makeMockQueue();
      const scheduler = new AggregationScheduler(repository, queue);

      // O scheduler não deve lançar — o erro deve ser capturado e logado internamente.
      scheduler.start();
      await waitForSchedulerRun();

      expect(queue.scheduleAggregation).not.toHaveBeenCalled();
    });

    it('should continue executing even if scheduleAggregation fails at one endpoint', async () => {
      const endpoint: ActiveEndpoint[] = [
        { workspaceId: TEST_WORKSPACE_ID, endpoint: '/api/users', method: 'GET' },
        { workspaceId: TEST_WORKSPACE_ID, endpoint: '/api/orders', method: 'POST' },
      ];
      const repository = makeMockRepository(endpoint);
      const queue = makeMockQueue();

      queue.scheduleAggregation
        .mockRejectedValueOnce(new Error('queue_full'))
        .mockResolvedValue(undefined);

      const scheduler = new AggregationScheduler(repository, queue);

      scheduler.start();
      await waitForSchedulerRun();

      expect(queue.scheduleAggregation).toHaveBeenCalledTimes(6);
    });
  });

  describe('periodic cycle', () => {
    it('should execute again after 5 minutes interval', async () => {
      const repository = makeMockRepository([
        { workspaceId: TEST_WORKSPACE_ID, endpoint: '/api/users', method: 'GET' },
      ]);
      const queue = makeMockQueue();
      const scheduler = new AggregationScheduler(repository, queue);

      scheduler.start();
      await waitForSchedulerRun();

      const calledAfterFirst = queue.scheduleAggregation.mock.calls.length;

      jest.advanceTimersByTime(5 * 60 * 1_000);
      await waitForSchedulerRun();

      expect(queue.scheduleAggregation.mock.calls.length).toBeGreaterThan(calledAfterFirst);
    });
  });

  describe('lifecycle', () => {
    it('should call start() twice without creating multiple timers', async () => {
      const repository = makeMockRepository([
        { workspaceId: TEST_WORKSPACE_ID, endpoint: '/api/users', method: 'GET' },
      ]);
      const queue = makeMockQueue();
      const scheduler = new AggregationScheduler(repository, queue);

      scheduler.start();
      scheduler.start();
      await waitForSchedulerRun();

      expect(queue.scheduleAggregation).toHaveBeenCalledTimes(3);
    });

    it('should call stop() and cancel the execution of the next cycle', async () => {
      const repository = makeMockRepository([
        { workspaceId: TEST_WORKSPACE_ID, endpoint: '/api/users', method: 'GET' },
      ]);
      const queue = makeMockQueue();
      const scheduler = new AggregationScheduler(repository, queue);

      scheduler.start();
      await waitForSchedulerRun();

      const callBeforeStop = queue.scheduleAggregation.mock.calls.length;

      scheduler.stop();
      jest.advanceTimersByTime(5 * 60 * 1_000);
      await waitForSchedulerRun();

      expect(queue.scheduleAggregation.mock.calls.length).toBe(callBeforeStop);
    });
  });
});
