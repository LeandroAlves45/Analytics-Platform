/**
 * Testes unitários para AlertEvaluationScheduler.
 */

import { AlertEvaluationScheduler } from '@infra/queue/AlertEvaluationScheduler';
import { EvaluateAlertsUseCase } from '@application/usecases/alerts/EvaluateAlertsUseCase';

async function waitForSchedulerRun(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('AlertEvaluationScheduler', () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('should execute evaluation immediately on start', async () => {
    const execute = jest.fn().mockResolvedValue({
      evaluatedRules: 1,
      triggeredCount: 0,
      resolvedCount: 0,
    });
    const useCase = { execute } as unknown as EvaluateAlertsUseCase;
    const scheduler = new AlertEvaluationScheduler(useCase);

    scheduler.start();

    await waitForSchedulerRun();

    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('should execute again after 60 seconds', async () => {
    const execute = jest.fn().mockResolvedValue({
      evaluatedRules: 0,
      triggeredCount: 0,
      resolvedCount: 0,
    });
    const useCase = { execute } as unknown as EvaluateAlertsUseCase;
    const scheduler = new AlertEvaluationScheduler(useCase);

    scheduler.start();

    await waitForSchedulerRun();

    jest.advanceTimersByTime(60 * 1_000);
    await waitForSchedulerRun();

    expect(execute.mock.calls.length).toBeGreaterThan(1);
  });

  it('should not throw when evaluation fails', async () => {
    const execute = jest.fn().mockRejectedValue(new Error('evaluation_failed'));
    const useCase = { execute } as unknown as EvaluateAlertsUseCase;
    const scheduler = new AlertEvaluationScheduler(useCase);

    scheduler.start();

    await waitForSchedulerRun();

    expect(execute).toHaveBeenCalled();
  });

  it('should stop periodic execution after stop', async () => {
    const execute = jest.fn().mockResolvedValue({
      evaluatedRules: 0,
      triggeredCount: 0,
      resolvedCount: 0,
    });
    const useCase = { execute } as unknown as EvaluateAlertsUseCase;
    const scheduler = new AlertEvaluationScheduler(useCase);

    scheduler.start();
    await waitForSchedulerRun();

    const callsBeforeStop = execute.mock.calls.length;
    scheduler.stop();

    jest.advanceTimersByTime(60 * 1_000);
    await waitForSchedulerRun();

    expect(execute.mock.calls.length).toBe(callsBeforeStop);
  });
});
